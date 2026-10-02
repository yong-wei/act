'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';
import { FallbackGltfModel, ModelAssetErrorBoundary } from './fallback-gltf-model';
import { SemanticBindingsStateProvider } from './semantic-bindings-rig';
import { initialShipArtifactUrls, isShipProxyUrl, shipLodMountPlan, type VersionedModelPackageDescriptor } from '../model-packages/types';
import { prepareShipLod, rememberShipLodUrl, resolvePreparedShipLodUrls, validatePreparedShipLod } from '../model-packages/lod-preparation';

type Props = {
  descriptor: VersionedModelPackageDescriptor;
  tier: 'high' | 'medium' | 'low';
  legacyCandidates: readonly string[];
  renderScene: (url: string) => ReactNode;
  resetToken?: number;
};
const failedPreparations = new Set<string>();
class ParsedShipLodError extends Error {}

function DisplayedLod({ url, onReady, renderScene }: {
  url: string; onReady: (url: string) => void; renderScene: Props['renderScene'];
}) {
  useGLTF(url, true, true);
  useEffect(() => { onReady(url); }, [url, onReady]);
  return <>{renderScene(url)}</>;
}

function PreparingLod({ url, descriptor, onReady }: { url: string; descriptor: Props['descriptor']; onReady: (url: string) => void }) {
  const { scene: model, parser } = useGLTF(url, true, true);
  const renderer = useThree(state => state.gl) as unknown as WebGPURenderer;
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      validatePreparedShipLod(descriptor, { animations: parser.json.animations ?? [], nodes: parser.json.nodes ?? [] });
      return prepareShipLod(renderer, model, camera, scene, () => active);
    }).then(ready => {
      if (ready && active) onReady(url);
    }).catch(error => { if (active) setError(new ParsedShipLodError(error instanceof Error ? error.message : String(error))); });
    return () => { active = false; };
  }, [url, descriptor, model, parser, renderer, camera, scene, onReady]);
  if (error) throw error;
  return null;
}

function PreparingChain({ urls, descriptor, onReady }: { urls: readonly string[]; descriptor: Props['descriptor']; onReady: (url: string) => void }) {
  const [url, ...rest] = urls;
  if (!url) return null;
  return <ModelAssetErrorBoundary key={url} onError={error => {
    // 解析成功后的 GPU/接口准备失败不能使其他可见实例丢掉成功的 useGLTF 缓存。
    if (!(error instanceof ParsedShipLodError)) failedPreparations.add(url);
  }}
    fallback={rest.length ? <PreparingChain urls={rest} descriptor={descriptor} onReady={onReady} /> : null}>
    <Suspense fallback={null}><PreparingLod url={url} descriptor={descriptor} onReady={onReady} /></Suspense>
  </ModelAssetErrorBoundary>;
}

/** 包变更立即重建边界，不能把旧包模型套到新包的坐标与接口上。 */
export function VersionedShipModel(props: Props) {
  const key = props.descriptor.packageId + ':' + props.descriptor.releaseManifestSha256;
  return <SemanticBindingsStateProvider key={key} resetToken={props.resetToken ?? 0}>
    <ProgressiveShipModel {...props} />
  </SemanticBindingsStateProvider>;
}

function ProgressiveShipModel({ descriptor, tier, legacyCandidates, renderScene }: Props) {
  const initial = useMemo(() => Array.from(new Set([
    ...(descriptor.roles['ship-proxy'] ? initialShipArtifactUrls(descriptor.roles['ship-proxy']) : []),
    shipLodMountPlan(descriptor, 'low').local,
    shipLodMountPlan(descriptor, 'medium').local,
    shipLodMountPlan(descriptor, 'high').local,
    ...legacyCandidates,
  ])), [descriptor, legacyCandidates]);
  const [displayedUrl, setDisplayedUrl] = useState(initial[0]);
  const [displayedReady, setDisplayedReady] = useState(false);
  const previousUrl = useRef(initial[0]);
  const visibleUrl = useRef(displayedUrl); visibleUrl.current = displayedUrl;
  const [prepared, setPrepared] = useState<{ key: string; urls: readonly string[] } | null>(null);
  const desired = shipLodMountPlan(descriptor, tier);
  const showingProxy = isShipProxyUrl(descriptor, displayedUrl);
  const low = shipLodMountPlan(descriptor, 'low');
  const requestKey = desired.local + ':' + showingProxy;
  const latestDesired = useRef(requestKey); latestDesired.current = requestKey;
  const displayedIsDesired = displayedUrl === desired.local || displayedUrl === desired.preferred;
  const ready = useCallback((url: string) => {
    rememberShipLodUrl(descriptor, url);
    if (url !== visibleUrl.current) previousUrl.current = visibleUrl.current;
    setDisplayedUrl(url); setDisplayedReady(true);
  }, [descriptor]);
  const replacementReady = useCallback((url: string) => {
    if (latestDesired.current === requestKey && (url === desired.local || url === desired.preferred
      || (showingProxy && (url === low.local || url === low.preferred)))) ready(url);
  }, [requestKey, showingProxy, low.local, low.preferred, desired.local, desired.preferred, ready]);
  useEffect(() => {
    let active = true;
    setPrepared(null);
    if (displayedReady && !displayedIsDesired) {
      void (async () => {
        const first = await resolvePreparedShipLodUrls(descriptor, showingProxy ? 'low' : tier);
        const target = showingProxy && tier !== 'low' ? await resolvePreparedShipLodUrls(descriptor, tier) : [];
        return Array.from(new Set([...first, ...target]));
      })().then(urls => {
        if (!active) return;
        for (const url of urls) if (failedPreparations.delete(url)) useGLTF.clear(url);
        setPrepared({ key: requestKey, urls });
      });
    }
    return () => { active = false; };
  }, [descriptor, tier, displayedReady, displayedIsDesired, showingProxy, requestKey]);
  const visibleCandidates = Array.from(new Set([displayedUrl, previousUrl.current, ...initial]));
  return <>
    <FallbackGltfModel candidates={visibleCandidates}
      onCandidateError={url => failedPreparations.add(url)}
      render={url => <DisplayedLod url={url} onReady={ready} renderScene={renderScene} />} />
    {displayedReady && !displayedIsDesired && prepared?.key === requestKey
      ? <PreparingChain key={requestKey + ':' + prepared.urls.join('|')} urls={prepared.urls} descriptor={descriptor} onReady={replacementReady} /> : null}
  </>;
}
