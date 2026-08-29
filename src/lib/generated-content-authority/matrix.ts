import type { DeclaredCrossDomainEdge, GeneratedContentAuthorityRow, GeneratedContentDomain } from './vocabulary';

import { GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION } from './vocabulary';

/**
 * 对账矩阵：四个生成内容域的权威边界证据。
 *
 * - 只记录仓库相对路径、符号名、模型名、哈希与状态；不含任何载荷（privacy.ts 校验）。
 * - sourceRevision 绑定最后一次对账的 git commit；fitness check 观测到漂移时按
 *   design.md Decision 2 判 STALE → 行 BLOCKED，需重新对账后更新此值。
 * - 本矩阵不是运行时权威：产品代码不得 import 本模块（fitness no-superdomain 检查）。
 */

/** #1564 归档 change（Assessment 依赖的唯一资格真源）。 */
export const ASSESSMENT_DEPENDENCY_ARCHIVE = 'openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance';

/** #1564 资格核验所需的实现/测试/回执契约文件（缺失即 NOT_QUALIFIED）。 */
export const ASSESSMENT_DEPENDENCY_EVIDENCE: readonly string[] = [
  'src/features/adaptive-assessment/generated-candidate-governance.ts',
  'src/features/adaptive-assessment/generated-candidate-persistence.ts',
  'src/features/adaptive-assessment/generated-candidate-catalog.ts',
  'src/app/api/assessment/generated-candidates/route.ts',
  'src/app/api/assessment/generated-candidates/[id]/review/route.ts',
  'src/app/api/assessment/generated-candidates/[id]/publish/route.ts',
  'src/features/adaptive-assessment/__tests__/generated-candidate-governance.test.ts',
];

/** LearningFact 权威写入器（任何域的生成/提供方模块都禁止 import）。 */
export const LEARNING_FACT_SINK_MODULES: readonly string[] = [
  'src/lib/canonical-learning-fact-identity/writer.ts',
  'src/lib/data-governance/learning-fact-materialization.ts',
  'src/lib/data-governance/simulation-task-learning-fact.ts',
];

/** 跨域深 import 允许边（新增边必须先修订矩阵）。 */
export const DECLARED_CROSS_DOMAIN_EDGES: readonly DeclaredCrossDomainEdge[] = [
  {
    fromDomain: 'smart-courseware',
    toDomain: 'smart-lesson',
    reason: 'SmartCoursewarePublicationRevision.planRevisionId 消费 SmartLessonRevision 公共契约（domain/schema）',
  },
];

/**
 * 矩阵主体。sourceRevision 在实现提交后回填为该提交 sha；
 * fitness 严格门（npm run test:generated-content-authority）以此判定 STALE。
 */
