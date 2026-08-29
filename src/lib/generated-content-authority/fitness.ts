import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, posix, resolve } from 'node:path';

import { extractSpecifiers } from '@/lib/architecture-census/imports';

import { scanReceiptPrivacyViolations } from './privacy';
import {
  ASSESSMENT_DEPENDENCY_ARCHIVE,
  ASSESSMENT_DEPENDENCY_EVIDENCE,
  DECLARED_CROSS_DOMAIN_IMPORT_PATHS,
  FORBIDDEN_SHARED_MODEL_PATTERNS,
  AUTHORITY_MODEL_DOMAIN,
  AUTHORITY_WRITE_MODEL_PATTERN,
  GENERATED_CONTENT_AUTHORITY_MATRIX,
  GENERATED_CONTENT_DOMAIN_ROOTS,
  PROVIDER_DISCOVERY_PATTERNS,
} from './matrix';
import type { GeneratedContentAuthorityRow } from './vocabulary';
import {
  GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION,
  GENERATED_CONTENT_INVARIANTS,
  type GeneratedContentAuthorityStatus,
  type GeneratedContentDomain,
  type GeneratedContentFitnessReport,
  type GeneratedContentInvariant,
} from './vocabulary';

type InvariantFindings = Record<GeneratedContentInvariant, { status: GeneratedContentAuthorityStatus; reasons: string[] }>;

interface FitnessInput {
  /** 仓库根（默认 process.cwd()） */
  readonly repoRoot?: string;
  /**
   * 证据摘要覆盖。默认重算当前证据文件的 sha256 摘要并与矩阵比对；
   * 单测可注入以验证 STALE/UNOBSERVED 语义（null = 无法观测，fail-closed）。
   */
  readonly evidenceDigestOverride?: string | null;
  /** 单测注入：模拟矩阵声明的摘要（默认读真实矩阵字段） */
  readonly declaredDigestOverride?: string;
  /** 单测注入：模拟声明修订与 HEAD 的谱系关系（默认 git merge-base 判定） */
  readonly headRelationOverride?: 'ANCESTOR' | 'UNRELATED' | 'UNOBSERVED';
}

function emptyFindings(): InvariantFindings {
  return Object.fromEntries(
    GENERATED_CONTENT_INVARIANTS.map((invariant) => [invariant, { status: 'QUALIFIED' as const, reasons: [] as string[] }]),
  ) as InvariantFindings;
}

function failInvariant(findings: InvariantFindings, invariant: GeneratedContentInvariant, reason: string): void {
  findings[invariant].status = 'NOT_QUALIFIED';
  findings[invariant].reasons.push(reason);
}


const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/iu;

