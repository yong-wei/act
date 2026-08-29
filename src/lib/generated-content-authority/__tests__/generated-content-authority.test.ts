import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GENERATED_CONTENT_AUTHORITY_MATRIX,
  assertGeneratedContentAuthorityFitness,
  computeEvidenceDigest,
  evaluateAssessmentDependencyQualification,
  scanDomainAuthorityWrites,
  extractRepoPaths,
  evaluateGeneratedContentAuthorityFitness,
  scanAuthoritySinkImports,
  scanReceiptPrivacyViolations,
  scanSuperdomainViolations,
  scanUndeclaredCrossDomainImports,
} from '@/lib/generated-content-authority';
import { GENERATED_CONTENT_INVARIANTS } from '@/lib/generated-content-authority/vocabulary';

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function initFixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'gca-fixture-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  git(root, ['config', 'user.name', 'fixture']);
  writeFileSync(join(root, '.gitignore'), 'node_modules\n');
  return root;
}

function commitAll(repoRoot: string, message: string): string {
  git(repoRoot, ['add', '-A']);
  const staged = git(repoRoot, ['diff', '--cached', '--name-only']);
  if (staged.trim().length > 0) {
    git(repoRoot, ['commit', '-m', message]);
  }
  return git(repoRoot, ['rev-parse', 'HEAD']);
}