export const GENERATED_CONTENT_AUTHORITY_MATRIX: {
  readonly schemaVersion: typeof GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION;
  readonly sourceRevision: string;
  /** 全部被引用证据文件的内容摘要（sha256）；fitness check 重算比对判定 STALE */
  readonly evidenceDigest: string;
  readonly rows: readonly GeneratedContentAuthorityRow[];
} = {
  schemaVersion: GENERATED_CONTENT_AUTHORITY_SCHEMA_VERSION,
  sourceRevision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
  evidenceDigest: '930fbfdb160c403da57e37549e1503e63e6297fe351ac4065683855914bbd66f',
  rows: [
    {
      domain: 'assessment',
      owner: 'src/features/adaptive-assessment（Assessment/adaptive-assessment 治理，#1564 实现）',
      sourceRevision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
      draftIdentity: {
        creationReference: 'src/app/api/assessment/generated-candidates/route.ts → createGeneratedCandidate (src/features/adaptive-assessment/generated-candidate-governance.ts)',
        notes: 'provider/model/prompt 哈希作为私有审计证据入 envelope（:257-258），载荷本体不入库',
      },
      validationEvidence: [
        'src/features/adaptive-assessment/generated-candidate-governance.ts runGeneratedCandidatePrecheck（确定性 precheck）',
        'src/features/adaptive-assessment/adaptive-assessment-semantic-review.ts validateAssessmentItemSemanticReviewSource（来源哈希校验）',
      ],
      humanAcceptance: [
        'src/app/api/assessment/generated-candidates/[id]/review/route.ts → reviewGeneratedCandidate（TEACHER/ADMIN；AI/自动 precheck 不可自批）',
      ],
      immutableRevision: {
        model: 'AdaptiveAssessmentGeneratedCandidateRevision',
        driftGuardReference: 'src/features/adaptive-assessment/generated-candidate-persistence.ts（contentHash 漂移抛 immutable-revision-drift）',
      },
      publicationReceipt: {
        kind: 'RECEIPT',
        reference: 'publishGeneratedCandidate（generated-candidate-governance.ts）→ AdaptiveAssessmentGeneratedPublicationReceipt + writeGeneratedCatalogRelease（generated-candidate-catalog.ts）',
        consumerBinding: 'applyGeneratedCandidateStoreToRuntimeOverlay（generated-catalog-runtime.ts，ADMIN-only publish 路由触发）',
      },
      generationModules: [
        'src/app/api/assessment/generated-candidates/route.ts',
        'src/features/assessment/adaptive-engine.ts',
      ],
      forbiddenSinkModules: [
        'src/features/adaptive-assessment/generated-candidate-catalog.ts',
        'src/features/adaptive-assessment/generated-catalog-runtime.ts',
        ...LEARNING_FACT_SINK_MODULES,
      ],
      sinkPolicyNotes: '候选草稿持久化（persistGeneratedCandidateStore）属草稿写入而非权威 sink；目录发布与运行时 overlay 仅 ADMIN publish 路由可达',
      sinkScanExemptions: [
        'src/features/adaptive-assessment/adaptive-assessment-catalog-selector.ts（已发布产物的运行时消费者，denominator.callers 已声明）',
        'src/features/adaptive-assessment/generated-catalog-runtime.ts（声明 sink 模块自身，发布路由专属消费）',
        'src/features/assessment/adaptive-persistence.ts（学生作答持久化权威路径：submitAnswerDurably；非 AI 生成器，作答写入与 LearningFact 物化属既有域内契约）',
      ],
      denominator: {
        routes: [
          'src/app/api/assessment/generate-question/route.ts',
          'src/app/api/assessment/generated-candidates/route.ts',
          'src/app/api/assessment/generated-candidates/[id]/review/route.ts',
          'src/app/api/assessment/generated-candidates/[id]/publish/route.ts',
        ],
        models: [
          'AdaptiveAssessmentGeneratedCandidate',
          'AdaptiveAssessmentGeneratedCandidateRevision',
          'AdaptiveAssessmentGeneratedCandidateEvent',
          'AdaptiveAssessmentGeneratedCandidateReview',
          'AdaptiveAssessmentGeneratedPublicationReceipt',
        ],
        workers: [],
        scripts: ['data/generated-assessment-catalog（发布 sidecar，由 writeGeneratedCatalogRelease 写出）'],
        tests: [
          'src/features/adaptive-assessment/__tests__/generated-candidate-governance.test.ts',
        ],
        callers: [
          'src/features/adaptive-assessment/generated-catalog-runtime.ts（运行时 overlay 消费）',
          'src/features/adaptive-assessment/adaptive-assessment-catalog-selector.ts（选题消费）',
          'src/features/assessment/adaptive-persistence.ts（submitAnswerDurably：作答持久化权威路径）',
        ],
      },
      privacyClass: 'private-audit-hashes',
      idempotencyBoundary: '候选/修订以 store 唯一身份 + contentHash 漂移守卫；发布回执随 publishGeneratedCandidate 状态机幂等',
      rollbackOwner: 'retireGeneratedPublication / rollbackGeneratedPublication（generated-candidate-governance.ts）',
      dependency: {
        changeId: 'reconcile-reviewed-assessment-generation-governance (#1564)',
        reference: ASSESSMENT_DEPENDENCY_ARCHIVE,
      },
    },
    {
      domain: 'assignment-rubric',
      owner: 'src/lib/assignments（Assignment 公共生命周期边界）',
      sourceRevision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
      draftIdentity: {
        creationReference: 'src/app/api/teacher/assignments/[assignmentId]/rubric-guidelines/generate/route.ts → generateAssignmentRubricGuidelines（assignment-rubric-generation.ts:106，LLM 调用 :149）',
        notes: '生成结果先以可编辑指南返回教师 UI，仅在人类发布修订时固化为 rubricSnapshot',
      },
      validationEvidence: [
        'src/lib/assignments/assignment-rubric-generation.ts generatedRubricGuidelinesSchema（zod 确定性校验）',
        'src/lib/assignments/assignment-rubric-contract.ts（analytic rubric v1 契约）',
      ],
      humanAcceptance: [
        'src/lib/assignments/assignment-service.ts publishAssignmentRevision（:367，教师发布修订固化 rubricSnapshot）',
        'src/lib/assignments/assignment-review.ts approveTeacherAssignmentReview（:237，评分人批，写 approval snapshot + approvedTotal）',
      ],
      immutableRevision: {
        model: 'AssignmentRevision / AssignmentQuestion.rubricSnapshot',
        driftGuardReference: 'prisma/schema.prisma AssignmentRevision.contentHash/frozenAt、AssignmentQuestion.sourceHash/sourceLineage（写入 assignment-service.ts:632）',
      },
      publicationReceipt: {
        kind: 'RECEIPT',
        reference: 'AssignmentPublicationOperation（prisma/schema.prisma:2583，幂等键 assignment-service.ts:525）',
        consumerBinding: 'selectCurrentPublishedRevisions（submission-service.ts:94，学生侧已发布修订选择器）',
      },
      generationModules: [
        'src/lib/assignments/assignment-rubric-generation.ts',
        'src/app/api/teacher/assignments/[assignmentId]/rubric-guidelines/generate/route.ts',
      ],
      forbiddenSinkModules: [
        'src/lib/assignments/assignment-review.ts',
        'src/lib/assignments/assignment-service.ts',
        'src/lib/smart-courseware/publication-service.ts',
        ...LEARNING_FACT_SINK_MODULES,
      ],
      sinkPolicyNotes: '发布（publishAssignmentRevision）与评分/反馈权威（assignment-review.ts）均对生成模块关闭：生成路由仅返回可编辑指南，教师发布时才固化为 rubricSnapshot',
      sinkScanExemptions: [
        'src/lib/assignments/assignment-route-guards.ts（授权守卫，公共 API 层合法消费方）',
        'src/lib/assignments/public-api.ts（公共 API 层合法消费方）',
      ],
      denominator: {
        routes: [
          'src/app/api/teacher/assignments/[assignmentId]/rubric-guidelines/generate/route.ts',
          'src/app/api/teacher/assignments/[assignmentId]/publish/route.ts',
          'src/app/api/teacher/assignments/[assignmentId]/submissions/[submissionId]/review/approve/route.ts',
        ],
        models: ['AssignmentRevision', 'AssignmentQuestion', 'AssignmentPublicationOperation', 'TeacherAssignmentApprovalSnapshot', 'TeacherAssignmentFeedbackRelease'],
        workers: [],
        scripts: [],
        tests: ['src/lib/__tests__/assignment-rubric-generation.test.ts'],
        callers: ['src/lib/assignments/public-api.ts', 'src/lib/assignments/submission-service.ts'],
      },
      privacyClass: 'domain-private-artifacts',
      idempotencyBoundary: '发布幂等键 assignmentPublicationIdempotencyKey；反馈回执 TeacherAssignmentFeedbackRelease.snapshotId @unique',
      rollbackOwner: 'Assignment 修订生命周期（draft 重建/新修订号）+ review return 路径',
      dependency: { changeId: null, reference: null },
    },
    {
      domain: 'smart-lesson',
      owner: 'src/lib/smart-lesson-plan（task/draft/revision/job 契约）',
      sourceRevision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
      draftIdentity: {
        creationReference: 'src/lib/smart-lesson-plan/service.ts createSmartLessonTask / startGenerationJob（:858）→ SmartLessonDraft',
        notes: 'advisory review（recordAdvisoryReview:1524）是顾问性输入，不是人类接受',
      },
      validationEvidence: [
        'src/lib/smart-lesson-plan/domain.ts deterministicPlanChecks（:491）',
        'src/lib/smart-lesson-plan/schema.ts smartLessonPlanSchema（smart-lesson-plan.boppps.v1）',
        'src/lib/smart-lesson-plan/domain.ts smartLessonGenerationInputHash（:243，输入哈希绑定）',
      ],
      humanAcceptance: [
        'src/app/api/teacher/smart-lesson-tasks/drafts/[draftId]/approve/route.ts → approveSmartLessonDraft（service.ts:1602）',
      ],
      immutableRevision: {
        model: 'SmartLessonRevision',
        driftGuardReference: 'prisma/schema.prisma:870（contentHash、四类 Snapshot、approvalIdempotencyKey/approvalRequestHash、@@unique(taskId,revisionNumber)、draftId @unique）',
      },
      publicationReceipt: {
        kind: 'EQUIVALENT',
        reference: 'SmartLessonRevision 审批字段（approvedById/approvedAt + 幂等键）即权威工件；本域无独立发布回执模型',
        consumerBinding: 'SmartCoursewarePublicationRevision.planRevisionId（prisma/schema.prisma:1179）为消费边界；过期计划经 acknowledgeSmartCoursewareStalePlan 显式确认',
      },
      generationModules: [
        'src/lib/smart-lesson-plan/provider-runtime.ts',
        'src/lib/smart-lesson-plan/service.ts',
        'src/lib/smart-lesson-plan/worker.ts',
      ],
      forbiddenSinkModules: [
        'src/lib/smart-courseware/publication-service.ts',
        'src/lib/assignments/assignment-review.ts',
        ...LEARNING_FACT_SINK_MODULES,
      ],
      sinkPolicyNotes: '本域接受（approveSmartLessonDraft）与生成编排同在 service.ts：模块级扫描无法分离，人类门由 approve 路由授权 + 审批幂等键守护（路由/服务测试覆盖）；生成模块禁止的 sink 为跨域权威与 LearningFact 写入器',
      denominator: {
        routes: [
          'src/app/api/teacher/smart-lesson-tasks/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/[taskId]/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/drafts/[draftId]/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/drafts/[draftId]/approve/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/drafts/[draftId]/generation/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/drafts/[draftId]/advisory-reviews/route.ts',
          'src/app/api/teacher/smart-lesson-tasks/jobs/[jobId]/route.ts',
        ],
        models: ['SmartLessonTask', 'SmartLessonDraft', 'SmartLessonRevision', 'SmartLessonGenerationJob', 'SmartLessonGenerationStage', 'SmartLessonProviderAttempt', 'SmartLessonAdvisoryReview'],
        workers: ['src/lib/smart-lesson-plan/worker.ts', 'src/lib/smart-lesson-plan/queue.ts'],
        scripts: [],
        tests: ['src/lib/smart-lesson-plan/__tests__/'],
        callers: ['src/lib/smart-courseware/service.ts（planRevisionId 消费）', 'src/lib/lesson-plan-runtime-binding.ts', 'src/lib/session-lesson-snapshot.ts'],
      },
      privacyClass: 'domain-private-artifacts',
      idempotencyBoundary: 'approvalIdempotencyKey/approvalRequestHash（SmartLessonRevision）+ 生成 job 幂等入队',
      rollbackOwner: 'src/lib/smart-lesson-plan/lifecycle.ts（archive/delete）',
      dependency: { changeId: null, reference: null },
    },
    {
      domain: 'smart-courseware',
      owner: 'src/lib/smart-courseware（draft/revision/module/job/publication 契约）',
      sourceRevision: '5b44e6c128c2f36811a496ac3be272f073d8ba15',
      draftIdentity: {
        creationReference: 'src/lib/smart-courseware/generation-service.ts startCoursewareGenerationJob（:35）/ module-regeneration-service.ts generateCoursewareModuleCandidate（:155）→ SmartCoursewareDraft',
      },
      validationEvidence: [
        'src/lib/smart-courseware/publication-service.ts runSmartCoursewareStaticPublicationValidation（:136）',
        'src/lib/smart-courseware/publication-service.ts runSmartCoursewareBrowserPublicationValidation（:173）',
        'src/lib/smart-courseware/domain.ts assertCoursewareManifestIdentity（:88）',
        'SmartCoursewarePublicationReceipt（prisma/schema.prisma:1107，STATIC/BROWSER profileHash 判别）',
      ],
      humanAcceptance: [
        'src/app/api/teacher/smart-courseware/drafts/[draftId]/approve/route.ts → approveSmartCoursewareDraft（service.ts:240）',
        'src/app/api/teacher/smart-courseware/jobs/[jobId]/accept/route.ts（生成交付人审）',
        'src/lib/smart-courseware/module-regeneration-service.ts acceptCoursewareModuleCandidate（:391，模块候选人审）',
      ],
      immutableRevision: {
        model: 'SmartCoursewareRevision → SmartCoursewarePublicationRevision',
        driftGuardReference: 'prisma/schema.prisma:1171（sourceRevisionId @unique、manifest/provenance/validation/receiptSnapshot、contentHash、@@unique(seriesId,revisionNumber)）',
      },
      publicationReceipt: {
        kind: 'RECEIPT',
        reference: 'src/lib/smart-courseware/publication-service.ts publishSmartCoursewareRevision（:313，Serializable 事务内校验后写 receiptSnapshot）+ SmartCoursewarePublicationOperation（schema:1210，@@unique(ownerId,idempotencyKey)）',
        consumerBinding: 'src/lib/smart-courseware/classroom-runtime.ts resolveGeneratedCoursewareSessionBinding（课堂会话绑定，由 classroom session lifecycle 消费）+ createGovernedPublicationProjection（:430，LessonPlan/LessonItem/TeachingResource 投影）',
      },
      generationModules: [
        'src/lib/smart-courseware/provider-runtime.ts',
        'src/lib/smart-courseware/generation-service.ts',
        'src/lib/smart-courseware/module-regeneration-service.ts',
        'src/lib/smart-courseware/worker.ts',
      ],
      forbiddenSinkModules: [
        'src/lib/smart-courseware/publication-service.ts',
        'src/lib/assignments/assignment-review.ts',
        ...LEARNING_FACT_SINK_MODULES,
      ],
      sinkScanExemptions: [
        'src/lib/smart-courseware/index.ts（桶导出，公共 API 层合法消费方）',
      ],
      denominator: {
        routes: [
          'src/app/api/teacher/smart-courseware/drafts/route.ts',
          'src/app/api/teacher/smart-courseware/drafts/[draftId]/approve/route.ts',
          'src/app/api/teacher/smart-courseware/drafts/[draftId]/generation/route.ts',
          'src/app/api/teacher/smart-courseware/drafts/[draftId]/modules/[moduleId]/regeneration/route.ts',
          'src/app/api/teacher/smart-courseware/jobs/[jobId]/accept/route.ts',
          'src/app/api/teacher/smart-courseware/revisions/[revisionId]/publication/route.ts',
        ],
        models: ['SmartCoursewareDraft', 'SmartCoursewareRevision', 'SmartCoursewareModule', 'SmartCoursewareModuleRevision', 'SmartCoursewareGenerationJob', 'SmartCoursewarePublicationReceipt', 'SmartCoursewarePublicationRevision', 'SmartCoursewarePublicationOperation'],
        workers: ['src/lib/smart-courseware/worker.ts', 'src/lib/smart-courseware/queue.ts'],
        scripts: [],
        tests: ['src/lib/smart-courseware/__tests__/'],
        callers: ['src/features/classroom/session/adapters/lifecycle-commands.ts（resolveGeneratedCoursewareSessionBinding）', 'src/app/api/teacher/smart-courseware/drafts/[draftId]/previews/*'],
      },
      privacyClass: 'domain-private-artifacts',
      idempotencyBoundary: 'SmartCoursewarePublicationOperation 幂等键 + 发布 Serializable 事务 + series/revisionNumber 唯一',
      rollbackOwner: '发布资格校验失败即拒绝；已发布修订不可变，回滚以新修订/ acknowledging 流程处理（publication-service.ts gap/stale-plan acknowledgements）',
      dependency: { changeId: null, reference: null },
    },
  ],
};