function candidatePaths(target: string): string[] {
  if (SOURCE_EXTENSION.test(target)) return [target];
  return [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.mjs`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
  ];
}

/**
 * 规范化 import 解析：@/ → src/，相对路径经 posix.normalize 折叠 '..'，
 * 然后按 TS 扩展名候选匹配 tracked 文件集。census 的 resolveImport 不折叠
 * '..' 段，这里自行实现以保证相对路径深 import 也可判定。
 */
function resolveSpecifier(fromPath: string, specifier: string, tracked: ReadonlySet<string>): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith('.')) {
    base = normalize(posix.join(posix.dirname(fromPath.split('\\').join('/')), specifier));
  } else {
    return null;
  }
  return candidatePaths(base).find((candidate) => tracked.has(candidate)) ?? null;
}

function gitLsFiles(repoRoot: string): Set<string> {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  return new Set(output.split('\0').filter(Boolean));
}

function observedHeadRevision(repoRoot: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * 声明修订与观测 HEAD 的谱系关系：ANCESTOR = 对账提交在当前历史中
 * （git merge-base --is-ancestor）；UNRELATED/不可观测 → fail-closed。
 * 采用祖先语义而非 HEAD 相等：声明修订写入其自身内容的提交在哈希上
 * 不可自指（与仓库 architecture-fitness 的 REQUIRED_BASELINE 提交产物
 * 对比惯例一致）；证据内容漂移由 evidenceDigest 单独判定。
 */
function resolveHeadRelation(repoRoot: string, declaredRevision: string): 'ANCESTOR' | 'UNRELATED' | 'UNOBSERVED' {
  const observed = observedHeadRevision(repoRoot);
  if (!observed) return 'UNOBSERVED';
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', declaredRevision, observed], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return 'ANCESTOR';
  } catch {
    return 'UNRELATED';
  }
}

function hasMixedWorktree(repoRoot: string): boolean {
  try {
    const porcelain = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
    return porcelain.trim().length > 0;
  } catch {
    return true;
  }
}

function rowStatusFromFindings(
  findings: InvariantFindings,
  dependency: 'NOT_APPLICABLE' | 'QUALIFIED' | 'NOT_QUALIFIED',
): GeneratedContentAuthorityStatus {
  // NOT_QUALIFIED（证据缺失/违例）压过 BLOCKED（显式依赖未满足）；
  // 仅 BLOCKED 级 finding 时行保持 BLOCKED 且依赖可见。
  if (GENERATED_CONTENT_INVARIANTS.some((invariant) => findings[invariant].status === 'NOT_QUALIFIED')) {
    return 'NOT_QUALIFIED';
  }
  if (dependency === 'NOT_QUALIFIED'
    || GENERATED_CONTENT_INVARIANTS.some((invariant) => findings[invariant].status === 'BLOCKED')) {
    return 'BLOCKED';
  }
  return 'QUALIFIED';
}

/**
 * #1564 资格评估（spec: Assessment remains blocked behind #1564）：
 * 归档 change 存在、任务全部完成、实现/测试/回执契约文件在位 → QUALIFIED；
 * 任一缺失或不一致 → NOT_QUALIFIED（Assessment 行 BLOCKED）。
 */
export function evaluateAssessmentDependencyQualification(repoRoot: string): {
  qualification: 'QUALIFIED' | 'NOT_QUALIFIED';
  reasons: string[];
} {
  const reasons: string[] = [];
  const archivePath = join(repoRoot, ASSESSMENT_DEPENDENCY_ARCHIVE);
  if (!existsSync(archivePath) || !statSync(archivePath).isDirectory()) {
    return { qualification: 'NOT_QUALIFIED', reasons: [`#1564 archive missing: ${ASSESSMENT_DEPENDENCY_ARCHIVE}`] };
  }
  const tasksText = readFileSync(join(archivePath, 'tasks.md'), 'utf8');
  const unchecked = (tasksText.match(/^- \[ \]/gmu) ?? []).length;
  if (unchecked > 0) {
    reasons.push(`#1564 tasks.md has ${unchecked} unchecked task(s)`);
  }
  for (const evidence of ASSESSMENT_DEPENDENCY_EVIDENCE) {
    if (!existsSync(join(repoRoot, evidence))) {
      reasons.push(`#1564 implementation evidence missing: ${evidence}`);
    }
  }
  return reasons.length === 0
    ? { qualification: 'QUALIFIED', reasons: [`#1564 archived with complete tasks and ${ASSESSMENT_DEPENDENCY_EVIDENCE.length} evidence files present`] }
    : { qualification: 'NOT_QUALIFIED', reasons };
}

function rowEvidencePaths(row: GeneratedContentAuthorityRow): string[] {
  const references: readonly string[] = [
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
    ...row.denominator.tests,
    ...row.denominator.scripts,
    ...row.generationModules,
    ...row.forbiddenSinkModules,
  ];
  const paths = new Set<string>();
  for (const reference of references) {
    for (const path of extractRepoPaths(reference)) paths.add(path);
  }
  for (const path of [...row.generationModules, ...row.forbiddenSinkModules]) paths.add(path);
  return [...paths].sort();
}

