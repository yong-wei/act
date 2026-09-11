/**
 * 候选资源 Runtime OSS 读取验证记录（Issue #2033；#2055 改为绑定驱动）。
 *
 * 对象键来源是节点 runtime 绑定字段（`adaptive-path-runtime-binding.ts`，由教学
 * 投影身份 × 活动 Runtime release manifest 解析），不再从节点导航 target 字符串
 * 反解；对象键形态为 release 资产路径或 `blob:<sha256>` 内容键。
 */

export type AdaptivePathObjectKeyReadState = 'verified' | 'index-verified' | 'missing' | 'forbidden' | 'checksum-mismatch' | 'release-mismatch' | 'unverified';

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

export async function promoteIndexedObjectKeyReads(
  records: AdaptivePathObjectKeyReadRecord[],
  verifier: AdaptivePathObjectKeyVerifier,
  verifiedAt = new Date().toISOString(),
): Promise<AdaptivePathObjectKeyReadRecord[]> {
  const entries = records.filter((record) => record.state === 'index-verified' && !record.objectKey.startsWith('published:'));
  if (entries.length === 0) return records;
  const verified = await verifyAdaptivePathObjectKeys(verifier, entries, verifiedAt, entries[0]?.runtimeReleaseId ?? null);
  const byKey = new Map(verified.map((record) => [
    `${record.candidateStyleId}\0${record.nodeNodeId}\0${record.objectKey}`,
    record,
  ]));
  return records.map((record) => (
    byKey.get(`${record.candidateStyleId}\0${record.nodeNodeId}\0${record.objectKey}`) ?? record
  ));
}
