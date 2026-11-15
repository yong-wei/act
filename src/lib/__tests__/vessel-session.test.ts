import { beforeEach, describe, expect, it, vi } from 'vitest';

const bindings = vi.hoisted(() => ({
  ensure: vi.fn().mockResolvedValue(undefined),
  native: {
    read: vi.fn(), advance: vi.fn(), setPaused: vi.fn(), snapshot: vi.fn(),
    restore: vi.fn(), reset: vi.fn(), free: vi.fn(),
  },
  create: vi.fn(),
}));

vi.mock('../control-engine/wasm-browser', () => ({
  ensureBrowserControlEngine: bindings.ensure,
  createBrowserVesselSessionBinding: bindings.create,
}));

import { createVesselSimulationSessionBrowser } from '../control-engine/vessel-session';

describe('常驻仿真浏览器入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bindings.create.mockReturnValue(bindings.native);
    bindings.native.read.mockReturnValue(JSON.stringify({ schema: 'act.vessel-session.v1', timeS: 1 }));
    bindings.native.advance.mockReturnValue(JSON.stringify({ schema: 'act.vessel-session.v1', timeS: 2 }));
  });

  it('按原始字符串保存与恢复随机状态快照', async () => {
    const snapshot = '{"rng_state":18446744073709551615}';
    bindings.native.snapshot.mockReturnValue(snapshot);
    const session = await createVesselSimulationSessionBrowser({ noiseLevel: 'N2' });
    expect(bindings.ensure).toHaveBeenCalledOnce();
    expect(bindings.create).toHaveBeenCalledWith('{"noiseLevel":"N2"}');
    expect(session.snapshot()).toBe(snapshot);
    session.restore(snapshot);
    expect(bindings.native.restore).toHaveBeenCalledWith(snapshot);
    expect(session.advance(1 / 60).timeS).toBe(2);
    expect(bindings.native.advance).toHaveBeenCalledWith(1 / 60, '');
  });

  it('重复清理只释放一次并拒绝释放后的调用', async () => {
    const session = await createVesselSimulationSessionBrowser();
    session.dispose();
    session.dispose();
    expect(bindings.native.free).toHaveBeenCalledOnce();
    expect(() => session.read()).toThrow('这次仿真已经结束。');
  });

  it('把受控波浪数组原样传给常驻对象', async () => {
    const assets = { firstOrderMetadata: '{"schema":"act.first-order-excitation.v1"}',
      firstOrderData: new Uint8Array([1, 2, 3]),
      fullDifferenceMetadata: '{"schema":"act.full-difference-qtf.v1"}',
      fullDifferenceData: new Uint8Array([4, 5, 6]) };
    await createVesselSimulationSessionBrowser({ environment: 'E1', secondOrderEnabled: true }, assets);
    expect(bindings.create).toHaveBeenCalledWith('{"environment":"E1","secondOrderEnabled":true}', assets);
  });

  it('将构造失败和状态协议错误返回统一错误对象', async () => {
    bindings.create.mockImplementationOnce(() => { throw '入射波浪系数未就绪'; });
    await expect(createVesselSimulationSessionBrowser()).rejects.toMatchObject({
      message: expect.stringContaining('入射波浪系数未就绪'),
    });
    const session = await createVesselSimulationSessionBrowser();
    bindings.native.read.mockReturnValue('{"schema":"obsolete"}');
    expect(() => session.read()).toThrow('仿真状态版本不匹配。');
  });
});