/**
 * 证据文件内容摘要：对矩阵全部被引用证据文件按路径排序后做 sha256。
 * 绑定判定用（HEAD 移动不影响；证据文件真实漂移才 STALE）。
 */
export /** 递归散列目录内容（相对路径 + 每文件 sha256），目录内容变化必然改变摘要。 */
function hashDirectoryRecursively(
  hash: ReturnType<typeof createHash>,
  tracked: ReadonlySet<string>,
  absoluteDir: string,
  displayRoot: string,
): void {
  const entries = readdirSync(absoluteDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = join(absoluteDir, entry.name);
    const display = `${displayRoot}/${entry.name}`;
    if (entry.isDirectory()) {
      hashDirectoryRecursively(hash, tracked, absolute, display);
    } else if (entry.isFile()) {
      // 仅散列 git 跟踪文件：.DS_Store / *.log 等本地未跟踪文件不属于
      // 捕获修订，不得阻断绑定判定
      if (!tracked.has(display)) continue;
      hash.update(`${display}:${createHash('sha256').update(readFileSync(absolute)).digest('hex')}\n`);
    }
  }
}

export function computeEvidenceDigest(repoRoot: string, rows: readonly GeneratedContentAuthorityRow[]): string {
  const tracked = gitLsFiles(repoRoot);
  const hash = createHash('sha256');
  for (const row of rows) {
    for (const path of rowEvidencePaths(row)) {
      const absolute = join(repoRoot, path);
      let marker = 'MISSING';
      if (existsSync(absolute)) {
        if (statSync(absolute).isDirectory()) {
          hashDirectoryRecursively(hash, tracked, absolute, path);
          continue;
        }
        // 单文件证据同样限定跟踪文件：未跟踪 = 不属于捕获修订（MISSING 语义）
        marker = tracked.has(path)
          ? createHash('sha256').update(readFileSync(absolute)).digest('hex')
          : 'MISSING';
      }
      hash.update(`${path}:${marker}`);
      hash.update('\n');
    }
  }
  return hash.digest('hex');
}

/** 从证据引用文本中提取仓库相对路径候选（src|prisma|openspec|data|scripts 前缀）。 */
export function extractRepoPaths(reference: string): string[] {
  return [...reference.matchAll(/((?:src|prisma|openspec|data|scripts)\/[\w@[\].!~-]+(?:\/[\w@[\].!~-]+)*)/gu)]
    .map((match) => match[1]);
}

/**
 * 来源扫描：声明生成模块的已解析 import 是否命中禁止 sink 模块。
 * 返回被阻断的 sink（module=目标 sink，importedBy=生成模块）。
 */
export function scanAuthoritySinkImports(
  repoRoot: string,
  generationModules: readonly string[],
  forbiddenSinkModules: readonly string[],
  options: {
    exemptions?: readonly string[];
  } = {},
): Array<{ module: string; importedBy: string }> {
  const names = gitLsFiles(repoRoot);
  const forbidden = new Set(forbiddenSinkModules);
  const blocked: Array<{ module: string; importedBy: string }> = [];
  const seen = new Set<string>();

  for (const modulePath of generationModules) {
    const absolute = join(repoRoot, modulePath);
    if (!existsSync(absolute)) continue;
    if ((options.exemptions ?? []).some((exempt) => modulePath.startsWith(exempt.split('（')[0]))) continue;
    const content = readFileSync(absolute, 'utf8');
    for (const specifier of extractSpecifiers(modulePath, content)) {
      const target = resolveSpecifier(modulePath, specifier, names);
      if (!target) continue;
      if (forbidden.has(target) && !seen.has(`${modulePath}->${target}`)) {
        seen.add(`${modulePath}->${target}`);
        blocked.push({ module: target, importedBy: modulePath });
      }
    }
  }
  return blocked;
}

function globalPattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
}