function writeFixtureTree(root: string, options: {
  generationImportsSink?: boolean;
  crossDomainImport?: boolean;
  archiveTasksUnchecked?: boolean;
  schemaSharedModel?: boolean;
  productImportsMatrix?: boolean;
} = {}): void {
  const dirs = [
    'src/features/adaptive-assessment',
    'src/features/adaptive-assessment/__tests__',
    'src/features/assessment',
    'src/lib/assignments',
    'src/lib/smart-lesson-plan',
    'src/lib/smart-courseware',
    'src/app/api/assessment/generated-candidates',
    'src/lib/canonical-learning-fact-identity',
    'src/lib/data-governance',
    'prisma',
    'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance',
  ];
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });

  writeFileSync(join(root, 'src/features/adaptive-assessment/generated-candidate-governance.ts'), 'export const governance = true;\n');
  writeFileSync(join(root, 'src/features/adaptive-assessment/generated-candidate-persistence.ts'), 'export const persistence = true;\n');
  writeFileSync(join(root, 'src/features/adaptive-assessment/generated-candidate-catalog.ts'), 'export const catalog = true;\n');
  mkdirSync(join(root, 'src/features/adaptive-assessment/__tests__'), { recursive: true });
  writeFileSync(join(root, 'src/features/adaptive-assessment/__tests__/generated-candidate-governance.test.ts'), 'export {};\n');
  writeFileSync(join(root, 'src/features/adaptive-assessment/generated-catalog-runtime.ts'), 'export const runtime = true;\n');
  writeFileSync(join(root, 'src/app/api/assessment/generated-candidates/route.ts'),
    options.generationImportsSink
      ? "import { writeGeneratedCatalogRelease } from '@/features/adaptive-assessment/generated-candidate-catalog';\nexport const route = writeGeneratedCatalogRelease;\n"
      : 'export const route = true;\n');
  writeFileSync(join(root, 'src/features/assessment/adaptive-engine.ts'), 'export const engine = true;\n');
  writeFileSync(join(root, 'src/lib/assignments/assignment-review.ts'), 'export const review = true;\n');
  writeFileSync(join(root, 'src/lib/assignments/assignment-rubric-generation.ts'), 'export const rubric = true;\n');
  writeFileSync(join(root, 'src/lib/smart-lesson-plan/domain.ts'), 'export const domain = true;\n');
  writeFileSync(join(root, 'src/lib/smart-lesson-plan/service.ts'),
    options.crossDomainImport
      ? "import { publishSmartCoursewareRevision } from '@/lib/smart-courseware/publication-service';\nexport const service = publishSmartCoursewareRevision;\n"
      : 'export const service = true;\n');
  writeFileSync(join(root, 'src/lib/smart-lesson-plan/provider-runtime.ts'), 'export const provider = true;\n');
  writeFileSync(join(root, 'src/lib/smart-lesson-plan/worker.ts'), 'export const worker = true;\n');
  writeFileSync(join(root, 'src/lib/smart-courseware/publication-service.ts'), 'export const publish = true;\n');
  writeFileSync(join(root, 'src/lib/smart-courseware/generation-service.ts'), "import { domain } from '@/lib/smart-lesson-plan/domain';\nexport const generation = domain;\n");
  writeFileSync(join(root, 'src/lib/smart-courseware/provider-runtime.ts'), 'export const provider = true;\n');
  writeFileSync(join(root, 'src/lib/smart-courseware/worker.ts'), 'export const worker = true;\n');
  writeFileSync(join(root, 'prisma/schema.prisma'), options.schemaSharedModel
    ? 'model GeneratedContentCandidate { id String @id }\n'
    : 'model Example { id String @id }\n');
  writeFileSync(join(root, 'src/features/assessment/product.ts'), options.productImportsMatrix
    ? "import { GENERATED_CONTENT_AUTHORITY_MATRIX } from '@/lib/generated-content-authority/matrix';\nexport const uses = GENERATED_CONTENT_AUTHORITY_MATRIX;\n"
    : 'export const product = true;\n');
  writeFileSync(join(root, 'src/lib/canonical-learning-fact-identity/writer.ts'), 'export const writer = true;\n');
  writeFileSync(join(root, 'src/lib/data-governance/learning-fact-materialization.ts'), 'export const materialization = true;\n');
  writeFileSync(join(root, 'src/lib/data-governance/simulation-task-learning-fact.ts'), 'export const simulationFact = true;\n');
  writeFileSync(join(root, 'src/lib/smart-courseware/classroom-runtime.ts'), 'export const classroom = true;\n');
  writeFileSync(join(root, 'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/tasks.md'),
    options.archiveTasksUnchecked
      ? '- [ ] 1.1 pending\n'
      : '- [x] 1.1 done\n');

  // 证据存在性镜像：从矩阵引用派生其余全部路径（评估器按这些引用核验存在性）
  for (const row of GENERATED_CONTENT_AUTHORITY_MATRIX.rows) {
    const references = [
      row.draftIdentity.creationReference,
      ...(row.draftIdentity.notes ? [row.draftIdentity.notes] : []),
      ...row.validationEvidence,
      ...row.humanAcceptance,
      row.immutableRevision.driftGuardReference ?? '',
      row.publicationReceipt.reference,
      row.publicationReceipt.consumerBinding ?? '',
      ...row.denominator.routes,
      ...row.denominator.workers,
      ...row.denominator.callers,
      ...row.generationModules,
      ...row.forbiddenSinkModules,
    ];
    for (const reference of references) {
      for (const path of extractRepoPaths(reference)) {
        const absolute = join(root, path);
        if (existsSync(absolute)) continue;
        mkdirSync(join(absolute, '..'), { recursive: true });
        writeFileSync(absolute, path.endsWith('.prisma')
          ? 'model Placeholder { id String @id }\n'
          : 'export {}\n');
      }
    }
    // tests/scripts 分母按原始条目处理：目录条目（/ 结尾或无扩展名）建目录，其余建文件
    const denominatorEntries = [...row.denominator.tests, ...row.denominator.scripts];
    for (const entry of denominatorEntries) {
      const clean = entry.replace(/\/+$/u, '');
      if (!clean || !clean.includes('/')) continue;
      const absolute = join(root, clean);
      if (existsSync(absolute)) continue;
      const isDirectory = entry.endsWith('/') || !/\.[a-z]+$/iu.test(clean);
      mkdirSync(isDirectory ? absolute : join(absolute, '..'), { recursive: true });
      if (!isDirectory) {
        writeFileSync(absolute, 'export {}\n');
      }
    }
  }
  mkdirSync(join(root, 'src/lib/generated-content-authority'), { recursive: true });
  writeFileSync(join(root, 'src/lib/generated-content-authority/matrix.ts'), 'export const matrix = true;\n');
}

