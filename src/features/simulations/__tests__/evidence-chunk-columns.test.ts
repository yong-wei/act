import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@/lib/student-model-artifact-contract';
import { decodeVesselTraceColumns, encodeVesselTraceColumns } from '../evidence-chunk-columns';
import { MAX_VESSEL_EVIDENCE_BYTES, recoveryTraceReference, simulationOssLocation, simulationOssReference,
  VESSEL_TRACE_COLUMNS } from '../evidence-reference';
import type { VesselTraceChunkData } from '../run-evidence';

const runRef = '00000000-0000-4000-8000-000000000001';
const metadata = { schema: 'act.vessel-trace-chunk.v1', runRef, chunkIndex: 0,
  controlStart: 0, nativeStart: 0, parameterHash: 'hash', endTimeS: 5 };

function makeChunk(points: unknown[], extra: Record<string, unknown> = {}) {
  return { ...metadata, points, nativeSamples: [], changes: [], ...extra } as VesselTraceChunkData;
}

function packedSections(section: unknown, numeric = new Uint8Array()) {
  const descriptor = new TextEncoder().encode(JSON.stringify([
    'act.vessel-trace-columns.v1', metadata, [section, [0, ['values', []]], null, [0, ['values', []]]],
  ]));
  const bytes = new Uint8Array(4 + descriptor.byteLength + numeric.byteLength);
  new DataView(bytes.buffer).setUint32(0, descriptor.byteLength, true);
  bytes.set(descriptor, 4);
  bytes.set(numeric, 4 + descriptor.byteLength);
  return bytes;
}

describe('无损浮点列采样格式', () => {
  it('保留Float64边界、未知嵌套数据、null与可选字段', () => {
    const values = [Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -0, Math.PI, 0.10000000000000002];
    const chunk = makeChunk(values.map((value, index) => ({
      numeric: value, vectors: [value, index], reading: index % 2 ? null : value,
      mixed: index === 0 ? null : { order: index, token: { '保留键': '海况\n🌊' } },
      options: { stable: true, next: undefined },
    })));
    const packed = encodeVesselTraceColumns(chunk)!;
    const decoded = decodeVesselTraceColumns(packed) as typeof chunk;
    expect(canonicalJson(decoded)).toBe(canonicalJson(chunk));
    expect(decoded).not.toHaveProperty('fineSamples');
    const withFine = { ...chunk, fineStart: 0, fineSamples: [] };
    expect(decodeVesselTraceColumns(encodeVesselTraceColumns(withFine)!)).toHaveProperty('fineSamples', []);
  });

  it('同一正文即使对象键顺序不同仍得到逐字一致的紧凑内容', () => {
    const one = makeChunk([{ d: 1, mixed: { b: 2, a: 3 } }, { mixed: null, d: 4 }]);
    const two = makeChunk([{ mixed: { a: 3, b: 2 }, d: 1 }, { d: 4, mixed: null }]);
    expect(encodeVesselTraceColumns(one)).toEqual(encodeVesselTraceColumns(two));
  });

  it('将相同前缀中两种编码和不同传输长度绑定到独立对象键', () => {
    const hash = 'a'.repeat(64);
    const old = simulationOssReference(runRef, 'chunk', 2, hash, 99);
    const compact = simulationOssReference(runRef, 'chunk', 2, hash, 99, VESSEL_TRACE_COLUMNS);
    const second = simulationOssReference(runRef, 'chunk', 2, hash, 100, VESSEL_TRACE_COLUMNS);
    expect(new Set([old, compact, second].map(ref => simulationOssLocation(ref).key)).size).toBe(3);
    expect([old, compact].map(ref => recoveryTraceReference(ref, false))).toEqual([old, '']);
    expect(recoveryTraceReference(compact, true)).toBe(compact);
    expect(() => simulationOssReference(runRef, 'checkpoint', 2, hash, 99, VESSEL_TRACE_COLUMNS)).toThrow();
  });

  it('拒绝非法布局、重复字段、截断与多余字节', () => {
    expect(() => decodeVesselTraceColumns(packedSections([121, ['constant', 0]]))).toThrow();
    expect(() => decodeVesselTraceColumns(packedSections([1, ['object', ['a', 'a'], [['constant', 1], ['constant', 2]]]]))).toThrow();
    expect(() => decodeVesselTraceColumns(packedSections([1, ['object', ['__proto__'], [['constant', null]]]]))).toThrow();
    expect(() => decodeVesselTraceColumns(packedSections([3, ['values', [1, 2]]]))).toThrow();
    expect(() => decodeVesselTraceColumns(packedSections([1, ['float64']], new Uint8Array(7)))).toThrow();
    expect(() => decodeVesselTraceColumns(packedSections([1, ['constant', 0]], new Uint8Array(1)))).toThrow();
    const nonfinite = new Uint8Array(8);
    new DataView(nonfinite.buffer).setFloat64(0, Infinity, true);
    expect(() => decodeVesselTraceColumns(packedSections([1, ['float64']], nonfinite))).toThrow();
  });

  it('限制可展开的样本体积并允许写入端回退原格式', () => {
    const repeated = 'x'.repeat(Math.ceil(MAX_VESSEL_EVIDENCE_BYTES / 120));
    expect(() => decodeVesselTraceColumns(packedSections([120, ['constant', repeated]]))).toThrow('展开后超过');
    expect(encodeVesselTraceColumns(makeChunk(Array(120).fill(repeated)))).toBeUndefined();
  });
});
