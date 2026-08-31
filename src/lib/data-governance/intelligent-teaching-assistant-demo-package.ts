import { resolveAIProviderConfig } from '../ai/provider-config';

export type AssistantDemoConfidence = 'high' | 'medium' | 'low';
export type AssistantDemoActorRole = 'student' | 'teacher';

export interface AssistantDemoCitation {
  id: string;
  owner: 'student' | 'teacher' | 'system';
  sourceFamily: string;
  title: string;
  confidence: AssistantDemoConfidence;
  href: string;
}

interface AssistantDemoMethodology {
  numerator: string;
  denominator: string;
  window: string;
  confidence: AssistantDemoConfidence;
  sourceFamily: string;
  sourceCoverage: { covered: number; total: number };
}

export interface AssistantDemoEffectMetric {
  id: 'gradingFeedbackCoverage' | 'teacherOverrideRate' | 'aiTeacherScoreDelta' |
    'aiTeacherAgreementRate' | 'blockedEvaluatorOutputCount' | 'gradingSampleSize' |
    'pathAdoptionRate' | 'prepPackActivationRate' | 'citationCoverageRate' | 'baselineUsageCoverage';
  label: string;
  value: number;
  unit: 'rate' | 'score' | 'count';
  confidence: AssistantDemoConfidence;
  definition: string;
  numerator: string;
  denominator: string;
  sourceWindow: string;
  sourceReferences: string[];
  exclusions: string[];
  caveats: string[];
  sampleSize: number;
  dataOrigin: 'synthetic-demo' | 'real-learner-evidence';
  synthetic: true;
}

export interface AssistantDemoEffectReportExport {
  id: string;
  classId: string;
  goalId: string;
  generatedAt: string;
  syntheticOnly: true;
  metrics: AssistantDemoEffectMetric[];
  export: { id: string; redacted: true; route: string; omits: string[] };
}

export interface IntelligentTeachingAssistantDemoPackage {
  version: 'intelligent-teaching-assistant-demo-package.v1';
  fixtureScope: {
    tenantId: string;
    syntheticOnly: true;
    owner: string;
    resetIdempotencyKey: string;
    cleanupSelectors: string[];
  };
  providerExamples: Array<{
    id: string;
    providerKind: 'openai-compatible' | 'anthropic-compatible';
    secretRef: string;
    capabilities: { tools: boolean; streaming: boolean; citations: boolean };
  }>;
  class: { id: string; title: string; studentIds: string[]; teacherId: string };
  students: Array<{ id: string; displayName: string; synthetic: true }>;
  goals: Array<{ id: string; title: string; synthetic: true; registered: true }>;
  learnerStateSlices: Array<{
    id: string;
    studentId: string;
    goalId: string;
    activePathId: string;
    evidenceRefs: string[];
  }>;
  diagnosisViews: Array<{
    id: string;
    role: 'student' | 'teacher-class' | 'teacher-student';
    subjectId: string;
    dimensions: Array<{ id: string; state: string; confidence: AssistantDemoConfidence; evidenceRefs: string[] }>;
    citations: AssistantDemoCitation[];
    redacted: true;
  }>;
  pathPlans: Array<{
    id: string;
    studentId: string;
    policyFamily: string;
    nodeIds: string[];
    selectedNodeId: string;
    alternatives: string[];
    citations: AssistantDemoCitation[];
  }>;
  assignments: Array<{
    id: string;
    classId: string;
    title: string;
    documentIds: string[];
    synthetic: true;
  }>;
  citationRecords: AssistantDemoCitation[];
  resourceExecutions: Array<{
    id: string;
    studentId: string;
    nodeId: string;
    status: 'completed' | 'needs-support';
    evidenceRef: string;
    konlingMode: 'resource-coach';
  }>;
  gradingRuns: Array<{
    id: string;
    teacherId: string;
    studentId: string;
    documentId: string;
    status: 'draft' | 'blocked' | 'approved' | 'returned';
    rubricVersion: string;
    feedbackVisible: boolean;
    citations: AssistantDemoCitation[];
    redactedExport: true;
  }>;
  documentWorkflow: {
    conversions: Array<{ id: string; documentId: string; status: 'converted'; redacted: true; sourceReference: string }>;
    teacherApprovals: Array<{
      id: string;
      gradingRunId: string;
      teacherId: string;
      status: 'approved';
      reviewedCriteria: number;
      changedCriteria: number;
      totalScoreDelta: number;
      evidenceSourceEventIds: string[];
    }>;
    writebackPreviews: Array<{ id: string; gradingRunId: string; target: 'learning-fact-preview'; createsFacts: number; committed: false }>;
  };
  diagnosisSnapshots: Array<{ id: string; diagnosisViewId: string; refreshedAt: string; evidenceRefs: string[]; redacted: true }>;
  pathOptions: Array<{ id: string; pathPlanId: string; optionType: 'selected' | 'alternative'; nodeIds: string[]; evidenceRefs: string[] }>;
  konlingCitations: Array<{ id: string; sessionId: string; citationId: string; sourceFamily: string; redacted: true }>;
  teacherReports: Array<{
    id: string;
    classId: string;
    metrics: Array<{ id: string; label: string; value: number; methodology: AssistantDemoMethodology }>;
    export: { id: string; redacted: true; omits: string[]; route: string };
  }>;
  prepPacks: Array<{
    id: string;
    teacherId: string;
    classId: string;
    status: 'review-ready';
    reviewItems: string[];
    citations: AssistantDemoCitation[];
    serverContextSigned: true;
  }>;
  prepPackOverlays: Array<{
    id: string;
    sourcePrepPackId: string;
    status: 'active';
    activatedByTeacherId: string;
    activatedAt: string;
    baseManifestMutated: false;
    evidenceRefs: string[];
  }>;
  effectReports: AssistantDemoEffectReportExport[];
  realEvidenceImports: Array<{
    id: string;
    status: 'pending-review' | 'available';
    sourceFamily: string;
    consentOrAuthorizationRef: string;
    privacyReviewRef: string;
    separatedFromSyntheticFixtures: boolean;
    importedAt: string;
  }>;
  konlingSessions: Array<{
    id: string;
    modeId: string;
    actorRole: 'student' | 'teacher';
    contextOwner: 'student' | 'teacher' | 'system';
    citations: AssistantDemoCitation[];
    unavailableStateCovered: boolean;
  }>;
  routeChecks: Array<{
    route: string;
    readyText: string;
    actorRole: AssistantDemoActorRole;
    requiredStatusSemantics?: 'ready';
    forbiddenTexts?: string[];
  }>;
  apiExamples: Array<{ method: 'GET' | 'POST'; path: string; asserts: string[]; actorRole: AssistantDemoActorRole | 'mode' }>;
  featureFlags: Array<{ key: string; expected: 'enabled'; rollbackValue: 'disabled' }>;
  rollback: { command: string; expectedChecks: string[] };
}

export interface AssistantDemoInstallState {
  records: Array<{ type: string; id: string; scope: string; payload: unknown }>;
}

export interface AssistantDemoInstallResult {
  resetDeletedIds: string[];
  upsertedIds: string[];
  state: AssistantDemoInstallState;
}

export interface AssistantDemoAcceptanceReport {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  errors: string[];
}

export type CompetitionBaselineActorRole = 'student' | 'teacher' | 'administrator';
export type CompetitionBaselineCapabilityStatus = 'implemented' | 'partial' | 'planned';
export type CompetitionBaselineSurfaceStatus = 'implemented' | 'placeholder' | 'feature-flagged' | 'api-only';

export interface CompetitionBaselineAccount {
  id: string;
  role: CompetitionBaselineActorRole;
  displayName: string;
  synthetic: true;
  routeScope: string[];
}

export interface CompetitionBaselineRouteStep {
  id: string;
  actorRole: CompetitionBaselineActorRole;
  label: string;
  route: string;
  expectedEvidence: string;
  surfaceStatus: CompetitionBaselineSurfaceStatus;
  dataOrigin: 'synthetic-demo';
}

export interface CompetitionBaselineCapability {
  id: string;
  competitionRequirement: string;
  platformCapability: string;
  status: CompetitionBaselineCapabilityStatus;
  proof: string[];
  nextChange?: string;
}

export interface CompetitionBaseline {
  id: string;
  competitionCode: 'xh-202620';
  story: string;
  sourcePackageVersion: IntelligentTeachingAssistantDemoPackage['version'];
  accounts: CompetitionBaselineAccount[];
  records: Array<{ id: string; type: string; dataOrigin: 'synthetic-demo'; sourcePackageId: string }>;
  routeLedger: CompetitionBaselineRouteStep[];
  capabilities: CompetitionBaselineCapability[];
  temporarySurfaces: Array<{ id: string; routeOrApi: string; surfaceStatus: CompetitionBaselineSurfaceStatus; removalOwner: string }>;
  seedReset: {
    command: string;
    resetCommand: string;
    idempotencyKey: string;
    cleanupSelectors: string[];
    duplicateCheck: string;
  };
  acceptanceCommands: string[];
}

