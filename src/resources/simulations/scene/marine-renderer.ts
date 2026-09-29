/** 数据后端边界：显式设备、真实身份、生命周期；场景和材质不按 API 分叉。 */
import { WebGPURenderer } from 'three/webgpu';
export type MarineGraphicsApi = 'webgl' | 'webgpu';

const identities = new WeakMap<WebGPURenderer, { api: string; hardware: string | null }>();
type RendererDevice = NonNullable<NonNullable<ConstructorParameters<typeof WebGPURenderer>[0]>['device']> & {
  destroy(): void;
};
interface ComparisonGpuHost {
  requestAdapter(): Promise<{
    info: { vendor: string; architecture: string; device: string; description: string };
    features: Iterable<string>;
    limits: { maxTextureDimension2D: number; maxColorAttachments: number };
    isFallbackAdapter?: boolean;
    requestDevice(descriptor: { requiredFeatures: string[] }): Promise<NonNullable<RendererDevice>>;
  } | null>;
}

export function marineRendererIdentity(renderer: WebGPURenderer) {
  return identities.get(renderer) ?? { api: renderer.backend.constructor.name, hardware: null };
}

export async function createMarineRenderer(canvas: HTMLCanvasElement, api: MarineGraphicsApi) {
  let device: RendererDevice | undefined;
  let hardware: string | null = null;
  if (api === 'webgpu') {
    const gpu = (navigator as Navigator & { gpu?: ComparisonGpuHost }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (!adapter) throw new Error('此设备未能初始化原生 WebGPU。');
    if (adapter.isFallbackAdapter || adapter.limits.maxTextureDimension2D < 2048
      || adapter.limits.maxColorAttachments < 4) {
      throw new Error('图形设备未满足海面渲染所需能力。');
    }
    const info = adapter.info;
    hardware = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' / ') || null;
    device = await adapter.requestDevice({ requiredFeatures: [...adapter.features] });
  }
  const renderer = new WebGPURenderer({ canvas, device, forceWebGL: api === 'webgl', antialias: true });
  const release = renderer.dispose.bind(renderer);
  let disposed = false;
  renderer.dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.onDeviceLost = () => {};
    release();
    // Three.js 不销毁外部传入的 device，由创建它的适配器负责释放。
    device?.destroy();
    identities.delete(renderer);
  };
  try {
    await renderer.init();
    const backend = renderer.backend.constructor.name;
    if (backend !== (api === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend')) {
      throw new Error('实际图形后端与所选接口不一致。');
    }
    if (api === 'webgl') {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('WebGL设备不支持海面所需浮点纹理。');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      hardware = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    }
    identities.set(renderer, { api: backend, hardware });
    return renderer;
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}