/**
 * 允许的生成模块 → 其它生成域内部的 import 边。
 * 精确到公共契约模块文件（非目录前缀）：跨域只能消费声明的公共契约，
 * 导入其它域的 service/权威函数（如 approveSmartLessonDraft）一律违例。
 */
export const DECLARED_CROSS_DOMAIN_IMPORT_PATHS: readonly { from: string; toModules: readonly string[] }[] = [
  {
    from: 'src/lib/smart-courseware/',
    toModules: [
      'src/lib/smart-lesson-plan/domain.ts',
      'src/lib/smart-lesson-plan/schema.ts',
    ],
  },
];

/** 四域根目录（未登记生成模块的发现范围）。 */
export const GENERATED_CONTENT_DOMAIN_ROOTS: Readonly<Record<GeneratedContentDomain, readonly string[]>> = {
  assessment: ['src/features/adaptive-assessment/', 'src/features/assessment/'],
  'assignment-rubric': ['src/lib/assignments/'],
  'smart-lesson': ['src/lib/smart-lesson-plan/'],
  'smart-courseware': ['src/lib/smart-courseware/'],
};

/** Prisma schema 中禁止出现的共享候选/状态模型名（no-superdomain）。 */
export const FORBIDDEN_SHARED_MODEL_PATTERNS: readonly RegExp[] = [
  /^model\s+GeneratedContentCandidate\b/mu,
  /^model\s+GeneratedContentAuthority\b/mu,
  /^model\s+UnifiedAiCandidate\b/mu,
  /^model\s+SharedCandidate\b/mu,
];