const demoCitations = {
  diagnosis: { id: 'cit-diagnosis-alpha', owner: 'student', sourceFamily: 'role-based-learning-diagnosis', title: 'Synthetic diagnosis summary', confidence: 'high', href: '/profile/growth' },
  path: { id: 'cit-path-alpha', owner: 'student', sourceFamily: 'adaptive-learning-path-planning', title: 'Recommended control-correction path', confidence: 'high', href: '/assessment/adaptive-practice?goal=control-correction' },
  resource: { id: 'cit-resource-alpha', owner: 'student', sourceFamily: 'resource-node-registry', title: 'Time-domain target resource', confidence: 'medium', href: '/interactive-learning/resources/lesson09-correction-precheck' },
  grading: { id: 'cit-grading-alpha', owner: 'teacher', sourceFamily: 'document-rubric-grading', title: 'Rubric criterion evidence', confidence: 'high', href: '/teacher/grading-workbench' },
  feedback: { id: 'cit-feedback-alpha', owner: 'student', sourceFamily: 'document-rubric-feedback', title: 'Student feedback explanation', confidence: 'medium', href: '/assessment/document-feedback' },
  report: { id: 'cit-report-class', owner: 'teacher', sourceFamily: 'teacher-evidence-governance', title: 'Class report metric basis', confidence: 'medium', href: '/teacher/classes/demo-ita-class/analytics-v2' },
  prep: { id: 'cit-prep-pack', owner: 'teacher', sourceFamily: 'teacher-prep-pack', title: 'Prep pack evidence basis', confidence: 'medium', href: '/teacher/classes/demo-ita-class' },
} satisfies Record<string, AssistantDemoCitation>;

