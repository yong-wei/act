import { createHash } from 'node:crypto';

import JSZip from 'jszip';

export interface SyntheticTeacherAiGradingPackageOptions {
  datasetKind?: 'synthetic' | 'pilot' | 'preflight' | 'first-round';
  extraFiles?: Record<string, string>;
  omitSubmission?: boolean;
  badSubmissionChecksum?: boolean;
  submissionPath?: string;
  duplicateSample?: boolean;
  baselineConfirmed?: boolean;
  gradingBasis?: 'structured-deductions' | 'teacher-score-only';
  scoreOnlyDeductions?: boolean;
  deductionCriterionId?: string;
  submissionBytes?: Buffer;
  sampleCount?: number;
}

export function syntheticTeacherAiGradingQuestionMarkdown(): string {
  return [
    '# 合成作业',
    '## T1-4 合成工程场景',
    '### 题干',
    '场景描述。',
    '### 参考答案',
    '仅用于验证解析器的合成答案。',
    '### 评分标准',
    '本题总分15分。',
    '#### 场景A（7分）',
    '| 评分项 | 分值 | 评分标准 |',
    '| --- | --- | --- |',
    '| 干扰来源分析 | 2分 | 合成标准 |',
    '| 开环判断与理由 | 3分 | 合成标准 |',
    '| 传感器选择 | 2分 | 合成标准 |',
    '#### 场景B（8分）',
    '| 评分项 | 分值 | 评分标准 |',
    '| --- | --- | --- |',
    '| 干扰来源分析 | 3分 | 合成标准 |',
    '| 开环判断与理由 | 3分 | 合成标准 |',
    '| 传感器选择 | 2分 | 合成标准 |',
    '#### 扣分项',
    '- 合成矛盾项：扣2分',
  ].join('\n');
}

export async function buildSyntheticTeacherAiGradingPackage(
  options: SyntheticTeacherAiGradingPackageOptions = {},
): Promise<Buffer> {
  const zip = new JSZip();
  const question = Buffer.from(syntheticTeacherAiGradingQuestionMarkdown());
  const submission = options.submissionBytes ?? Buffer.from('PK\u0003\u0004synthetic-docx-placeholder');
  const submissionPath = options.submissionPath ?? 'submissions/sample-abcd/T1-4.docx';
  const sampleCount = options.sampleCount ?? 1;
  const sampleIds = sampleCount === 1
    ? ['sample-abcd']
    : Array.from({ length: sampleCount }, (_, index) => `sample-${String(index + 1).padStart(4, '0')}`);
  const baseline = {
    schemaVersion: 'teacher-ai-grading-package-baseline.v1',
    datasetId: 'synthetic-t1',
    datasetVersion: 'v1',
    gradingBasis: options.gradingBasis ?? 'structured-deductions',
    samples: sampleIds.map((sampleId) => ({
      sampleId,
      cleanupConfirmed: true,
      baselineConfirmed: options.baselineConfirmed ?? true,
      teacherTotalScore: 13,
      questions: [{
        questionId: 'T1-4',
        maxScore: 15,
        teacherScore: 13,
        deductions: options.gradingBasis === 'teacher-score-only' && !options.scoreOnlyDeductions
          ? []
          : [{ criterionId: options.deductionCriterionId ?? 't1-4-criterion-1', points: 2, reasonCode: 'missing-reason' }],
      }],
    })),
  };
  const baselineBytes = Buffer.from(JSON.stringify(baseline));
  const samples = sampleIds.map((sampleId) => ({
    sampleId,
    submissions: [{
      questionId: 'T1-4',
      path: submissionPath.replace('sample-abcd', sampleId),
      checksum: options.badSubmissionChecksum ? sha256(Buffer.from('different')) : sha256(submission),
    }],
    scoreBand: 'middle',
    primaryErrorType: 'reasoning-gap',
  }));
  if (options.duplicateSample) samples.push({ ...samples[0] });
  const manifest = {
    schemaVersion: 'teacher-ai-grading-package-manifest.v1',
    datasetId: 'synthetic-t1',
    datasetVersion: 'v1',
    datasetKind: options.datasetKind ?? 'synthetic',
    question: { path: 'T1S.md', checksum: sha256(question) },
    baseline: { path: 'baseline.json', checksum: sha256(baselineBytes) },
    assets: [],
    samples,
  };
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('baseline.json', baselineBytes);
  zip.file('T1S.md', question);
  zip.folder('assets');
  zip.folder('submissions');
  if (!options.omitSubmission) for (const sample of samples) zip.file(sample.submissions[0].path, submission);
  for (const [path, content] of Object.entries(options.extraFiles ?? {})) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function sha256(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
