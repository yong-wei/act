import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildSyntheticTeacherAiGradingPackage,
  syntheticTeacherAiGradingQuestionMarkdown,
} from './fixtures/teacher-ai-grading-lab-synthetic';

import {
  parseTeacherAiGradingManifest,
  parseTeacherAiGradingBaseline,
  parseTeacherAiGradingQuestions,
  readTeacherAiGradingLabConfig,
  TeacherAiGradingLabError,
} from '../teacher-ai-grading-lab-contracts';
import {
  importTeacherAiGradingPackageZip,
  TeacherAiGradingZipError,
  validateTeacherAiGradingPackageZip,
} from '../teacher-ai-grading-lab-import';
import {
  findSensitiveTeacherAiGradingLabPaths,
  findSensitiveTeacherAiGradingLabStagedFiles,
} from '../teacher-ai-grading-lab-sensitive-files';
import { createFileSystemTeacherAiGradingLabDatasetStore } from '../teacher-ai-grading-lab-dataset-store';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('teacher AI grading lab configuration', () => {
  it.each([
    [{}, 'LAB_CONFIG_DATA_ROOT_MISSING'],
    [{ TEACHER_AI_GRADING_LAB_DATA_ROOT: 'relative/data' }, 'LAB_CONFIG_DATA_ROOT_RELATIVE'],
    [{ TEACHER_AI_GRADING_LAB_DATA_ROOT: process.cwd() }, 'LAB_CONFIG_DATA_ROOT_IN_REPOSITORY'],
    [{ TEACHER_AI_GRADING_LAB_DATA_ROOT: tmpdir() }, 'LAB_CONFIG_OWNER_ID_MISSING'],
    [{ TEACHER_AI_GRADING_LAB_DATA_ROOT: tmpdir(), TEACHER_AI_GRADING_LAB_OWNER_TEACHER_USER_ID: 'teacher-1' }, 'LAB_CONFIG_OWNER_ID_INVALID'],
  ])('rejects invalid configuration with a stable code', (env, code) => {
    expect(() => readTeacherAiGradingLabConfig(env, process.cwd())).toThrowError(expect.objectContaining({ code }));
  });

  it('accepts only an absolute external data root and ACT cuid owner ID', () => {
    const config = readTeacherAiGradingLabConfig({
      TEACHER_AI_GRADING_LAB_DATA_ROOT: tmpdir(),
      TEACHER_AI_GRADING_LAB_OWNER_TEACHER_USER_ID: `c${'a'.repeat(24)}`,
    }, process.cwd());
    expect(config.ownerTeacherUserId).toBe(`c${'a'.repeat(24)}`);
  });
});

