// Relative imports let the Node load test use the same encoder as the browser worker.
import { canonicalJson } from '../../lib/student-model-artifact-contract/index.ts';
import { MAX_VESSEL_EVIDENCE_BYTES } from './evidence-reference.ts';
import type { VesselTraceChunkData } from './run-evidence';

const schema = 'act.vessel-trace-columns.v1';
const arrayFields = ['points', 'nativeSamples', 'fineSamples', 'changes'] as const;
const sectionLimits = [120, 6000, 800, 512];
const maxDepth = 32;
const floatBytes = 8;
// A finite Float64 needs at most 25 bytes in the existing JSON representation.
const maxNumberTextBytes = 25;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

type Scalar = null | boolean | number | string;
type Column = ['values', unknown[]] | ['constant', Scalar] | ['float64']
  | ['object', string[], Column[]] | ['array', Column[]];

class ExpandedTraceLimit extends Error {}

function invalid(): never {
  throw new Error('实验采样列格式无效，请重新读取记录。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value: unknown): value is Scalar {
  return value === null || typeof value === 'boolean' || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
}

function checkDepth(depth: number) {
  if (depth > maxDepth) throw new ExpandedTraceLimit('实验采样列结构超过允许范围。');
}

function expandedBudget() {
  let remaining = MAX_VESSEL_EVIDENCE_BYTES;
  return (bytes: number) => {
    remaining -= bytes;
    if (remaining < 0) throw new ExpandedTraceLimit('实验采样展开后超过允许范围。');
  };
}

const textBytes = (text: string) => encoder.encode(text).byteLength;
const recordBytes = (keys: string[]) => 2 + textBytes(JSON.stringify(keys)) + keys.length;
const arrayBytes = (length: number) => 2 + Math.max(length - 1, 0);

function floatWord() {
  const bytes = new Uint8Array(floatBytes);
  return { bytes, view: new DataView(bytes.buffer) };
}

/** Store repeated sample layouts once. Numeric columns use byte-shuffled little-endian Float64. */
export function encodeVesselTraceColumns(chunk: VesselTraceChunkData): Uint8Array<ArrayBuffer> | undefined {
  const { points, nativeSamples, fineSamples, changes, ...metadata } = chunk;
  const charge = expandedBudget();
  const numeric: Uint8Array<ArrayBuffer>[] = [];
  const word = floatWord();
  function pack(values: unknown[], depth: number): Column {
    checkDepth(depth);
    const first = values[0];
    if (isScalar(first) && values.every(value => value === first)) {
      charge(textBytes(JSON.stringify(first)) * values.length);
      return ['constant', first];
    }
    if (typeof first === 'number' && values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) {
      charge(maxNumberTextBytes * values.length);
      const column = new Uint8Array(values.length * floatBytes);
      for (let row = 0; row < values.length; row++) {
        // The existing JSON representation normalizes negative zero to zero.
        word.view.setFloat64(0, values[row] || 0, true);
        for (let byte = 0; byte < floatBytes; byte++) column[byte * values.length + row] = word.bytes[byte];
      }
      numeric.push(column);
      return ['float64'];
    }
    if (isRecord(first)) {
      const keys = Object.keys(first).filter(key => first[key] !== undefined).sort();
      if (!keys.includes('__proto__') && values.every((value): value is Record<string, unknown> => isRecord(value)
        && Object.keys(value).filter(key => value[key] !== undefined).length === keys.length
        && keys.every(key => Object.hasOwn(value, key) && value[key] !== undefined))) {
        charge(recordBytes(keys) * values.length);
        return ['object', keys, keys.map(key => pack(values.map(value => value[key]), depth + 1))];
      }
    }
    if (Array.isArray(first) && values.every((value): value is unknown[] => Array.isArray(value) && value.length === first.length)) {
      charge(arrayBytes(first.length) * values.length);
      return ['array', first.map((_, index) => pack(values.map(value => value[index]), depth + 1))];
    }
    const literal = canonicalJson(values);
    charge(textBytes(literal));
    return ['values', JSON.parse(literal) as unknown[]];
  }

  try {
    const metadataText = canonicalJson(metadata);
    charge(textBytes(metadataText) + recordBytes([...arrayFields]));
    const sections = [points, nativeSamples, fineSamples, changes].map((values, index) => {
      if (values === undefined) return null;
      if (values.length > sectionLimits[index]) throw new ExpandedTraceLimit('实验采样数超过允许范围。');
      charge(arrayBytes(values.length));
      return [values.length, pack(values, 0)];
    });
    const descriptor = encoder.encode(JSON.stringify([schema, JSON.parse(metadataText), sections]));
    const length = 4 + descriptor.byteLength + numeric.reduce((sum, column) => sum + column.length, 0);
    if (length > MAX_VESSEL_EVIDENCE_BYTES) return undefined;
    const bytes = new Uint8Array(length);
    new DataView(bytes.buffer).setUint32(0, descriptor.byteLength, true);
    bytes.set(descriptor, 4);
    let offset = 4 + descriptor.byteLength;
    for (const column of numeric) {
      bytes.set(column, offset);
      offset += column.byteLength;
    }
    return bytes;
  } catch (error) {
    if (error instanceof ExpandedTraceLimit) return undefined;
    throw error;
  }
}

/** Decode only a bounded representation. Callers independently verify the decompressed body hash first. */
export function decodeVesselTraceColumns(bytes: Uint8Array): unknown {
  if (bytes.byteLength <= 4 || bytes.byteLength > MAX_VESSEL_EVIDENCE_BYTES) invalid();
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  let offset = length + 4;
  if (length === 0 || offset > bytes.byteLength) invalid();
  const descriptor: unknown = JSON.parse(decoder.decode(bytes.subarray(4, offset)));
  if (!Array.isArray(descriptor) || descriptor.length !== 3) invalid();
  const [version, metadata, sections] = descriptor as unknown[];
  if (version !== schema || !isRecord(metadata) || metadata.schema !== 'act.vessel-trace-chunk.v1'
    || arrayFields.some(key => Object.hasOwn(metadata, key))
    || !Array.isArray(sections) || sections.length !== arrayFields.length) invalid();

  const charge = expandedBudget();
  charge(textBytes(canonicalJson(metadata)) + recordBytes([...arrayFields]));
  const word = floatWord();
  function expand(column: unknown, count: number, depth: number): unknown[] {
    checkDepth(depth);
    if (!Array.isArray(column)) invalid();
    switch (column[0]) {
      case 'values': {
        const values: unknown = column[1];
        if (column.length !== 2 || !Array.isArray(values) || values.length !== count) invalid();
        charge(textBytes(canonicalJson(values)));
        return values;
      }
      case 'constant': {
        const value: unknown = column[1];
        if (column.length !== 2 || !isScalar(value) || count === 0) invalid();
        charge(textBytes(JSON.stringify(value)) * count);
        return Array<Scalar>(count).fill(value);
      }
      case 'float64': {
        if (column.length !== 1 || count === 0 || offset + count * floatBytes > bytes.byteLength) invalid();
        charge(maxNumberTextBytes * count);
        const values = new Array<number>(count);
        for (let row = 0; row < count; row++) {
          for (let byte = 0; byte < floatBytes; byte++) word.bytes[byte] = bytes[offset + byte * count + row];
          const value = word.view.getFloat64(0, true);
          if (!Number.isFinite(value)) invalid();
          values[row] = value;
        }
        offset += count * floatBytes;
        return values;
      }
      case 'object': {
        const keys: unknown = column[1];
        const children: unknown = column[2];
        if (column.length !== 3 || count === 0 || !Array.isArray(keys) || !Array.isArray(children)
          || keys.length !== children.length || !keys.every((key, index) => typeof key === 'string'
            && key !== '__proto__' && (index === 0 || key > keys[index - 1]))) invalid();
        charge(recordBytes(keys) * count);
        const values = children.map(child => expand(child, count, depth + 1));
        return Array.from({ length: count }, (_, row) => {
          const record: Record<string, unknown> = {};
          for (let field = 0; field < keys.length; field++) record[keys[field]] = values[field][row];
          return record;
        });
      }
      case 'array': {
        const children: unknown = column[1];
        if (column.length !== 2 || count === 0 || !Array.isArray(children)) invalid();
        charge(arrayBytes(children.length) * count);
        const values = children.map(child => expand(child, count, depth + 1));
        return Array.from({ length: count }, (_, row) => values.map(value => value[row]));
      }
      default: return invalid();
    }
  }

  const chunk = { ...metadata };
  for (const [index, field] of arrayFields.entries()) {
    const section: unknown = sections[index];
    if (section === null && field === 'fineSamples') continue;
    if (!Array.isArray(section) || section.length !== 2) invalid();
    const [count, column] = section as [number, unknown];
    if (!Number.isSafeInteger(count) || count < 0 || count > sectionLimits[index]) invalid();
    charge(arrayBytes(count));
    chunk[field] = expand(column, count, 0);
  }
  if (offset !== bytes.byteLength) invalid();
  return chunk;
}
