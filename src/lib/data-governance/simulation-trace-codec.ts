import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import type { EncodedSimulationTrace } from '@/lib/control-engine/evidence-cpu-pool';

export const MAX_SIMULATION_CHUNK_BYTES = 4 * 1024 * 1024;
const compress = promisify(gzip);
const decompress = promisify(gunzip);

export async function encodeSimulationTrace(value: unknown): Promise<EncodedSimulationTrace> {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  if (bytes.byteLength > MAX_SIMULATION_CHUNK_BYTES) throw new Error('原始采样分块过大，请缩短单次上传区间。');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const compressed = await compress(bytes, { level: 3 });
  return { checksum, uncompressedBytes: bytes.byteLength, compressed };
}

export async function decodeSimulationTrace(compressed: Uint8Array, checksum: string): Promise<unknown> {
  if (compressed.byteLength > MAX_SIMULATION_CHUNK_BYTES) throw new Error('原始采样分块大小无效。');
  const bytes = await decompress(compressed, { maxOutputLength: MAX_SIMULATION_CHUNK_BYTES });
  if (createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('原始采样分块校验失败。');
  return JSON.parse(bytes.toString('utf8')) as unknown;
}
