import { isAbsolute, relative, resolve } from 'node:path';

import { z } from 'zod';

export const TEACHER_AI_GRADING_LAB_MANIFEST_VERSION = 'teacher-ai-grading-package-manifest.v1' as const;
export const TEACHER_AI_GRADING_LAB_BASELINE_VERSION = 'teacher-ai-grading-package-baseline.v1' as const;
export const TEACHER_AI_GRADING_LAB_IMPORT_VERSION = 'teacher-ai-grading-package-import.v1' as const;

export type TeacherAiGradingLabErrorCode =
  | 'LAB_CONFIG_DATA_ROOT_MISSING'
  | 'LAB_CONFIG_DATA_ROOT_RELATIVE'
  | 'LAB_CONFIG_DATA_ROOT_IN_REPOSITORY'
  | 'LAB_CONFIG_OWNER_ID_MISSING'
  | 'LAB_CONFIG_OWNER_ID_INVALID'
  | 'LAB_PACKAGE_SCHEMA_INVALID'
  | 'LAB_PACKAGE_DUPLICATE_SAMPLE_ID'
  | 'LAB_BASELINE_UNCONFIRMED'
  | 'LAB_BASELINE_INCONSISTENT'
  | 'LAB_RUBRIC_DUPLICATE_QUESTION_ID'
  | 'LAB_RUBRIC_SECTION_MISSING'
  | 'LAB_RUBRIC_MAX_SCORE_UNKNOWN'
  | 'LAB_RUBRIC_SCORE_MISMATCH'
  | 'LAB_RUBRIC_SCORE_QUANTUM_INVALID'
  | 'LAB_RUBRIC_FIRST_ROUND_CONTRACT_INVALID'
  | 'LAB_RUBRIC_ASSET_INVALID'
  | 'LAB_RUBRIC_ASSET_MISSING';

export class TeacherAiGradingLabError extends Error {
  constructor(
    public readonly code: TeacherAiGradingLabErrorCode,
    message: string,
    public readonly logicalPath?: string,
  ) {
    super(message);
    this.name = 'TeacherAiGradingLabError';
  }
}

const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const logicalPathSchema = z.string().min(1).max(240).refine((value) => (
  !value.includes('\\')
  && !value.startsWith('/')
  && !/^[A-Za-z]:/.test(value)
  && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
), 'unsafe logical path');
const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/);
const questionIdSchema = z.string().regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);

export const teacherAiGradingLabManifestSchema = z.object({
  schemaVersion: z.literal(TEACHER_AI_GRADING_LAB_MANIFEST_VERSION),
  datasetId: identifierSchema,
  datasetVersion: identifierSchema,
  datasetKind: z.enum(['synthetic', 'pilot', 'preflight', 'first-round']),
  question: z.object({
    path: logicalPathSchema.refine((value) => /^[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/i.test(value), 'question file must be a markdown file'),
    checksum: checksumSchema,
  }).strict(),
  baseline: z.object({
    path: z.literal('baseline.json'),
    checksum: checksumSchema,
  }).strict(),
  assets: z.array(z.object({
    path: logicalPathSchema.refine((value) => value.startsWith('assets/')),
    checksum: checksumSchema,
  }).strict()).max(128),
  samples: z.array(z.object({
    sampleId: z.string().regex(/^sample-[a-z0-9]{4,32}$/),
    submissions: z.array(z.object({
      questionId: questionIdSchema,
      path: logicalPathSchema.refine((value) => /^submissions\/[^/]+\/[^/]+\.(docx|doc)$/i.test(value)),
      checksum: checksumSchema,
    }).strict()).min(1).max(32),
    scoreBand: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
    primaryErrorType: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  }).strict()).min(1).max(50),
}).strict().superRefine((manifest, context) => {
  if (manifest.datasetKind === 'first-round' && (manifest.samples.length < 30 || manifest.samples.length > 50)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples'], message: 'first-round datasets require 30 to 50 samples' });
  }
  if (manifest.datasetKind === 'pilot' && (manifest.samples.length < 1 || manifest.samples.length > 2)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples'], message: 'pilot datasets require 1 to 2 samples' });
  }
  if (manifest.datasetKind === 'preflight' && manifest.samples.length !== 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples'], message: 'preflight datasets require exactly 2 samples' });
  }
  const sampleIds = new Set<string>();
  const paths = new Set<string>();
  for (const [index, sample] of manifest.samples.entries()) {
    if (sampleIds.has(sample.sampleId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples', index, 'sampleId'], message: 'duplicate sample ID' });
    }
    sampleIds.add(sample.sampleId);
    const questionIds = new Set<string>();
    for (const [submissionIndex, submission] of sample.submissions.entries()) {
      if (questionIds.has(submission.questionId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples', index, 'submissions', submissionIndex, 'questionId'], message: 'duplicate question submission' });
      }
      if (paths.has(submission.path.toLowerCase())) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['samples', index, 'submissions', submissionIndex, 'path'], message: 'duplicate submission path' });
      }
      questionIds.add(submission.questionId);
      paths.add(submission.path.toLowerCase());
    }
  }
});