/**
 * default-deny 权威写扫描（task 3.1 的封闭实现）：
 * 范围 = 全仓库 tracked src 源文件（排除测试与治理模块自身），与域根无关——
 * 任何位置（含 src/app/api 路由）的权威模型写调用都必须落在该模型属主域
 * 登记的 authorityWriteSites 白名单内；provider/AI 调用点必须登记于
 * generationModules。分母由 tracked 文件集封闭，无手工枚举。
 */
export function scanDomainAuthorityWrites(
  repoRoot: string,
  options: {
    domainRootsByDomain: Readonly<Record<GeneratedContentDomain, readonly string[]>>;
    authorityWriteSitesByDomain: Readonly<Record<GeneratedContentDomain, readonly string[]>>;
    registeredProviderModulesByDomain: Readonly<Record<GeneratedContentDomain, readonly string[]>>;
  },
): { unauthorizedWrites: string[]; unregisteredProviders: string[] } {
  const tracked = gitLsFiles(repoRoot);
  const scanScope = Array.from(tracked).filter((path) => (
    /^src\/.*\.[cm]?[jt]sx?$/u.test(path)
    && !path.startsWith('src/lib/generated-content-authority/')
    && !path.includes('__tests__/')
    && !/\.test\.[cm]?[jt]sx?$/u.test(path)
  ));

  const unauthorizedWrites: string[] = [];
  const unregisteredProviders: string[] = [];

  for (const path of scanScope) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, 'utf8');

    // 权威写点发现：全域 default-deny（写权威模型与域无关，必须登记）
    for (const match of content.matchAll(globalPattern(AUTHORITY_WRITE_MODEL_PATTERN))) {
      const model = match[1];
      const ownerDomain = AUTHORITY_MODEL_DOMAIN[model];
      if (!ownerDomain) continue;
      const writeSites = options.authorityWriteSitesByDomain[ownerDomain] ?? [];
      const isWriteSite = writeSites.some((site) => site.split('（')[0].trim() === path);
      if (!isWriteSite) {
        unauthorizedWrites.push(`unregistered ${ownerDomain} authority-model write (${model}): ${path}`);
      }
    }

    // provider 登记发现：范围限于四域根 + 已登记入口（域外 AI 使用不属本矩阵管辖）
    const providerScopeRoots = Object.entries(options.domainRootsByDomain)
      .flatMap(([domain, roots]) => roots.map((root) => ({ domain: domain as GeneratedContentDomain, root })));
    const inProviderScope = providerScopeRoots.some(({ root }) => path.startsWith(root))
      || (Object.values(options.registeredProviderModulesByDomain) as unknown as readonly string[][])
        .some((modules) => modules.includes(path));
    if (!inProviderScope) continue;
    const isProviderCallSite = PROVIDER_DISCOVERY_PATTERNS.some((pattern) => pattern.test(content));
    if (isProviderCallSite) {
      const registered = (Object.values(options.registeredProviderModulesByDomain) as unknown as readonly string[][])
        .some((modules) => modules.includes(path));
      if (!registered) {
        unregisteredProviders.push(path);
      }
    }

    for (const match of content.matchAll(new RegExp(AUTHORITY_WRITE_MODEL_PATTERN.source, AUTHORITY_WRITE_MODEL_PATTERN.flags.includes('g') ? AUTHORITY_WRITE_MODEL_PATTERN.flags : AUTHORITY_WRITE_MODEL_PATTERN.flags + 'g'))) {
      const model = match[1];
      const ownerDomain = AUTHORITY_MODEL_DOMAIN[model];
      if (!ownerDomain) continue;
      const writeSites = options.authorityWriteSitesByDomain[ownerDomain] ?? [];
      const isWriteSite = writeSites.some((site) => site.split('（')[0].trim() === path);
      if (!isWriteSite) {
        unauthorizedWrites.push(`unregistered ${ownerDomain} authority-model write (${model}): ${path}`);
      }
    }
  }
  return { unauthorizedWrites, unregisteredProviders };
}