describe('teacher AI grading question parser', () => {
  it('parses T1-4 nested scenario groups, table criteria, and source trace', () => {
    const parsed = parseTeacherAiGradingQuestions(syntheticTeacherAiGradingQuestionMarkdown(), new Set());
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]).toMatchObject({ questionId: 'T1-4', maxScore: 15 });
    expect(parsed.questions[0].rubricItems).toHaveLength(6);
    expect(parsed.questions[0].rubricItems.map((item) => item.group)).toEqual([
      '场景A（7分）', '场景A（7分）', '场景A（7分）',
      '场景B（8分）', '场景B（8分）', '场景B（8分）',
    ]);
    expect(parsed.questions[0].rubricItems[0].trace).toEqual(expect.objectContaining({ startLine: expect.any(Number), snippet: expect.stringContaining('干扰来源分析') }));
    expect(parsed.questions[0].sections.评分标准.snippet).toContain('总分15分');
    expect(parsed.questions[0].sections.题干.snippet).toContain('场景描述');
  });

  it('rejects a rubric whose item points do not equal its declared maximum', () => {
    const markdown = syntheticTeacherAiGradingQuestionMarkdown().replace('| 传感器选择 | 2分 |', '| 传感器选择 | 1分 |');
    expect(() => parseTeacherAiGradingQuestions(markdown, new Set())).toThrowError(expect.objectContaining({ code: 'LAB_RUBRIC_SCORE_MISMATCH' }));
  });

  it('parses strict numbered criteria with parenthesized or bold comma scores', () => {
    const markdown = syntheticTeacherAiGradingQuestionMarkdown()
      .replace('本题总分15分。', '本题总分6分。')
      .replace(/#### 场景A（7分）[\s\S]*#### 扣分项/, [
        '1. 模型正确（3分）',
        '2. **结论正确，3分。**',
        '正文在第 3 步说明模型参数，不是评分项。',
        '#### 扣分项',
      ].join('\n'));
    const parsed = parseTeacherAiGradingQuestions(markdown, new Set());
    expect(parsed.questions[0].rubricItems.map(({ label, points }) => ({ label, points }))).toEqual([
      { label: '模型正确', points: 3 },
      { label: '结论正确', points: 3 },
    ]);
  });

  it('uses the declared criterion score instead of a later partial-credit score', () => {
    const markdown = [
      '# 真实评分格式',
      '## T1-2 极点位置与稳定性类型识别',
      '### 题干',
      '判断系统稳定性。',
      '### 参考答案',
      '根据极点位置判断。',
      '### 评分标准',
      '本题总分6分。',
      '1. **总体判断准则，2分。** 判分标准：完整得2分；少一类或表述不完整得1分。',
      '2. **配置判断，4分。** 判分标准：完整得4分；部分正确得1分。',
    ].join('\n');

    const parsed = parseTeacherAiGradingQuestions(markdown, new Set());

    expect(parsed.questions[0].rubricItems.map(({ label, points }) => ({ label, points }))).toEqual([
      { label: '总体判断准则', points: 2 },
      { label: '配置判断', points: 4 },
    ]);
  });

  it('rejects missing relative assets without attempting completion', () => {
    const markdown = syntheticTeacherAiGradingQuestionMarkdown().replace('场景描述。', '场景描述。\n\n![证据图](assets/T1/evidence.png)');
    expect(() => parseTeacherAiGradingQuestions(markdown, new Set())).toThrowError(expect.objectContaining({
      code: 'LAB_RUBRIC_ASSET_MISSING',
      logicalPath: 'T1-4.assets/T1/evidence.png',
    }));
  });

  it('rejects duplicate question IDs and missing required sections', () => {
    const duplicate = `${syntheticTeacherAiGradingQuestionMarkdown()}\n${syntheticTeacherAiGradingQuestionMarkdown()}`;
    expect(() => parseTeacherAiGradingQuestions(duplicate, new Set())).toThrowError(expect.objectContaining({ code: 'LAB_RUBRIC_DUPLICATE_QUESTION_ID' }));
    expect(() => parseTeacherAiGradingQuestions(syntheticTeacherAiGradingQuestionMarkdown().replace('### 参考答案', '### 解答'), new Set()))
      .toThrowError(expect.objectContaining({ code: 'LAB_RUBRIC_SECTION_MISSING' }));
  });
});

