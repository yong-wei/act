import {
  ALLOWED_ASSIGNMENT_ASSET_FORMATS,
  isAllowedAssignmentAsset,
  normalizeAssignmentAssetMimeType,
  SUBMISSION_LIMITS,
} from '@/lib/assignments/submission-domain';

export type StudentResponseAsset = {
  id: string;
  displayName: string;
  mimeType?: string;
  sizeBytes?: number;
  role?: string;
  orderIndex?: number | null;
  embeddedPosition?: string | null;
};

export type StudentUploadErrorPayload = {
  error?: string;
  message?: string;
  metadata?: {
    allowedFormats?: string[];
    limit?: number;
    fields?: Array<{ field?: string; code?: string }>;
  };
};

export const STUDENT_ASSIGNMENT_ALLOWED_FORMATS =
  ALLOWED_ASSIGNMENT_ASSET_FORMATS.join('、');

export function preflightAssignmentFiles(
  files: Array<Pick<File, 'name' | 'type' | 'size'>>,
  occupiedAssetCount: number,
) {
  const accepted: Array<Pick<File, 'name' | 'type' | 'size'>> = [];
  const errors: Array<{ fileName: string; message: string }> = [];
  let remaining = Math.max(0, SUBMISSION_LIMITS.assets - occupiedAssetCount);
  for (const file of files) {
    const mimeType = normalizeAssignmentAssetMimeType(file.name, file.type);
    if (!isAllowedAssignmentAsset(file.name, mimeType)) {
      errors.push({
        fileName: file.name,
        message: `文件“${file.name}”格式不受支持。允许格式：${STUDENT_ASSIGNMENT_ALLOWED_FORMATS}。`,
      });
      continue;
    }
    if (file.size <= 0 || file.size > SUBMISSION_LIMITS.file) {
      errors.push({
        fileName: file.name,
        message: file.size <= 0
          ? `文件“${file.name}”为空，不能上传。`
          : `文件“${file.name}”超过单文件 ${SUBMISSION_LIMITS.file / 1024 / 1024} MB 限制。`,
      });
      continue;
    }
    if (remaining === 0) {
      errors.push({
        fileName: file.name,
        message: `文件“${file.name}”无法添加：正文图片与独立附件合计最多 ${SUBMISSION_LIMITS.assets} 个。`,
      });
      continue;
    }
    accepted.push(file);
    remaining -= 1;
  }
  return { accepted, errors };
}

export function localizedStudentSubmissionError(
  payload: StudentUploadErrorPayload,
  fallback: string,
): string {
  const limit = Number(payload.metadata?.limit);
  const messages: Record<string, string> = {
    'answer-asset-limit-exceeded': `正文图片与独立附件合计最多 ${Number.isFinite(limit) ? limit : SUBMISSION_LIMITS.assets} 个。`,
    'unsupported-assignment-asset-format': `附件格式不受支持。允许格式：${(payload.metadata?.allowedFormats ?? ALLOWED_ASSIGNMENT_ASSET_FORMATS).join('、')}。`,
    'answer-version-conflict': '答案已在其他位置更新，已恢复服务器中的最新内容，请重试。',
    'asset-order-set-mismatch': '附件列表已变化，已恢复服务器中的最新顺序，请重新排序。',
    'answer-evidence-required': '请填写答案正文或添加至少一个附件。',
    'asset-integrity-mismatch': '附件完整性校验失败，请重新选择文件。',
    'submission-quota-exceeded': '上传额度已用完，请移除不需要的附件后重试。',
    'rate-limited': '操作过于频繁，请稍后重试。',
    'assignment-forbidden': '当前作业权限已变化，请返回任务中心刷新。',
    'answer-asset-not-found': '附件已不存在，请刷新本题后重试。',
    'asset-read-forbidden': '当前附件不可访问，请刷新本题后重试。',
    'assignment-deadline-closed': '作业已截止，当前不能修改。',
    'answer-already-submitted': '本题已经提交，当前不能修改。',
    'invalid-embedded-asset-reference': '正文图片引用已变化，请重新载入后再保存。',
    'upload-intent-not-found': '上传确认已过期，请重新选择文件。',
    'asset-not-finalizable': '附件当前无法确认，请重新选择文件。',
  };
  if (payload.error && messages[payload.error]) return messages[payload.error];
  const fieldIssue = payload.metadata?.fields?.[0];
  if (fieldIssue?.code === 'unsupported-assignment-asset-format'
    || ['fileName', 'mimeType'].includes(fieldIssue?.field ?? '')) {
    return messages['unsupported-assignment-asset-format'];
  }
  if (fieldIssue?.field === 'sizeBytes') {
    return `附件超过单文件 ${SUBMISSION_LIMITS.file / 1024 / 1024} MB 限制。`;
  }
  if (fieldIssue?.field === 'checksum') {
    return messages['asset-integrity-mismatch'];
  }
  if (fieldIssue?.field === 'embeddedAssets'
    || fieldIssue?.field === 'assetIds') {
    return messages['answer-asset-limit-exceeded'];
  }
  if (fieldIssue?.field === 'text') {
    return `答案正文超过 ${SUBMISSION_LIMITS.text} 字符限制。`;
  }
  return fallback;
}

export function independentAssets<T extends StudentResponseAsset>(
  assets: readonly T[],
): T[] {
  return assets
    .filter((asset) => asset.role !== 'EMBEDDED_IMAGE')
    .sort((left, right) =>
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER)
      - (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id));
}

export function embeddedAssetReferences(
  markdown: string,
  assets: readonly StudentResponseAsset[],
): Array<{ assetId: string; positionRef: string }> | null {
  const positions = [
    ...markdown.matchAll(/\basset:(md:[a-zA-Z0-9_-]{1,80})\b/g),
  ].map((match) => match[1]);
  if (new Set(positions).size !== positions.length) return null;
  const byPosition = new Map(
    assets
      .filter((asset) => asset.role === 'EMBEDDED_IMAGE' && asset.embeddedPosition)
      .map((asset) => [asset.embeddedPosition!, asset.id]),
  );
  const references = positions.map((positionRef) => ({
    positionRef,
    assetId: byPosition.get(positionRef) ?? '',
  }));
  return references.some((reference) => !reference.assetId)
    ? null
    : references;
}

export function moveIndependentAssetIds(
  assetIds: readonly string[],
  assetId: string,
  targetIndex: number,
): string[] {
  const currentIndex = assetIds.indexOf(assetId);
  if (currentIndex < 0) return [...assetIds];
  const boundedTarget = Math.max(0, Math.min(assetIds.length - 1, targetIndex));
  const next = [...assetIds];
  next.splice(currentIndex, 1);
  next.splice(boundedTarget, 0, assetId);
  return next;
}