export function scanUndeclaredCrossDomainImports(
  repoRoot: string,
  domainGenerationModules: Readonly<Record<GeneratedContentDomain, readonly string[]>>,
): string[] {
  const names = gitLsFiles(repoRoot);
  const domainRoots: ReadonlyArray<{ domain: GeneratedContentDomain | 'unowned'; root: string }> = [
    { domain: 'assessment', root: 'src/features/adaptive-assessment/' },
    { domain: 'assessment', root: 'src/features/assessment/' },
    { domain: 'assignment-rubric', root: 'src/lib/assignments/' },
    { domain: 'smart-lesson', root: 'src/lib/smart-lesson-plan/' },
    { domain: 'smart-courseware', root: 'src/lib/smart-courseware/' },
  ];

  const violations: string[] = [];
  for (const [domain, modules] of Object.entries(domainGenerationModules) as Array<[GeneratedContentDomain, readonly string[]]>) {
    for (const modulePath of modules) {
      const absolute = join(repoRoot, modulePath);
      if (!existsSync(absolute)) continue;
      const content = readFileSync(absolute, 'utf8');
      for (const specifier of extractSpecifiers(modulePath, content)) {
        const target = resolveSpecifier(modulePath, specifier, names);
        if (!target) continue;
        if (!domainRoots.some(({ root }) => target.startsWith(root))) continue;
        const targetDomain = domainRoots.find(({ root }) => target.startsWith(root))?.domain;
        if (!targetDomain || targetDomain === domain) continue;
        const declared = DECLARED_CROSS_DOMAIN_IMPORT_PATHS.some((allowed) => (
          modulePath.startsWith(allowed.from) && allowed.toModules.includes(target)
        ));
        if (!declared) {
          violations.push(`undeclared cross-domain import: ${modulePath} -> ${target} (${domain} -> ${targetDomain})`);
        }
      }
    }
  }
  return violations;
}

/** no-superdomain：产品代码不得 import 治理矩阵模块（含相对路径写法）；Prisma 不得声明共享候选/状态模型。 */
export function scanSuperdomainViolations(repoRoot: string): string[] {
  const violations: string[] = [];
  const tracked = gitLsFiles(repoRoot);
  const names = Array.from(tracked).filter((path) => (
    /^src\/.*\.[cm]?[jt]sx?$/u.test(path)
    && !path.startsWith('src/lib/generated-content-authority/')
    && !path.includes('__tests__')
  ));

  for (const path of names) {
    const content = readFileSync(join(repoRoot, path), 'utf8');
    if (!content.includes('generated-content-authority')) continue;
    for (const specifier of extractSpecifiers(path, content)) {
      const target = resolveSpecifier(path, specifier, tracked);
      if (!target) continue;
      if (target.startsWith('src/lib/generated-content-authority/')) {
        violations.push(`product module imports the governance matrix (runtime authority attempt): ${path}`);
        break;
      }
    }
  }

  const schemaPath = join(repoRoot, 'prisma/schema.prisma');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf8');
    for (const pattern of FORBIDDEN_SHARED_MODEL_PATTERNS) {
      if (pattern.test(schema)) {
        violations.push(`prisma schema declares a forbidden shared model: ${pattern.source}`);
      }
    }
  }
  return violations;
}

function checkRowEvidencePresence(
  repoRoot: string,
  row: typeof GENERATED_CONTENT_AUTHORITY_MATRIX.rows[number],
  findings: InvariantFindings,
): void {
  const references: readonly string[] = [
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
  ];
  for (const reference of references) {
    for (const path of extractRepoPaths(reference)) {
      if (!existsSync(join(repoRoot, path))) {
        failInvariant(findings, 'DOMAIN_OWNERSHIP', `evidence path missing: ${path}`);
      }
    }
  }
  for (const modulePath of row.generationModules) {
    if (!existsSync(join(repoRoot, modulePath))) {
      failInvariant(findings, 'NO_DIRECT_AUTHORITY_WRITE', `declared generation module missing: ${modulePath}`);
    }
  }
  for (const modulePath of row.forbiddenSinkModules) {
    if (!existsSync(join(repoRoot, modulePath))) {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', `declared forbidden sink module missing: ${modulePath}`);
    }
  }
}

