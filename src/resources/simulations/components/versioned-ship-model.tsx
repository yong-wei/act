'use client';

/**
 * 版本化模型包的共享挂载边界：质量档位 → 主舰 LOD 的唯一映射、
 * 就绪前保留当前模型、候选失败进入旧模型候选链。
 *
 * 共享加载器职责（spec: simulation-scene-visual-pipeline）：
 * - 档位切换只在下一 LOD 就绪后替换主舰 GLB，不重置仿真/相机/世界变换；
 * - 已可见模型的替换失败保持当前模型继续挂载；
 * - 首次候选加载失败沿 legacy 候选链回退（FallbackGltfModel 语义）。
 * 实验自有场景代码不得另建第二套重试状态机。
 *
 * 激活 LOD 的首选仍是公开存储，但首帧只挂同源镜像；
 * 短超时 HEAD 探测成功后再切到公开地址，避免对未接通域名 useGLTF。
 */

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';

import { FallbackGltfModel, ModelAssetErrorBoundary } from './fallback-gltf-model';
import {
  shipLodMountPlan,
  type VersionedModelPackageDescriptor,
} from '../model-packages/type055-nanchang-101-v2';

function uniqueUrls(urls: readonly string[]): string[] {
  return [...new Set(urls)];
}

/** 后台预载下一 LOD；加载完成前不渲染任何东西，失败由外层边界吞掉并保持当前模型。 */
function LodPrefetch({ url, onReady }: { url: string; onReady: () => void }) {
  useGLTF(url, true, true);
  useEffect(() => { onReady(); }, [url, onReady]);
  return null;
}

function LodPrefetchChain({
  urls,
  onReady,
}: {
  urls: readonly string[];
  onReady: (url: string) => void;
}) {
  const url = urls[0];
  if (!url) return null;
  const rest = urls.slice(1);
  return (
    <ModelAssetErrorBoundary
      key={url}
      fallback={rest.length > 0 ? <LodPrefetchChain urls={rest} onReady={onReady} /> : null}
    >
      <Suspense fallback={null}>
        <LodPrefetch url={url} onReady={() => onReady(url)} />
      </Suspense>
    </ModelAssetErrorBoundary>
  );
}

export function VersionedShipModel({
  descriptor,
  tier,
  legacyCandidates,
  renderScene,
}: {
  descriptor: VersionedModelPackageDescriptor;
  tier: 'high' | 'medium' | 'low';
  /** 旧模型候选链（现有 browser-delivery registry 解析结果），作为最终回退。 */
  legacyCandidates: readonly string[];
  renderScene: (url: string) => ReactNode;
}) {
  const { preferred, local } = shipLodMountPlan(descriptor, tier);
  const [committedUrl, setCommittedUrl] = useState(local);
  const publicReady = committedUrl === preferred;

  useEffect(() => {
    setCommittedUrl(local);
  }, [local]);

  useEffect(() => {
    if (preferred === local || !preferred.startsWith('https://')) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1500);
    fetch(preferred, { method: 'HEAD', mode: 'cors', signal: controller.signal })
      .then((response) => {
        if (response.ok) setCommittedUrl(preferred);
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [preferred, local]);

  const mountCandidates = publicReady
    ? uniqueUrls([preferred, local, ...legacyCandidates])
    : uniqueUrls([local, ...legacyCandidates]);

  return (
    <>
      <FallbackGltfModel
        candidates={mountCandidates}
        render={renderScene}
      />
      {publicReady || mountCandidates.includes(committedUrl) ? null : (
        <LodPrefetchChain urls={[local]} onReady={setCommittedUrl} />
      )}
    </>
  );
}
