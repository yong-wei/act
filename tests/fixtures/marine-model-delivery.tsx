import { Suspense, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { WebGPURenderer } from 'three/webgpu';
import { VersionedShipModel } from '../../src/resources/simulations/components/versioned-ship-model';
import { HeroModelBasis } from '../../src/resources/simulations/components/hero-model-basis';
import { TYPE055_NANCHANG_101_V2 } from '../../src/resources/simulations/model-packages/type055-nanchang-101-v2';
import { cloneSkinnedScene } from '../../src/resources/simulations/model-packages/clone-skinned-scene';

declare global {
  interface Window {
    __modelDelivery?: { url: string; api: string; matrix: readonly number[] };
    __disposeModelDelivery?: () => void;
  }
}
function VisibleAsset({ url, api }: { url: string; api: string }) {
  const { scene } = useGLTF(url, true, true);
  const model = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    cloned.traverse(object => { object.frustumCulled = false; });
    return cloned;
  }, [scene]);
  useEffect(() => {
    window.__modelDelivery = { url, api, matrix: TYPE055_NANCHANG_101_V2.modelToSceneMatrix! };
  }, [url, api]);
  return <HeroModelBasis matrix={TYPE055_NANCHANG_101_V2.modelToSceneMatrix}><primitive object={model} /></HeroModelBasis>;
}
/** 直接打包当前消费者，免除跨Origin转接Next开发热更新对分发验收的干扰。 */
export async function mount(api: 'webgl' | 'webgpu') {
  const renderer = new WebGPURenderer({ forceWebGL: api === 'webgl' });
  await renderer.init();
  const backend = renderer.backend as unknown as { isWebGLBackend?: boolean; isWebGPUBackend?: boolean };
  const identity = backend.isWebGLBackend ? 'WebGLBackend' : backend.isWebGPUBackend ? 'WebGPUBackend' : 'unknown';
  const div = document.createElement('div'); div.style.cssText = 'width:100vw;height:100vh'; document.body.append(div);
  const root = createRoot(div);
  root.render(<Canvas gl={renderer as never} camera={{ position: [150, 140, 300], near: 0.1, far: 2000 }}>
    <ambientLight intensity={2} /><directionalLight position={[100, 100, 100]} intensity={3} />
    <Suspense fallback={null}><VersionedShipModel descriptor={TYPE055_NANCHANG_101_V2} tier="low" legacyCandidates={[]}
      renderScene={url => <VisibleAsset url={url} api={identity} />} /></Suspense>
  </Canvas>);
  window.__disposeModelDelivery = () => { root.unmount(); renderer.dispose(); div.remove(); };
}
