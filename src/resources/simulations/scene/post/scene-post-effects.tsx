'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { pass, screenUV, vec2, float } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';

import { useSceneQuality } from '../quality/quality-state';

/** 后处理链：泛光 + 暗角，高档加 SMAA；低档整体关闭（quality 模块驱动）。 */
function NodePostEffects() {
  const renderer = useThree(state => state.gl) as unknown as WebGPURenderer;
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const { tier, params } = useSceneQuality();
  const bundle = useMemo(() => {
    if (!params.postEnabled) return null;
    const pipeline = new RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode('output');
    const glow = bloom(color, 0.35, 0.2, 0.85);
    const vignette = float(1).sub(screenUV.sub(vec2(0.5)).length().smoothstep(0.18, 0.75).mul(0.55));
    const antialias = tier === 'high' ? smaa(color) : null;
    pipeline.outputNode = (antialias?.getTextureNode() ?? color).add(glow).mul(vignette);
    return { pipeline, scenePass, glow, antialias };
  }, [renderer, scene, camera, tier, params.postEnabled]);
  useEffect(() => () => { bundle?.pipeline.dispose(); bundle?.scenePass.dispose(); bundle?.glow.dispose(); bundle?.antialias?.dispose(); }, [bundle]);
  useFrame(() => {
    if (bundle) bundle.pipeline.render();
    else renderer.render(scene, camera);
  }, 1);
  return null;
}
export function ScenePostEffects() {
  const renderer = useThree(state => state.gl);
  return 'isWebGPURenderer' in renderer ? <NodePostEffects /> : <LegacyPostEffects />;
}
function LegacyPostEffects() {
  const { tier, params } = useSceneQuality();
  if (!params.postEnabled) return null;
  return (
    <EffectComposer multisampling={tier === 'high' ? 0 : 4}>
      <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      {tier === 'high' ? <SMAA /> : <></>}
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
    </EffectComposer>
  );
}