function usesHalfPointQuantum(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 2 - Math.round(value * 2)) <= 1e-9;
}

const halfPointScoreSchema = z.number().nonnegative().finite().refine(usesHalfPointQuantum, 'score-must-use-0.5-quantum');

const deductionSchema = z.object({
  criterionId: identifierSchema,
  points: halfPointScoreSchema.refine((value) => value > 0, 'score-must-be-positive'),
  reasonCode: identifierSchema,
}).strict();

const teacherAnnotationCategorySchema = z.enum([
  'calculation',
  'concept',
  'method',
  'presentation',
  'reasoning',
  'other',
]);

export const teacherAiGradingLabBaselineSchema = z.object({
  schemaVersion: z.literal(TEACHER_AI_GRADING_LAB_BASELINE_VERSION),
  datasetId: identifierSchema,
  datasetVersion: identifierSchema,
  gradingBasis: z.enum(['structured-deductions', 'teacher-score-only']).default('structured-deductions'),
  samples: z.array(z.object({
    sampleId: z.string().regex(/^sample-[a-z0-9]{4,32}$/),
    cleanupConfirmed: z.literal(true),
    baselineConfirmed: z.literal(true),
    teacherTotalScore: halfPointScoreSchema,
    questions: z.array(z.object({
      questionId: questionIdSchema,
      maxScore: halfPointScoreSchema.refine((value) => value > 0, 'score-must-be-positive'),
      teacherScore: halfPointScoreSchema,
      teacherAnnotationCategories: z.array(teacherAnnotationCategorySchema).max(16).default([]),
      deductions: z.array(deductionSchema).max(64),
    }).strict()).min(1),
  }).strict()).min(1).max(50),
}).strict().superRefine((baseline, context) => {
  for (const [sampleIndex, sample] of baseline.samples.entries()) {
    const sum = sample.questions.reduce((total, question) => total + question.teacherScore, 0);
    if (sample.teacherTotalScore !== undefined && sample.teacherTotalScore !== sum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['samples', sampleIndex, 'teacherTotalScore'],
        message: 'teacher total score does not equal question scores',
      });
    }
    for (const [questionIndex, question] of sample.questions.entries()) {
      if (question.teacherScore > question.maxScore) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['samples', sampleIndex, 'questions', questionIndex, 'teacherScore'],
          message: 'teacher score exceeds question maximum',
        });
      }
    }
  }
});

export type TeacherAiGradingLabManifest = z.infer<typeof teacherAiGradingLabManifestSchema>;
export type TeacherAiGradingLabBaseline = z.infer<typeof teacherAiGradingLabBaselineSchema>;

export interface TeacherAiGradingLabConfig {
  dataRoot: string;
  ownerTeacherUserId: string;
}

export function readTeacherAiGradingLabConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  repositoryRoot = process.cwd(),
): TeacherAiGradingLabConfig {
  const rawDataRoot = env.TEACHER_AI_GRADING_LAB_DATA_ROOT?.trim() ?? '';
  if (!rawDataRoot) throw new TeacherAiGradingLabError('LAB_CONFIG_DATA_ROOT_MISSING', 'Evaluation data root is required.');
  if (!isAbsolute(rawDataRoot)) throw new TeacherAiGradingLabError('LAB_CONFIG_DATA_ROOT_RELATIVE', 'Evaluation data root must be absolute.');

  const dataRoot = resolve(rawDataRoot);
  const repoRoot = resolve(repositoryRoot);
  const repoRelative = relative(repoRoot, dataRoot);
  if (repoRelative === '' || (!repoRelative.startsWith('..') && !isAbsolute(repoRelative))) {
    throw new TeacherAiGradingLabError('LAB_CONFIG_DATA_ROOT_IN_REPOSITORY', 'Evaluation data root must be outside the repository.');
  }

  const ownerTeacherUserId = env.TEACHER_AI_GRADING_LAB_OWNER_TEACHER_USER_ID?.trim() ?? '';
  if (!ownerTeacherUserId) {
    throw new TeacherAiGradingLabError('LAB_CONFIG_OWNER_ID_MISSING', 'Owner teacher user ID is required.');
  }
  if (!/^c[a-z0-9]{24,31}$/.test(ownerTeacherUserId)) {
    throw new TeacherAiGradingLabError('LAB_CONFIG_OWNER_ID_INVALID', 'Owner teacher user ID must be a valid ACT cuid.');
  }
  return { dataRoot, ownerTeacherUserId };
}

