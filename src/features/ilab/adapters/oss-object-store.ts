import type { Readable } from 'node:stream';
import { simulationOssLocation } from '@/features/simulations/public-api';

const MAX_OBJECT_BYTES = 4 * 1024 * 1024;
const AUTHORIZATION_SECONDS = 300;

type Credential = { accessKeyId: string; accessKeySecret: string; securityToken?: string };
type CredentialClient = { getCredential(): Promise<Credential> };
type OssClient = {
  signPostObjectPolicyV4(policy: unknown, date: Date): string;
  signatureUrlV4(method: string, expires: number, request: { queries?: Record<string, string> }, key: string): Promise<string>;
  head(key: string): Promise<{ res: { headers: Record<string, string> } }>;
  getStream(key: string, options?: { versionId?: string }): Promise<{ stream: Readable }>;
};
let credentialClient: CredentialClient | undefined;

export function simulationEvidenceOssConfigured() {
  return Boolean(process.env.SIMULATION_EVIDENCE_OSS_BUCKET);
}

export function simulationEvidenceDirectUploadEnabled() {
  return simulationEvidenceOssConfigured() && process.env.SIMULATION_EVIDENCE_DIRECT_UPLOAD === '1';
}

function configuration() {
  const bucket = process.env.SIMULATION_EVIDENCE_OSS_BUCKET;
  const region = process.env.SIMULATION_EVIDENCE_OSS_REGION ?? process.env.ACT_RUNTIME_OSS_REGION ?? 'oss-cn-hangzhou';
  if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !/^oss-[a-z0-9-]+$/.test(region)) {
    throw new Error('私有实验存储尚未配置。');
  }
  return { bucket, region, roleName: process.env.SIMULATION_EVIDENCE_OSS_RAM_ROLE ?? process.env.ACT_RUNTIME_OSS_RAM_ROLE };
}

async function client(internal: boolean) {
  const config = configuration();
  if (!credentialClient) {
    const credentials = require('@alicloud/credentials') as {
      default: new (config?: unknown) => CredentialClient;
      Config: new (config: unknown) => unknown;
    };
    credentialClient = config.roleName
      ? new credentials.default(new credentials.Config({ type: 'ecs_ram_role', roleName: config.roleName, disableIMDSv1: true }))
      : new credentials.default();
  }
  const credential = await credentialClient.getCredential();
  if (!credential?.accessKeyId || !credential.accessKeySecret) throw new Error('私有实验存储凭据暂不可用。');
  const Oss = require('ali-oss') as new (options: unknown) => OssClient;
  return { ...config, credential, oss: new Oss({ bucket: config.bucket, region: config.region,
    secure: true, authorizationV4: true, internal: internal && Boolean(config.roleName),
    accessKeyId: credential.accessKeyId, accessKeySecret: credential.accessKeySecret, stsToken: credential.securityToken,
    timeout: 20_000 }) };
}

export interface SimulationOssUploadAuthorization {
  reference: string;
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
}

/** 签名只允许一个不可覆盖对象及精确长度，凭据密钥始终保留在服务器。 */
export async function authorizeSimulationOssUpload(reference: string, storedBytes: number, descriptorHash: string):
Promise<SimulationOssUploadAuthorization> {
  if (!Number.isInteger(storedBytes) || storedBytes < 1 || storedBytes > MAX_OBJECT_BYTES
    || !/^[0-9a-f]{64}$/.test(descriptorHash)) throw new Error('实验对象大小或描述无效。');
  const { key, checksum } = simulationOssLocation(reference);
  const { oss, bucket, region, credential } = await client(false);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTHORIZATION_SECONDS * 1000).toISOString();
  const date = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const scope = `${credential.accessKeyId}/${date.slice(0, 8)}/${region.slice(4)}/oss/aliyun_v4_request`;
  const fields: Record<string, string> = {
    key, 'x-oss-credential': scope, 'x-oss-date': date, 'x-oss-signature-version': 'OSS4-HMAC-SHA256',
    'x-oss-forbid-overwrite': 'true', 'x-oss-content-type': 'application/gzip',
    'x-oss-meta-descriptor': descriptorHash, 'x-oss-meta-sha256': checksum, success_action_status: '200',
    ...(credential.securityToken ? { 'x-oss-security-token': credential.securityToken } : {}),
  };
  const policy = { expiration: expiresAt, conditions: [{ bucket },
    ...Object.entries(fields).map(([name, value]) => ({ [name]: value })),
    ['content-length-range', storedBytes, storedBytes]] };
  return { reference, url: `https://${bucket}.${region}.aliyuncs.com`, expiresAt,
    fields: { ...fields, policy: Buffer.from(JSON.stringify(policy)).toString('base64'),
      'x-oss-signature': oss.signPostObjectPolicyV4(policy, now) } };
}

export interface SimulationOssObjectReceipt {
  etag: string;
  crc64: string;
  versionId?: string;
  storedBytes: number;
}

export async function confirmSimulationOssUpload(reference: string, storedBytes: number, descriptorHash: string):
Promise<SimulationOssObjectReceipt> {
  const { key, checksum } = simulationOssLocation(reference);
  const { oss } = await client(true);
  const { res: { headers } } = await oss.head(key);
  const actualBytes = Number(headers['content-length']);
  const etag = headers.etag;
  const crc64 = headers['x-oss-hash-crc64ecma'];
  if (actualBytes !== storedBytes || actualBytes < 1 || actualBytes > MAX_OBJECT_BYTES
    || headers['content-type'] !== 'application/gzip' || headers['content-encoding']
    || headers['x-oss-version-id']
    || headers['x-oss-meta-descriptor'] !== descriptorHash || headers['x-oss-meta-sha256'] !== checksum
    || !etag || !crc64 || !/^\d+$/.test(crc64)) throw new Error('实验对象的存储回执与上传描述不一致。');
  return { etag, crc64, storedBytes: actualBytes,
    ...(headers['x-oss-version-id'] ? { versionId: headers['x-oss-version-id'] } : {}) };
}

export async function authorizeSimulationOssDownload(reference: string, versionId?: string) {
  const { oss } = await client(false);
  const { key } = simulationOssLocation(reference);
  return { reference, url: await oss.signatureUrlV4('GET', AUTHORIZATION_SECONDS,
    { queries: versionId ? { versionId } : undefined }, key),
    expiresAt: new Date(Date.now() + AUTHORIZATION_SECONDS * 1000).toISOString() };
}

/** 服务端正式核验独立读取压缩正文，解压与正文SHA由已有codec继续核对。 */
export async function readSimulationOssObject(reference: string, versionId?: string) {
  const { oss } = await client(true);
  const { key } = simulationOssLocation(reference);
  const { stream } = await oss.getStream(key, { versionId });
  const parts: Buffer[] = [];
  let length = 0;
  try {
    for await (const part of stream) {
      const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
      length += bytes.byteLength;
      if (length > MAX_OBJECT_BYTES) throw new Error('实验对象大小超过允许范围。');
      parts.push(bytes);
    }
    return Buffer.concat(parts, length);
  } finally { stream.destroy(); }
}