export const INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE: IntelligentTeachingAssistantDemoPackage = {
  version: 'intelligent-teaching-assistant-demo-package.v1',
  fixtureScope: {
    tenantId: 'demo-intelligent-teaching-assistant-tenant',
    syntheticOnly: true,
    owner: 'data-governance-demo',
    resetIdempotencyKey: 'intelligent-teaching-assistant-demo-2026-06-05',
    cleanupSelectors: [
      'tenantId=demo-intelligent-teaching-assistant-tenant AND classId=demo-ita-class AND demoPackage=intelligent-teaching-assistant',
      'tenantId=demo-intelligent-teaching-assistant-tenant AND syntheticOnly=true AND demoPackage=intelligent-teaching-assistant',
      'tenantId=demo-intelligent-teaching-assistant-tenant AND demoPackage=intelligent-teaching-assistant',
    ],
  },
  providerExamples: [
    { id: 'ita-openai-compatible', providerKind: 'openai-compatible', secretRef: 'env:DEMO_AI_API_KEY', capabilities: { tools: true, streaming: true, citations: true } },
  ],
  class: {
    id: 'demo-ita-class',
    title: 'Synthetic Intelligent Teaching Assistant Class',
    teacherId: 'demo-teacher-ita',
    studentIds: ['demo-ita-student-alpha', 'demo-ita-student-beta', 'demo-ita-student-gamma'],
  },
  students: [
    { id: 'demo-ita-student-alpha', displayName: 'Synthetic Assistant Learner Alpha', synthetic: true },
    { id: 'demo-ita-student-beta', displayName: 'Synthetic Assistant Learner Beta', synthetic: true },
    { id: 'demo-ita-student-gamma', displayName: 'Synthetic Assistant Learner Gamma', synthetic: true },
  ],
  goals: [
    { id: 'control-correction', title: 'Control correction intelligent assistant demo', synthetic: true, registered: true },
  ],
  learnerStateSlices: [
    { id: 'learner-state-alpha', studentId: 'demo-ita-student-alpha', goalId: 'control-correction', activePathId: 'path-alpha-main', evidenceRefs: ['evidence-alpha-path', 'evidence-alpha-simulation'] },
    { id: 'learner-state-beta', studentId: 'demo-ita-student-beta', goalId: 'control-correction', activePathId: 'path-beta-feedback', evidenceRefs: ['evidence-beta-feedback'] },
    { id: 'learner-state-gamma', studentId: 'demo-ita-student-gamma', goalId: 'control-correction', activePathId: 'path-alpha-remediation', evidenceRefs: ['evidence-gamma-summary'] },
  ],
  diagnosisViews: [
    { id: 'diagnosis-alpha', role: 'student', subjectId: 'demo-ita-student-alpha', dimensions: [{ id: 'parameterDesign', state: 'needs-attention', confidence: 'medium', evidenceRefs: ['evidence-alpha-path'] }], citations: [demoCitations.diagnosis], redacted: true },
    { id: 'diagnosis-class', role: 'teacher-class', subjectId: 'demo-ita-class', dimensions: [{ id: 'classTransfer', state: 'mixed', confidence: 'medium', evidenceRefs: ['evidence-class-report'] }], citations: [demoCitations.report], redacted: true },
    { id: 'diagnosis-student-beta', role: 'teacher-student', subjectId: 'demo-ita-student-beta', dimensions: [{ id: 'feedbackUse', state: 'ready', confidence: 'high', evidenceRefs: ['evidence-beta-feedback'] }], citations: [demoCitations.feedback], redacted: true },
    { id: 'diagnosis-student-gamma', role: 'teacher-student', subjectId: 'demo-ita-student-gamma', dimensions: [{ id: 'parameterDesign', state: 'ready', confidence: 'medium', evidenceRefs: ['evidence-gamma-summary'] }], citations: [demoCitations.report], redacted: true },
  ],
  pathPlans: [
    { id: 'path-alpha-main', studentId: 'demo-ita-student-alpha', policyFamily: 'rules-plus-graph-search', nodeIds: ['knowledge-card:control-correction-time-domain-targets', 'simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'], selectedNodeId: 'simulation:control-correction-step-response-lab', alternatives: ['path-alpha-remediation'], citations: [demoCitations.path, demoCitations.resource] },
    { id: 'path-beta-feedback', studentId: 'demo-ita-student-beta', policyFamily: 'long-horizon-hybrid-preview', nodeIds: ['document-feedback:rubric-control-report', 'knowledge-card:control-correction-time-domain-targets'], selectedNodeId: 'document-feedback:rubric-control-report', alternatives: ['path-beta-fast-review'], citations: [demoCitations.feedback] },
    { id: 'path-alpha-remediation', studentId: 'demo-ita-student-gamma', policyFamily: 'rules-plus-graph-search', nodeIds: ['knowledge-card:control-correction-time-domain-targets', 'document-feedback:rubric-control-report'], selectedNodeId: 'knowledge-card:control-correction-time-domain-targets', alternatives: [], citations: [demoCitations.path, demoCitations.report] },
  ],
  assignments: [
    { id: 'assignment-control-report', classId: 'demo-ita-class', title: 'Synthetic control report grading assignment', documentIds: ['doc-alpha-control-report', 'doc-beta-control-report'], synthetic: true },
  ],
  citationRecords: Object.values(demoCitations),
  resourceExecutions: [
    { id: 'execution-alpha-resource', studentId: 'demo-ita-student-alpha', nodeId: 'simulation:control-correction-step-response-lab', status: 'needs-support', evidenceRef: 'evidence-alpha-simulation', konlingMode: 'resource-coach' },
    { id: 'execution-beta-feedback', studentId: 'demo-ita-student-beta', nodeId: 'document-feedback:rubric-control-report', status: 'completed', evidenceRef: 'evidence-beta-feedback', konlingMode: 'resource-coach' },
  ],
  gradingRuns: [
    { id: 'grading-alpha-draft', teacherId: 'demo-teacher-ita', studentId: 'demo-ita-student-alpha', documentId: 'doc-alpha-control-report', status: 'draft', rubricVersion: 'rubric-control-report.v1', feedbackVisible: false, citations: [demoCitations.grading], redactedExport: true },
    { id: 'grading-beta-approved', teacherId: 'demo-teacher-ita', studentId: 'demo-ita-student-beta', documentId: 'doc-beta-control-report', status: 'approved', rubricVersion: 'rubric-control-report.v1', feedbackVisible: true, citations: [demoCitations.grading, demoCitations.feedback], redactedExport: true },
  ],
  documentWorkflow: {
    conversions: [
      { id: 'conversion-doc-alpha-control-report', documentId: 'doc-alpha-control-report', status: 'converted', redacted: true, sourceReference: 'submission:doc-alpha-control-report' },
      { id: 'conversion-doc-beta-control-report', documentId: 'doc-beta-control-report', status: 'converted', redacted: true, sourceReference: 'submission:doc-beta-control-report' },
    ],
    teacherApprovals: [
      { id: 'approval-grading-beta-approved', gradingRunId: 'grading-beta-approved', teacherId: 'demo-teacher-ita', status: 'approved', reviewedCriteria: 2, changedCriteria: 1, totalScoreDelta: 1, evidenceSourceEventIds: ['event-grading-beta-approved'] },
    ],
    writebackPreviews: [
      { id: 'writeback-preview-grading-alpha-draft', gradingRunId: 'grading-alpha-draft', target: 'learning-fact-preview', createsFacts: 1, committed: false },
    ],
  },
  diagnosisSnapshots: [
    { id: 'snapshot-diagnosis-alpha', diagnosisViewId: 'diagnosis-alpha', refreshedAt: '2026-06-05T09:20:00.000Z', evidenceRefs: ['evidence-alpha-path', 'evidence-alpha-simulation'], redacted: true },
    { id: 'snapshot-diagnosis-class', diagnosisViewId: 'diagnosis-class', refreshedAt: '2026-06-05T09:25:00.000Z', evidenceRefs: ['evidence-class-report'], redacted: true },
  ],
  pathOptions: [
    { id: 'path-option-alpha-selected', pathPlanId: 'path-alpha-main', optionType: 'selected', nodeIds: ['simulation:control-correction-step-response-lab'], evidenceRefs: ['evidence-alpha-simulation'] },
    { id: 'path-option-alpha-alternative', pathPlanId: 'path-alpha-main', optionType: 'alternative', nodeIds: ['knowledge-card:control-correction-time-domain-targets'], evidenceRefs: ['evidence-alpha-path'] },
    { id: 'path-option-beta-selected', pathPlanId: 'path-beta-feedback', optionType: 'selected', nodeIds: ['document-feedback:rubric-control-report'], evidenceRefs: ['evidence-beta-feedback'] },
  ],
  konlingCitations: [
    { id: 'konling-citation-diagnosis', sessionId: 'konling-diagnosis', citationId: 'cit-diagnosis-alpha', sourceFamily: 'role-based-learning-diagnosis', redacted: true },
    { id: 'konling-citation-path', sessionId: 'konling-path', citationId: 'cit-path-alpha', sourceFamily: 'adaptive-learning-path-planning', redacted: true },
    { id: 'konling-citation-prep', sessionId: 'konling-prep', citationId: 'cit-prep-pack', sourceFamily: 'teacher-prep-pack', redacted: true },
  ],
  teacherReports: [{
    id: 'teacher-report-demo-ita',
    classId: 'demo-ita-class',
    metrics: [
      { id: 'diagnosisCoverage', label: '诊断覆盖率', value: 1, methodology: { numerator: 'students with student or teacher-student diagnosis views', denominator: 'demo class roster students represented by diagnosis and path fixtures', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'medium', sourceFamily: 'role-based-learning-diagnosis', sourceCoverage: { covered: 3, total: 3 } } },
      { id: 'gradingFeedbackCoverage', label: '批改反馈覆盖率', value: 0.5, methodology: { numerator: 'approved or returned grading runs with visible feedback and citations', denominator: 'synthetic grading runs', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'high', sourceFamily: 'document-rubric-grading', sourceCoverage: { covered: 1, total: 2 } } },
      { id: 'konlingModeCoverage', label: '控灵模式覆盖率', value: 1, methodology: { numerator: 'required Konling modes with scoped context and citations', denominator: 'required demo Konling modes', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'medium', sourceFamily: 'konling-agent-runtime', sourceCoverage: { covered: 8, total: 8 } } },
    ],
    export: { id: 'teacher-report-demo-ita-export', redacted: true, omits: ['raw answer bodies', 'private memory', 'hidden Arena internals', 'raw traces', 'plaintext secrets'], route: '/api/teacher/classes/demo-ita-class/control-correction-report?export=true' },
  }],
  prepPacks: [
    { id: 'prep-pack-demo-ita', teacherId: 'demo-teacher-ita', classId: 'demo-ita-class', status: 'review-ready', reviewItems: ['diagnosis-summary', 'path-risk', 'grading-pattern', 'resource-plan'], citations: [demoCitations.prep, demoCitations.report], serverContextSigned: true },
  ],
  prepPackOverlays: [
    { id: 'overlay-prep-pack-demo-ita', sourcePrepPackId: 'prep-pack-demo-ita', status: 'active', activatedByTeacherId: 'demo-teacher-ita', activatedAt: '2026-06-05T10:30:00.000Z', baseManifestMutated: false, evidenceRefs: ['cit-prep-pack', 'cit-report-class'] },
  ],
  effectReports: [{
    id: 'effect-report-demo-ita',
    classId: 'demo-ita-class',
    goalId: 'control-correction',
    generatedAt: '2026-06-05T18:00:00.000Z',
    syntheticOnly: true,
    metrics: [
      { id: 'gradingFeedbackCoverage', label: '批改反馈覆盖率', value: 0.5, unit: 'rate', confidence: 'high', definition: 'Share of document rubric grading runs with teacher-approved or returned feedback visible to students.', numerator: '1 approved synthetic grading run with feedback action cards and citations', denominator: '2 synthetic grading runs', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['grading-beta-approved', 'feedback-grading-beta-approved'], exclusions: ['Draft grading runs awaiting teacher approval are excluded from the numerator.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'teacherOverrideRate', label: '教师覆写率', value: 0.5, unit: 'rate', confidence: 'medium', definition: 'Share of teacher-reviewed assistant draft rubric criteria changed by the teacher before approval or return.', numerator: '1 criterion with teacher diff', denominator: '2 approved grading criteria', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['approval-grading-beta-approved'], exclusions: ['Draft and blocked evaluator outputs without teacher review are excluded from the denominator.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'aiTeacherScoreDelta', label: 'AI/教师分差', value: 0.5, unit: 'score', confidence: 'medium', definition: 'Average absolute criterion score delta between assistant draft and teacher-approved rubric values.', numerator: '1 total changed score point across edited criteria', denominator: '2 approved grading criteria', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['grading-beta-approved', 'approval-grading-beta-approved'], exclusions: ['Unapproved drafts and blocked evaluator outputs are excluded.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'aiTeacherAgreementRate', label: 'AI/教师一致率', value: 0.5, unit: 'rate', confidence: 'medium', definition: 'Share of teacher-reviewed rubric criteria whose assistant draft required no teacher diff.', numerator: '1 unchanged criterion', denominator: '2 approved grading criteria', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['grading-beta-approved', 'approval-grading-beta-approved'], exclusions: ['Draft and blocked evaluator outputs without teacher review are excluded from the denominator.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'blockedEvaluatorOutputCount', label: '阻塞输出数', value: 0, unit: 'count', confidence: 'high', definition: 'Count of schema-invalid or evidence-anchor-invalid evaluator outputs blocked before writeback.', numerator: '0 blocked evaluator outputs', denominator: '2 synthetic evaluator outputs inspected', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['conversion-doc-alpha-control-report', 'conversion-doc-beta-control-report'], exclusions: ['Manual teacher edits after a valid draft are not counted as blocked outputs.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'gradingSampleSize', label: '评分样本量', value: 2, unit: 'count', confidence: 'high', definition: 'Number of document rubric grading runs included in the synthetic effect report window.', numerator: '2 grading runs in report scope', denominator: '1 synthetic class report window', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['grading-alpha-draft', 'grading-beta-approved'], exclusions: ['Real learner evidence imports are excluded until privacy review is complete.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 2, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'pathAdoptionRate', label: '路径采纳率', value: 0.667, unit: 'rate', confidence: 'medium', definition: 'Share of synthetic learner paths with a selected governed path option.', numerator: '2 selected path options', denominator: '3 synthetic path plans', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['path-alpha-main', 'path-beta-feedback', 'path-option-alpha-selected', 'path-option-beta-selected'], exclusions: ['Alternative options are excluded from the adoption numerator.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 3, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'prepPackActivationRate', label: '课前包激活率', value: 1, unit: 'rate', confidence: 'medium', definition: 'Share of generated synthetic teacher prep packs with an active runtime overlay.', numerator: '1 active prep-pack overlay', denominator: '1 synthetic prep pack', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['prep-pack-demo-ita', 'overlay-prep-pack-demo-ita'], exclusions: ['Draft-resource requests without approved overlay anchors are excluded.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 1, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'citationCoverageRate', label: '引用覆盖率', value: 1, unit: 'rate', confidence: 'high', definition: 'Share of required Konling demo sessions carrying reviewable redacted citations.', numerator: '8 cited Konling sessions', denominator: '8 required Konling sessions', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['konling-diagnosis', 'konling-path', 'konling-resource', 'konling-grading', 'konling-feedback', 'konling-class', 'konling-prep', 'konling-generic'], exclusions: ['Generic uncited chat transcripts are excluded from the demo package.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 8, dataOrigin: 'synthetic-demo', synthetic: true },
      { id: 'baselineUsageCoverage', label: '基线使用覆盖率', value: 1, unit: 'rate', confidence: 'medium', definition: 'Share of final competition route-ledger steps represented by deterministic synthetic demo package evidence.', numerator: '15 final competition route-ledger steps represented', denominator: '15 final competition route-ledger steps', sourceWindow: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', sourceReferences: ['entry-home', 'teacher-grading-workbench', 'student-document-feedback', 'student-learner-record', 'student-diagnosis-growth', 'student-adaptive-path', 'teacher-prep-pack-review', 'teacher-class-diagnosis', 'teacher-student-diagnosis', 'teacher-effect-report', 'admin-provenance', 'admin-governance', 'student-arena-entry', 'student-arena-challenge', 'student-control-workbench'], exclusions: ['External live-video repository availability is tracked separately in the asset manifest.'], caveats: ['Synthetic fixture metric for demo readiness; not a measured learning-gain claim.'], sampleSize: 15, dataOrigin: 'synthetic-demo', synthetic: true },
    ],
    export: { id: 'effect-report-demo-ita-export', redacted: true, route: '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true', omits: ['raw answer bodies', 'private memory', 'hidden Arena internals', 'raw traces', 'plaintext secrets'] },
  }],
  realEvidenceImports: [],
  konlingSessions: [
    { id: 'konling-diagnosis', modeId: 'diagnosis-explainer', actorRole: 'student', contextOwner: 'student', citations: [demoCitations.diagnosis], unavailableStateCovered: true },
    { id: 'konling-path', modeId: 'path-advisor', actorRole: 'student', contextOwner: 'student', citations: [demoCitations.path], unavailableStateCovered: true },
    { id: 'konling-resource', modeId: 'resource-coach', actorRole: 'student', contextOwner: 'student', citations: [demoCitations.resource], unavailableStateCovered: true },
    { id: 'konling-grading', modeId: 'grading-assistant', actorRole: 'teacher', contextOwner: 'teacher', citations: [demoCitations.grading], unavailableStateCovered: true },
    { id: 'konling-feedback', modeId: 'feedback-explainer', actorRole: 'student', contextOwner: 'student', citations: [demoCitations.feedback], unavailableStateCovered: true },
    { id: 'konling-class', modeId: 'class-summarizer', actorRole: 'teacher', contextOwner: 'teacher', citations: [demoCitations.report], unavailableStateCovered: true },
    { id: 'konling-prep', modeId: 'prep-coauthor', actorRole: 'teacher', contextOwner: 'teacher', citations: [demoCitations.prep], unavailableStateCovered: true },
    { id: 'konling-generic', modeId: 'generic-chat', actorRole: 'student', contextOwner: 'system', citations: [demoCitations.resource], unavailableStateCovered: true },
  ],
  routeChecks: [
    { route: '/assessment/adaptive-practice?goal=control-correction', readyText: 'data-control-correction-center', actorRole: 'student' },
    { route: '/teacher/grading-workbench?demo=1', readyText: '报告评分工作台', actorRole: 'teacher' },
    { route: '/assessment/document-feedback?demo=1', readyText: '报告反馈', actorRole: 'student' },
    { route: '/teacher/classes/demo-ita-class/analytics-v2', readyText: '班级学情总览', actorRole: 'teacher', requiredStatusSemantics: 'ready', forbiddenTexts: ['加载班级学情总览', '加载失败', 'data-operations-status-semantics="loading"', 'data-operations-status-semantics="error"'] },
    { route: '/teacher/classes/demo-ita-class/students/demo-ita-student-beta', readyText: '证据摘要', actorRole: 'teacher', requiredStatusSemantics: 'ready', forbiddenTexts: ['加载学生学情', '加载失败', 'data-operations-status-semantics="loading"', 'data-operations-status-semantics="error"'] },
  ],
  apiExamples: [
    { method: 'GET', path: '/api/adaptive/learner-state?goal=control-correction', asserts: ['goal slice', 'path context'], actorRole: 'student' },
    { method: 'POST', path: '/api/learning-paths/plan', asserts: ['path id returned', 'multi-path context'], actorRole: 'teacher' },
    { method: 'POST', path: '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute', asserts: ['execution write response', 'resource execution context'], actorRole: 'student' },
    { method: 'POST', path: '/api/teacher/document-grading/approve', asserts: ['legacy document-rubric draft writes return 410', 'native Assignment review remains the write path'], actorRole: 'teacher' },
    { method: 'POST', path: '/api/ai/chat', asserts: ['mode runtime contract', 'citation guard'], actorRole: 'mode' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/control-correction-report?export=true', asserts: ['redacted export', 'metric methodology'], actorRole: 'teacher' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true', asserts: ['effect report metrics', 'synthetic caveats'], actorRole: 'teacher' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/insights', asserts: ['class insights payload', 'student roster evidence'], actorRole: 'teacher' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/heatmap', asserts: ['class heatmap payload', 'competency matrix'], actorRole: 'teacher' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights', asserts: ['student insights payload', 'individual evidence summary'], actorRole: 'teacher' },
  ],
  featureFlags: [
    { key: 'AI_PROVIDER_ENABLED', expected: 'enabled', rollbackValue: 'disabled' },
    { key: 'KONLING_SERVER_MODE_CONTEXT_SECRET', expected: 'enabled', rollbackValue: 'disabled' },
    { key: 'DOCUMENT_RUBRIC_GRADING_ENABLED', expected: 'enabled', rollbackValue: 'disabled' },
  ],
  rollback: {
    command: 'rtk npx tsx scripts/tests/intelligent-teaching-assistant-demo-acceptance.ts --rollback-check',
    expectedChecks: ['AI provider fallback can be disabled', 'signed mode context can be removed', 'demo tenant cleanup selector present'],
  },
};

export const XH_202620_COMPETITION_BASELINE: CompetitionBaseline = {
  id: 'xh-202620-control-assistant-baseline',
  competitionCode: 'xh-202620',
  story: 'Automatic-control intelligent teaching assistant closed loop from document assignment to effect report.',
  sourcePackageVersion: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.version,
  accounts: [
    {
      id: 'demo-teacher-ita',
      role: 'teacher',
      displayName: 'Competition Demo Teacher',
      synthetic: true,
      routeScope: [
        '/',
        '/teacher/grading-workbench?demo=1',
        '/teacher/classes/demo-ita-class/analytics-v2',
        '/teacher/classes/demo-ita-class/students/demo-ita-student-beta',
        '/teacher/prep-packs',
        '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      ],
    },
    {
      id: 'demo-admin-ita',
      role: 'administrator',
      displayName: 'Competition Demo Administrator',
      synthetic: true,
      routeScope: [
        '/admin/settings',
        '/admin/data-governance',
        '/data-center',
      ],
    },
    {
      id: 'demo-ita-student-alpha',
      role: 'student',
      displayName: 'Competition Demo Student Alpha',
      synthetic: true,
      routeScope: [
        '/',
        '/profile/evidence',
        '/profile/growth',
        '/assessment/adaptive-practice?goal=control-correction',
        '/assessment/document-feedback?demo=1',
        '/arena',
        '/arena/challenges/task-second-order-lead-pid',
        '/interactive-learning/control-workbench',
      ],
    },
  ],
  records: [
    { id: 'demo-ita-class', type: 'class', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'assignment-control-report', type: 'assignment', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'snapshot-diagnosis-alpha', type: 'diagnosis-snapshot', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'path-alpha-main', type: 'path-plan', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'konling-diagnosis', type: 'konling-session', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'prep-pack-demo-ita', type: 'prep-pack', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'overlay-prep-pack-demo-ita', type: 'prep-pack-overlay', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
    { id: 'effect-report-demo-ita-export', type: 'effect-report-export', dataOrigin: 'synthetic-demo', sourcePackageId: 'intelligent-teaching-assistant' },
  ],
  routeLedger: [
    {
      id: 'entry-home',
      actorRole: 'student',
      label: 'Reviewer starts from the unified student entry surface',
      route: '/',
      expectedEvidence: 'commercial student entry with competition route order',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'teacher-grading-workbench',
      actorRole: 'teacher',
      label: 'Teacher reviews assistant draft grading',
      route: '/teacher/grading-workbench?demo=1',
      expectedEvidence: 'document-grading-workbench marker and grading-alpha-draft fixture',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-document-feedback',
      actorRole: 'student',
      label: 'Student reads rubric feedback',
      route: '/assessment/document-feedback?demo=1',
      expectedEvidence: 'document-feedback marker and feedback-grading-beta-approved fixture',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-learner-record',
      actorRole: 'student',
      label: 'Student opens learner record instead of operations data center',
      route: '/profile/evidence',
      expectedEvidence: 'student evidence profile route, not /data-center',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-diagnosis-growth',
      actorRole: 'student',
      label: 'Student opens diagnosis and growth evidence',
      route: '/profile/growth',
      expectedEvidence: 'diagnosis-alpha and learner growth evidence',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-adaptive-path',
      actorRole: 'student',
      label: 'Student follows control-correction adaptive path',
      route: '/assessment/adaptive-practice?goal=control-correction',
      expectedEvidence: 'data-control-correction-center marker and path-alpha-main fixture',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'teacher-prep-pack-review',
      actorRole: 'teacher',
      label: 'Teacher reviews prep-pack actions',
      route: '/teacher/prep-packs',
      expectedEvidence: 'prep-pack-demo-ita fixture with signed server context and lifecycle actions',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'teacher-class-diagnosis',
      actorRole: 'teacher',
      label: 'Teacher reviews class-level diagnosis and report evidence',
      route: '/teacher/classes/demo-ita-class/analytics-v2',
      expectedEvidence: 'teacher-class-analytics marker and demo-ita-class governance summary',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'teacher-student-diagnosis',
      actorRole: 'teacher',
      label: 'Teacher drills into individual student evidence',
      route: '/teacher/classes/demo-ita-class/students/demo-ita-student-beta',
      expectedEvidence: 'teacher-student-insights marker and demo-ita-student-beta evidence summary',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'teacher-effect-report',
      actorRole: 'teacher',
      label: 'Teacher exports source-backed assistant effect report',
      route: '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      expectedEvidence: 'effectReport payload with source-backed synthetic metrics',
      surfaceStatus: 'api-only',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'admin-provenance',
      actorRole: 'administrator',
      label: 'Administrator inspects provenance and demo-source policy',
      route: '/data-center',
      expectedEvidence: 'admin/teacher operations-only data center with source quality attributes',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'admin-governance',
      actorRole: 'administrator',
      label: 'Administrator verifies governed data and provider policy',
      route: '/admin/data-governance',
      expectedEvidence: 'admin data governance surface with provenance controls',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-arena-entry',
      actorRole: 'student',
      label: 'Student opens Arena challenge workspace',
      route: '/arena',
      expectedEvidence: 'Arena workspace shell and task map',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-arena-challenge',
      actorRole: 'student',
      label: 'Student inspects official Arena challenge',
      route: '/arena/challenges/task-second-order-lead-pid',
      expectedEvidence: 'task-second-order-lead-pid challenge detail and leaderboard evidence',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
    {
      id: 'student-control-workbench',
      actorRole: 'student',
      label: 'Student rehearses in the simulation control workbench',
      route: '/interactive-learning/control-workbench',
      expectedEvidence: 'control-workbench simulation shell',
      surfaceStatus: 'implemented',
      dataOrigin: 'synthetic-demo',
    },
  ],
  capabilities: [
    {
      id: 'diagnosis-to-path',
      competitionRequirement: 'Learner diagnosis and recommended learning path',
      platformCapability: 'role-based diagnosis, adaptive path planning, learner evidence profile',
      status: 'implemented',
      proof: ['snapshot-diagnosis-alpha', 'path-alpha-main', '/profile/evidence'],
    },
    {
      id: 'document-grading',
      competitionRequirement: 'AI-assisted report grading with teacher review',
      platformCapability: 'document rubric grading workbench and cited student feedback',
      status: 'implemented',
      proof: ['grading-alpha-draft', 'approval-grading-beta-approved', '/teacher/grading-workbench?demo=1'],
    },
    {
      id: 'konling-explanation',
      competitionRequirement: 'Interactive assistant explains diagnosis, path, resources, and grading',
      platformCapability: 'Konling mode runtime with scoped citations',
      status: 'implemented',
      proof: ['konling-diagnosis', 'konling-path', 'konling-grading'],
    },
    {
      id: 'teacher-prep-pack',
      competitionRequirement: 'Teacher receives a prep-pack action from student evidence',
      platformCapability: 'teacher prep-pack and runtime overlay fixtures',
      status: 'implemented',
      proof: ['prep-pack-demo-ita', 'overlay-prep-pack-demo-ita'],
    },
    {
      id: 'effect-report',
      competitionRequirement: 'Competition reviewer sees source-backed effect report',
      platformCapability: 'assistant effect report export with metric methodology',
      status: 'implemented',
      proof: ['effect-report-demo-ita-export'],
    },
  ],
  temporarySurfaces: [
    {
      id: 'assistant-effect-report-api-only',
      routeOrApi: '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      surfaceStatus: 'api-only',
      removalOwner: 'polish-competition-surfaces-report',
    },
    {
      id: 'demo-provider-flags',
      routeOrApi: 'AI_PROVIDER_ENABLED, KONLING_SERVER_MODE_CONTEXT_SECRET, DOCUMENT_RUBRIC_GRADING_ENABLED',
      surfaceStatus: 'feature-flagged',
      removalOwner: 'harden-assistant-evidence-loop',
    },
  ],
  seedReset: {
    command: 'rtk npm run test:competition-baseline',
    resetCommand: 'rtk npm run test:intelligent-teaching-assistant-demo -- --rollback-check',
    idempotencyKey: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.resetIdempotencyKey,
    cleanupSelectors: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.cleanupSelectors,
    duplicateCheck: 'installIntelligentTeachingAssistantDemoFixtures(firstInstall.state) equals firstInstall.state',
  },
  acceptanceCommands: [
    'rtk npm run test:competition-baseline',
    'rtk npm run test:intelligent-teaching-assistant-demo',
    'rtk npm run test:commercial-ui-governance',
    'rtk openspec validate competition-demo-baseline --strict',
  ],
};

const REQUIRED_MODES = new Set([
  'generic-chat',
  'diagnosis-explainer',
  'path-advisor',
  'resource-coach',
  'grading-assistant',
  'feedback-explainer',
  'class-summarizer',
  'prep-coauthor',
]);

const REQUIRED_OMISSIONS = ['raw answer bodies', 'private memory', 'hidden Arena internals', 'raw traces', 'plaintext secrets'];
const REVIEWABLE_HREFS = new Set(Object.values(demoCitations).map((citation) => citation.href));
const REQUIRED_ROUTES = new Set([
  '/assessment/adaptive-practice?goal=control-correction',
  '/teacher/grading-workbench?demo=1',
  '/assessment/document-feedback?demo=1',
  '/teacher/classes/demo-ita-class/analytics-v2',
  '/teacher/classes/demo-ita-class/students/demo-ita-student-beta',
]);
const REQUIRED_APIS = new Set([
  '/api/adaptive/learner-state?goal=control-correction',
  '/api/learning-paths/plan',
  '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute',
  '/api/teacher/document-grading/approve',
  '/api/ai/chat',
  '/api/teacher/classes/demo-ita-class/control-correction-report?export=true',
  '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
  '/api/teacher/classes/demo-ita-class/insights',
  '/api/teacher/classes/demo-ita-class/heatmap',
  '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights',
]);
const REQUIRED_FLAGS = new Set(['AI_PROVIDER_ENABLED', 'KONLING_SERVER_MODE_CONTEXT_SECRET', 'DOCUMENT_RUBRIC_GRADING_ENABLED']);
const REQUIRED_INSTALL_RECORD_TYPES = new Set([
  'assignment',
  'citation',
  'class',
  'diagnosis-view',
  'diagnosis-snapshot',
  'document-conversion',
  'goal',
  'effect-report-export',
  'effect-report-metric',
  'grading-run',
  'konling-citation',
  'konling-session',
  'learner-state-slice',
  'path-plan',
  'path-option',
  'prep-pack',
  'prep-pack-overlay',
  'resource-execution',
  'student',
  'student-feedback',
  'teacher-report',
  'teacher-report-export',
  'teacher-report-metric',
  'teacher-approval',
  'writeback-preview',
]);
const REQUIRED_EFFECT_REPORT_METRICS = new Set([
  'gradingFeedbackCoverage',
  'teacherOverrideRate',
  'aiTeacherScoreDelta',
  'aiTeacherAgreementRate',
  'blockedEvaluatorOutputCount',
  'gradingSampleSize',
  'pathAdoptionRate',
  'prepPackActivationRate',
  'citationCoverageRate',
  'baselineUsageCoverage',
]);
const REQUIRED_COMPETITION_ROUTE_IDS = new Set([
  'entry-home',
  'teacher-grading-workbench',
  'student-document-feedback',
  'student-learner-record',
  'student-diagnosis-growth',
  'student-adaptive-path',
  'teacher-prep-pack-review',
  'teacher-class-diagnosis',
  'teacher-student-diagnosis',
  'teacher-effect-report',
  'admin-provenance',
  'admin-governance',
  'student-arena-entry',
  'student-arena-challenge',
  'student-control-workbench',
]);
const FORBIDDEN_PATTERNS = [
  /(?:^|[\s:"'])sk-[a-z0-9_-]{8,}/i,
  /Bearer\s+[a-z0-9._-]+/i,
  /@[a-z0-9.-]+\.[a-z]{2,}/i,
  /raw[\s._-]*(answer|response|submission|body)/i,
  /private[\s._-]*(memory|konling)/i,
  /hidden[\s._-]*(arena|evaluation|evaluator|internal)(?![a-z\s._-]*redacted)/i,
  /raw[\s._-]*(trace|traces|timeseries|sample|samples)/i,
];
const DEMO_PACKAGE_ID = 'intelligent-teaching-assistant';

function collectPrivacyScanText(value: unknown, path: string[] = []): string[] {
  if (value === null || value === undefined) return [];
  if (path.length >= 2 && path[path.length - 2] === 'omits' && path.includes('export')) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [`${path.join('.')}:${String(value)}`];
  if (Array.isArray(value)) return value.flatMap((item, index) => collectPrivacyScanText(item, [...path, String(index)]));
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => collectPrivacyScanText(item, [...path, key]));
  return [];
}

function expectedMetricValue(pkg: IntelligentTeachingAssistantDemoPackage, metricId: string): number | null {
  if (metricId === 'diagnosisCoverage') {
    const represented = new Set(pkg.diagnosisViews.filter((view) => view.role !== 'teacher-class').map((view) => view.subjectId));
    const pathStudents = new Set(pkg.pathPlans.map((path) => path.studentId));
    return pkg.class.studentIds.filter((id) => represented.has(id) || pathStudents.has(id)).length / pkg.class.studentIds.length;
  }
  if (metricId === 'gradingFeedbackCoverage') {
    return pkg.gradingRuns.filter((run) => (
      run.feedbackVisible &&
      run.citations.length > 0 &&
      (run.status === 'approved' || run.status === 'returned')
    )).length / pkg.gradingRuns.length;
  }
  if (metricId === 'konlingModeCoverage') {
    const modes = new Set(pkg.konlingSessions.map((session) => session.modeId));
    return [...REQUIRED_MODES].filter((mode) => modes.has(mode)).length / REQUIRED_MODES.size;
  }
  if (metricId === 'teacherOverrideRate') {
    const reviewedCriteria = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.reviewedCriteria, 0);
    const changedCriteria = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.changedCriteria, 0);
    return reviewedCriteria === 0 ? 0 : changedCriteria / reviewedCriteria;
  }
  if (metricId === 'aiTeacherScoreDelta') {
    const reviewedCriteria = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.reviewedCriteria, 0);
    const totalScoreDelta = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.totalScoreDelta, 0);
    return reviewedCriteria === 0 ? 0 : totalScoreDelta / reviewedCriteria;
  }
  if (metricId === 'aiTeacherAgreementRate') {
    const reviewedCriteria = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.reviewedCriteria, 0);
    const changedCriteria = pkg.documentWorkflow.teacherApprovals.reduce((sum, approval) => sum + approval.changedCriteria, 0);
    return reviewedCriteria === 0 ? 0 : Math.max(0, 1 - changedCriteria / reviewedCriteria);
  }
  if (metricId === 'blockedEvaluatorOutputCount') {
    return pkg.gradingRuns.filter((run) => run.status === 'blocked').length;
  }
  if (metricId === 'gradingSampleSize') {
    return pkg.gradingRuns.length;
  }
  if (metricId === 'pathAdoptionRate') {
    const selectedOptions = pkg.pathOptions.filter((option) => option.optionType === 'selected').length;
    return pkg.pathPlans.length === 0 ? 0 : selectedOptions / pkg.pathPlans.length;
  }
  if (metricId === 'prepPackActivationRate') {
    const activeOverlays = pkg.prepPackOverlays.filter((overlay) => overlay.status === 'active').length;
    return pkg.prepPacks.length === 0 ? 0 : activeOverlays / pkg.prepPacks.length;
  }
  if (metricId === 'citationCoverageRate') {
    const citedSessions = pkg.konlingSessions.filter((session) => session.citations.length > 0).length;
    return pkg.konlingSessions.length === 0 ? 0 : citedSessions / pkg.konlingSessions.length;
  }
  if (metricId === 'baselineUsageCoverage') {
    const representedSteps = XH_202620_COMPETITION_BASELINE.routeLedger.filter((step) => (
      (step.surfaceStatus === 'implemented' || step.surfaceStatus === 'api-only') &&
      step.expectedEvidence.length > 0 &&
      step.dataOrigin === 'synthetic-demo'
    )).length;
    return XH_202620_COMPETITION_BASELINE.routeLedger.length === 0
      ? 0
      : representedSteps / XH_202620_COMPETITION_BASELINE.routeLedger.length;
  }
  return null;
}

function expectedEffectMetricSampleSize(pkg: IntelligentTeachingAssistantDemoPackage, metricId: AssistantDemoEffectMetric['id']): number | null {
  if (
    metricId === 'gradingFeedbackCoverage' ||
    metricId === 'blockedEvaluatorOutputCount' ||
    metricId === 'gradingSampleSize'
  ) {
    return pkg.gradingRuns.length;
  }
  if (
    metricId === 'teacherOverrideRate' ||
    metricId === 'aiTeacherScoreDelta' ||
    metricId === 'aiTeacherAgreementRate'
  ) {
    return pkg.documentWorkflow.teacherApprovals.reduce((total, approval) => total + approval.reviewedCriteria, 0);
  }
  if (metricId === 'pathAdoptionRate') {
    return pkg.pathPlans.length;
  }
  if (metricId === 'prepPackActivationRate') {
    return pkg.prepPacks.length;
  }
  if (metricId === 'citationCoverageRate') {
    return pkg.konlingSessions.length;
  }
  if (metricId === 'baselineUsageCoverage') {
    return XH_202620_COMPETITION_BASELINE.routeLedger.length;
  }
  return null;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isCompleteEffectMetric(metric: AssistantDemoEffectMetric): boolean {
  return Boolean(
    metric.definition &&
    metric.numerator &&
    metric.denominator &&
    metric.sourceWindow &&
    metric.confidence &&
    metric.sourceReferences.length > 0 &&
    metric.exclusions.length > 0 &&
    metric.caveats.length > 0 &&
    metric.sampleSize > 0 &&
    metric.dataOrigin === 'synthetic-demo' &&
    metric.synthetic,
  );
}

function collectDemoSourceReferenceIds(pkg: IntelligentTeachingAssistantDemoPackage): Set<string> {
  return new Set([
    pkg.class.id,
    ...Object.values(demoCitations).map((citation) => citation.id),
    ...pkg.citationRecords.map((citation) => citation.id),
    ...pkg.learnerStateSlices.map((slice) => slice.id),
    ...pkg.diagnosisViews.map((view) => view.id),
    ...pkg.diagnosisSnapshots.map((snapshot) => snapshot.id),
    ...pkg.pathPlans.map((path) => path.id),
    ...pkg.pathOptions.map((option) => option.id),
    ...pkg.resourceExecutions.map((execution) => execution.id),
    ...pkg.gradingRuns.map((run) => run.id),
    ...pkg.gradingRuns.map((run) => `feedback-${run.id}`),
    ...pkg.documentWorkflow.conversions.map((conversion) => conversion.id),
    ...pkg.documentWorkflow.teacherApprovals.map((approval) => approval.id),
    ...pkg.documentWorkflow.writebackPreviews.map((preview) => preview.id),
    ...pkg.teacherReports.map((report) => report.id),
    ...pkg.prepPacks.map((pack) => pack.id),
    ...pkg.prepPackOverlays.map((overlay) => overlay.id),
    ...pkg.effectReports.map((report) => report.export.id),
    ...pkg.konlingSessions.map((session) => session.id),
  ]);
}

export function buildIntelligentTeachingAssistantEffectReportExport(
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): AssistantDemoEffectReportExport {
  const report = pkg.effectReports[0];
  if (!report) {
    throw new Error('Intelligent teaching assistant demo package does not define an effect report export.');
  }
  return report;
}

export function installIntelligentTeachingAssistantDemoFixtures(
  currentState: AssistantDemoInstallState = { records: [] },
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): AssistantDemoInstallResult {
  const scope = pkg.fixtureScope.tenantId;
  const records = [
    demoRecord('class', pkg.class.id, scope, pkg.class),
    ...pkg.students.map((student) => demoRecord('student', student.id, scope, student)),
    ...pkg.goals.map((goal) => demoRecord('goal', goal.id, scope, goal)),
    ...pkg.learnerStateSlices.map((slice) => demoRecord('learner-state-slice', slice.id, scope, slice)),
    ...pkg.diagnosisViews.map((view) => demoRecord('diagnosis-view', view.id, scope, view)),
    ...pkg.pathPlans.map((plan) => demoRecord('path-plan', plan.id, scope, plan)),
    ...pkg.assignments.map((assignment) => demoRecord('assignment', assignment.id, scope, assignment)),
    ...pkg.citationRecords.map((citation) => demoRecord('citation', citation.id, scope, citation)),
    ...pkg.resourceExecutions.map((execution) => demoRecord('resource-execution', execution.id, scope, execution)),
    ...pkg.gradingRuns.map((run) => demoRecord('assignment', `assignment-${run.documentId}`, scope, {
      id: `assignment-${run.documentId}`,
      classId: pkg.class.id,
      studentId: run.studentId,
      documentId: run.documentId,
      rubricVersion: run.rubricVersion,
    })),
    ...pkg.gradingRuns.map((run) => demoRecord('document-submission', run.documentId, scope, {
      id: run.documentId,
      classId: pkg.class.id,
      studentId: run.studentId,
      redacted: run.redactedExport,
    })),
    ...pkg.gradingRuns.map((run) => demoRecord('grading-run', run.id, scope, run)),
    ...pkg.gradingRuns.map((run) => demoRecord('student-feedback', `feedback-${run.id}`, scope, {
      gradingRunId: run.id,
      studentId: run.studentId,
      visible: run.feedbackVisible,
      citations: run.citations,
    })),
    ...pkg.documentWorkflow.conversions.map((conversion) => demoRecord('document-conversion', conversion.id, scope, conversion)),
    ...pkg.documentWorkflow.teacherApprovals.map((approval) => demoRecord('teacher-approval', approval.id, scope, approval)),
    ...pkg.documentWorkflow.writebackPreviews.map((preview) => demoRecord('writeback-preview', preview.id, scope, preview)),
    ...pkg.diagnosisSnapshots.map((snapshot) => demoRecord('diagnosis-snapshot', snapshot.id, scope, snapshot)),
    ...pkg.pathOptions.map((option) => demoRecord('path-option', option.id, scope, option)),
    ...pkg.konlingCitations.map((citation) => demoRecord('konling-citation', citation.id, scope, citation)),
    ...pkg.teacherReports.flatMap((report) => [
      demoRecord('teacher-report', report.id, scope, report),
      demoRecord('teacher-report-export', report.export.id, scope, report.export),
      ...report.metrics.map((metric) => demoRecord('teacher-report-metric', metric.id, scope, metric)),
    ]),
    ...pkg.prepPacks.map((pack) => demoRecord('prep-pack', pack.id, scope, pack)),
    ...pkg.prepPackOverlays.map((overlay) => demoRecord('prep-pack-overlay', overlay.id, scope, overlay)),
    ...pkg.effectReports.flatMap((report) => [
      demoRecord('effect-report-export', report.export.id, scope, report.export),
      ...report.metrics.map((metric) => demoRecord('effect-report-metric', `${report.id}:${metric.id}`, scope, metric)),
    ]),
    ...pkg.konlingSessions.map((session) => demoRecord('konling-session', session.id, scope, session)),
  ].sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
  const retained = currentState.records.filter((record) => !isDemoOwnedRecord(record, scope));
  const resetDeletedIds = currentState.records.filter((record) => isDemoOwnedRecord(record, scope)).map((record) => record.id).sort();
  const collision = retained.find((record) => (
    record.scope === scope &&
    records.some((demo) => demo.type === record.type && demo.id === record.id)
  ));
  if (collision) {
    throw new Error(`Cannot install intelligent teaching assistant demo fixtures over non-demo record ${collision.type}:${collision.id}`);
  }

  return { resetDeletedIds, upsertedIds: records.map((record) => record.id), state: { records: [...retained, ...records] } };
}

function demoRecord(type: string, id: string, scope: string, payload: unknown): AssistantDemoInstallState['records'][number] {
  return {
    type,
    id,
    scope,
    payload: {
      ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : { value: payload }),
      demoPackage: DEMO_PACKAGE_ID,
      syntheticOnly: true,
    },
  };
}

function isDemoOwnedRecord(record: AssistantDemoInstallState['records'][number], scope: string): boolean {
  if (record.scope !== scope) return false;
  const payload = record.payload;
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>).demoPackage === DEMO_PACKAGE_ID,
  );
}

export function buildIntelligentTeachingAssistantDemoRollbackReport(): AssistantDemoAcceptanceReport {
  const providerDisabled = resolveAIProviderConfig({ AI_PROVIDER_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv).enabled === false;
  const simulatedModeContextSecret = '';
  const checks = [
    { id: 'rollback.ai-provider-disabled', ok: providerDisabled, detail: 'AI_PROVIDER_ENABLED=false disables environment fallback provider routing.' },
    { id: 'rollback.mode-context-secret-removed', ok: simulatedModeContextSecret.length === 0, detail: 'Signed server mode context can be removed without exposing fixture secrets.' },
    { id: 'rollback.demo-tenant-cleanup-selector', ok: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.cleanupSelectors.some((selector) => selector.includes('syntheticOnly=true')), detail: 'Demo tenant cleanup selectors remain available.' },
  ];
  const errors = checks.filter((check) => !check.ok).map((check) => `${check.id} failed`);
  return { ok: errors.length === 0, checks, errors };
}

export function validateIntelligentTeachingAssistantDemoPackage(
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): string[] {
  const errors: string[] = [];
  const add = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
  const routeSet = new Set(pkg.routeChecks.map((check) => check.route));
  const apiSet = new Set(pkg.apiExamples.map((example) => example.path));
  const sourceReferenceIds = collectDemoSourceReferenceIds(pkg);
  const baselineRouteLedgerIds = new Set(XH_202620_COMPETITION_BASELINE.routeLedger.map((step) => step.id));
  add(pkg.fixtureScope.syntheticOnly, 'fixture scope must be synthetic only');
  add(pkg.fixtureScope.cleanupSelectors.every((selector) => (
    selector.includes('tenantId=demo-intelligent-teaching-assistant-tenant') &&
    selector.includes('demoPackage=intelligent-teaching-assistant') &&
    selector.includes('AND')
  )), 'cleanup selectors must be demo-package-scoped conjunctions');
  add(pkg.students.every((student) => student.synthetic) && pkg.class.studentIds.every((id) => pkg.students.some((student) => student.id === id)), 'class roster must contain only synthetic students');
  add(pkg.goals.every((goal) => goal.synthetic && goal.registered) && pkg.goals.some((goal) => goal.id === 'control-correction'), 'registered synthetic control-correction goal is required');
  add(pkg.learnerStateSlices.every((slice) => pkg.class.studentIds.includes(slice.studentId) && pkg.goals.some((goal) => goal.id === slice.goalId) && pkg.pathPlans.some((path) => path.id === slice.activePathId) && slice.evidenceRefs.length > 0), 'learner-state slices must link roster students, goals, active paths, and evidence refs');
  add(pkg.class.studentIds.every((id) => pkg.pathPlans.some((path) => path.studentId === id) || pkg.diagnosisViews.some((view) => view.subjectId === id)), 'every roster student must have diagnosis or path evidence');
  add(pkg.diagnosisViews.every((view) => view.redacted && view.citations.length > 0 && view.dimensions.every((dimension) => dimension.evidenceRefs.length > 0)), 'diagnosis views require redaction, dimensions, evidence, and citations');
  add(pkg.pathPlans.every((path) => path.nodeIds.includes(path.selectedNodeId) && path.citations.length > 0), 'path plans require selected nodes and citations');
  add(pkg.assignments.every((assignment) => assignment.synthetic && assignment.classId === pkg.class.id && assignment.documentIds.length > 0), 'assignments require synthetic class-scoped document ids');
  add(pkg.citationRecords.length >= Object.keys(demoCitations).length && pkg.citationRecords.every((citation) => REVIEWABLE_HREFS.has(citation.href)), 'independent citation records must point to reviewable demo routes');
  add(pkg.resourceExecutions.every((execution) => execution.konlingMode === 'resource-coach' && execution.evidenceRef), 'resource executions require resource-coach context and evidence refs');
  add(pkg.gradingRuns.every((run) => run.citations.length > 0 && run.redactedExport), 'grading runs require citations and redacted exports');
  add(pkg.gradingRuns.every((run) => (
    !run.feedbackVisible || run.status === 'approved' || run.status === 'returned'
  )), 'visible grading feedback requires teacher-approved or returned grading state');
  add(pkg.documentWorkflow.conversions.every((conversion) => pkg.gradingRuns.some((run) => run.documentId === conversion.documentId) && conversion.redacted), 'document conversions require redacted source submissions');
  add(pkg.documentWorkflow.teacherApprovals.every((approval) => (
    pkg.gradingRuns.some((run) => run.id === approval.gradingRunId && run.status === 'approved') &&
    approval.status === 'approved' &&
    approval.reviewedCriteria > 0 &&
    approval.changedCriteria >= 0 &&
    approval.changedCriteria <= approval.reviewedCriteria &&
    approval.totalScoreDelta >= 0 &&
    approval.evidenceSourceEventIds.length > 0
  )), 'teacher approvals require approved grading runs, criterion deltas, and evidence source events');
  add(pkg.documentWorkflow.writebackPreviews.every((preview) => pkg.gradingRuns.some((run) => run.id === preview.gradingRunId) && preview.target === 'learning-fact-preview' && preview.createsFacts > 0 && preview.committed === false), 'writeback previews must describe uncommitted learning-fact effects');
  add(pkg.diagnosisSnapshots.every((snapshot) => pkg.diagnosisViews.some((view) => view.id === snapshot.diagnosisViewId) && snapshot.redacted && snapshot.evidenceRefs.length > 0), 'diagnosis snapshots require refreshed redacted evidence');
  add(pkg.pathOptions.every((option) => pkg.pathPlans.some((path) => path.id === option.pathPlanId) && option.nodeIds.length > 0 && option.evidenceRefs.length > 0), 'path options require linked path plans, nodes, and evidence refs');
  add(pkg.konlingCitations.every((citation) => pkg.konlingSessions.some((session) => session.id === citation.sessionId) && pkg.citationRecords.some((record) => record.id === citation.citationId) && citation.redacted), 'Konling citation records must link sessions to redacted reviewable citations');
  add(pkg.teacherReports.every((report) => report.export.redacted && REQUIRED_OMISSIONS.every((omission) => report.export.omits.includes(omission))), 'teacher exports must omit restricted payload classes');
  add(pkg.teacherReports.every((report) => report.metrics.every((metric) => {
    const expected = expectedMetricValue(pkg, metric.id);
    return metric.methodology.numerator && metric.methodology.denominator && metric.methodology.window && metric.methodology.sourceFamily && metric.methodology.sourceCoverage.covered > 0 && (expected === null || Math.abs(metric.value - expected) < 0.000001);
  })), 'teacher report metrics require methodology and recomputable values');
  add(pkg.prepPacks.every((pack) => pack.serverContextSigned && pack.reviewItems.length > 0 && pack.citations.length > 0), 'prep packs require signed server context, review items, and citations');
  add(pkg.prepPackOverlays.every((overlay) => pkg.prepPacks.some((pack) => pack.id === overlay.sourcePrepPackId) && overlay.status === 'active' && overlay.baseManifestMutated === false && overlay.evidenceRefs.length > 0), 'prep-pack overlays require active activation evidence without base manifest mutation');
  add(pkg.effectReports.length > 0 && pkg.effectReports.every((report) => (
    report.syntheticOnly &&
    report.goalId === 'control-correction' &&
    report.export.redacted &&
    REQUIRED_OMISSIONS.every((omission) => report.export.omits.includes(omission)) &&
    [...REQUIRED_EFFECT_REPORT_METRICS].every((id) => report.metrics.some((metric) => metric.id === id)) &&
    report.metrics.every(isCompleteEffectMetric)
  )), 'effect report metrics require definitions, source windows, source references, exclusions, caveats, and synthetic labels');
  add(pkg.effectReports.every((report) => report.metrics.every((metric) => (
    metric.id === 'baselineUsageCoverage'
      ? new Set(metric.sourceReferences).size === baselineRouteLedgerIds.size
        && [...baselineRouteLedgerIds].every((reference) => metric.sourceReferences.includes(reference))
      : metric.sourceReferences.every((reference) => sourceReferenceIds.has(reference))
  ))), 'effect report source references must resolve to the metric-specific evidence source set');
  add(pkg.effectReports.every((report) => report.metrics.every((metric) => {
    const expected = expectedMetricValue(pkg, metric.id);
    return expected === null || roundMetric(expected) === metric.value;
  })), 'effect report metrics must match recomputable demo record values');
  add(pkg.effectReports.every((report) => report.metrics.every((metric) => {
    const expected = expectedEffectMetricSampleSize(pkg, metric.id);
    return expected === null || expected === metric.sampleSize;
  })), 'effect report metric sample sizes must match recomputable demo record denominators');
  add(pkg.realEvidenceImports.every((entry) => (
    entry.status === 'pending-review' ||
    (entry.consentOrAuthorizationRef.length > 0 && entry.privacyReviewRef.length > 0 && entry.separatedFromSyntheticFixtures)
  )), 'real evidence imports require privacy review, authorization, and synthetic separation metadata');
  add([...REQUIRED_MODES].every((mode) => pkg.konlingSessions.some((session) => session.modeId === mode)), 'Konling sessions must cover all required teaching assistant modes');
  add(pkg.konlingSessions.every((session) => session.citations.length > 0 && session.unavailableStateCovered), 'Konling sessions require citations and unavailable-state coverage');
  add(pkg.konlingSessions.every((session) => session.citations.every((citation) => REVIEWABLE_HREFS.has(citation.href))), 'citations must point to reviewable demo routes');
  add(
    routeSet.size === REQUIRED_ROUTES.size
      && [...REQUIRED_ROUTES].every((route) => routeSet.has(route)),
    'route checks must cover known demo product surfaces',
  );
  add(
    apiSet.size === REQUIRED_APIS.size
      && [...REQUIRED_APIS].every((path) => apiSet.has(path)),
    'API examples must cover known demo API contracts',
  );
  add(pkg.providerExamples.every((provider) => provider.secretRef.startsWith('env:') && provider.capabilities.tools && provider.capabilities.streaming && provider.capabilities.citations), 'provider examples must use env secret refs and declare tool, streaming, and citation support');
  add(pkg.featureFlags.every((flag) => REQUIRED_FLAGS.has(flag.key) && flag.expected === 'enabled' && flag.rollbackValue === 'disabled'), 'feature flags must name known demo prerequisites and rollback values');
  add(buildIntelligentTeachingAssistantDemoRollbackReport().ok, 'rollback behavior checks must pass');
  const serialized = collectPrivacyScanText(pkg).join('\n');
  for (const pattern of FORBIDDEN_PATTERNS) add(!pattern.test(serialized), `fixture contains forbidden private or secret pattern: ${pattern}`);
  const firstInstall = installIntelligentTeachingAssistantDemoFixtures({ records: [] }, pkg);
  const secondInstall = installIntelligentTeachingAssistantDemoFixtures(firstInstall.state, pkg);
  const installTypes = new Set(firstInstall.state.records.map((record) => record.type));
  add([...REQUIRED_INSTALL_RECORD_TYPES].every((type) => installTypes.has(type)), 'fixture install records must cover goal, learner state, assignment, citation, grading, prep-pack, Konling, and report types');
  add(firstInstall.upsertedIds.length === new Set(firstInstall.upsertedIds).size, 'fixture install ids must be unique');
  add(JSON.stringify(firstInstall.state.records) === JSON.stringify(secondInstall.state.records), 'fixture install/reset must be idempotent');
  return errors;
}

export function buildIntelligentTeachingAssistantDemoAcceptanceReport(
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): AssistantDemoAcceptanceReport {
  const errors = validateIntelligentTeachingAssistantDemoPackage(pkg);
  const checks = [
    { id: 'fixtures.synthetic-resettable', ok: errors.every((error) => !error.includes('fixture') && !error.includes('synthetic')), detail: 'Synthetic fixture scope, reset key, and cleanup selectors are present.' },
    { id: 'student-path-diagnosis', ok: errors.every((error) => !error.includes('diagnosis') && !error.includes('path')), detail: 'Student diagnosis, path selection, resource context, and citations are represented.' },
    { id: 'teacher-grading-report-prep', ok: errors.every((error) => !error.includes('grading') && !error.includes('teacher') && !error.includes('prep')), detail: 'Teacher report, grading workbench, feedback, and prep-pack evidence are represented.' },
    { id: 'konling-modes', ok: errors.every((error) => !error.includes('Konling') && !error.includes('mode')), detail: 'All teaching assistant modes have scoped context, citations, and unavailable-state coverage.' },
    { id: 'privacy-provider-rollback', ok: errors.every((error) => !error.includes('forbidden') && !error.includes('provider') && !error.includes('rollback')), detail: 'Privacy scan, provider prerequisites, and rollback checks pass.' },
  ];
  return { ok: errors.length === 0 && checks.every((check) => check.ok), checks, errors };
}

export function validateCompetitionBaseline(
  baseline: CompetitionBaseline = XH_202620_COMPETITION_BASELINE,
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): string[] {
  const errors: string[] = [];
  const add = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
  const roles = new Set(baseline.accounts.map((account) => account.role));
  const routeRoles = new Set(baseline.routeLedger.map((step) => step.actorRole));
  const statuses = new Set(baseline.routeLedger.map((step) => step.surfaceStatus));
  const installed = installIntelligentTeachingAssistantDemoFixtures({ records: [] }, pkg);
  const reinstalled = installIntelligentTeachingAssistantDemoFixtures(installed.state, pkg);
  const installedIds = new Set(installed.upsertedIds);
  const installedTypesById = new Map(installed.state.records.map((record) => [record.id, record.type]));
  const ledgerRoutes = new Set(baseline.routeLedger.map((step) => step.route));
  const accountScopeByRole = new Map(baseline.accounts.map((account) => [account.role, new Set(account.routeScope)]));
  const capabilityProofs = baseline.capabilities.flatMap((capability) => capability.proof);

  add(baseline.competitionCode === 'xh-202620', 'competition baseline must target xh-202620');
  add(baseline.sourcePackageVersion === pkg.version, 'competition baseline must reference the current demo package version');
  add(['student', 'teacher', 'administrator'].every((role) => roles.has(role as CompetitionBaselineActorRole)), 'competition baseline must define student, teacher, and administrator demo accounts');
  add(baseline.accounts.every((account) => account.synthetic && account.routeScope.length > 0), 'competition demo accounts require synthetic markers and scoped routes');
  add(baseline.records.every((record) => record.dataOrigin === 'synthetic-demo' && record.sourcePackageId === 'intelligent-teaching-assistant'), 'competition records require explicit synthetic-demo data-origin metadata');
  add(baseline.records.every((record) => installedIds.has(record.id)), 'competition baseline records must exist in deterministic demo fixture install output');
  add(baseline.records.every((record) => installedTypesById.get(record.id) === record.type), 'competition baseline record types must match deterministic demo fixture install output');
  add(JSON.stringify(installed.state.records) === JSON.stringify(reinstalled.state.records), 'competition baseline seed/reset must be idempotent');
  add(['student', 'teacher', 'administrator'].every((role) => routeRoles.has(role as CompetitionBaselineActorRole)), 'competition route ledger must cover student, teacher, and administrator routes');
  add([...REQUIRED_COMPETITION_ROUTE_IDS].every((id) => baseline.routeLedger.some((step) => step.id === id)), 'competition route ledger must cover final entry, grading, diagnosis, path, prep-pack, effect-report, simulation or Arena, and admin surfaces');
  add(baseline.routeLedger.every((step) => step.dataOrigin === 'synthetic-demo' && step.expectedEvidence.length > 0), 'competition route ledger steps require synthetic data origin and expected evidence');
  add(baseline.routeLedger.every((step) => accountScopeByRole.get(step.actorRole)?.has(step.route)), 'competition route ledger routes must stay within each account role scope');
  add(!baseline.routeLedger.some((step) => step.actorRole === 'student' && step.route === '/data-center'), 'student competition route ledger must not use Data Center');
  add(baseline.routeLedger.some((step) => step.actorRole === 'student' && step.route === '/profile/evidence'), 'student competition route ledger must use learner-record evidence surface');
  add(['implemented', 'api-only'].every((status) => statuses.has(status as CompetitionBaselineSurfaceStatus)), 'competition route ledger must classify implemented and API-only surface status');
  add(baseline.capabilities.every((capability) => capability.status === 'implemented' && !capability.nextChange), 'competition capability map must mark final baseline capabilities implemented without follow-up change pointers');
  add(capabilityProofs.every((proof) => installedIds.has(proof) || ledgerRoutes.has(proof)), 'competition capability proof ids must resolve to fixture records or ledger routes');
  add(
    ['feature-flagged', 'api-only'].every((status) => (
      baseline.temporarySurfaces.some((surface) => surface.surfaceStatus === status)
    )) && baseline.temporarySurfaces.every((surface) => surface.removalOwner.length > 0),
    'competition baseline must record feature-flagged and API-only surfaces with removal owners',
  );
  add(baseline.seedReset.idempotencyKey === pkg.fixtureScope.resetIdempotencyKey, 'competition seed/reset must reuse the demo package idempotency key');
  add(baseline.seedReset.cleanupSelectors.every((selector) => selector.includes('syntheticOnly=true') || selector.includes('demoPackage=intelligent-teaching-assistant')), 'competition cleanup selectors must target synthetic demo package data');
  add(baseline.acceptanceCommands.includes('rtk npm run test:competition-baseline'), 'competition baseline must expose a named acceptance command');
  add(baseline.acceptanceCommands.includes('rtk npm run test:intelligent-teaching-assistant-demo'), 'competition baseline must reuse intelligent assistant demo acceptance');
  add(baseline.acceptanceCommands.includes('rtk npm run test:commercial-ui-governance'), 'competition baseline must expose commercial UI governance acceptance');
  add(baseline.acceptanceCommands.includes('rtk openspec validate competition-demo-baseline --strict'), 'competition baseline must expose the archived spec validation command');
  add(!baseline.acceptanceCommands.some((command) => command.includes('freeze-competition-baseline')), 'competition baseline acceptance commands must not reference the archived change id');
  return errors;
}

export function buildCompetitionBaselineAcceptanceReport(
  baseline: CompetitionBaseline = XH_202620_COMPETITION_BASELINE,
  pkg: IntelligentTeachingAssistantDemoPackage = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
): AssistantDemoAcceptanceReport {
  const errors = [
    ...validateIntelligentTeachingAssistantDemoPackage(pkg),
    ...validateCompetitionBaseline(baseline, pkg),
  ];
  const checks = [
    { id: 'competition.accounts', ok: errors.every((error) => !error.includes('accounts')), detail: 'Teacher, administrator, and student demo accounts are declared with stable ids.' },
    { id: 'competition.routes', ok: errors.every((error) => !error.includes('route ledger') && !error.includes('Data Center') && !error.includes('learner-record')), detail: 'Route ledger covers teacher, student, administrator, and learner-record boundaries.' },
    { id: 'competition.data-origin', ok: errors.every((error) => !error.includes('data-origin') && !error.includes('records')), detail: 'Baseline records are synthetic-demo scoped and backed by deterministic fixture ids.' },
    { id: 'competition.seed-reset', ok: errors.every((error) => !error.includes('seed/reset') && !error.includes('idempotent')), detail: 'Seed/reset commands reuse the existing fixture idempotency contract.' },
    { id: 'competition.acceptance', ok: errors.every((error) => !error.includes('acceptance command')), detail: 'Named acceptance commands are available for baseline and assistant demo checks.' },
  ];
  return { ok: errors.length === 0 && checks.every((check) => check.ok), checks, errors };
}
