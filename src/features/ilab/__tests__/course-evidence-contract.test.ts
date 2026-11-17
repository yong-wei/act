import { describe, expect, it } from 'vitest';
import { vesselTraceChunkSchema } from '../course-evidence-contract';

const chunk = {
  schema: 'act.vessel-trace-chunk.v1', runRef: '00000000-0000-4000-8000-000000000001',
  chunkIndex: 0, controlStart: 0, nativeStart: 0, parameterHash: 'parameters', endTimeS: 1,
  points: [], changes: [], nativeSamples: [],
};
const sample = (signal: unknown) => ({ signal, measurement: {
  value: null, t_sample_s: 0, t_arrive_s: 1, quality: 'Missing',
} });

describe('原始证据分块结构兼容', () => {
  it('沿用历史UUID格式，保留版本位和变体位未受限的已有运行引用', () => {
    const runRef = '12345678-abcd-0000-0000-123456789abc';
    expect(vesselTraceChunkSchema.parse({ ...chunk, runRef }).runRef).toBe(runRef);
    expect(vesselTraceChunkSchema.safeParse({ ...chunk, runRef: 'invalid-run-reference' }).success).toBe(false);
  });

  it('保留历史分块和传感器联合类型的解析结果', () => {
    const value = { ...chunk, ignored: true, nativeSamples: [sample('Heading'),
      sample({ SurfaceEncoder: 0, ignored: true }), sample({ AzimuthEncoder: 15 }), sample({ ShaftSpeed: 1 }),
      sample({ SurfaceEncoder: 16, ShaftSpeed: 0 }), sample({ SurfaceEncoder: 0, ShaftSpeed: 1 })] };
    const parsed = vesselTraceChunkSchema.parse(value);
    expect(parsed).not.toHaveProperty('ignored');
    expect(parsed.nativeSamples.map(row => row.signal)).toEqual(['Heading', { SurfaceEncoder: 0 },
      { AzimuthEncoder: 15 }, { ShaftSpeed: 1 }, { ShaftSpeed: 0 }, { SurfaceEncoder: 0 }]);
    expect(parsed).not.toHaveProperty('fineStart');
    expect(parsed).not.toHaveProperty('fineSamples');
    expect(parsed.nativeSamples[0].measurement).toEqual(value.nativeSamples[0].measurement);
  });

  it.each(['unknown-sensor', null, {}, { ShaftSpeed: -1 }, { ShaftSpeed: 16 }, { ShaftSpeed: 0.5 }])(
    '拒绝非法仪器标识 %j', (signal) => {
      expect(vesselTraceChunkSchema.safeParse({ ...chunk, nativeSamples: [sample(signal)] }).success).toBe(false);
    },
  );

  it('拒绝非有限采样、无效时间和超过分块上限的数据', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const observed = sample('Heading');
      expect(vesselTraceChunkSchema.safeParse({ ...chunk, nativeSamples: [{ ...observed,
        measurement: { ...observed.measurement, value } }] }).success).toBe(false);
    }
    expect(vesselTraceChunkSchema.safeParse({ ...chunk, endTimeS: -1 }).success).toBe(false);
    expect(vesselTraceChunkSchema.safeParse({ ...chunk, nativeSamples: Array.from({ length: 6001 },
      () => sample('Heading')) }).success).toBe(false);
    expect(vesselTraceChunkSchema.safeParse({ ...chunk, fineStart: 0, fineSamples: [{
      timeS: 1, positionNedM: [0, 0, 0], attitudeDeg: [0, 0, 0], bodyVelocitySi: [0, 0, 0, 0, 0],
      surfaceDeg: [], shaftRpm: [], azimuthDeg: [], motorPowerW: [],
    }] }).success).toBe(false);
  });
});