function checkRowContractFields(
  row: typeof GENERATED_CONTENT_AUTHORITY_MATRIX.rows[number],
  findings: InvariantFindings,
): void {
  if (!row.owner.trim()) failInvariant(findings, 'DOMAIN_OWNERSHIP', 'owner missing');
  if (!row.idempotencyBoundary.trim()) failInvariant(findings, 'DOMAIN_OWNERSHIP', 'idempotency boundary missing');
  if (!row.rollbackOwner.trim()) failInvariant(findings, 'DOMAIN_OWNERSHIP', 'rollback owner missing');
  if (row.validationEvidence.length === 0) failInvariant(findings, 'VALIDATED_DETERMINISTIC', 'no deterministic validation evidence');
  if (row.humanAcceptance.length === 0) failInvariant(findings, 'HUMAN_ACCEPTED', 'no human acceptance point');
  if (!row.immutableRevision.model.trim()) failInvariant(findings, 'IMMUTABLE_REVISION', 'no immutable revision model');
  if (row.publicationReceipt.kind === 'EQUIVALENT' && !row.publicationReceipt.consumerBinding) {
    failInvariant(findings, 'PUBLICATION_RECEIPT', 'equivalent authority requires a declared consumer binding');
  }
  if (row.generationModules.length === 0) failInvariant(findings, 'NO_DIRECT_AUTHORITY_WRITE', 'no generation modules declared for sink scanning');
  if (row.forbiddenSinkModules.length === 0) failInvariant(findings, 'NO_DIRECT_AUTHORITY_WRITE', 'no forbidden sinks declared');
}

/**
 * 只读 fitness 评估：对整个矩阵做来源绑定、证据存在性、契约字段、
 * sink 扫描、跨域深 import、no-superdomain、#1564 资格与隐私校验。
 * 绝不调用生成/发布服务，也绝不修改产品记录。
 */
