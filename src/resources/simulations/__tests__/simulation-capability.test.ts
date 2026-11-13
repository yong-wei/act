import { describe, expect, it } from 'vitest';

import {
  classifyGraphicsFailure,
  toSimulationReadiness,
  type GraphicsCapability,
} from '../lib/simulation-capability';

describe('classifyGraphicsFailure（#2151 失败分类）', () => {
  it('把扩展列表读取失败归类为环境不支持', () => {
    const error = new Error("Cannot read properties of null (reading 'getSupportedExtensions')");
    expect(classifyGraphicsFailure(error)).toBe('context-unavailable');
  });

  it('显式 deviceLost 优先归类为设备丢失', () => {
    expect(classifyGraphicsFailure(new Error('任意异常'), { deviceLost: true })).toBe('device-lost');
  });

  it('异常文本含 device lost 时归类为设备丢失', () => {
    expect(classifyGraphicsFailure(new Error('WebGPU device lost.'))).toBe('device-lost');
  });

  it('上下文不可用文本归类为环境不支持', () => {
    expect(classifyGraphicsFailure(new Error('WebGL is not supported'))).toBe('context-unavailable');
    expect(classifyGraphicsFailure(new Error('Unable to create WebGL context'))).toBe('context-unavailable');
  });

  it('其余异常归类为初始化缺陷，不透出给学生文案直接判定环境问题', () => {
    expect(classifyGraphicsFailure(new Error('some unexpected TypeError'))).toBe('init-defect');
    expect(classifyGraphicsFailure(undefined)).toBe('init-defect');
    expect(classifyGraphicsFailure('字符串异常')).toBe('init-defect');
  });
});

describe('toSimulationReadiness（三态合成）', () => {
  const graphicsOk: GraphicsCapability = { ok: true, backend: 'webgl' };
  const graphicsFail: GraphicsCapability = { ok: false, backend: null, detail: 'x' };

  it('模型未完成时报告模型准备中', () => {
    expect(toSimulationReadiness(null, graphicsOk)).toBe('preparing-model');
    expect(toSimulationReadiness({ ok: false }, graphicsOk)).toBe('preparing-model');
  });

  it('模型就绪但图形未探测完成时报告画面准备中', () => {
    expect(toSimulationReadiness({ ok: true }, null)).toBe('preparing-graphics');
  });

  it('图形探测失败优先报告不可运行，即使模型仍在准备', () => {
    expect(toSimulationReadiness(null, graphicsFail)).toBe('unavailable');
    expect(toSimulationReadiness({ ok: true }, graphicsFail)).toBe('unavailable');
  });

  it('两者就绪时报告可以运行', () => {
    expect(toSimulationReadiness({ ok: true }, graphicsOk)).toBe('runnable');
  });
});