export interface SourceTrace {
  startLine: number;
  endLine: number;
  heading: string;
  snippet: string;
}

export interface ParsedRubricItem {
  id: string;
  label: string;
  points: number;
  group: string | null;
  trace: SourceTrace;
}

export interface ParsedGradingQuestion {
  questionId: string;
  title: string;
  maxScore: number;
  sections: Record<'题干' | '参考答案' | '评分标准', SourceTrace>;
  rubricItems: ParsedRubricItem[];
  assetPaths: string[];
  trace: SourceTrace;
}

export interface ParsedGradingQuestionSet {
  questions: ParsedGradingQuestion[];
}

interface Heading {
  line: number;
  level: number;
  text: string;
}

export function parseTeacherAiGradingQuestions(markdown: string, availablePaths: ReadonlySet<string>): ParsedGradingQuestionSet {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const headings = lines.flatMap((line, index) => {
    const match = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
    return match ? [{ line: index, level: match[1].length, text: match[2] }] : [];
  });
  const questionHeadings = headings.filter((heading) => heading.level === 2 && /^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/.test(heading.text));
  const seen = new Set<string>();
  const questions = questionHeadings.map((heading, index) => {
    const questionId = /^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/.exec(heading.text)![1];
    if (seen.has(questionId)) {
      throw new TeacherAiGradingLabError('LAB_RUBRIC_DUPLICATE_QUESTION_ID', `Duplicate question ID: ${questionId}.`, questionId);
    }
    seen.add(questionId);
    const end = questionHeadings[index + 1]?.line ?? lines.length;
    return parseQuestion(lines, headings, heading, end, questionId, availablePaths);
  });
  if (questions.length === 0) {
    throw new TeacherAiGradingLabError('LAB_RUBRIC_SECTION_MISSING', 'No question headings were found.', 'T1S.md');
  }
  return { questions };
}

function parseQuestion(
  lines: string[],
  headings: Heading[],
  questionHeading: Heading,
  questionEnd: number,
  questionId: string,
  availablePaths: ReadonlySet<string>,
): ParsedGradingQuestion {
  const sectionHeadings = headings.filter((heading) => (
    heading.level === 3
    && heading.line > questionHeading.line
    && heading.line < questionEnd
    && ['题干', '参考答案', '标准答案', '评分标准', '分步评分标准'].includes(heading.text.trim())
  ));
  const sections = {} as ParsedGradingQuestion['sections'];
  for (const name of ['题干', '参考答案', '评分标准'] as const) {
    const section = sectionHeadings.find((heading) => (
      heading.text.trim() === name
      || (name === '参考答案' && heading.text.trim() === '标准答案')
      || (name === '评分标准' && heading.text.trim() === '分步评分标准')
    ));
    if (!section) throw new TeacherAiGradingLabError('LAB_RUBRIC_SECTION_MISSING', `Missing ${name} section.`, `${questionId}.${name}`);
    const nextSection = sectionHeadings.find((heading) => heading.line > section.line);
    const endLine = nextSection?.line ?? questionEnd;
    sections[name] = trace(lines, section.line, endLine - 1, section.text);
  }

  const rubricStart = sectionHeadings.find((heading) => (
    heading.text.trim() === '评分标准' || heading.text.trim() === '分步评分标准'
  ))!.line;
  const rubricLines = lines.slice(rubricStart + 1, questionEnd);
  const rubricItems = parseRubricItems(lines, rubricLines, rubricStart + 1, questionId);
  const explicitMax = findExplicitMaxScore([questionHeading.text, ...rubricLines]);
  const itemTotal = rubricItems.reduce((sum, item) => sum + item.points, 0);
  const maxScore = explicitMax ?? itemTotal;
  if (!Number.isFinite(maxScore) || maxScore <= 0 || rubricItems.length === 0) {
    throw new TeacherAiGradingLabError('LAB_RUBRIC_MAX_SCORE_UNKNOWN', 'Question maximum score cannot be determined.', questionId);
  }
  if (!usesHalfPointQuantum(maxScore) || rubricItems.some((item) => !usesHalfPointQuantum(item.points))) {
    throw new TeacherAiGradingLabError('LAB_RUBRIC_SCORE_QUANTUM_INVALID', 'Question and criterion scores must use 0.5-point increments.', questionId);
  }
  if (Math.abs(itemTotal - maxScore) > 1e-9) {
    throw new TeacherAiGradingLabError('LAB_RUBRIC_SCORE_MISMATCH', `Rubric item total ${itemTotal} does not match maximum ${maxScore}.`, questionId);
  }

  const questionLines = lines.slice(questionHeading.line + 1, questionEnd);
  const assetPaths = [...questionLines.join('\n').matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)].map((match) => match[1]);
  for (const assetPath of assetPaths) {
    if (!assetPath.startsWith('assets/') || assetPath.includes('\\') || assetPath.split('/').some((part) => part === '..' || part === '.')) {
      throw new TeacherAiGradingLabError('LAB_RUBRIC_ASSET_INVALID', 'Question asset path must be a safe relative assets path.', `${questionId}.${assetPath}`);
    }
    if (!availablePaths.has(assetPath)) {
      throw new TeacherAiGradingLabError('LAB_RUBRIC_ASSET_MISSING', 'Question asset is missing from the package.', `${questionId}.${assetPath}`);
    }
  }

  return {
    questionId,
    title: questionHeading.text.slice(questionId.length).trim(),
    maxScore,
    sections,
    rubricItems,
    assetPaths,
    trace: trace(lines, questionHeading.line, questionEnd - 1, questionHeading.text),
  };
}

