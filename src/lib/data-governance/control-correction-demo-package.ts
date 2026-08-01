import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  type AdaptiveLearningPathPlan,
} from '../adaptive-learning-path-planner';
import {
  isControlCorrectionPathRoundPersistenceEnabled,
  validateControlCorrectionPathPlanForPersistence,
} from '../control-correction-path-rounds';
import {
  getPathNodeSemanticsForResourceType,
  type ResourceNodeType,
} from '../resource-node-registry';
import {
  isAdaptiveLearnerStateServiceEnabled,
} from './adaptive-learner-state-service';
import { resolveAIProviderConfig } from '../ai/provider-config';

export type DemoConfidence = 'high' | 'medium' | 'low' | 'none';

function pathNodeSemantics(type: ResourceNodeType) {
  const semantics = getPathNodeSemanticsForResourceType(type);
  return {
    pathNodeType: semantics.type,
    displayName: semantics.displayName,
    iconKey: semantics.iconKey,
    shapeHint: semantics.shapeHint,
    evidenceBehavior: semantics.evidenceBehavior,
    evidenceStatus: 'instrumented' as const,
    externalResource: null,
    checkpoint: null,
  };
}

export interface DemoCitation {
  id: string;
  sourceFamily: string;
  title: string;
  confidence: DemoConfidence;
  href: string;
}

export interface DemoMetricMethodology {
  numerator: string;
  denominator: string;
  window: string;
  confidence: Exclude<DemoConfidence, 'none'>;
  sourceFamily: string;
  includedPopulation: string;
  excludedPopulation: string;
  sourceCoverage: { covered: number; total: number };
}

export interface DemoLearnerStateSlice {
  id: string;
  studentId: string;
  generatedAt: string;
  dimensions: Array<{ id: string; state: string; confidence: DemoConfidence; evidenceRefs: string[] }>;
  activePathId: string;
}

export interface DemoArenaEvidence {
  kind: 'ArenaSubmission';
  submissionId: string;
  taskId: string;
  official: true;
  hiddenEvaluatorInternalsRedacted: true;
  auxiliaryLearningFactRef: string;
}

export interface ControlCorrectionDemoPackage {
  version: 'control-correction-evaluation-demo-package.v1';
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
    authMode: 'bearer-api-key' | 'none';
    secretRef: string;
    capabilities: {
      tools: boolean;
      streaming: boolean;
      citationNormalization: boolean;
    };
  }>;
  course: { id: string; title: string; goalId: 'control-correction' };
  class: { id: string; title: string; studentIds: string[] };
  students: Array<{ id: string; displayName: string; synthetic: true }>;
  resourceNodes: Array<{ id: string; kind: string; title: string; governedSourceFamily: string }>;
  learnerStateSlices: DemoLearnerStateSlice[];
  pathRounds: Array<{
    id: string;
    studentId: string;
    generatedFromLearnerStateId: string;
    nodeIds: string[];
    readChecks: string[];
    executions: Array<{ nodeId: string; status: 'completed' | 'fallback'; evidenceRef: string }>;
    deviations: Array<{ kind: 'fallback-path' | 'terminal-validation'; marked: true; reason: string }>;
    terminalValidation: { state: 'passed' | 'failed' | 'low-confidence'; evidenceRef: string; lowConfidenceMarked: boolean };
  }>;
  konlingInterventions: Array<{
    id: string;
    pathRoundId: string;
    status: 'accepted' | 'partial' | 'low-confidence-fallback';
    coachingSummary: string;
    citations: DemoCitation[];
    lowConfidenceMarked: boolean;
  }>;
  simulationArenaOutcomes: Array<{
    id: string;
    pathRoundId: string;
    simulationState: 'passed' | 'failed' | 'low-confidence';
    arenaValidationState: 'passed' | 'failed' | 'low-confidence';
    evidenceRef: string;
    arenaEvidence: DemoArenaEvidence;
  }>;
  teacherReport: {
    classId: string;
    goalId: 'control-correction';
    metrics: Array<{
      id: string;
      label: string;
      value: number;
      methodology: DemoMetricMethodology;
    }>;
    export: {
      id: string;
      redacted: true;
      omits: string[];
      route: string;
    };
  };
  routeChecks: Array<{ route: string; expectedMarker: string }>;
  apiExamples: Array<{ method: 'GET' | 'POST'; path: string; asserts: string[] }>;
  featureFlags: Array<{ key: string; expected: 'enabled' | 'disabled'; rollbackValue: 'enabled' | 'disabled' }>;
  rollback: {
    command: string;
    expectedChecks: string[];
  };
}

export interface DemoInstallState {
  records: Array<{ type: string; id: string; scope: string; payload: unknown }>;
}

export interface DemoInstallResult {
  resetDeletedIds: string[];
  upsertedIds: string[];
  state: DemoInstallState;
}

export interface DemoAcceptanceReport {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  errors: string[];
}

export interface DemoLearningPathPlanPostBody {
  classId: string;
  learnerStateRef: string;
  inputSnapshot: { fixtureScope: string; syntheticOnly: true };
  plan: AdaptiveLearningPathPlan;
}