describe('generated content authority — receipt privacy scanning', () => {
  it('rejects prompts, model responses, answers, feedback, credentials, user ids, and local paths', () => {
    const violations = scanReceiptPrivacyViolations({
      nested: {
        promptText: 'explain closed loop',
        modelResponseText: 'a controller',
        answers: ['A'],
        feedbackBody: 'good',
        credential: 'sk-xxx',
        userId: 'user-1',
        studentEmail: 's@example.test',
        absolutePath: '/Users/yong/repo/file.ts',
        homePath: '~/secrets/x',
        windowsPath: 'C:\\Users\\y\\f',
        okField: 'src/lib/assignments/assignment-rubric-generation.ts',
      },
    });
    const reasons = violations.map((violation) => `${violation.path}:${violation.reason}`);
    expect(reasons).toContain('$.nested.promptText:forbidden-key');
    expect(reasons).toContain('$.nested.modelResponseText:forbidden-key');
    expect(reasons.some((entry) => entry.startsWith('$.nested.answers:'))).toBe(true);
    expect(reasons).toContain('$.nested.feedbackBody:forbidden-key');
    expect(reasons).toContain('$.nested.credential:forbidden-key');
    expect(reasons).toContain('$.nested.userId:forbidden-key');
    expect(reasons).toContain('$.nested.studentEmail:forbidden-key');
    expect(violations.some((violation) => violation.path === '$.nested.absolutePath')).toBe(true);
    expect(violations.some((violation) => violation.reason === 'absolute-local-path-value')).toBe(true);
    expect(reasons.filter((entry) => entry.includes('okField'))).toEqual([]);
  });

  it('accepts the committed matrix without privacy violations', () => {
    expect(scanReceiptPrivacyViolations(GENERATED_CONTENT_AUTHORITY_MATRIX, '$matrix')).toEqual([]);
  });

  it('enforces structured formats on QA receipt fields (fail-closed on free-text payloads)', () => {
    const violations = scanReceiptPrivacyViolations({
      qaReceipts: [
        {
          reference: 'student answer A — the model said the loop is stable',
          outputHash: 'a'.repeat(64),
          toolVersion: '1.0.0',
          revision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
          conclusion: 'PASS',
        },
        {
          reference: 'artifacts/qa/run-1.har',
          outputHash: 'b'.repeat(64),
          toolVersion: 'playwright/1.2',
          revision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
          conclusion: 'PASS',
        },
        {
          reference: 'user:42 answered incorrectly about gain margin',
          outputHash: 'c'.repeat(64),
          toolVersion: 'playwright/1.2',
          revision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
          conclusion: 'FAIL',
        },
        {
          // 无空格但非内容寻址/仓库路径：用户标识仍被字段格式拒绝
          reference: 'user:42',
          outputHash: 'd'.repeat(64),
          toolVersion: 'playwright/1.2',
          revision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
          conclusion: 'PASS',
        },
        {
          // 回执形状中的未知字段：原始 provider 载荷夹带即拒绝
          reference: 'artifacts/qa/run-2.har',
          outputHash: 'e'.repeat(64),
          toolVersion: 'playwright/1.2',
          revision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
          conclusion: 'PASS',
          payload: 'raw-provider-output',
        },
      ],
    });
    const failed = violations.filter((violation) => violation.reason === 'unstructured-payload-value');
    expect(failed).toHaveLength(3);
    const unknownFields = violations.filter((violation) => violation.reason === 'unknown-receipt-field');
    expect(unknownFields).toHaveLength(1);
    expect(unknownFields[0].path).toContain('.payload');
    expect(failed[0].path).toContain('qaReceipts[0].reference');
    expect(failed[1].path).toContain('qaReceipts[2].reference');
  });
});

