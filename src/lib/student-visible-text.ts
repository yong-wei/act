/**
 * Student-visible copy must never echo machine identities.
 * Canonical IDs, resource IDs, event types, fixture names and similar tokens
 * stay in storage; the learner surface uses Chinese labels or a generic fallback.
 */

const INTERNAL_PREFIX = /^(?:ctc|ctkg|cts|ctf|ctk|act|ctb|ctr)[:\s]/iu;
const EMBEDDED_CANONICAL = /\b(?:ctc|ctkg|cts|ctf|ctk|act|ctb|ctr):[A-Za-z0-9._:-]+/u;
const EVENT_TYPE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/u;
const FIXTURE = /fixture/iu;
const HASH_SLUG = /[a-f0-9]{16,}/u;
const PUBLISHED_RESOURCE = /^published-resource:/iu;
const SNAKE_TOKEN = /^[a-z][a-z0-9_]{11,}$/u;
const KEBAB_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}$/iu;
const PASCAL_TOKEN = /^[A-Z][A-Za-z0-9]*(?:[A-Z][A-Za-z0-9]+)+$/u;
const PUNCTUATED_IDENT = /^[A-Za-z][A-Za-z0-9._:-]*[._:-][A-Za-z0-9._:-]+$/u;
const UNIT_OR_STEP_KEY = /^(?:unit|step)[-_]/iu;

const FACT_TYPE_LABELS: Record<string, string> = {
  question: '课堂作答记录',
  simulation: '仿真操作记录',
  ai_intervention: '智能助学交互记录',
  ethical: '工程伦理记录',
  adaptive_practice: '自适应练习记录',
  assessment: '练习作答记录',
  page_view: '页面学习记录',
  design: '设计活动记录',
  media: '媒体学习记录',
  document_rubric_grading: '文档批改记录',
  arena_official: 'Arena 正式评测记录',
  arena_submission: 'Arena 提交记录',
  arena_preview: 'Arena 预览记录',
  'control_correction_path.selection_recorded': '路径方案选择记录',
  'control_correction_path.execution_recorded': '路径学习记录',
  'control_correction_path.helpfulness_recorded': '路径反馈记录',
  'control_correction_path.rejection_recorded': '路径方案调整记录',
  'learning_path.selection_recorded': '路径方案选择记录',
  'learning-path-execution': '学习路径完成记录',
  AdaptiveAssessmentAnswer: '自适应练习作答记录',
};

export function looksLikeInternalSystemToken(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (INTERNAL_PREFIX.test(trimmed) || EMBEDDED_CANONICAL.test(trimmed)) return true;
  if (PUBLISHED_RESOURCE.test(trimmed) || EVENT_TYPE.test(trimmed) || FIXTURE.test(trimmed)) return true;
  if (UNIT_OR_STEP_KEY.test(trimmed)) return true;
  if (/[\u4e00-\u9fff]/u.test(trimmed)) return false;
  if (HASH_SLUG.test(trimmed) || SNAKE_TOKEN.test(trimmed) || KEBAB_SLUG.test(trimmed)) return true;
  if (PASCAL_TOKEN.test(trimmed) || PUNCTUATED_IDENT.test(trimmed)) return true;
  return false;
}

export function presentStudentVisibleText(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || looksLikeInternalSystemToken(trimmed)) return fallback;
  return trimmed;
}

export function presentStudentVisibleContextFragment(value: string | null | undefined): string | null {
  const presented = presentStudentVisibleText(value, '');
  return presented || null;
}

export function presentStudentVisibleQuestionPrompt(
  prompt?: string | null,
  questionId?: string | null,
): string {
  return presentStudentVisibleText(prompt, '')
    || presentStudentVisibleText(questionId, '')
    || '题目';
}

export function presentStudentVisibleFactType(factType: string | null | undefined): string {
  const trimmed = typeof factType === 'string' ? factType.trim() : '';
  if (!trimmed) return '学习记录';
  if (FACT_TYPE_LABELS[trimmed]) return FACT_TYPE_LABELS[trimmed];
  if (trimmed.startsWith('control_correction_path.')) return '校正路径学习记录';
  if (trimmed.startsWith('learning_path.')) return '学习路径记录';
  if (FIXTURE.test(trimmed)) return '诊断练习记录';
  if (looksLikeInternalSystemToken(trimmed)) return '学习记录';
  return '学习记录';
}

export function presentStudentVisibleEvidenceTitle(input: {
  evidenceTitle?: string | null;
  factType?: string | null;
  stepId?: string | null;
}): string {
  const authored = presentStudentVisibleText(input.evidenceTitle, '');
  if (authored) return authored;
  if (input.factType === 'question') {
    const step = presentStudentVisibleText(input.stepId, '');
    return step ? `课堂作答（${step}）` : '课堂作答记录';
  }
  return presentStudentVisibleFactType(input.factType);
}

export function presentStudentVisibleEvidenceSource(source: string | null | undefined): string {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) return '学习记录';
  if (FACT_TYPE_LABELS[trimmed]) return FACT_TYPE_LABELS[trimmed];
  if (trimmed === 'AdaptiveAssessmentAnswer') return '自适应练习作答记录';
  if (trimmed === 'learning-path-execution') return '学习路径完成记录';
  return presentStudentVisibleFactType(trimmed);
}

export function presentCollectedLearningEvidence(input: {
  title?: string | null;
  resourceLabel: string;
  knowledgeCoverage?: readonly string[];
}): string {
  const title = presentStudentVisibleText(input.title, '');
  if (title) return `${title}学习记录`;
  const coverage = (input.knowledgeCoverage ?? [])
    .map((item) => presentStudentVisibleText(item, ''))
    .filter(Boolean);
  if (coverage.length > 0) return coverage.join('、');
  return `${input.resourceLabel}完成记录`;
}
