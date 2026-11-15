import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarineRenderer, marineRendererIdentity } from '../scene/marine-renderer';

const mocks = vi.hoisted(() => ({init:vi.fn(),release:vi.fn()}));
vi.mock('three/webgpu', () => ({WebGPURenderer:class {
  backend:object;
  init = mocks.init;
  dispose = mocks.release;
  constructor(options:{forceWebGL:boolean}) {
    this.backend = options.forceWebGL ? {isWebGLBackend:true} : {isWebGPUBackend:true};
  }
  getContext() { return {getExtension:() => ({}),getParameter:() => 'fixture GPU'}; }
}}));

const adapter = (requestDevice:() => Promise<{destroy:() => void}>) => ({
  info:{vendor:'fixture',architecture:'',device:'',description:''},features:[],
  limits:{maxTextureDimension2D:4096,maxColorAttachments:8},requestDevice,
});

beforeEach(() => {
  vi.useFakeTimers();
  mocks.init.mockReset().mockResolvedValue(undefined);
  mocks.release.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('真实渲染器初始化期限与资源释放', () => {
  it('设备适配器持续等待时在五秒后退出', async () => {
    vi.stubGlobal('navigator',{gpu:{requestAdapter:() => new Promise(() => {})}});
    const pending = expect(createMarineRenderer({} as HTMLCanvasElement,'webgpu')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it('设备超时后迟到的结果被销毁，且不会开始绘制初始化', async () => {
    const destroy = vi.fn();
    let finish!:(value:{destroy:() => void}) => void;
    vi.stubGlobal('navigator',{gpu:{requestAdapter:async () => adapter(() => new Promise((resolve) => {finish=resolve;}))}});
    const pending = expect(createMarineRenderer({} as HTMLCanvasElement,'webgpu')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    finish({destroy});
    await Promise.resolve(); await Promise.resolve();
    expect(destroy).toHaveBeenCalledOnce();
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it('绘制初始化超时后释放设备，并清理迟到的渲染资源', async () => {
    const destroy = vi.fn();
    let finish!:() => void;
    mocks.init.mockImplementation(() => new Promise<void>((resolve) => {finish=resolve;}));
    vi.stubGlobal('navigator',{gpu:{requestAdapter:async () => adapter(async () => ({destroy}))}});
    const pending = expect(createMarineRenderer({} as HTMLCanvasElement,'webgpu')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(destroy).toHaveBeenCalledOnce();
    finish();
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.release).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('正常初始化保存真实后端，重复释放只销毁一次设备', async () => {
    const destroy = vi.fn();
    vi.stubGlobal('navigator',{gpu:{requestAdapter:async () => adapter(async () => ({destroy}))}});
    const renderer = await createMarineRenderer({} as HTMLCanvasElement,'webgpu');
    expect(marineRendererIdentity(renderer)).toEqual({api:'WebGPUBackend',hardware:'fixture'});
    renderer.dispose(); renderer.dispose();
    expect(destroy).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
