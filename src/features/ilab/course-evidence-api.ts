import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { EvidenceCpuError } from '@/lib/control-engine/evidence-cpu-pool';
import { IlabServiceError, toIlabHttpError } from './run-lock';

const decompress = promisify(gunzip);
const compress = promisify(gzip);
const MAX_ENCODED_BYTES = 4*1024*1024;

export async function requireVesselEvidenceAccount(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) throw new IlabServiceError('请先登录后保存到平台。',401);
  if (request.headers.get('x-act-preview') === '1') throw new IlabServiceError('当前为预览模式。',403);
  return session.user.id;
}

export async function readVesselEvidenceBytes(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_ENCODED_BYTES) throw new IlabServiceError('原始采样分块过大。',413);
  const reader = request.body?.getReader();
  if (!reader) throw new IlabServiceError('实验数据内容为空。',400);
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_ENCODED_BYTES) { await reader.cancel(); throw new IlabServiceError('原始采样分块过大。',413); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  let bytes = Buffer.concat(parts);
  const encoding = request.headers.get('content-encoding');
  if (encoding && encoding !== 'gzip' && encoding !== 'identity') throw new IlabServiceError('实验数据编码无法识别。',415);
  try {
    if (encoding === 'gzip') bytes = await decompress(bytes,{ maxOutputLength:MAX_ENCODED_BYTES });
    return bytes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') throw new IlabServiceError('原始采样分块过大。',413);
    throw new IlabServiceError('实验数据内容无法解析。',400);
  }
}

export async function readVesselEvidenceJson(request: Request): Promise<unknown> {
  const bytes = await readVesselEvidenceBytes(request);
  try { return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown; }
  catch { throw new IlabServiceError('实验数据内容无法解析。',400); }
}

export function vesselEvidenceErrorResponse(error: unknown) {
  rethrowIfNextDynamicError(error);
  const failure = toIlabHttpError(error instanceof EvidenceCpuError
    ? new IlabServiceError(error.message, error.status) : error);
  const savedProgress = error && typeof error === 'object' && 'savedProgress' in error ? error.savedProgress : undefined;
  return NextResponse.json({ error:failure.message, ...(savedProgress ? { savedProgress } : {}) },{ status:failure.status });
}

/** 本人恢复点和原始分块按客户端声明压缩，私有响应保持逐请求读取。 */
export async function vesselEvidenceJsonResponse(request: Request, value: unknown) {
  const encodings = new Map<string, number>();
  for (const part of (request.headers.get('accept-encoding') ?? '').split(',')) {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith('q='));
    const weight = quality === undefined ? 1 : Number(quality.slice(2));
    encodings.set(name, Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0);
  }
  const acceptsGzip = (encodings.get('gzip') ?? encodings.get('*') ?? 0) > 0;
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    Vary: 'Accept-Encoding',
  });
  let bytes = Buffer.from(JSON.stringify(value));
  if (acceptsGzip && bytes.byteLength >= 1024) {
    bytes = await compress(bytes,{ level:3 });
    headers.set('Content-Encoding', 'gzip');
  }
  headers.set('Content-Length', String(bytes.byteLength));
  return new NextResponse(new Uint8Array(bytes), {headers});
}