describe('generated content authority — fixture fitness checks', () => {
  let root: string;
  let baseRevision: string;

  beforeAll(() => {
    root = initFixtureRepo();
    writeFixtureTree(root);
    baseRevision = commitAll(root, 'fixture tree');
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // 自洽绑定：fixture 的声明摘要与观测摘要都按 fixture 文件现算
  function fixtureInput(evidenceDigest: string | null = computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows)) {
    return {
      repoRoot: root,
      evidenceDigestOverride: evidenceDigest,
      declaredDigestOverride: computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows),
      headRelationOverride: 'ANCESTOR' as const,
    };
  }

  it('qualifies a clean fixture tree whose evidence, sinks, and dependency are consistent', () => {
    const report = evaluateGeneratedContentAuthorityFitness(fixtureInput());
    expect(report.sourceBinding).toMatchObject({ binding: 'CURRENT', mixedWorktree: expect.anything() });
    for (const row of report.rows) {
      const failed = GENERATED_CONTENT_INVARIANTS.filter((invariant) => row.invariantFindings[invariant].status !== 'QUALIFIED');
      expect(failed, `${row.domain}: ${failed.map((invariant) => row.invariantFindings[invariant].reasons).join('; ')}`).toEqual([]);
    }
    expect(report.rows.map((row) => row.domain)).toEqual(['assessment', 'assignment-rubric', 'smart-lesson', 'smart-courseware']);
    expect(report.settled).toBe('QUALIFIED');
  });

  it('fails closed when a generation module imports a forbidden authority sink', () => {
    writeFileSync(join(root, 'src/app/api/assessment/generated-candidates/route.ts'),
      "import { writeGeneratedCatalogRelease } from '@/features/adaptive-assessment/generated-candidate-catalog';\nexport const route = writeGeneratedCatalogRelease;\n");
    commitAll(root, 'introduce sink violation');
    const report = evaluateGeneratedContentAuthorityFitness(fixtureInput());
    const assessment = report.rows.find((row) => row.domain === 'assessment')!;
    expect(assessment.status).toBe('NOT_QUALIFIED');
    expect(assessment.blockedSinks).toContainEqual({
      module: 'src/features/adaptive-assessment/generated-candidate-catalog.ts',
      importedBy: 'src/app/api/assessment/generated-candidates/route.ts',
    });
    expect(assessment.invariantFindings.NO_DIRECT_AUTHORITY_WRITE.status).toBe('NOT_QUALIFIED');
    expect(report.settled).toBe('BLOCKED');
    expect(() => assertGeneratedContentAuthorityFitness(report)).toThrow(/NO_DIRECT_AUTHORITY_WRITE/);
    // 恢复现场，避免污染后续用例
    writeFileSync(join(root, 'src/app/api/assessment/generated-candidates/route.ts'), 'export const route = true;\n');
    commitAll(root, 'restore sink fixture');
  });

  it('marks stale evidence digests as BLOCKED via fail-closed binding', () => {
    const report = evaluateGeneratedContentAuthorityFitness({ repoRoot: root, evidenceDigestOverride: '0'.repeat(64) });
    expect(report.sourceBinding.binding).toBe('STALE');
    for (const row of report.rows) {
      expect(row.status).toBe('NOT_QUALIFIED');
      expect(row.invariantFindings.DOMAIN_OWNERSHIP.reasons.some((reason) => reason.startsWith('stale evidence digest'))).toBe(true);
    }
    expect(report.settled).toBe('BLOCKED');
  });

  it('fails closed when the evidence digest is unobservable', () => {
    const report = evaluateGeneratedContentAuthorityFitness({ repoRoot: root, evidenceDigestOverride: null });
    expect(report.sourceBinding.binding).toBe('UNOBSERVED');
    expect(report.settled).toBe('BLOCKED');
  });

  it('blocks the assessment row when #1564 evidence is missing or inconsistent', () => {
    const original = readFileSync(join(root, 'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/tasks.md'), 'utf8');
    writeFileSync(join(root, 'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/tasks.md'), '- [ ] 1.1 pending\n');
    commitAll(root, 'uncheck #1564 tasks');
    try {
      const report = evaluateGeneratedContentAuthorityFitness(fixtureInput());
      const assessment = report.rows.find((row) => row.domain === 'assessment')!;
      expect(assessment.dependency.qualification).toBe('NOT_QUALIFIED');
      expect(assessment.status, JSON.stringify(assessment.invariantFindings)).toBe('BLOCKED');
      expect(assessment.invariantFindings.HUMAN_ACCEPTED.status).toBe('BLOCKED');
      // 其它域不受 Assessment 依赖连带
      const smartCourseware = report.rows.find((row) => row.domain === 'smart-courseware')!;
      expect(smartCourseware.dependency.qualification).toBe('NOT_APPLICABLE');
      expect(smartCourseware.status).toBe('QUALIFIED');
    } finally {
      writeFileSync(join(root, 'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/tasks.md'), original);
      commitAll(root, 'restore #1564 tasks');
    }
  });

  it('narrows cross-domain edges to declared public contract modules', () => {
    // courseware 生成模块 import smart-lesson-plan 的 service（权威函数）：窄边外 → 违例
    writeFileSync(join(root, 'src/lib/smart-courseware/generation-service.ts'),
      "import { approveSmartLessonDraft } from '@/lib/smart-lesson-plan/service';\nexport const generation = approveSmartLessonDraft;\n");
    const authorityViolations = scanUndeclaredCrossDomainImports(root, {
      assessment: ['src/features/assessment/adaptive-engine.ts'],
      'assignment-rubric': ['src/lib/assignments/assignment-rubric-generation.ts'],
      'smart-lesson': ['src/lib/smart-lesson-plan/provider-runtime.ts'],
      'smart-courseware': ['src/lib/smart-courseware/generation-service.ts'],
    });
    expect(authorityViolations.some((violation) => violation.includes('smart-lesson-plan/service.ts'))).toBe(true);
    // 恢复为 domain/schema 公共契约 import：声明允许边内 → 无违例
    writeFileSync(join(root, 'src/lib/smart-courseware/generation-service.ts'),
      "import { domain } from '@/lib/smart-lesson-plan/domain';\nexport const generation = domain;\n");
    const clean = scanUndeclaredCrossDomainImports(root, {
      assessment: ['src/features/assessment/adaptive-engine.ts'],
      'assignment-rubric': ['src/lib/assignments/assignment-rubric-generation.ts'],
      'smart-lesson': ['src/lib/smart-lesson-plan/provider-runtime.ts'],
      'smart-courseware': ['src/lib/smart-courseware/generation-service.ts'],
    });
    expect(clean).toEqual([]);
  });

  it('records an unregistered-provider violation for domain-root AI modules that import no sink', () => {
    // 域根内新增仅调用 provider、不 import 任何 sink 的模块：仍必须产生
    // UNREGISTERED_PROVIDER 违例（unowned caller 不可绕过门禁）
    writeFileSync(join(root, 'src/lib/smart-courseware/rogue-provider.ts'),
      "import { generateText } from 'ai';\nexport const call = generateText;\n");
    commitAll(root, 'add rogue unregistered provider');
    const violations = scanDomainAuthorityWrites(root, {
      domainRootsByDomain: {
        assessment: ['src/features/adaptive-assessment/', 'src/features/assessment/', 'src/app/api/assessment/'],
        'assignment-rubric': ['src/lib/assignments/', 'src/app/api/teacher/assignments/'],
        'smart-lesson': ['src/lib/smart-lesson-plan/', 'src/app/api/teacher/smart-lesson-tasks/'],
        'smart-courseware': ['src/lib/smart-courseware/', 'src/app/api/teacher/smart-courseware/'],
      },
      authorityWriteSitesByDomain: {
        assessment: [], 'assignment-rubric': [], 'smart-lesson': [], 'smart-courseware': [],
      },
      registeredProviderModulesByDomain: {
        assessment: ['src/features/assessment/adaptive-engine.ts'],
        'assignment-rubric': ['src/lib/assignments/assignment-rubric-generation.ts'],
        'smart-lesson': ['src/lib/smart-lesson-plan/provider-runtime.ts', 'src/lib/smart-lesson-plan/service.ts', 'src/lib/smart-lesson-plan/worker.ts'],
        'smart-courseware': ['src/lib/smart-courseware/provider-runtime.ts', 'src/lib/smart-courseware/generation-service.ts', 'src/lib/smart-courseware/worker.ts'],
      },
      forbiddenSinkModulesByDomain: {
        assessment: [], 'assignment-rubric': [], 'smart-lesson': [], 'smart-courseware': [],
      },
      sinkScanExemptionsByDomain: {
        assessment: [], 'assignment-rubric': [], 'smart-lesson': [], 'smart-courseware': [],
      },
    });
    const providerViolations = violations.filter((violation) => (
      violation.kind === 'UNREGISTERED_PROVIDER' && violation.file === 'src/lib/smart-courseware/rogue-provider.ts'
    ));
    expect(providerViolations).toHaveLength(1);
    expect(providerViolations[0].domain).toBe('smart-courseware');
    writeFileSync(join(root, 'src/lib/smart-courseware/rogue-provider.ts'), 'export const rogue = true;\n');
    commitAll(root, 'restore rogue fixture');
  });

  it('rejects undeclared cross-domain imports from other domains', () => {
    writeFileSync(join(root, 'src/lib/smart-lesson-plan/service.ts'),
      "import { publishSmartCoursewareRevision } from '@/lib/smart-courseware/publication-service';\nexport const service = publishSmartCoursewareRevision;\n");
    const violations = scanUndeclaredCrossDomainImports(root, {
      assessment: ['src/features/assessment/adaptive-engine.ts'],
      'assignment-rubric': ['src/lib/assignments/assignment-rubric-generation.ts'],
      'smart-lesson': ['src/lib/smart-lesson-plan/service.ts'],
      'smart-courseware': ['src/lib/smart-courseware/generation-service.ts'],
    });
    expect(violations.some((violation) => violation.includes('smart-lesson-plan/service.ts -> src/lib/smart-courseware/publication-service.ts'))).toBe(true);
    writeFileSync(join(root, 'src/lib/smart-lesson-plan/service.ts'), 'export const service = true;\n');
  });

  it('rejects shared candidate models and product imports of the governance matrix', () => {
    const originalSchema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
    const originalProduct = readFileSync(join(root, 'src/features/assessment/product.ts'), 'utf8');
    writeFileSync(join(root, 'prisma/schema.prisma'), 'model GeneratedContentCandidate { id String @id }\n');
    writeFileSync(join(root, 'src/features/assessment/product.ts'),
      "import { GENERATED_CONTENT_AUTHORITY_MATRIX } from '@/lib/generated-content-authority/matrix';\nexport const uses = GENERATED_CONTENT_AUTHORITY_MATRIX;\n");
    try {
      const violations = scanSuperdomainViolations(root);
      expect(violations.some((violation) => violation.includes('forbidden shared model'))).toBe(true);
      expect(violations.some((violation) => violation.includes('runtime authority attempt'))).toBe(true);
      // 相对路径 import 同样必须被解析识别
      writeFileSync(join(root, 'src/features/assessment/product.ts'),
        "import { GENERATED_CONTENT_AUTHORITY_MATRIX } from '../../lib/generated-content-authority/matrix';\nexport const uses = GENERATED_CONTENT_AUTHORITY_MATRIX;\n");
      const relativeViolations = scanSuperdomainViolations(root);
      expect(relativeViolations.some((violation) => violation.includes('runtime authority attempt'))).toBe(true);
    } finally {
      writeFileSync(join(root, 'prisma/schema.prisma'), originalSchema);
      writeFileSync(join(root, 'src/features/assessment/product.ts'), originalProduct);
      commitAll(root, 'restore superdomain fixtures');
    }
  });

  it('includes denominator test evidence and directory content in the evidence digest', () => {
    const before = computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows);
    // 声明的测试证据文件被弱化 → 摘要变化
    const assessmentTestFile = join(root, 'src/features/adaptive-assessment/__tests__/generated-candidate-governance.test.ts');
    writeFileSync(assessmentTestFile, 'export const weakened = true;\n');
    const afterWeaken = computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows);
    expect(afterWeaken).not.toBe(before);
    writeFileSync(assessmentTestFile, 'export {};\n');
    // 声明的测试证据目录（smart-lesson __tests__）内新增 tracked 文件 → 摘要变化（递归散列）
    const lessonTestsDir = join(root, 'src/lib/smart-lesson-plan/__tests__');
    mkdirSync(lessonTestsDir, { recursive: true });
    writeFileSync(join(lessonTestsDir, 'extra-cover.test.ts'), 'export {};\n');
    commitAll(root, 'add tracked dir evidence');
    const afterDirAdd = computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows);
    expect(afterDirAdd).not.toBe(before);
    rmSync(join(lessonTestsDir, 'extra-cover.test.ts'));
    commitAll(root, 'remove dir evidence');
    // 声明的测试证据文件被删除 → MISSING 标记 → 摘要变化
    rmSync(assessmentTestFile);
    const afterDelete = computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows);
    expect(afterDelete).not.toBe(before);
    writeFileSync(assessmentTestFile, 'export {};\n');
    expect(computeEvidenceDigest(root, GENERATED_CONTENT_AUTHORITY_MATRIX.rows)).toBe(before);
  });

  it('exposes idempotency, rollback, and authorization evidence for every domain row', () => {
    for (const row of GENERATED_CONTENT_AUTHORITY_MATRIX.rows) {
      expect(row.idempotencyBoundary.trim().length).toBeGreaterThan(0);
      expect(row.rollbackOwner.trim().length).toBeGreaterThan(0);
      expect(row.humanAcceptance.length).toBeGreaterThan(0);
    }
  });
});

