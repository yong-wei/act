/**
 * generated-content-authority-invariants：跨域不变量词表。
 *
 * 这是验证视角（verification lens），不是共享运行时模型：
 * 矩阵只记录各域本地契约的证据，不持久化候选/状态，也不做运行时权威。
 */

export const GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION = 'generated-content-authority.v1';

/** 七条跨域不变量（design.md Decision 1）。 */
export const GENERATED_CONTENT_INVARIANTS = [
  'DRAFT_EDITABLE',
  'VALIDATED_DETERMINISTIC',
  'HUMAN_ACCEPTED',
  'IMMUTABLE_REVISION',
  'PUBLICATION_RECEIPT',
  'NO_DIRECT_AUTHORITY_WRITE',
  'DOMAIN_OWNERSHIP',
] as const;

export type GeneratedContentInvariant = (typeof GENERATED_CONTENT_INVARIANTS)[number];

/** 行状态：QUALIFIED 证据齐备；BLOCKED 显式依赖未满足；NOT_QUALIFIED 证据缺失/违例。 */
export type GeneratedContentAuthorityStatus = 'QUALIFIED' | 'BLOCKED' | 'NOT_QUALIFIED';

/** 生成内容的四个属主域。 */
export const GENERATED_CONTENT_DOMAINS = [
  'assessment',
  'assignment-rubric',
  'smart-lesson',
  'smart-courseware',
] as const;

export type GeneratedContentDomain = (typeof GENERATED_CONTENT_DOMAINS)[number];

/** 矩阵/回执中允许出现的隐私类（只记录哈希与路径引用，不允许载荷）。 */
export type GeneratedContentPrivacyClass =
  | 'private-audit-hashes'
  | 'domain-private-artifacts'
  | 'external-content-addressed';

/** 运行级 QA 回执：只有内容寻址引用与结论，绝无截图/日志/载荷本体。 */
export interface GeneratedContentQaReceipt {
  /** 仓库相对路径或内容寻址引用（外部 QA 产物的指针） */
  readonly reference: string;
  readonly revision: string;
  readonly outputHash: string;
  readonly toolVersion: string;
  readonly conclusion: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

/** 一个域的权威证据行（全部为仓库相对路径与符号名，不含载荷）。 */
export interface GeneratedContentAuthorityRow {
  readonly domain: GeneratedContentDomain;
  readonly owner: string;
  /** 矩阵与回执绑定的源修订（实现该行最后一次对账时的 git commit） */
  readonly sourceRevision: string;
  /** 可编辑草稿/候选身份 */
  readonly draftIdentity: {
    readonly creationReference: string;
    readonly notes?: string;
  };
  /** 确定性验证证据 */
  readonly validationEvidence: readonly string[];
  /** 人类接受点（路由 + 用例函数） */
  readonly humanAcceptance: readonly string[];
  /** 不可变修订/快照（模型与漂移守卫） */
  readonly immutableRevision: {
    readonly model: string;
    readonly driftGuardReference?: string;
  };
  /** 发布回执或等价权威工件 */
  readonly publicationReceipt: {
    readonly kind: 'RECEIPT' | 'EQUIVALENT';
    readonly reference: string;
    readonly consumerBinding?: string;
  };
  /** 参与来源扫描的生成/提供方模块（仓库相对路径） */
  readonly generationModules: readonly string[];
  /** 这些模块禁止 import 的权威 sink 模块 */
  readonly forbiddenSinkModules: readonly string[];
  /** 域根内合法的 sink 消费方（公共 API/桶导出等），豁免于根级 sink 扫描 */
  readonly sinkScanExemptions?: readonly string[];
  /** sink 策略说明（如本域接受/发布与生成同文件时的路由级守卫说明） */
  readonly sinkPolicyNotes?: string;
  /** 分母清单：route/api/model/worker/script/test/caller */
  readonly denominator: {
    readonly routes: readonly string[];
    readonly models: readonly string[];
    readonly workers: readonly string[];
    readonly scripts: readonly string[];
    readonly tests: readonly string[];
    readonly callers: readonly string[];
  };
  readonly privacyClass: GeneratedContentPrivacyClass;
  readonly idempotencyBoundary: string;
  readonly rollbackOwner: string;
  /** 跨域依赖（如 Assessment → #1564）；none 表示无外部依赖 */
  readonly dependency: {
    readonly changeId: string | null;
    readonly reference: string | null;
  };
  readonly qaReceipts?: readonly GeneratedContentQaReceipt[];
}

/** 允许的跨域深 import 边（已审查的公共契约；新增边必须先更新此表）。 */
export interface DeclaredCrossDomainEdge {
  readonly fromDomain: GeneratedContentDomain;
  readonly toDomain: GeneratedContentDomain;
  readonly reason: string;
}

/** fitness 报告。只读：不包含任何产品数据变更意图。 */
export interface GeneratedContentFitnessReport {
  readonly schemaVersion: typeof GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION;
  readonly sourceBinding: {
    /** 对账提交（参考标签） */
    readonly declaredRevision: string;
    /** 当前观测 HEAD（上下文信息；绑定判定用证据摘要） */
    readonly observedRevision: string | null;
    /** 绑定判定 = 矩阵 evidenceDigest 与当前证据文件的 sha256 摘要一致 */
    readonly binding: 'CURRENT' | 'STALE' | 'UNOBSERVED';
    /** 声明修订与观测 HEAD 的谱系关系：仅 ANCESTOR 可收敛（UNRELATED/UNOBSERVED fail-closed） */
    readonly headRelation: 'ANCESTOR' | 'UNRELATED' | 'UNOBSERVED';
    readonly mixedWorktree: boolean;
  };
  readonly rows: ReadonlyArray<{
    readonly domain: GeneratedContentDomain;
    readonly status: GeneratedContentAuthorityStatus;
    readonly invariantFindings: Readonly<Record<GeneratedContentInvariant, {
      readonly status: GeneratedContentAuthorityStatus;
      readonly reasons: readonly string[];
    }>>;
    readonly blockedSinks: ReadonlyArray<{ readonly module: string; readonly importedBy: string }>;
    readonly dependency: {
      readonly changeId: string | null;
      readonly qualification: 'NOT_APPLICABLE' | 'QUALIFIED' | 'NOT_QUALIFIED';
      readonly reasons: readonly string[];
    };
  }>;
  readonly violations: readonly string[];
  readonly settled: GeneratedContentAuthorityStatus;
}
