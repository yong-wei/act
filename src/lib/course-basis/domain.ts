export type CourseBasisActor = {
  id: string;
  role: 'TEACHER' | 'ADMIN';
};

export type CourseBasisSource = {
  sourceType: 'MARKDOWN' | 'PLAIN_TEXT' | 'PASTED_TEXT' | 'SEARCHABLE_PDF';
  sourceName: string;
  mimeType: string;
  content: Uint8Array | string;
};

export type ExtractedCourseBasisSegment = {
  orderIndex: number;
  stableAnchor: string;
  headingPath: string[];
  pageNumber: number | null;
  paragraphNumber: number;
  text: string;
  contentHash: string;
};

export type CourseBasisLifecycle =
  | { state: 'UPLOADING'; label: '上传中'; editable: false; frozen: false }
  | { state: 'PROCESSING'; label: '正在提取'; editable: false; frozen: false }
  | { state: 'EDITABLE'; label: '可编辑'; editable: true; frozen: false }
  | { state: 'FROZEN'; label: '已冻结'; editable: false; frozen: true }
  | { state: 'DISABLED'; label: '已停用'; editable: false; frozen: boolean }
  | { state: 'FAILED'; label: '处理失败'; editable: false; frozen: false };

export type CourseBasisLifecycleInput = {
  extractionState: string;
  reviewState: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  retiredAt?: Date | string | null;
};

export function projectCourseBasisLifecycle(input: CourseBasisLifecycleInput): CourseBasisLifecycle {
  if (input.retiredAt) {
    return { state: 'DISABLED', label: '已停用', editable: false, frozen: input.reviewState === 'CONFIRMED' };
  }
  if (input.reviewState === 'REJECTED' || input.extractionState === 'FAILED' || input.extractionState === 'UNSUPPORTED') {
    return { state: 'FAILED', label: '处理失败', editable: false, frozen: false };
  }
  if (input.extractionState === 'UPLOADING') {
    return { state: 'UPLOADING', label: '上传中', editable: false, frozen: false };
  }
  if (input.extractionState !== 'EXTRACTED') {
    return { state: 'PROCESSING', label: '正在提取', editable: false, frozen: false };
  }
  if (input.reviewState === 'CONFIRMED') {
    return { state: 'FROZEN', label: '已冻结', editable: false, frozen: true };
  }
  return { state: 'EDITABLE', label: '可编辑', editable: true, frozen: false };
}

export type CourseBasisReferenceBlocker = {
  category: string;
  referenceId: string;
  name: string;
  navigationTarget: string;
};

export class CourseBasisError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: Array<string | CourseBasisReferenceBlocker> = [],
  ) {
    super(code);
    this.name = 'CourseBasisError';
  }
}
