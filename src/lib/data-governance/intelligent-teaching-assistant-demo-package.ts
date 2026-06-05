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
    status: 'draft' | 'approved';
    rubricVersion: string;
    feedbackVisible: true;
    citations: AssistantDemoCitation[];
    redactedExport: true;
  }>;
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
    { id: 'ita-anthropic-compatible', providerKind: 'anthropic-compatible', secretRef: 'env:DEMO_ANTHROPIC_API_KEY', capabilities: { tools: true, streaming: true, citations: true } },
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
    { id: 'grading-alpha-draft', teacherId: 'demo-teacher-ita', studentId: 'demo-ita-student-alpha', documentId: 'doc-alpha-control-report', status: 'draft', rubricVersion: 'rubric-control-report.v1', feedbackVisible: true, citations: [demoCitations.grading], redactedExport: true },
    { id: 'grading-beta-approved', teacherId: 'demo-teacher-ita', studentId: 'demo-ita-student-beta', documentId: 'doc-beta-control-report', status: 'approved', rubricVersion: 'rubric-control-report.v1', feedbackVisible: true, citations: [demoCitations.grading, demoCitations.feedback], redactedExport: true },
  ],
  teacherReports: [{
    id: 'teacher-report-demo-ita',
    classId: 'demo-ita-class',
    metrics: [
      { id: 'diagnosisCoverage', label: '诊断覆盖率', value: 1, methodology: { numerator: 'students with student or teacher-student diagnosis views', denominator: 'demo class roster students represented by diagnosis and path fixtures', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'medium', sourceFamily: 'role-based-learning-diagnosis', sourceCoverage: { covered: 3, total: 3 } } },
      { id: 'gradingFeedbackCoverage', label: '批改反馈覆盖率', value: 1, methodology: { numerator: 'grading runs with visible feedback and citations', denominator: 'synthetic grading runs', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'high', sourceFamily: 'document-rubric-grading', sourceCoverage: { covered: 2, total: 2 } } },
      { id: 'konlingModeCoverage', label: '控灵模式覆盖率', value: 1, methodology: { numerator: 'required Konling modes with scoped context and citations', denominator: 'required demo Konling modes', window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z', confidence: 'medium', sourceFamily: 'konling-agent-runtime', sourceCoverage: { covered: 8, total: 8 } } },
    ],
    export: { id: 'teacher-report-demo-ita-export', redacted: true, omits: ['raw answer bodies', 'private memory', 'hidden Arena internals', 'raw traces', 'plaintext secrets'], route: '/api/teacher/classes/demo-ita-class/control-correction-report?export=true' },
  }],
  prepPacks: [
    { id: 'prep-pack-demo-ita', teacherId: 'demo-teacher-ita', classId: 'demo-ita-class', status: 'review-ready', reviewItems: ['diagnosis-summary', 'path-risk', 'grading-pattern', 'resource-plan'], citations: [demoCitations.prep, demoCitations.report], serverContextSigned: true },
  ],
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
    { method: 'POST', path: '/api/teacher/document-grading/approve', asserts: ['grading approval response', 'document rubric payload'], actorRole: 'teacher' },
    { method: 'POST', path: '/api/ai/chat', asserts: ['mode runtime contract', 'citation guard'], actorRole: 'mode' },
    { method: 'GET', path: '/api/teacher/classes/demo-ita-class/control-correction-report?export=true', asserts: ['redacted export', 'metric methodology'], actorRole: 'teacher' },
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
  'goal',
  'grading-run',
  'konling-session',
  'learner-state-slice',
  'path-plan',
  'prep-pack',
  'resource-execution',
  'student',
  'teacher-report',
  'teacher-report-export',
  'teacher-report-metric',
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
  if (path.length >= 4 && path[0] === 'teacherReports' && path[2] === 'export' && path[3] === 'omits') return [];
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
    return pkg.gradingRuns.filter((run) => run.feedbackVisible && run.citations.length > 0).length / pkg.gradingRuns.length;
  }
  if (metricId === 'konlingModeCoverage') {
    const modes = new Set(pkg.konlingSessions.map((session) => session.modeId));
    return [...REQUIRED_MODES].filter((mode) => modes.has(mode)).length / REQUIRED_MODES.size;
  }
  return null;
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
    ...pkg.teacherReports.flatMap((report) => [
      demoRecord('teacher-report', report.id, scope, report),
      demoRecord('teacher-report-export', report.export.id, scope, report.export),
      ...report.metrics.map((metric) => demoRecord('teacher-report-metric', metric.id, scope, metric)),
    ]),
    ...pkg.prepPacks.map((pack) => demoRecord('prep-pack', pack.id, scope, pack)),
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
  add(pkg.gradingRuns.every((run) => run.feedbackVisible && run.citations.length > 0 && run.redactedExport), 'grading runs require visible feedback, citations, and redacted exports');
  add(pkg.teacherReports.every((report) => report.export.redacted && REQUIRED_OMISSIONS.every((omission) => report.export.omits.includes(omission))), 'teacher exports must omit restricted payload classes');
  add(pkg.teacherReports.every((report) => report.metrics.every((metric) => {
    const expected = expectedMetricValue(pkg, metric.id);
    return metric.methodology.numerator && metric.methodology.denominator && metric.methodology.window && metric.methodology.sourceFamily && metric.methodology.sourceCoverage.covered > 0 && (expected === null || Math.abs(metric.value - expected) < 0.000001);
  })), 'teacher report metrics require methodology and recomputable values');
  add(pkg.prepPacks.every((pack) => pack.serverContextSigned && pack.reviewItems.length > 0 && pack.citations.length > 0), 'prep packs require signed server context, review items, and citations');
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