describe('teacher AI grading package validation and import', () => {
  it('keeps the formal T2 intake fail-closed and path-free', async () => {
    const source = await readFile(resolve('scripts/data-governance/prepare-t2-formal-experiment.ps1'), 'utf8');
    expect(source).toContain("'sample-{0:D3}' -f $_");
    expect(source).toContain("$authoritativeRubric = Join-Path $SourceRoot 'T2S-20.md'");
    expect(source).toContain('Assert-FileSignature');
    expect(source).toContain("'[Content_Types].xml' -notin $entryNames");
    expect(source).toContain("'word/document.xml' -notin $entryNames");
    expect(source).toContain('sourceReadOnly');
    expect(source).toContain('must contain exactly the four authoritative answer files');
    expect(source).not.toMatch(/sourceFile\s*=/u);
  });

  it('loads AI evaluation inputs without opening the isolated human baseline', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grading-lab-baseline-isolation-'));
    tempRoots.push(dataRoot);
    const store = createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot });
    await store.importPackage(await buildSyntheticTeacherAiGradingPackage());
    await rm(join(dataRoot, 'datasets', 'synthetic-t1', 'v1', 'baseline.json'));

    await expect(store.loadEvaluation({ datasetId: 'synthetic-t1', datasetVersion: 'v1' }))
      .resolves.toMatchObject({ datasetId: 'synthetic-t1', datasetVersion: 'v1' });
    await expect(store.load({ datasetId: 'synthetic-t1', datasetVersion: 'v1' })).rejects.toThrow();
  });

  it.each([1, 3])('rejects preflight datasets with %i samples', (sampleCount) => {
    const sample = {
      sampleId: 'sample-abcd',
      submissions: [{ questionId: 'T1-4', path: 'submissions/sample-abcd/T1-4.docx', checksum: `sha256:${'a'.repeat(64)}` }],
      scoreBand: 'middle', primaryErrorType: 'reasoning-gap',
    };
    const manifest = {
      schemaVersion: 'teacher-ai-grading-package-manifest.v1', datasetId: 'preflight-t1', datasetVersion: 'v1', datasetKind: 'preflight',
      question: { path: 'T1S.md', checksum: `sha256:${'b'.repeat(64)}` }, baseline: { path: 'baseline.json', checksum: `sha256:${'c'.repeat(64)}` }, assets: [],
      samples: Array.from({ length: sampleCount }, (_, index) => ({ ...sample, sampleId: `sample-abcd${index}`, submissions: [{ questionId: 'T1-4', path: `submissions/sample-abcd${index}/T1-4.docx`, checksum: `sha256:${'a'.repeat(64)}` }] })),
    };
    expect(() => parseTeacherAiGradingManifest(manifest)).toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
  });

  it('rejects rubric scores that are not half-point values', () => {
    const markdown = syntheticTeacherAiGradingQuestionMarkdown().replace('| 传感器选择 | 2分 |', '| 传感器选择 | 1.25分 |');
    expect(() => parseTeacherAiGradingQuestions(markdown, new Set())).toThrowError(expect.objectContaining({ code: 'LAB_RUBRIC_SCORE_QUANTUM_INVALID' }));
  });

  it('rejects non-half-point teacher baselines and scores above the question maximum', () => {
    const baseline = {
      schemaVersion: 'teacher-ai-grading-package-baseline.v1', datasetId: 'synthetic-t1', datasetVersion: 'v1',
      samples: [{ sampleId: 'sample-abcd', cleanupConfirmed: true, baselineConfirmed: true, questions: [{ questionId: 'T1-4', maxScore: 25, teacherScore: 12.25, deductions: [] }] }],
    };
    expect(() => parseTeacherAiGradingBaseline(baseline)).toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
    expect(() => parseTeacherAiGradingBaseline({ ...baseline, samples: [{ ...baseline.samples[0], questions: [{ ...baseline.samples[0].questions[0], teacherScore: 25.5 }] }] })).toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
  });

  it('keeps only enumerated teacher annotation categories in the isolated baseline', () => {
    const baseline = {
      schemaVersion: 'teacher-ai-grading-package-baseline.v1', datasetId: 'synthetic-t1', datasetVersion: 'v1',
      samples: [{ sampleId: 'sample-abcd', cleanupConfirmed: true, baselineConfirmed: true, questions: [{
        questionId: 'T1-4', maxScore: 25, teacherScore: 20, teacherAnnotationCategories: ['reasoning'], deductions: [],
      }] }],
    };
    const withTotal = { ...baseline, samples: [{ ...baseline.samples[0], teacherTotalScore: 20 }] };
    expect(parseTeacherAiGradingBaseline(withTotal).samples[0].questions[0].teacherAnnotationCategories)
      .toEqual(['reasoning']);
    expect(() => parseTeacherAiGradingBaseline({ ...baseline, studentName: 'forbidden' }))
      .toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
    expect(() => parseTeacherAiGradingBaseline({
      ...withTotal,
      samples: [{ ...withTotal.samples[0], teacherTotalScore: 19 }],
    })).toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
    expect(() => parseTeacherAiGradingBaseline({
      ...withTotal,
      samples: [{ ...withTotal.samples[0], questions: [{
        ...withTotal.samples[0].questions[0], teacherAnnotationCategories: ['person@example.test'],
      }] }],
    })).toThrowError(expect.objectContaining({ code: 'LAB_PACKAGE_SCHEMA_INVALID' }));
  });

  it('accepts exactly two preflight samples', () => {
    const sample = (index: number) => ({ sampleId: `sample-abcd${index}`, submissions: [{ questionId: 'T1-4', path: `submissions/sample-abcd${index}/T1-4.docx`, checksum: `sha256:${'a'.repeat(64)}` }], scoreBand: 'middle', primaryErrorType: 'reasoning-gap' });
    expect(parseTeacherAiGradingManifest({
      schemaVersion: 'teacher-ai-grading-package-manifest.v1', datasetId: 'preflight-t1', datasetVersion: 'v1', datasetKind: 'preflight',
      question: { path: 'T1S.md', checksum: `sha256:${'b'.repeat(64)}` }, baseline: { path: 'baseline.json', checksum: `sha256:${'c'.repeat(64)}` }, assets: [], samples: [sample(1), sample(2)],
    })).toMatchObject({ datasetKind: 'preflight', samples: [{ sampleId: 'sample-abcd1' }, { sampleId: 'sample-abcd2' }] });
  });

  it.each([0, 3])('rejects pilot datasets with %i samples', (sampleCount) => {
    const sample = {
      sampleId: 'sample-abcd',
      submissions: [{ questionId: 'T1-4', path: 'submissions/sample-abcd/T1-4.docx', checksum: `sha256:${'a'.repeat(64)}` }],
      scoreBand: 'middle',
      primaryErrorType: 'reasoning-gap',
    };
    const manifest = {
      schemaVersion: 'teacher-ai-grading-package-manifest.v1',
      datasetId: 'pilot-t1',
      datasetVersion: 'v1',
      datasetKind: 'pilot',
      question: { path: 'T1S.md', checksum: `sha256:${'b'.repeat(64)}` },
      baseline: { path: 'baseline.json', checksum: `sha256:${'c'.repeat(64)}` },
      assets: [],
      samples: Array.from({ length: sampleCount }, (_, index) => ({
        ...sample,
        sampleId: `sample-abcd${index}`,
        submissions: [{ questionId: 'T1-4', path: `submissions/sample-abcd${index}/T1-4.docx`, checksum: `sha256:${'a'.repeat(64)}` }],
      })),
    };

    expect(() => parseTeacherAiGradingManifest(manifest)).toThrowError(expect.objectContaining({
      code: 'LAB_PACKAGE_SCHEMA_INVALID',
    }));
  });

  it('validates the versioned manifest, baseline, directory contract, and checksums', async () => {
    const bytes = await buildSyntheticTeacherAiGradingPackage();
    const result = await validateTeacherAiGradingPackageZip(bytes);
    expect(result.manifest).toMatchObject({
      schemaVersion: 'teacher-ai-grading-package-manifest.v1',
      datasetKind: 'synthetic',
    });
    expect(result.baseline.schemaVersion).toBe('teacher-ai-grading-package-baseline.v1');
    expect(result.questions.questions[0].questionId).toBe('T1-4');
  });

  it('rejects a first-round package that is not a four-question, 100-point contract', async () => {
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ datasetKind: 'first-round', sampleCount: 30 })))
      .rejects.toThrowError(expect.objectContaining({ code: 'LAB_RUBRIC_FIRST_ROUND_CONTRACT_INVALID' }));
  });

  it('imports through staging but keeps the package blocked until redaction confirmation', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'teacher-ai-grading-lab-'));
    tempRoots.push(dataRoot);
    const result = await importTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage(), {
      dataRoot,
      ownerTeacherUserId: `c${'a'.repeat(24)}`,
    });
    expect(result).toMatchObject({ datasetKind: 'synthetic', runnable: false, redactionState: 'pending' });
    expect(result.importPath).toBe(join(dataRoot, 'datasets', 'synthetic-t1', 'v1'));
  });

  it.each(['../escape.docx', '/absolute.docx', 'C:/absolute.docx', 'submissions\\ambiguous.docx'])(
    'rejects unsafe ZIP path %s before extraction',
    async (unsafePath) => {
      const bytes = await buildSyntheticTeacherAiGradingPackage({ extraFiles: { [unsafePath]: 'unsafe' } });
      await expect(validateTeacherAiGradingPackageZip(bytes)).rejects.toMatchObject({ code: 'LAB_ZIP_PATH_UNSAFE' });
    },
  );

  it('rejects case-conflicting ZIP paths', async () => {
    const bytes = await buildSyntheticTeacherAiGradingPackage({ extraFiles: { 'Assets/conflict.png': 'a', 'assets/conflict.png': 'b' } });
    await expect(validateTeacherAiGradingPackageZip(bytes)).rejects.toMatchObject({ code: 'LAB_ZIP_DUPLICATE_PATH' });
  });

  it('rejects undeclared files, missing files, bad checksums, and illegal extensions', async () => {
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ extraFiles: { 'extra.txt': 'x' } })))
      .rejects.toMatchObject({ code: 'LAB_ZIP_UNDECLARED_FILE' });
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ omitSubmission: true })))
      .rejects.toMatchObject({ code: 'LAB_ZIP_MISSING_FILE', logicalPath: 'submissions/sample-abcd/T1-4.docx' });
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ badSubmissionChecksum: true })))
      .rejects.toMatchObject({ code: 'LAB_ZIP_CHECKSUM_MISMATCH' });
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ submissionPath: 'submissions/sample-abcd/T1-4.wps' })))
      .rejects.toSatisfy((error: unknown) => (
        error instanceof TeacherAiGradingLabError || error instanceof TeacherAiGradingZipError
      ));
  });

  it('rejects duplicate sample IDs and unconfirmed teacher baseline', async () => {
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ duplicateSample: true })))
      .rejects.toMatchObject({ code: 'LAB_PACKAGE_DUPLICATE_SAMPLE_ID' });
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ baselineConfirmed: false })))
      .rejects.toMatchObject({ code: 'LAB_BASELINE_UNCONFIRMED' });
  });

  it('rejects deductions whose criterion is absent from the corresponding question', async () => {
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({
      deductionCriterionId: 't9-9-criterion-1',
    }))).rejects.toMatchObject({ code: 'LAB_BASELINE_INCONSISTENT' });
  });

  it('accepts an explicitly confirmed score-only baseline and rejects deductions within it', async () => {
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({ gradingBasis: 'teacher-score-only' })))
      .resolves.toMatchObject({ baseline: { gradingBasis: 'teacher-score-only' } });
    await expect(validateTeacherAiGradingPackageZip(await buildSyntheticTeacherAiGradingPackage({
      gradingBasis: 'teacher-score-only', scoreOnlyDeductions: true,
    }))).rejects.toMatchObject({ code: 'LAB_BASELINE_INCONSISTENT' });
  });

  it('returns a stable duplicate-import error without exposing the native destination path', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'teacher-ai-grading-lab-'));
    tempRoots.push(dataRoot);
    const bytes = await buildSyntheticTeacherAiGradingPackage();
    const config = { dataRoot, ownerTeacherUserId: `c${'a'.repeat(24)}` };
    await importTeacherAiGradingPackageZip(bytes, config);
    const duplicate = await importTeacherAiGradingPackageZip(bytes, config).catch((error: unknown) => error);
    expect(duplicate).toMatchObject({ code: 'LAB_IMPORT_ALREADY_EXISTS' });
    expect(String((duplicate as Error).message)).not.toContain(dataRoot);
  });
});