describe('generated content authority — real repository evaluation', () => {
  it('binds the matrix to a reconciled revision and qualifies the assessment dependency against #1564', () => {
    expect(GENERATED_CONTENT_AUTHORITY_MATRIX.sourceRevision).not.toMatch(/^PENDING/u);
    const qualification = evaluateAssessmentDependencyQualification(process.cwd());
    expect(qualification.qualification).toBe('QUALIFIED');
  });

  it('keeps every real row free of sink imports, cross-domain violations, and privacy leaks (self-consistent binding)', () => {
    const report = evaluateGeneratedContentAuthorityFitness({
      repoRoot: process.cwd(),
      observedRevisionOverride: GENERATED_CONTENT_AUTHORITY_MATRIX.sourceRevision,
    });
    for (const row of report.rows) {
      expect(row.blockedSinks, `${row.domain} sink violations`).toEqual([]);
      const failed = GENERATED_CONTENT_INVARIANTS.filter((invariant) => row.invariantFindings[invariant].status !== 'QUALIFIED');
      expect(failed, `${row.domain}: ${failed.map((invariant) => `${invariant}=${row.invariantFindings[invariant].reasons.join('; ')}`).join(' | ')}`).toEqual([]);
    }
    expect(report.violations).toEqual([]);
  });

  it('settles the real matrix through the dependency-qualified assessment row', () => {
    const report = evaluateGeneratedContentAuthorityFitness({
      repoRoot: process.cwd(),
      observedRevisionOverride: GENERATED_CONTENT_AUTHORITY_MATRIX.sourceRevision,
    });
    const assessment = report.rows.find((row) => row.domain === 'assessment')!;
    expect(assessment.dependency.changeId).toContain('#1564');
    expect(assessment.dependency.qualification).toBe('QUALIFIED');
    expect(assessment.status).toBe('QUALIFIED');
    assertGeneratedContentAuthorityFitness(report);
  });
});