export interface DemoRollbackBehaviorReport {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  errors: string[];
}

export const CONTROL_CORRECTION_DEMO_PACKAGE: ControlCorrectionDemoPackage = {
  version: 'control-correction-evaluation-demo-package.v1',
  fixtureScope: {
    tenantId: 'demo-control-correction-tenant',
    syntheticOnly: true,
    owner: 'data-governance-demo',
    resetIdempotencyKey: 'control-correction-demo-2026-06-05',
    cleanupSelectors: [
      'tenantId=demo-control-correction-tenant AND classId=demo-control-correction-class',
      'tenantId=demo-control-correction-tenant AND goalId=control-correction',
      'tenantId=demo-control-correction-tenant AND syntheticOnly=true',
    ],
  },
  providerExamples: [
    {
      id: 'demo-openai-compatible',
      providerKind: 'openai-compatible',
      authMode: 'bearer-api-key',
      secretRef: 'env:DEMO_AI_API_KEY',
      capabilities: { tools: true, streaming: true, citationNormalization: true },
    },
    {
      id: 'demo-local-gateway',
      providerKind: 'openai-compatible',
      authMode: 'none',
      secretRef: 'env:DEMO_LOCAL_GATEWAY_API_KEY',
      capabilities: { tools: true, streaming: true, citationNormalization: false },
    },
  ],
  course: {
    id: 'demo-control-correction-course',
    title: 'Control Correction Closed Loop Demo',
    goalId: 'control-correction',
  },
  class: {
    id: 'demo-control-correction-class',
    title: 'Synthetic Control Correction Class',
    studentIds: ['demo-student-alpha', 'demo-student-beta', 'demo-student-gamma'],
  },
  students: [
    { id: 'demo-student-alpha', displayName: 'Synthetic Learner Alpha', synthetic: true },
    { id: 'demo-student-beta', displayName: 'Synthetic Learner Beta', synthetic: true },
    { id: 'demo-student-gamma', displayName: 'Synthetic Learner Gamma', synthetic: true },
  ],
  resourceNodes: [
    {
      id: 'knowledge-card:control-correction-time-domain-targets',
      kind: 'knowledge-card',
      title: 'Time-domain target card',
      governedSourceFamily: 'resource-node-registry',
    },
    {
      id: 'simulation:control-correction-step-response-lab',
      kind: 'simulation',
      title: 'Step response validation lab',
      governedSourceFamily: 'simulation-runtime-summary',
    },
    {
      id: 'arena-task:task-second-order-lead-pid',
      kind: 'arena-task',
      title: 'Arena transfer validation',
      governedSourceFamily: 'arena-official-summary',
    },
  ],
  learnerStateSlices: [
    {
      id: 'learner-state-alpha',
      studentId: 'demo-student-alpha',
      generatedAt: '2026-06-05T00:00:00.000Z',
      dimensions: [
        { id: 'controlModeling', state: 'needs-attention', confidence: 'medium', evidenceRefs: ['evidence-modeling-alpha'] },
        { id: 'parameterDesign', state: 'ready', confidence: 'high', evidenceRefs: ['evidence-parameter-alpha'] },
      ],
      activePathId: 'path-alpha',
    },
    {
      id: 'learner-state-beta',
      studentId: 'demo-student-beta',
      generatedAt: '2026-06-05T00:00:00.000Z',
      dimensions: [
        { id: 'controlModeling', state: 'ready', confidence: 'high', evidenceRefs: ['evidence-modeling-beta'] },
        { id: 'parameterDesign', state: 'low-confidence', confidence: 'low', evidenceRefs: ['evidence-parameter-beta-low'] },
      ],
      activePathId: 'path-beta',
    },
    {
      id: 'learner-state-gamma',
      studentId: 'demo-student-gamma',
      generatedAt: '2026-06-05T00:00:00.000Z',
      dimensions: [
        { id: 'controlModeling', state: 'ready', confidence: 'medium', evidenceRefs: ['evidence-modeling-gamma'] },
        { id: 'parameterDesign', state: 'ready', confidence: 'medium', evidenceRefs: ['evidence-parameter-gamma'] },
      ],
      activePathId: 'path-gamma',
    },
  ],
  pathRounds: [
    {
      id: 'path-alpha',
      studentId: 'demo-student-alpha',
      generatedFromLearnerStateId: 'learner-state-alpha',
      nodeIds: ['knowledge-card:control-correction-time-domain-targets', 'simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      readChecks: ['path-read-authorized', 'resource-graph-present', 'current-node-scoped'],
      executions: [
        { nodeId: 'knowledge-card:control-correction-time-domain-targets', status: 'completed', evidenceRef: 'execution-alpha-card' },
        { nodeId: 'simulation:control-correction-step-response-lab', status: 'completed', evidenceRef: 'execution-alpha-sim' },
        { nodeId: 'arena-task:task-second-order-lead-pid', status: 'completed', evidenceRef: 'execution-alpha-arena' },
      ],
      deviations: [{ kind: 'terminal-validation', marked: true, reason: 'terminal validation reached governed summary' }],
      terminalValidation: { state: 'passed', evidenceRef: 'terminal-alpha-summary', lowConfidenceMarked: true },
    },
    {
      id: 'path-beta',
      studentId: 'demo-student-beta',
      generatedFromLearnerStateId: 'learner-state-beta',
      nodeIds: ['simulation:control-correction-step-response-lab', 'knowledge-card:control-correction-time-domain-targets', 'arena-task:task-second-order-lead-pid'],
      readChecks: ['path-read-authorized', 'fallback-node-scoped', 'terminal-validation-visible'],
      executions: [
        { nodeId: 'simulation:control-correction-step-response-lab', status: 'fallback', evidenceRef: 'execution-beta-sim-fallback' },
        { nodeId: 'knowledge-card:control-correction-time-domain-targets', status: 'completed', evidenceRef: 'execution-beta-card' },
        { nodeId: 'arena-task:task-second-order-lead-pid', status: 'fallback', evidenceRef: 'execution-beta-arena-low-confidence' },
      ],
      deviations: [{ kind: 'fallback-path', marked: true, reason: 'low confidence simulation evidence requires remediation' }],
      terminalValidation: { state: 'low-confidence', evidenceRef: 'terminal-beta-low-confidence', lowConfidenceMarked: true },
    },
    {
      id: 'path-gamma',
      studentId: 'demo-student-gamma',
      generatedFromLearnerStateId: 'learner-state-gamma',
      nodeIds: ['knowledge-card:control-correction-time-domain-targets', 'simulation:control-correction-step-response-lab', 'arena-task:task-second-order-lead-pid'],
      readChecks: ['path-read-authorized', 'resource-graph-present', 'terminal-validation-visible'],
      executions: [
        { nodeId: 'knowledge-card:control-correction-time-domain-targets', status: 'completed', evidenceRef: 'execution-gamma-card' },
        { nodeId: 'simulation:control-correction-step-response-lab', status: 'completed', evidenceRef: 'execution-gamma-sim' },
        { nodeId: 'arena-task:task-second-order-lead-pid', status: 'completed', evidenceRef: 'execution-gamma-arena' },
      ],
      deviations: [{ kind: 'terminal-validation', marked: true, reason: 'terminal validation reached governed summary' }],
      terminalValidation: { state: 'passed', evidenceRef: 'terminal-gamma-summary', lowConfidenceMarked: true },
    },
  ],
  konlingInterventions: [
    {
      id: 'konling-alpha',
      pathRoundId: 'path-alpha',
      status: 'accepted',
      coachingSummary: 'Coach references time-domain target and Arena summary before recommending gain adjustment.',
      citations: [
        { id: 'cit-alpha-content', sourceFamily: 'resource-node-registry', title: 'Time-domain target card', confidence: 'high', href: '/interactive-learning/resources/lesson09-correction-precheck' },
        { id: 'cit-alpha-evidence', sourceFamily: 'arena-official-summary', title: 'Arena transfer validation', confidence: 'medium', href: '/arena/challenges/task-second-order-lead-pid' },
      ],
      lowConfidenceMarked: true,
    },
    {
      id: 'konling-beta',
      pathRoundId: 'path-beta',
      status: 'low-confidence-fallback',
      coachingSummary: 'Coach marks low confidence and sends the learner to the card before retrying simulation.',
      citations: [
        { id: 'cit-beta-content', sourceFamily: 'resource-node-registry', title: 'Time-domain target card', confidence: 'high', href: '/interactive-learning/resources/lesson09-correction-precheck' },
      ],
      lowConfidenceMarked: true,
    },
  ],
  simulationArenaOutcomes: [
    {
      id: 'sim-arena-alpha',
      pathRoundId: 'path-alpha',
      simulationState: 'passed',
      arenaValidationState: 'passed',
      evidenceRef: 'terminal-alpha-summary',
      arenaEvidence: {
        kind: 'ArenaSubmission',
        submissionId: 'arena-submission-alpha',
        taskId: 'task-second-order-lead-pid',
        official: true,
        hiddenEvaluatorInternalsRedacted: true,
        auxiliaryLearningFactRef: 'execution-alpha-arena',
      },
    },
    {
      id: 'sim-arena-beta',
      pathRoundId: 'path-beta',
      simulationState: 'low-confidence',
      arenaValidationState: 'low-confidence',
      evidenceRef: 'terminal-beta-low-confidence',
      arenaEvidence: {
        kind: 'ArenaSubmission',
        submissionId: 'arena-submission-beta',
        taskId: 'task-second-order-lead-pid',
        official: true,
        hiddenEvaluatorInternalsRedacted: true,
        auxiliaryLearningFactRef: 'execution-beta-arena-low-confidence',
      },
    },
    {
      id: 'sim-arena-gamma',
      pathRoundId: 'path-gamma',
      simulationState: 'passed',
      arenaValidationState: 'passed',
      evidenceRef: 'terminal-gamma-summary',
      arenaEvidence: {
        kind: 'ArenaSubmission',
        submissionId: 'arena-submission-gamma',
        taskId: 'task-second-order-lead-pid',
        official: true,
        hiddenEvaluatorInternalsRedacted: true,
        auxiliaryLearningFactRef: 'execution-gamma-arena',
      },
    },
  ],
  teacherReport: {
    classId: 'demo-control-correction-class',
    goalId: 'control-correction',
    metrics: [
      {
        id: 'simulationPassRate',
        label: '路径参与学生仿真通过率',
        value: 2 / 3,
        methodology: {
          numerator: 'students with governed simulation terminal validation state passed',
          denominator: 'students in demo class roster with control-correction path rounds',
          window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z',
          confidence: 'medium',
          sourceFamily: 'simulation-runtime-summary',
          includedPopulation: 'demo class roster students with a control-correction path round and simulation/Arena outcome',
          excludedPopulation: 'none; all synthetic roster students are included',
          sourceCoverage: { covered: 3, total: 3 },
        },
      },
      {
        id: 'citationCoverage',
        label: '控灵引用覆盖率',
        value: 1,
        methodology: {
          numerator: 'Konling interventions with at least one content citation and marked low-confidence fallback when needed',
          denominator: 'Konling interventions emitted during demo path rounds',
          window: '2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z',
          confidence: 'high',
          sourceFamily: 'konling-citation-guard',
          includedPopulation: 'Konling interventions emitted during demo path rounds',
          excludedPopulation: 'path rounds without a Konling intervention',
          sourceCoverage: { covered: 2, total: 2 },
        },
      },
    ],
    export: {
      id: 'demo-teacher-report-export',
      redacted: true,
      omits: ['raw answer bodies', 'private memory', 'high-frequency traces', 'hidden Arena internals'],
      route: '/api/teacher/classes/demo-control-correction-class/control-correction-report?export=true',
    },
  },
  routeChecks: [
    { route: '/assessment/adaptive-practice?goal=control-correction', expectedMarker: 'data-control-correction-center' },
    { route: '/api/teacher/classes/demo-control-correction-class/control-correction-report', expectedMarker: 'control-correction' },
  ],
  apiExamples: [
    { method: 'GET', path: '/api/adaptive/learner-state?goal=control-correction', asserts: ['goalId=control-correction', 'activePathId present'] },
    { method: 'POST', path: '/api/learning-paths/plan', asserts: ['path id returned', 'resource graph node ids scoped'] },
    { method: 'GET', path: '/api/teacher/classes/demo-control-correction-class/control-correction-report?export=true', asserts: ['redacted export', 'metric methodology present'] },
  ],
  featureFlags: [
    { key: 'CONTROL_CORRECTION_PATH_ROUNDS_ENABLED', expected: 'enabled', rollbackValue: 'disabled' },
    { key: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED', expected: 'enabled', rollbackValue: 'disabled' },
    { key: 'AI_PROVIDER_ENABLED', expected: 'enabled', rollbackValue: 'disabled' },
  ],
  rollback: {
    command: 'rtk npx tsx scripts/tests/control-correction-demo-acceptance.ts --rollback-check',
    expectedChecks: ['flags disabled', 'demo tenant cleanup selector present', 'exports remain redacted'],
  },
};

const REQUIRED_OMISSIONS = ['raw answer bodies', 'private memory', 'high-frequency traces', 'hidden Arena internals'];
const FORBIDDEN_PATTERNS = [
  /(?:^|[\s:"'])sk-[a-z0-9_-]{8,}/i,
  /Bearer\s+[a-z0-9._-]+/i,
  /@[a-z0-9.-]+\.[a-z]{2,}/i,
  /raw[\s._-]*(answer|response|submission|body)/i,
  /original[\s._-]*(answer|response|submission)/i,
  /student[\s._-]*(response|answer).*raw/i,
  /private[\s._-]*(memory|konling)/i,
  /hidden[\s._-]*(arena|evaluation|evaluator|internal)(?![a-z\s._-]*redacted)/i,
  /raw[\s._-]*(trace|traces|timeseries|sample|samples|high[\s._-]*frequency)/i,
  /high[\s._-]*frequency[\s._-]*(trace|traces|sample|samples|timeseries)/i,
  /(?:^|\.)trace(?:\.|:)/i,
  /(?:^|\.)samples(?:\.|:)/i,
  /timeseries/i,
];

const CANONICAL_RESOURCE_NODE_IDS = new Set([
  'knowledge-card:control-correction-time-domain-targets',
  'simulation:control-correction-step-response-lab',
  'arena-task:task-second-order-lead-pid',
]);

const REQUIRED_ROUTE_CHECKS = new Set([
  '/assessment/adaptive-practice?goal=control-correction',
  '/api/teacher/classes/demo-control-correction-class/control-correction-report',
]);

const REQUIRED_API_EXAMPLES = new Set([
  '/api/adaptive/learner-state?goal=control-correction',
  '/api/learning-paths/plan',
  '/api/teacher/classes/demo-control-correction-class/control-correction-report?export=true',
]);

const KNOWN_RUNTIME_FEATURE_FLAGS = new Set([
  'CONTROL_CORRECTION_PATH_ROUNDS_ENABLED',
  'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED',
  'AI_PROVIDER_ENABLED',
]);

const REVIEWABLE_CITATION_HREFS = new Set([
  '/interactive-learning/resources/lesson09-correction-precheck',
  '/arena/challenges/task-second-order-lead-pid',
]);

function collectPrivacyScanText(value: unknown, path: string[] = []): string[] {
  if (value === null || value === undefined) return [];
  if (path.length >= 3 && path[0] === 'teacherReport' && path[1] === 'export' && path[2] === 'omits') {
    return [];
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [`${path.join('.')}:${String(value)}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPrivacyScanText(item, [...path, String(index)]));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectPrivacyScanText(item, [...path, key]));
  }
  return [];
}

function expectedMetricValue(pkg: ControlCorrectionDemoPackage, metricId: string): number | null {
  if (metricId === 'simulationPassRate') {
    const rosterPathStudentIds = new Set(pkg.pathRounds.map((round) => round.studentId));
    const denominator = pkg.class.studentIds.filter((studentId) => rosterPathStudentIds.has(studentId)).length;
    const numerator = pkg.simulationArenaOutcomes.filter((outcome) => (
      outcome.simulationState === 'passed' && outcome.arenaValidationState === 'passed'
    )).length;
    return denominator === 0 ? null : numerator / denominator;
  }
  if (metricId === 'citationCoverage') {
    const denominator = pkg.konlingInterventions.length;
    const numerator = pkg.konlingInterventions.filter((intervention) => (
      intervention.citations.length > 0 &&
      (intervention.status !== 'low-confidence-fallback' || intervention.lowConfidenceMarked)
    )).length;
    return denominator === 0 ? null : numerator / denominator;
  }
  return null;
}

export function installControlCorrectionDemoFixtures(
  currentState: DemoInstallState = { records: [] },
  pkg: ControlCorrectionDemoPackage = CONTROL_CORRECTION_DEMO_PACKAGE,
): DemoInstallResult {
  const scope = pkg.fixtureScope.tenantId;
  const retained = currentState.records.filter((record) => record.scope !== scope);
  const resetDeletedIds = currentState.records
    .filter((record) => record.scope === scope)
    .map((record) => record.id)
    .sort();
  const records = [
    { type: 'course', id: pkg.course.id, scope, payload: pkg.course },
    { type: 'class', id: pkg.class.id, scope, payload: pkg.class },
    ...pkg.students.map((student) => ({ type: 'student', id: student.id, scope, payload: student })),
    ...pkg.resourceNodes.map((node) => ({ type: 'resource-node', id: node.id, scope, payload: node })),
    ...pkg.learnerStateSlices.map((slice) => ({ type: 'learner-state-slice', id: slice.id, scope, payload: slice })),
    ...pkg.pathRounds.map((round) => ({ type: 'path-round', id: round.id, scope, payload: round })),
    ...pkg.simulationArenaOutcomes.map((outcome) => ({ type: 'simulation-arena-outcome', id: outcome.id, scope, payload: outcome })),
    ...pkg.konlingInterventions.map((intervention) => ({ type: 'konling-intervention', id: intervention.id, scope, payload: intervention })),
    ...pkg.teacherReport.metrics.map((metric) => ({ type: 'teacher-report-metric', id: metric.id, scope, payload: metric })),
    { type: 'teacher-report-export', id: pkg.teacherReport.export.id, scope, payload: pkg.teacherReport.export },
  ].sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));

  return {
    resetDeletedIds,
    upsertedIds: records.map((record) => record.id),
    state: { records: [...retained, ...records] },
  };
}

export function buildControlCorrectionDemoPlanPostBody(
  pkg: ControlCorrectionDemoPackage = CONTROL_CORRECTION_DEMO_PACKAGE,
): DemoLearningPathPlanPostBody {
  const studentId = pkg.students[0].id;
  const generatedAt = '2026-06-05T00:00:00.000Z';
  const mainPath: AdaptiveLearningPathPlan['mainPath'] = [
    {
      nodeId: 'knowledge-card:control-correction-time-domain-targets',
      title: 'Time-domain target card',
      type: 'knowledge_card',
      ...pathNodeSemantics('knowledge_card'),
      sourceKind: 'resource_registry',
      sourceRef: 'lesson09-correction-precheck',
      target: '/interactive-learning/resources/lesson09-correction-precheck',
      estimatedTimeMinutes: 6,
      prerequisiteNodeIds: [],
      knowledgeCoverage: ['control-correction'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.82,
      reasonCodes: ['demo-learner-state-gap'],
      status: 'completed',
    },
    {
      nodeId: 'simulation:control-correction-step-response-lab',
      title: 'Step response validation lab',
      type: 'simulation',
      ...pathNodeSemantics('simulation'),
      sourceKind: 'simulation_resource',
      sourceRef: 'control-correction-step-response-lab',
      target: '/simulations/cruise?resource=control-correction-step-response-lab',
      estimatedTimeMinutes: 12,
      prerequisiteNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
      knowledgeCoverage: ['control-correction', 'time-domain-response'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      score: 0.86,
      reasonCodes: ['demo-simulation-practice'],
      status: 'next',
    },
    {
      nodeId: 'arena-task:task-second-order-lead-pid',
      title: 'Arena transfer validation',
      type: 'arena_task',
      ...pathNodeSemantics('arena_task'),
      sourceKind: 'arena_task',
      sourceRef: 'task-second-order-lead-pid',
      target: '/arena/challenges/task-second-order-lead-pid',
      estimatedTimeMinutes: 15,
      prerequisiteNodeIds: ['simulation:control-correction-step-response-lab'],
      knowledgeCoverage: ['control-correction', 'transfer-validation'],
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: ['terminal-validation'],
      score: 0.9,
      reasonCodes: ['demo-terminal-validation'],
      status: 'next',
    },
  ];

  return {
    classId: pkg.class.id,
    learnerStateRef: pkg.learnerStateSlices[0].id,
    inputSnapshot: {
      fixtureScope: pkg.fixtureScope.tenantId,
      syntheticOnly: true,
    },
    plan: {
      id: `demo-path-${studentId}-control-correction`,
      userId: studentId,
      goal: {
        id: 'control-correction',
        title: 'Control correction',
        knowledgeTargets: ['control-correction'],
        competencyTargets: ['parameterDesign'],
      },
      stage: 'stage-1-rules-graph',
      policyFamily: 'rules-plus-graph-search',
      policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['rules-plus-graph-search'],
      excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
      status: 'ready',
      currentNodeId: 'simulation:control-correction-step-response-lab',
      mainPath,
      alternatives: [],
      score: {
        total: 0.86,
        objectives: {
          learningGain: 0.88,
          engagement: 0.78,
          constraintSatisfaction: 0.92,
          diversity: 0.8,
          fatigue: 0.12,
          dropoutRisk: 0.08,
        },
      },
      confidence: { level: 'medium', score: 0.82, sourceCoverage: 1 },
      explanations: {
        selectedReasons: ['demo path follows resource, simulation, and Arena validation order'],
        rejectedAlternatives: [],
        fallbackReasons: [],
        configurationFulfillment: [],
      },
      executionStatus: {
        adopted: true,
        completedNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
        activeNodeId: 'simulation:control-correction-step-response-lab',
        updatedAt: generatedAt,
      },
      deviations: [],
      corrections: [],
      feedbackEvents: [],
      visualization: {
        map: {
          mainPathNodeIds: mainPath.map((node) => node.nodeId),
          branchPaths: [],
          currentNodeId: 'simulation:control-correction-step-response-lab',
          completedNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
          riskNodeIds: [],
          blockedNodes: [],
          alternatives: [],
        },
        timeline: {
          generatedAt,
          windows: [{ days: 3, nodeIds: mainPath.map((node) => node.nodeId), estimatedMinutes: 33 }],
        },
        evidence: {
          evidenceBasis: 'adaptive-learner-state',
          confidence: { level: 'medium', score: 0.82, sourceCoverage: 1 },
          sourceCoverage: { learnerState: 'demo', simulation: 'demo', arena: 'demo' },
          learnerStateDeficits: [{
            targetId: 'parameterDesign',
            kind: 'competency',
            value: 0.42,
            confidence: 0.78,
            evidenceCount: 3,
            reasonCode: 'demo-parameter-design-gap',
          }],
          capabilityEvidence: [],
          prerequisiteReasons: [],
          teacherPolicy: mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
          alternatives: [],
        },
      },
    },
  };
}

export function buildControlCorrectionDemoRollbackReport(): DemoRollbackBehaviorReport {
  const originalPathFlag = process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED;
  process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED = 'false';
  const pathFlag = isControlCorrectionPathRoundPersistenceEnabled();
  if (originalPathFlag === undefined) {
    delete process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED;
  } else {
    process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED = originalPathFlag;
  }
  const learnerStateFlag = isAdaptiveLearnerStateServiceEnabled({ ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED: 'false' });
  const providerEnabled = resolveAIProviderConfig({ AI_PROVIDER_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv).enabled;
  const checks = [
    {
      id: 'rollback.path-rounds-disabled',
      ok: pathFlag === false,
      detail: 'CONTROL_CORRECTION_PATH_ROUNDS_ENABLED=false disables path round persistence routes.',
    },
    {
      id: 'rollback.learner-state-disabled',
      ok: learnerStateFlag === false,
      detail: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=false disables learner-state service reads.',
    },
    {
      id: 'rollback.ai-provider-env-fallback-disabled',
      ok: providerEnabled === false,
      detail: 'AI_PROVIDER_ENABLED=false disables the environment fallback provider; persisted provider settings remain governed by admin settings.',
    },
  ];
  const errors = checks.filter((check) => !check.ok).map((check) => `${check.id} failed`);
  return { ok: errors.length === 0, checks, errors };
}

export function validateControlCorrectionDemoPackage(
  pkg: ControlCorrectionDemoPackage = CONTROL_CORRECTION_DEMO_PACKAGE,
): string[] {
  const errors: string[] = [];
  const add = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };

  add(pkg.fixtureScope.syntheticOnly === true, 'fixture scope must be synthetic only');
  add(pkg.fixtureScope.resetIdempotencyKey.trim().length > 0, 'reset idempotency key is required');
  add(pkg.fixtureScope.cleanupSelectors.length >= 2, 'cleanup selectors are required');
  add(pkg.fixtureScope.cleanupSelectors.every((selector) => (
    selector.includes('tenantId=demo-control-correction-tenant')
    && (selector.includes('classId=demo-control-correction-class') || selector.includes('goalId=control-correction') || selector.includes('syntheticOnly=true'))
  )), 'cleanup selectors must be demo-tenant-scoped conjunctions');
  add(pkg.students.length > 0 && pkg.students.every((student) => student.synthetic), 'students must be synthetic');
  add(pkg.class.studentIds.every((id) => pkg.students.some((student) => student.id === id)), 'class student ids must point to fixture students');
  add(pkg.resourceNodes.length >= 3, 'resource graph must include knowledge, simulation, and Arena resources');
  add(pkg.resourceNodes.every((node) => CANONICAL_RESOURCE_NODE_IDS.has(node.id)), 'resource nodes must use canonical control-correction resource ids');
  add(pkg.routeChecks.every((check) => REQUIRED_ROUTE_CHECKS.has(check.route)), 'route checks must use known control-correction routes');
  add(pkg.apiExamples.every((example) => REQUIRED_API_EXAMPLES.has(example.path)), 'API examples must use known control-correction API paths');
  add([...REQUIRED_ROUTE_CHECKS].every((route) => pkg.routeChecks.some((check) => check.route === route)), 'required route checks are missing');
  add([...REQUIRED_API_EXAMPLES].every((path) => pkg.apiExamples.some((example) => example.path === path)), 'required API examples are missing');
  add(pkg.learnerStateSlices.every((slice) => slice.dimensions.length > 0 && slice.activePathId), 'learner-state slices require dimensions and active paths');
  add(pkg.class.studentIds.every((studentId) => pkg.learnerStateSlices.some((slice) => slice.studentId === studentId)), 'every roster student must have a learner-state slice');
  add(pkg.class.studentIds.every((studentId) => pkg.pathRounds.some((round) => round.studentId === studentId)), 'every roster student must have a path round');
  add(pkg.pathRounds.every((round) => pkg.learnerStateSlices.some((slice) => slice.id === round.generatedFromLearnerStateId)), 'path rounds must reference learner-state slice ids');
  add(pkg.pathRounds.every((round) => round.nodeIds.every((nodeId) => CANONICAL_RESOURCE_NODE_IDS.has(nodeId))), 'path rounds must use canonical resource node ids');
  add(pkg.pathRounds.every((round) => round.readChecks.length > 0 && round.executions.length > 0), 'path rounds require read checks and executions');
  add(pkg.pathRounds.every((round) => (
    round.nodeIds.every((nodeId) => round.executions.some((execution) => execution.nodeId === nodeId))
  )), 'path round executions must cover every node id');
  add(pkg.pathRounds.some((round) => round.deviations.some((deviation) => deviation.kind === 'fallback-path')), 'fallback path deviation must be represented');
  add(pkg.pathRounds.every((round) => round.terminalValidation.state !== 'low-confidence' || round.terminalValidation.lowConfidenceMarked), 'low-confidence terminal validation must be marked');
  add(pkg.konlingInterventions.every((intervention) => intervention.citations.length > 0), 'Konling interventions require citations');
  add(pkg.konlingInterventions.every((intervention) => (
    intervention.citations.every((citation) => REVIEWABLE_CITATION_HREFS.has(citation.href))
  )), 'Konling citations must point to reviewable demo routes');
  add(pkg.konlingInterventions.every((intervention) => (
    intervention.status !== 'low-confidence-fallback' || intervention.lowConfidenceMarked
  )), 'low-confidence Konling fallback must be marked');
  add(pkg.simulationArenaOutcomes.every((outcome) => outcome.evidenceRef && outcome.pathRoundId), 'simulation/Arena outcomes require evidence and path round links');
  add(pkg.simulationArenaOutcomes.every((outcome) => (
    outcome.arenaEvidence?.kind === 'ArenaSubmission'
    && outcome.arenaEvidence.official
    && outcome.arenaEvidence.taskId === 'task-second-order-lead-pid'
    && outcome.arenaEvidence.hiddenEvaluatorInternalsRedacted
  )), 'Arena outcomes must reference official redacted ArenaSubmission evidence');
  add(pkg.simulationArenaOutcomes.every((outcome) => {
    const round = pkg.pathRounds.find((candidate) => candidate.id === outcome.pathRoundId);
    return round?.executions.some((execution) => (
      execution.nodeId === 'arena-task:task-second-order-lead-pid'
      && execution.evidenceRef === outcome.arenaEvidence.auxiliaryLearningFactRef
    ));
  }), 'Arena outcomes must be attributed to the matching Arena node execution');
  add(pkg.teacherReport.metrics.every((metric) => (
    metric.methodology.numerator
    && metric.methodology.denominator
    && metric.methodology.window
    && metric.methodology.confidence
    && metric.methodology.sourceFamily
    && metric.methodology.includedPopulation
    && metric.methodology.excludedPopulation
    && metric.methodology.sourceCoverage.covered > 0
    && metric.methodology.sourceCoverage.total >= metric.methodology.sourceCoverage.covered
  )), 'teacher metrics require numerator, denominator, window, confidence, and source family');
  add(pkg.teacherReport.metrics.every((metric) => {
    const expected = expectedMetricValue(pkg, metric.id);
    return expected === null || Math.abs(metric.value - expected) < 0.000001;
  }), 'teacher metric values must match recomputed fixture evidence');
  add(pkg.teacherReport.metrics
    .filter((metric) => metric.id.toLowerCase().includes('rate'))
    .every((metric) => metric.methodology.denominator.includes('demo class roster')), 'teacher rate metric denominators must disclose roster coverage');
  add(pkg.teacherReport.export.redacted === true, 'teacher report export must be redacted');
  add(REQUIRED_OMISSIONS.every((omission) => pkg.teacherReport.export.omits.includes(omission)), 'teacher export must omit private payload classes');
  add(pkg.providerExamples.every((provider) => provider.secretRef.startsWith('env:')), 'provider examples must use env secret references');
  add(pkg.providerExamples.every((provider) => provider.capabilities.tools && provider.capabilities.streaming), 'provider examples must declare tools and streaming support');
  add(pkg.featureFlags.length >= 3 && pkg.featureFlags.every((flag) => (
    KNOWN_RUNTIME_FEATURE_FLAGS.has(flag.key)
    && flag.expected === 'enabled'
    && flag.rollbackValue === 'disabled'
  )), 'feature flags and rollback values must reference known runtime flags');
  add(pkg.rollback.expectedChecks.length >= 3, 'rollback expected checks are required');
  add(pkg.routeChecks.length > 0 && pkg.apiExamples.length > 0, 'route checks and API examples are required');
  try {
    validateControlCorrectionPathPlanForPersistence(buildControlCorrectionDemoPlanPostBody(pkg).plan);
  } catch {
    errors.push('demo learning-path plan POST body must satisfy persistence validation');
  }
  const rollbackReport = buildControlCorrectionDemoRollbackReport();
  add(rollbackReport.ok, 'rollback behavior checks must pass');

  const serialized = collectPrivacyScanText(pkg).join('\n');
  for (const pattern of FORBIDDEN_PATTERNS) {
    add(!pattern.test(serialized), `fixture contains forbidden private or secret pattern: ${pattern}`);
  }
  const firstInstall = installControlCorrectionDemoFixtures({ records: [] }, pkg);
  const secondInstall = installControlCorrectionDemoFixtures(firstInstall.state, pkg);
  add(firstInstall.upsertedIds.length === new Set(firstInstall.upsertedIds).size, 'fixture install ids must be unique');
  add(JSON.stringify(firstInstall.state.records) === JSON.stringify(secondInstall.state.records), 'fixture install/reset must be idempotent');

  return errors;
}

export function buildControlCorrectionDemoAcceptanceReport(
  pkg: ControlCorrectionDemoPackage = CONTROL_CORRECTION_DEMO_PACKAGE,
): DemoAcceptanceReport {
  const errors = validateControlCorrectionDemoPackage(pkg);
  const checks = [
    { id: 'fixtures.synthetic-resettable', ok: errors.every((error) => !error.includes('fixture') && !error.includes('reset')), detail: 'Synthetic scope, reset key, and cleanup selectors are present.' },
    { id: 'loop.learner-state-path-execution', ok: errors.every((error) => !error.includes('learner-state') && !error.includes('path rounds')), detail: 'Learner state, path read, execution, fallback, and terminal validation are represented.' },
    { id: 'loop.konling-citations', ok: errors.every((error) => !error.includes('Konling') && !error.includes('citation')), detail: 'Konling coaching includes citations and marked low-confidence fallback.' },
    { id: 'loop.teacher-report-export', ok: errors.every((error) => !error.includes('teacher') && !error.includes('export')), detail: 'Teacher report metrics include methodology and redacted export.' },
    { id: 'provider-flags-rollback', ok: errors.every((error) => !error.includes('provider') && !error.includes('flags') && !error.includes('rollback')), detail: 'Provider examples, feature flags, and rollback checks are present.' },
    { id: 'privacy', ok: errors.every((error) => !error.includes('forbidden') && !error.includes('private')), detail: 'Fixture scan rejects secrets, real contact data, raw payloads, and private memory.' },
  ];
  return { ok: errors.length === 0 && checks.every((check) => check.ok), checks, errors };
}
