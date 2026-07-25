'use client';

import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';

import { useSceneQuality } from '../quality/quality-state';

/** 后处理链：泛光 + 暗角，高档加 SMAA；低档整体关闭（quality 模块驱动）。 */
export function ScenePostEffects() {
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
