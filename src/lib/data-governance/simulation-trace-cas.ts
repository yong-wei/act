import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evidenceCpuWorkersEnabled, runEvidenceCpuTask, type EncodedSimulationTrace } from '@/lib/control-engine/evidence-cpu-pool';
import { encodeSimulationTrace, decodeSimulationTrace } from './simulation-trace-codec';
import { readSimulationOssObject } from '@/features/ilab/public-api';
import { simulationOssLocation } from '@/features/simulations/public-api';

const referencePattern = /^simulation-cas:(file|s3):sha256:([0-9a-f]{64})$/;

function privateS3() {
  const endpoint = process.env.SUBMISSION_S3_ENDPOINT;
  const bucket = process.env.SUBMISSION_S3_BUCKET;
  const accessKeyId = process.env.SUBMISSION_S3_ACCESS_KEY;
  const secretAccessKey = process.env.SUBMISSION_S3_SECRET_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, client: new S3Client({ endpoint, forcePathStyle: true,
    region: process.env.SUBMISSION_S3_REGION ?? 'us-east-1', credentials: { accessKeyId,secretAccessKey } }) };
}

function filePath(hash: string) {
  const root = process.env.SIMULATION_EVIDENCE_ROOT ?? path.join(process.cwd(),'data/simulation-evidence');
  return path.join(root,'sha256',hash.slice(0,2),`${hash}.json.gz`);
}

function objectKey(hash: string) { return `simulation-traces/sha256/${hash.slice(0,2)}/${hash}.json.gz`; }

/** SimulationTrace引用的私有原始分块，内容哈希由服务端计算。 */
export async function writeSimulationTraceChunk(value: unknown) {
  const encoded = evidenceCpuWorkersEnabled()
    ? await runEvidenceCpuTask('encode', value) : await encodeSimulationTrace(value);
  return storeEncodedSimulationTrace(encoded);
}

export async function storeEncodedSimulationTrace(encoded: EncodedSimulationTrace) {
  const { checksum: hash, compressed, uncompressedBytes } = encoded;
  const storage = privateS3();
  if (storage) {
    try {
      await storage.client.send(new PutObjectCommand({ Bucket:storage.bucket,Key:objectKey(hash),Body:compressed,
        ContentType:'application/gzip',Metadata:{ 'uncompressed-sha256':hash } }));
    } finally { storage.client.destroy(); }
  } else {
    const target = filePath(hash);
    await mkdir(path.dirname(target),{ recursive:true,mode:0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary,compressed,{ flag:'wx',mode:0o600 });
      await rename(temporary,target);
    } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; }); }
  }
  return { uri:`simulation-cas:${storage ? 's3' : 'file'}:sha256:${hash}`,
    checksum:hash,uncompressedBytes,storedBytes:compressed.byteLength };
}

export async function readSimulationTraceChunk<T>(reference: string): Promise<T> {
  if (reference.startsWith('simulation-cas:oss:')) {
    const location = simulationOssLocation(reference);
    const compressed = await readSimulationOssObject(reference);
    if (location.storedBytes !== undefined && compressed.byteLength !== location.storedBytes) {
      throw new Error('原始采样分块长度不一致。');
    }
    return await decodeSimulationTrace(compressed, location.checksum, location.traceEncoding) as T;
  }
  const match = referencePattern.exec(reference);
  if (!match) throw new Error('原始采样引用无效。');
  const [,backend,hash] = match;
  let compressed: Uint8Array;
  if (backend === 's3') {
    const storage = privateS3();
    if (!storage) throw new Error('原始采样对象存储暂时无法读取。');
    try {
      const result = await storage.client.send(new GetObjectCommand({ Bucket:storage.bucket,Key:objectKey(hash) }));
      if (!result.Body) throw new Error('原始采样分块为空。');
      compressed = await result.Body.transformToByteArray();
    } finally { storage.client.destroy(); }
  } else { compressed = await readFile(filePath(hash)); }
  const value = evidenceCpuWorkersEnabled()
    ? await runEvidenceCpuTask('decode', { compressed, checksum: hash })
    : await decodeSimulationTrace(compressed, hash);
  return value as T;
}
