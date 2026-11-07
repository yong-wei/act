/**
 * 仿真运行前置能力探测与失败分类。
 *
 * 面向 #2151：进入正式运行前区分「模型准备（WASM 运行时）—图形准备（渲染后端）—可以运行」，
 * 并把图形失败归类为学生可理解的三类（环境不支持 / 设备丢失 / 初始化缺陷）。
 * 探测结果进程内缓存；`?graphics=webgl|webgpu` 的显式覆盖行为由 MarineCanvas 负责。
 */

import { createMarineRenderer } from '../scene/marine-renderer';
import { preloadVirtualSimulationRuntime } from '../physics/simulation-engine-facade';

export type GraphicsFailureKind = 'context-unavailable' | 'device-lost' | 'init-defect';

export interface GraphicsCapability {
  ok: boolean;
  /** 实际可用的渲染后端；失败时为 null。 */
  backend: 'webgpu' | 'webgl' | null;
  /** 原始异常文本（诊断折叠用），学生文案不直接使用。 */
  detail?: string;
}

export interface ModelCapability {
  ok: boolean;
  detail?: string;
}

/** 按异常特征归类图形失败，供学生面板选择文案。 */
export function classifyGraphicsFailure(error: unknown, options?: { deviceLost?: boolean }): GraphicsFailureKind {
  if (options?.deviceLost) return 'device-lost';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowered = message.toLowerCase();
  if (
    lowered.includes('getsupportedextensions') ||
    lowered.includes('webgl') && lowered.includes('null') ||
    lowered.includes('unable to create') ||
    lowered.includes('context') && lowered.includes('unavailable') ||
    lowered.includes('not supported') ||
    lowered.includes('failed to fetch') && lowered.includes('pipeline')
  ) {
    return 'context-unavailable';
  }
  if (lowered.includes('device') && (lowered.includes('lost') || lowered.includes('removed'))) {
    return 'device-lost';
  }
  return 'init-defect';
}

let cachedGraphics: GraphicsCapability | null = null;

/**
 * 在离屏 canvas 上真实创建渲染上下文探测图形能力（webgpu 失败则回退 webgl）。
 * 结果缓存；探测本身不抛出。
 */
export async function probeGraphicsCapability(): Promise<GraphicsCapability> {
  if (cachedGraphics) return cachedGraphics;
  const canvas = document.createElement('canvas');
  try {
    const renderer = await createMarineRenderer(canvas, 'webgpu');
    renderer.dispose();
    cachedGraphics = { ok: true, backend: 'webgpu' };
    return cachedGraphics;
  } catch {
    // 继续 webgl 回退探测。
  }
  try {
    const renderer = await createMarineRenderer(canvas, 'webgl');
    renderer.dispose();
    cachedGraphics = { ok: true, backend: 'webgl' };
    return cachedGraphics;
  } catch (webglError) {
    cachedGraphics = {
      ok: false,
      backend: null,
      detail: webglError instanceof Error ? webglError.message : String(webglError),
    };
    return cachedGraphics;
  }
}

/** 仅测试用：清除探测缓存。 */
export function resetGraphicsCapabilityCacheForTest(): void {
  cachedGraphics = null;
}

let modelProbe: Promise<ModelCapability> | null = null;

/** 探测 WASM 数值运行时可加载；结果以 Promise 缓存，不重复加载。 */
export function probeModelCapability(): Promise<ModelCapability> {
  if (!modelProbe) {
    modelProbe = preloadVirtualSimulationRuntime()
      .then(() => ({ ok: true }) as ModelCapability)
      .catch((error: unknown) => ({
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      }));
  }
  return modelProbe;
}

/** 仅测试用：重置模型探测缓存。 */
export function resetModelCapabilityCacheForTest(): void {
  modelProbe = null;
}

export type SimulationReadiness = 'preparing-model' | 'preparing-graphics' | 'runnable' | 'unavailable';

export function toSimulationReadiness(model: { ok: boolean } | null, graphics: GraphicsCapability | null): SimulationReadiness {
  if (graphics && !graphics.ok) return 'unavailable';
  if (!model || !model.ok) return 'preparing-model';
  if (!graphics) return 'preparing-graphics';
  return 'runnable';
}

export const READINESS_LABEL: Record<SimulationReadiness, string> = {
  'preparing-model': '模型准备中…',
  'preparing-graphics': '画面准备中…',
  'runnable': '可以运行',
  'unavailable': '当前环境暂不能运行，见画面区说明',
};