export function evaluateGeneratedContentAuthorityFitness(input: FitnessInput = {}): GeneratedContentFitnessReport {
  const repoRoot = resolve(input.repoRoot ?? process.cwd());
  const declared = GENERATED_CONTENT_AUTHORITY_MATRIX.sourceRevision;
  const declaredDigest = input.declaredDigestOverride ?? GENERATED_CONTENT_AUTHORITY_MATRIX.evidenceDigest;
  const observed = observedHeadRevision(repoRoot);
  const mixedWorktree = hasMixedWorktree(repoRoot);
  const computedDigest = computeEvidenceDigest(repoRoot, GENERATED_CONTENT_AUTHORITY_MATRIX.rows);
  const bindingState: 'CURRENT' | 'STALE' | 'UNOBSERVED' = input.evidenceDigestOverride !== undefined
    ? (input.evidenceDigestOverride === null
      ? 'UNOBSERVED'
      : input.evidenceDigestOverride === declaredDigest ? 'CURRENT' : 'STALE')
    : (input.declaredDigestOverride === undefined && declaredDigest === 'PENDING-EVIDENCE-DIGEST'
      ? 'UNOBSERVED'
      : computedDigest === declaredDigest ? 'CURRENT' : 'STALE');

  const headRelation = input.headRelationOverride ?? resolveHeadRelation(repoRoot, declared);
  const binding: GeneratedContentFitnessReport['sourceBinding'] = {
    declaredRevision: declared,
    observedRevision: observed,
    binding: bindingState,
    mixedWorktree,
  };

  const violations: string[] = [];
  const domainGenerationModules = Object.fromEntries(
    GENERATED_CONTENT_AUTHORITY_MATRIX.rows.map((row) => [row.domain, row.generationModules]),
  ) as Record<GeneratedContentDomain, readonly string[]>;

  const writeScan = scanDomainAuthorityWrites(repoRoot, {
    domainRootsByDomain: GENERATED_CONTENT_DOMAIN_ROOTS,
    authorityWriteSitesByDomain: Object.fromEntries(
      GENERATED_CONTENT_AUTHORITY_MATRIX.rows.map((row) => [row.domain, row.authorityWriteSites]),
    ) as Record<GeneratedContentDomain, readonly string[]>,
    registeredProviderModulesByDomain: Object.fromEntries(
      GENERATED_CONTENT_AUTHORITY_MATRIX.rows.map((row) => [row.domain, row.generationModules]),
    ) as Record<GeneratedContentDomain, readonly string[]>,
  });
  const crossDomainViolations = scanUndeclaredCrossDomainImports(repoRoot, domainGenerationModules);
  violations.push(...crossDomainViolations);
  const superdomainViolations = scanSuperdomainViolations(repoRoot);
  violations.push(...superdomainViolations);
  const matrixPrivacy = scanReceiptPrivacyViolations(GENERATED_CONTENT_AUTHORITY_MATRIX, '$matrix');
  violations.push(...matrixPrivacy.map((violation) => `privacy: ${violation.path} (${violation.reason})`));

  const rows = GENERATED_CONTENT_AUTHORITY_MATRIX.rows.map((row) => {
    const findings = emptyFindings();
    const rowSourceRevision = row.sourceRevision;

    // 来源绑定（task 1.4）：行级修订缺失、行级与矩阵级混合、矩阵级 STALE/UNOBSERVED → fail-closed
    if (!rowSourceRevision || rowSourceRevision.startsWith('PENDING')) {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', 'row source revision not reconciled (PENDING)');
    } else if (rowSourceRevision !== declared) {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', `mixed source revision: row ${rowSourceRevision} != matrix ${declared}`);
    }
    if (binding.binding === 'STALE') {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', 'stale evidence digest: matrix evidence has drifted from the recorded files');
    }
    if (binding.binding === 'UNOBSERVED') {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', 'evidence digest unobservable (fail-closed)');
    }

    checkRowContractFields(row, findings);
    checkRowEvidencePresence(repoRoot, row, findings);

    const blockedSinks = scanAuthoritySinkImports(repoRoot, row.generationModules, row.forbiddenSinkModules, {
      exemptions: row.sinkScanExemptions ?? [],
    });
    for (const sink of blockedSinks) {
      failInvariant(findings, 'NO_DIRECT_AUTHORITY_WRITE', `generation module imports authority sink: ${sink.importedBy} -> ${sink.module}`);
    }
    for (const violation of writeScan.unauthorizedWrites) {
      if (violation.startsWith(`unregistered ${row.domain} authority-model write`)) {
        failInvariant(findings, 'NO_DIRECT_AUTHORITY_WRITE', violation);
      }
    }
    for (const providerModule of writeScan.unregisteredProviders) {
      const ownerDomain = GENERATED_CONTENT_AUTHORITY_MATRIX.rows.find((matrixRow) => (
        matrixRow.generationModules.some((modulePath) => providerModule.startsWith(modulePath.replace(/\/[\w-]+\.tsx?$/u, '/')))
      ))?.domain;
      if (ownerDomain === row.domain || !ownerDomain) {
        if (row.domain === 'smart-courseware' || !ownerDomain) {
          // 未登记 provider 归入最接近的域或全局违例
        }
      }
      if (!ownerDomain) {
        failInvariant(findings, 'DOMAIN_OWNERSHIP', `unregistered provider/generation entry: ${providerModule} (declare it in generationModules or remove the AI call)`);
      }
    }
    // QA 回执修订绑定：每条回执 revision 必须等于行 sourceRevision（对账修订）
    for (const receipt of row.qaReceipts ?? []) {
      if (receipt.revision !== rowSourceRevision) {
        failInvariant(findings, 'DOMAIN_OWNERSHIP', `qa receipt revision ${receipt.revision} != reconciled source revision ${rowSourceRevision}`);
      }
    }

    for (const violation of crossDomainViolations) {
      if (violation.startsWith(`undeclared cross-domain import: `)) {
        const fromModule = violation.split(' -> ')[0].replace('undeclared cross-domain import: ', '');
        if (row.generationModules.includes(fromModule)) {
          failInvariant(findings, 'DOMAIN_OWNERSHIP', violation);
        }
      }
    }

    const dependency = row.domain === 'assessment'
      ? evaluateAssessmentDependencyQualification(repoRoot)
      : { qualification: 'NOT_APPLICABLE' as const, reasons: [] as string[] };
    if (dependency.qualification === 'NOT_QUALIFIED') {
      findings.HUMAN_ACCEPTED.status = 'BLOCKED';
      findings.HUMAN_ACCEPTED.reasons.push('dependency #1564 not qualified; human/publication evidence may not be recorded');
      findings.PUBLICATION_RECEIPT.status = 'BLOCKED';
      findings.PUBLICATION_RECEIPT.reasons.push('dependency #1564 not qualified; publication receipt unavailable');
    }

    const rowPrivacy = scanReceiptPrivacyViolations(row, `$.rows.${row.domain}`);
    for (const violation of rowPrivacy) {
      failInvariant(findings, 'DOMAIN_OWNERSHIP', `privacy violation in matrix row: ${violation.path} (${violation.reason})`);
    }
    violations.push(...rowPrivacy.map((violation) => `privacy: ${violation.path} (${violation.reason})`));

    const status = rowStatusFromFindings(findings, dependency.qualification);
    return {
      domain: row.domain,
      status,
      invariantFindings: findings,
      blockedSinks,
      dependency: {
        changeId: row.dependency.changeId,
        qualification: dependency.qualification,
        reasons: dependency.reasons,
      },
    };
  });

  const settledStatus: GeneratedContentAuthorityStatus = rows.every((row) => row.status === 'QUALIFIED')
    && violations.length === 0
    && binding.binding === 'CURRENT'
    ? 'QUALIFIED'
    : 'BLOCKED';

  return {
    schemaVersion: GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION,
    sourceBinding: binding,
    rows,
    violations,
    settled: settledStatus,
  };
}

