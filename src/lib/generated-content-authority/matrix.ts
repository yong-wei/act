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
  'src/lib/data-governance/interactive-evidence-scoring-recompute.ts',
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
  evidenceDigest: 'f7ea8b7474190ee9969c4ad5d345bc1a9a86b33823c8bd5182f20cdd10c28232',
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
        'src/app/api/assessment/generate-question/route.ts',
        'src/app/api/assessment/next-question/route.ts',
        'src/app/api/assessment/submit-answer/route.ts',
        'src/app/api/assessment/diagnostic/route.ts',
        'src/app/api/assessment/remediation/route.ts',
        'src/app/api/assessment/remediation/interventions/route.ts',
        'src/app/api/assessment/remediation/interventions/events/route.ts',
        'src/app/api/assessment/remediation/interventions/validation/route.ts',
        'src/features/assessment/adaptive-engine.ts',
      ],
      authorityWriteSites: [
        'src/features/adaptive-assessment/generated-candidate-persistence.ts（候选/修订/事件/评审/回执唯一持久化入口）',
        'src/features/adaptive-assessment/generated-candidate-catalog.ts（writeGeneratedCatalogRelease：目录 sidecar 发布写点）',
        'src/features/adaptive-assessment/adaptive-assessment-semantic-review.ts（人审决策 artifact 落盘）',
        'src/features/assessment/adaptive-persistence.ts（学生作答持久化权威路径：submitAnswerDurably）',
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
        'src/app/api/assessment/remediation/route.ts（补救干预路径，generated-catalog-runtime 的合法消费方）',
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
      authorityWriteSites: [
        'src/lib/assignments/assignment-service.ts（publishAssignmentRevision：修订发布与 rubricSnapshot 固化）',
        'src/lib/assignments/assignment-review.ts（approveTeacherAssignmentReview：approval snapshot + approvedTotal；feedback release）',
        'src/lib/assignments/submission-service.ts（学生作答/发布修订选择器配套写点）',
        'src/lib/data-governance/math-document-grading-lifecycle.ts（文档批改评分权威，人类审批驱动）',
        'src/lib/data-governance/math-document-grading-persistence.ts（批改评分持久化）',
        'src/lib/data-governance/teacher-assignment-review-outbox.ts（批改 outbox：approval/feedback/提交状态写点）',
        'src/app/api/teacher/document-grading/approve/route.ts（批改审批路由，人类审批驱动）',
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
      authorityWriteSites: [
        'src/lib/smart-lesson-plan/service.ts（createSmartLessonTask/updateSmartLessonDraft/approveSmartLessonDraft：任务/草稿/不可变修订全状态机）',
        'src/lib/smart-lesson-plan/worker.ts（生成 job 状态写点）',
        'src/lib/smart-lesson-plan/queue.ts（任务状态/入队写点）',
        'src/lib/smart-lesson-plan/lifecycle.ts（archive/delete）',
        'src/lib/teacher-default-class-service.ts（教师默认班默认任务创建，教师操作驱动）',
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
      authorityWriteSites: [
        'src/lib/smart-lesson-plan/lifecycle.ts（smart-lesson archive/delete 时对 courseware 记录的级联清理写点，显式登记的跨域清理）',
        'src/lib/smart-courseware/service.ts（approveSmartCoursewareDraft：修订创建）',
        'src/lib/smart-courseware/publication-service.ts（publishSmartCoursewareRevision：发布回执/投影/操作幂等）',
        'src/lib/smart-courseware/generation-service.ts（generation job/unit/attempt 状态写点）',
        'src/lib/smart-courseware/module-regeneration-service.ts（模块候选生成/接受）',
        'src/lib/smart-courseware/worker.ts（job 状态写点）',
        'src/lib/smart-courseware/queue.ts（入队）',
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

/**
 * LearningFact 写点白名单（全域 default-deny）：LearningFact 是跨域 Learning
 * Record 权威，其 Prisma 写调用只允许出现在下列既有 writer/治理模块内；
 * 生成器/未登记模块直写即违例（与四域 authorityWriteSites 并行的独立封闭面）。
 */
export const LEARNING_FACT_WRITE_SITES: readonly string[] = [
  'src/lib/canonical-learning-fact-identity/writer.ts',
  'src/lib/data-governance/learning-fact-materialization.ts',
  'src/lib/data-governance/simulation-task-learning-fact.ts',
  'src/lib/data-governance/document-rubric-grading-workbench.ts',
  'src/lib/data-governance/historical-evidence-materialization.ts',
  'src/lib/data-governance/interactive-evidence-scoring-recompute.ts',
  'src/lib/data-governance/simulation-agent-evidence-materialization.ts',
  'src/lib/data-governance/course-evidence-backfill.ts',
  'src/lib/data-governance/yangfan-diagnostic-fixture.ts',
  'src/lib/konling-agent-runtime.ts',
  'src/app/api/teacher/document-grading/approve/route.ts',
];

/**
 * 最终权威模型（修订/回执/评分/发布）：provider 调用文件中禁止出现这些写调用——
 * AI 生成路径只能产出草稿/候选（Draft/Task 类），不得触碰最终权威。
 */
export const FINAL_AUTHORITY_WRITE_MODEL_PATTERN = /\.(learningFact|assignmentPublicationOperation|assignmentSubmission|gradingRun|gradingCriterionAssessment|teacherAssignmentApprovalSnapshot|teacherAssignmentFeedbackRelease|smartLessonRevision|smartCoursewarePublicationRevision|smartCoursewarePublicationOperation|adaptiveAssessmentGeneratedPublicationReceipt)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/u;

/**
 * 权威模型的 Prisma 写调用只允许出现在矩阵登记的 authorityWriteSites 内；
 * 该名单是 default-deny 的白名单——全域扫描发现的任何未登记写点即违例。
 */
export const AUTHORITY_WRITE_MODEL_PATTERN = /\.(learningFact|adaptiveAssessmentGeneratedCandidate|adaptiveAssessmentGeneratedCandidateRevision|adaptiveAssessmentGeneratedCandidateEvent|adaptiveAssessmentGeneratedCandidateReview|adaptiveAssessmentGeneratedPublicationReceipt|assignmentRevision|assignmentQuestion|assignmentPublicationOperation|assignmentSubmission|gradingRun|gradingCriterionAssessment|teacherAssignmentApprovalSnapshot|teacherAssignmentFeedbackRelease|smartLessonRevision|smartLessonDraft|smartLessonTask|smartCoursewareRevision|smartCoursewarePublicationRevision|smartCoursewarePublicationReceipt|smartCoursewarePublicationOperation|smartCoursewareModule|smartCoursewareModuleRevision)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/u;

/**
 * 四域根目录：provider/AI 调用点的发现范围（域根内出现 AI 调用必须登记）。
 * 写点发现不受此限制——全域 default-deny。
 */
export const GENERATED_CONTENT_DOMAIN_ROOTS: Readonly<Record<GeneratedContentDomain, readonly string[]>> = {
  assessment: ['src/features/adaptive-assessment/', 'src/features/assessment/', 'src/app/api/assessment/'],
  'assignment-rubric': ['src/lib/assignments/', 'src/app/api/teacher/assignments/'],
  'smart-lesson': ['src/lib/smart-lesson-plan/', 'src/app/api/teacher/smart-lesson-tasks/'],
  'smart-courseware': ['src/lib/smart-courseware/', 'src/app/api/teacher/smart-courseware/'],
};

/** 权威模型 → 属主域（写点归属判定；violations 按此路由到对应矩阵行）。 */
export const AUTHORITY_MODEL_DOMAIN: Readonly<Record<string, GeneratedContentDomain>> = {
  // learningFact 刻意不在表内：Learning Record 域由既有 trusted-learning-fact-filter/
  // canonical identity 契约治理（spec Non-Goal），不属于四域矩阵的权威写点判定

  adaptiveAssessmentGeneratedCandidate: 'assessment',
  adaptiveAssessmentGeneratedCandidateRevision: 'assessment',
  adaptiveAssessmentGeneratedCandidateEvent: 'assessment',
  adaptiveAssessmentGeneratedCandidateReview: 'assessment',
  adaptiveAssessmentGeneratedPublicationReceipt: 'assessment',
  assignmentRevision: 'assignment-rubric',
  assignmentQuestion: 'assignment-rubric',
  assignmentPublicationOperation: 'assignment-rubric',
  assignmentSubmission: 'assignment-rubric',
  gradingRun: 'assignment-rubric',
  gradingCriterionAssessment: 'assignment-rubric',
  teacherAssignmentApprovalSnapshot: 'assignment-rubric',
  teacherAssignmentFeedbackRelease: 'assignment-rubric',
  smartLessonRevision: 'smart-lesson',
  smartLessonDraft: 'smart-lesson',
  smartLessonTask: 'smart-lesson',
  smartCoursewareRevision: 'smart-courseware',
  smartCoursewarePublicationRevision: 'smart-courseware',
  smartCoursewarePublicationReceipt: 'smart-courseware',
  smartCoursewarePublicationOperation: 'smart-courseware',
  smartCoursewareModule: 'smart-courseware',
  smartCoursewareModuleRevision: 'smart-courseware',
};

/** provider/AI 调用点发现：import 这些模块即视为生成入口，必须登记。 */
export const PROVIDER_DISCOVERY_PATTERNS: readonly RegExp[] = [
  /from\s+['"]@\/lib\/ai\/provider-registry['"]/u,
  /from\s+['"]ai['"]/u,
];

/** Prisma schema 中禁止出现的共享候选/状态模型名（no-superdomain）。 */
export const FORBIDDEN_SHARED_MODEL_PATTERNS: readonly RegExp[] = [
  /^model\s+GeneratedContentCandidate\b/mu,
  /^model\s+GeneratedContentAuthority\b/mu,
  /^model\s+UnifiedAiCandidate\b/mu,
  /^model\s+SharedCandidate\b/mu,
];
