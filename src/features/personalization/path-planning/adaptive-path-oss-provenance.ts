/**
 * 候选资源 → Runtime OSS 对象键解析与读取验证记录（Issue #2033）。
 *
 * Runtime 教学资产以 `/api/course-runtime/assets/<assetPath>` 提供（OSS blob-view
 * 内 assetPath 即对象键）；`/api/course-runtime/blob-assets/<sha256>` 为内容寻址键。
 * 非 runtime 资产（站内路由等）如实标记 non-runtime，不计入 OSS 指标。
 */

export interface AdaptivePathResourceOssProvenance {
  resourceId: string;
  target: string;
  state: 'runtime-object-key' | 'blob-content-key' | 'non-runtime';
  objectKey: string | null;
}

export type AdaptivePathObjectKeyReadState = 'verified' | 'missing' | 'forbidden' | 'checksum-mismatch' | 'unverified';

export interface AdaptivePathObjectKeyReadRecord {
  objectKey: string;
  resourceId: string;
  candidateStyleId: string;
  nodeNodeId: string;
  state: AdaptivePathObjectKeyReadState;
  /** 与 Runtime manifest 一致的内容校验值（verified 时提供）。 */
  contentSha256: string | null;
  verifiedAt: string;
  /** 本次读取验证所针对的活动 Runtime release；验证不可用时为 null。 */
  runtimeReleaseId: string | null;
}

export function resolveAdaptivePathRuntimeObjectKey(target: string | null | undefined): {
  state: 'runtime-object-key' | 'blob-content-key' | 'non-runtime';
  objectKey: string | null;
} {
  if (!target) return { state: 'non-runtime', objectKey: null };
  const assetsPrefix = '/api/course-runtime/assets/';
  if (target.startsWith(assetsPrefix)) {
    const objectKey = target.slice(assetsPrefix.length).split('?')[0];
    return objectKey.length > 0 ? { state: 'runtime-object-key', objectKey } : { state: 'non-runtime', objectKey: null };
  }
  const blobPrefix = '/api/course-runtime/blob-assets/';
  if (target.startsWith(blobPrefix)) {
    const sha256 = target.slice(blobPrefix.length).split('?')[0];
    return sha256.length > 0 ? { state: 'blob-content-key', objectKey: `blob:${sha256}` } : { state: 'non-runtime', objectKey: null };
  }
  return { state: 'non-runtime', objectKey: null };
}

/** 读取验证端口：由 runtime release store 在批次定稿时实现。 */
export interface AdaptivePathObjectKeyVerifier {
  verify(objectKey: string): Promise<{ state: 'verified' | 'missing' | 'forbidden' | 'checksum-mismatch'; contentSha256: string | null }>;
}

export async function verifyAdaptivePathObjectKeys(
  verifier: AdaptivePathObjectKeyVerifier,
  entries: Array<{ objectKey: string; resourceId: string; candidateStyleId: string; nodeNodeId: string }>,
  verifiedAt: string,
  runtimeReleaseId: string | null = null,
): Promise<AdaptivePathObjectKeyReadRecord[]> {
  const records: AdaptivePathObjectKeyReadRecord[] = [];
  const verifiedByKey = new Map<string, { state: 'verified' | 'missing' | 'forbidden' | 'checksum-mismatch'; contentSha256: string | null }>();
  for (const entry of entries) {
    let result: { state: 'verified' | 'missing' | 'forbidden' | 'checksum-mismatch'; contentSha256: string | null };
    try {
      const cached = verifiedByKey.get(entry.objectKey);
      if (cached) {
        result = cached;
      } else {
        result = await verifier.verify(entry.objectKey);
        verifiedByKey.set(entry.objectKey, result);
      }
    } catch {
      result = { state: 'missing', contentSha256: null };
    }
    records.push({
      objectKey: entry.objectKey,
      resourceId: entry.resourceId,
      candidateStyleId: entry.candidateStyleId,
      nodeNodeId: entry.nodeNodeId,
      state: result.state,
      contentSha256: result.contentSha256,
      verifiedAt,
      runtimeReleaseId,
    });
  }
  return records;
}