function parseRubricItems(lines: string[], rubricLines: string[], offset: number, questionId: string): ParsedRubricItem[] {
  const items: ParsedRubricItem[] = [];
  let group: string | null = null;
  for (let index = 0; index < rubricLines.length; index += 1) {
    const line = rubricLines[index];
    const groupMatch = /^####\s+(.+?)\s*$/.exec(line);
    if (groupMatch) {
      group = groupMatch[1];
      continue;
    }
    if (group?.startsWith('扣分')) continue;

    const tableMatch = /^\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*分\s*\|/.exec(line);
    const numberedMatch = matchNumberedRubricItem(line);
    const bulletMatch = /^[-*]\s+\**(.+?)\**[，,]\s*(\d+(?:\.\d+)?)\s*分(?:[：:]|$)/.exec(line.trim());
    const boldParenMatch = /^[-*]?\s*\*{0,2}(.+?)\*{0,2}\s*[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/.exec(line.trim());
    const match = tableMatch ?? numberedMatch ?? bulletMatch ?? boldParenMatch;
    if (!match || /评分项|[-:]{3,}/.test(match[1])) continue;
    const label = match[1].replace(/\*\*/g, '').trim();
    const points = Number(match[2]);
    items.push({
      id: `${questionId.toLowerCase()}-criterion-${items.length + 1}`,
      label,
      points,
      group,
      trace: trace(lines, offset + index, offset + index, group ?? '评分标准'),
    });
  }
  return items;
}

function matchNumberedRubricItem(line: string): [string, string, string] | null {
  const normalized = line.trim().replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
  const declared = /^\d+[.、]\s+\*{0,2}(.+?)(?:[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]|[，,]\s*(\d+(?:\.\d+)?)\s*分[。.:：；;]?)/.exec(normalized);
  if (declared) return [declared[0], declared[1], declared[2] ?? declared[3]];
  const terminal = /^\d+[.、]\s+(.+?)\s+(\d+(?:\.\d+)?)\s*分[。；;]?$/.exec(normalized);
  return terminal ? [terminal[0], terminal[1], terminal[2]] : null;
}

function findExplicitMaxScore(lines: string[]): number | null {
  for (const line of lines) {
    const match = /(?:总分|满分)\s*(?:为|是|[:：])?\s*\*{0,2}(\d+(?:\.\d+)?)\s*分/.exec(line);
    if (match) return Number(match[1]);
  }
  return null;
}

function trace(lines: string[], start: number, end: number, heading: string): SourceTrace {
  return {
    startLine: start + 1,
    endLine: end + 1,
    heading,
    snippet: lines.slice(start, end + 1).join('\n').trim(),
  };
}

export function parseTeacherAiGradingManifest(value: unknown): TeacherAiGradingLabManifest {
  const result = teacherAiGradingLabManifestSchema.safeParse(value);
  if (!result.success) {
    const duplicate = result.error.issues.find((issue) => issue.message === 'duplicate sample ID');
    throw new TeacherAiGradingLabError(
      duplicate ? 'LAB_PACKAGE_DUPLICATE_SAMPLE_ID' : 'LAB_PACKAGE_SCHEMA_INVALID',
      result.error.issues[0]?.message ?? 'Invalid package manifest.',
      result.error.issues[0]?.path.join('.'),
    );
  }
  return result.data;
}

export function parseTeacherAiGradingBaseline(value: unknown): TeacherAiGradingLabBaseline {
  const result = teacherAiGradingLabBaselineSchema.safeParse(value);
  if (!result.success) {
    const unconfirmed = result.error.issues.some((issue) => issue.path.includes('cleanupConfirmed') || issue.path.includes('baselineConfirmed'));
    throw new TeacherAiGradingLabError(
      unconfirmed ? 'LAB_BASELINE_UNCONFIRMED' : 'LAB_PACKAGE_SCHEMA_INVALID',
      result.error.issues[0]?.message ?? 'Invalid package baseline.',
      result.error.issues[0]?.path.join('.'),
    );
  }
  return result.data;
}