/** 门禁断言：fitness 未收敛（BLOCKED/NOT_QUALIFIED）或工作树混合时抛错，fail-closed。 */
export function assertGeneratedContentAuthorityFitness(
  report: GeneratedContentFitnessReport,
  options: { requireCleanWorktree?: boolean; requireReconciledHead?: boolean } = {},
): void {
  const problems: string[] = [];
  if (report.settled !== 'QUALIFIED') {
    problems.push(`fitness is ${report.settled}`);
  }
  if (options.requireCleanWorktree && report.sourceBinding.mixedWorktree) {
    problems.push('worktree is mixed; governance evidence requires a clean tree');
  }
  if (problems.length === 0) return;

  const rowDetails = report.rows
    .filter((row) => row.status !== 'QUALIFIED')
    .map((row) => {
      const failedInvariants = GENERATED_CONTENT_INVARIANTS
        .filter((invariant) => row.invariantFindings[invariant].status !== 'QUALIFIED')
        .map((invariant) => `${invariant}: ${row.invariantFindings[invariant].reasons.join('; ')}`);
      return `${row.domain}: ${row.status}\n  ${failedInvariants.join('\n  ')}`;
    })
    .join('\n');
  throw new Error(
    `generated-content authority fitness check failed\nreasons: ${problems.join('; ')}\nviolations:\n${report.violations.join('\n') || '(none)'}\nrows:\n${rowDetails}`,
  );
}