describe('teacher AI grading sensitive-file gate', () => {
  it('blocks conventionally named packages, extracted data, identity maps, and runtime output', () => {
    const paths = [
      'teacher-ai-grading-lab-data/imports/package/manifest.json',
      'evidence/class-a.grading-lab.zip',
      'private/grading-lab-identity-mapping.csv',
      'tmp/grading-lab-run-artifacts/result.json',
    ];
    expect(findSensitiveTeacherAiGradingLabPaths(paths).map((finding) => finding.path)).toEqual(paths);
  });

  it('detects package ZIP structure, new Word files, and identity mappings from staged content', async () => {
    const packageZip = await buildSyntheticTeacherAiGradingPackage();
    const findings = await findSensitiveTeacherAiGradingLabStagedFiles([
      { path: 'evidence/arbitrary-name.zip', content: packageZip, trackedBefore: false },
      { path: 'uploads/report.docx', content: Buffer.from('document'), trackedBefore: false },
      { path: 'data/map.json', content: Buffer.from(JSON.stringify([{ sampleId: 'sample-abcd', studentNumber: '1' }])), trackedBefore: false },
      { path: 'data/map.csv', content: Buffer.from('sampleId,email\nsample-abcd,student@example.test\n'), trackedBefore: false },
    ]);
    expect(findings.map((finding) => finding.reason)).toEqual([
      'evaluation package archive',
      'potential student submission',
      'identity mapping',
      'identity mapping',
    ]);
  });

  it('blocks tracked Word files while allowing ordinary source and data without identity field combinations', async () => {
    expect(await findSensitiveTeacherAiGradingLabStagedFiles([
      { path: 'docs/existing.docx', content: Buffer.from('tracked document'), trackedBefore: true },
      { path: 'src/example.ts', content: Buffer.from("const sampleId = 'sample-abcd';\n"), trackedBefore: false },
      { path: 'data/metrics.json', content: Buffer.from(JSON.stringify([{ sampleId: 'sample-abcd', score: 12 }])), trackedBefore: false },
      { path: 'data/metrics.tsv', content: Buffer.from('sampleId\tscore\nsample-abcd\t12\n'), trackedBefore: false },
    ])).toEqual([{ path: 'docs/existing.docx', reason: 'potential student submission' }]);
  });

  it('detects a renamed package whose authoritative rubric is T2S-20.md', async () => {
    const archive = await JSZip.loadAsync(await buildSyntheticTeacherAiGradingPackage());
    const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as { question: { path: string } };
    archive.remove(manifest.question.path);
    manifest.question.path = 'T2S-20.md';
    archive.file('T2S-20.md', '# synthetic rubric');
    archive.file('manifest.json', JSON.stringify(manifest));
    const t2Package = await archive.generateAsync({ type: 'nodebuffer' });

    await expect(findSensitiveTeacherAiGradingLabStagedFiles([
      { path: 'evidence/renamed-archive.zip', content: t2Package, trackedBefore: false },
    ])).resolves.toEqual([{ path: 'evidence/renamed-archive.zip', reason: 'evaluation package archive' }]);
  });

  it('explicitly allows source code and only the exact synthetic fixture paths', async () => {
    expect(findSensitiveTeacherAiGradingLabPaths([
      'src/lib/data-governance/teacher-ai-grading-lab-import.ts',
      'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic.ts',
      'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/sample-abcd/T1-4.docx',
    ])).toEqual([]);
    await expect(findSensitiveTeacherAiGradingLabStagedFiles([{
      path: 'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/sample-abcd/T1-4.docx',
      content: Buffer.from('synthetic fixture'),
      trackedBefore: true,
    }])).resolves.toEqual([]);
    await expect(findSensitiveTeacherAiGradingLabStagedFiles([{
      path: 'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/synthetic-unexpected.docx',
      content: Buffer.from('unexpected document'),
      trackedBefore: true,
    }])).resolves.toEqual([{
      path: 'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/synthetic-unexpected.docx',
      reason: 'potential student submission',
    }]);
  });

  it('checks staged index content without reading worktree replacements or printing sensitive details', async () => {
    const repository = await mkdtemp(join(tmpdir(), 'teacher-ai-grading-sensitive-check-'));
    tempRoots.push(repository);
    expect(runGit(repository, ['init']).status).toBe(0);

    await writeFile(join(repository, 'safe.ts'), 'export const safe = true;\n');
    expect(runGit(repository, ['add', 'safe.ts']).status).toBe(0);
    const safeCheck = runSensitiveFileCheck(repository);
    expect(safeCheck, `${safeCheck.stdout}${safeCheck.stderr}`).toMatchObject({ status: 0 });

    const stagedPackage = await buildSyntheticTeacherAiGradingPackage();
    await writeFile(join(repository, 'arbitrary.zip'), stagedPackage);
    expect(runGit(repository, ['add', '-f', 'arbitrary.zip']).status).toBe(0);
    await writeFile(join(repository, 'arbitrary.zip'), 'SAFE-WORKTREE-REPLACEMENT');
    const blocked = runSensitiveFileCheck(repository);
    expect(blocked.status).toBe(1);
    expect(`${blocked.stdout}${blocked.stderr}`).not.toContain('arbitrary.zip');
    expect(`${blocked.stdout}${blocked.stderr}`).not.toContain('SAFE-WORKTREE-REPLACEMENT');
    expect(`${blocked.stdout}${blocked.stderr}`).not.toContain('manifest.json');
  });
});

function runGit(cwd: string, args: string[]) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function runSensitiveFileCheck(cwd: string) {
  return spawnSync(
    process.execPath,
    [
      resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'),
      resolve(process.cwd(), 'scripts/data-governance/check-teacher-ai-grading-sensitive-files.ts'),
    ],
    { cwd, encoding: 'utf8' },
  );
}
