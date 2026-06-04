export const CONTROL_CORRECTION_TEACHER_REPORT_VERSION = 'control-correction-teacher-report.v1';
export const CONTROL_CORRECTION_REPORT_GOAL_ID = 'control-correction';

type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface ControlCorrectionReportStudent {
  userId: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
}

export interface ControlCorrectionTeacherReportInput {
  classInfo: {
    id: string;
    name: string;
    studentCount: number;
  };
  students: ControlCorrectionReportStudent[];
  paths: Array<Record<string, any>>;
  snapshots: Array<Record<string, any>>;
  featureCaches: Array<Record<string, any>>;
  now?: Date;
}

export interface ControlCorrectionReportMetric {
  id: string;
  label: string;
  value: number | null;
  denominator: number;
  includedPopulation: number;
  excludedPopulation: number;
  exclusionReasons: string[];
  calculationWindow: {
    start: string | null;
    end: string | null;
  };
  confidence: Confidence;
  sourceCoverage: {
    readyStudents: number;
    staleStudents: number;
    missingStudents: number;
    lowConfidenceStudents: number;
  };
  methodology: string;
}

export interface ControlCorrectionStudentDrilldown {
  userId: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  evidenceState: 'ready' | 'stale' | 'missing';
  confidenceMarkers: string[];
  path: {
    pathId: string | null;
    pathStatus: string | null;
    terminalValidationState: string | null;
    terminalValidationMarkers: string[];
    terminalFailureReasons: string[];
    completedExecutionCount: number;
    deviationCount: number;
    interventionCount: number;
    acceptedInterventionCount: number;
    evidenceRefs: Array<{ kind: string; id: string }>;
  };
  learnerState: {
    competencyLift: number | null;
    latestSnapshotAt: string | null;
    previousSnapshotAt: string | null;
  };
}

export interface ControlCorrectionTeacherReport {
  version: string;
  goalId: typeof CONTROL_CORRECTION_REPORT_GOAL_ID;
  classInfo: ControlCorrectionTeacherReportInput['classInfo'];
  generatedAt: string;
  metrics: Record<string, ControlCorrectionReportMetric>;
  studentDrilldowns: ControlCorrectionStudentDrilldown[];
  resourceContribution: Array<{
    resourceType: string;
    nodeId: string;
    executionCount: number;
    completedCount: number;
  }>;
  methodologyNotes: string[];
  redactionPolicyNotes: string[];
}

export function buildControlCorrectionTeacherReport(
  input: ControlCorrectionTeacherReportInput,
): ControlCorrectionTeacherReport {
  const now = input.now ?? new Date();
  const pathsByUser = latestByUser(input.paths);
  const snapshotsByUser = groupSnapshotsByUser(input.snapshots);
  const cachesByUser = new Map(input.featureCaches.map((cache) => [String(cache.userId), cache]));
  const coverage = summarizeCoverage(input.students, cachesByUser);
  const drilldowns = input.students.map((student) => buildStudentDrilldown(
    student,
    pathsByUser.get(student.userId) ?? null,
    snapshotsByUser.get(student.userId) ?? [],
    cachesByUser.get(student.userId) ?? null,
  ));
  const windows = collectWindow(input.paths);

  return {
    version: CONTROL_CORRECTION_TEACHER_REPORT_VERSION,
    goalId: CONTROL_CORRECTION_REPORT_GOAL_ID,
    classInfo: input.classInfo,
    generatedAt: now.toISOString(),
    metrics: {
      pathAdoption: metric('pathAdoption', '路径采用率', drilldowns.filter((item) => item.path.pathId).length, input.students.length, coverage, windows, 'Students with a control-correction learning path divided by class roster denominator.'),
      pathCompletion: ratioMetric('pathCompletion', '路径完成率', drilldowns.filter((item) => item.path.pathId && item.path.pathStatus === 'completed').length, drilldowns.filter((item) => item.path.pathId).length, coverage, windows, 'Completed control-correction paths divided by adopted path denominator.'),
      deviationRate: ratioMetric('deviationRate', '路径偏离率', drilldowns.filter((item) => item.path.deviationCount > 0).length, drilldowns.filter((item) => item.path.pathId).length, coverage, windows, 'Students with governed path deviations divided by adopted path denominator.'),
      competencyLift: averageMetric('competencyLift', '能力提升均值', drilldowns.map((item) => item.learnerState.competencyLift).filter(isNumber), drilldowns.filter((item) => item.learnerState.competencyLift !== null).length, input.students.length, coverage, windows, 'Average latest-minus-previous competency score across students with two snapshots.'),
      simulationPassRate: terminalEvidenceRateMetric('simulationPassRate', '仿真通过率', input.paths, hasAcceptedTerminalSimulation, coverage, windows, 'Terminal validations with accepted governed simulation evidence divided by adopted path denominator.'),
      arenaValidSubmissionRate: terminalEvidenceRateMetric('arenaValidSubmissionRate', 'Arena 有效提交率', input.paths, hasAcceptedTerminalArena, coverage, windows, 'Terminal validations with accepted governed Arena evidence divided by adopted path denominator.'),
      konlingInterventionAcceptance: interventionRateMetric('konlingInterventionAcceptance', '控灵干预接受率', input.paths, isAcceptedIntervention, coverage, windows, 'Accepted or completed Konling interventions divided by intervention denominator.'),
      interventionAfterSuccess: interventionAfterSuccessMetric(input.paths, coverage, windows),
      citationCoverage: interventionRateMetric('citationCoverage', '引用覆盖率', input.paths, hasCitations, coverage, windows, 'Interventions with privacy-safe citations divided by intervention denominator.'),
      resourceContribution: resourceContributionMetric(input.paths, coverage, windows),
    },
    studentDrilldowns: drilldowns,
    resourceContribution: summarizeResourceContribution(input.paths),
    methodologyNotes: [
      'All denominators are explicit and scoped to the authorized class roster or governed evidence subset.',
      'Stage 1 metrics use governed learning paths, feature cache summaries, learner snapshots, and privacy-safe evidence references.',
      'Optimization experiments, contextual bandits, and reinforcement-learning policy data are not required for this report.',
    ],
    redactionPolicyNotes: [
      'Exports and drilldowns omit raw answer bodies, raw traces, hidden Arena internals, private Konling memory, and teacher-only suggestedAction payloads.',
      'Evidence references are reduced to kind/id pairs for teacher-scoped traceability.',
    ],
  };
}

export function buildControlCorrectionTeacherReportExport(report: ControlCorrectionTeacherReport) {
  const metrics = Object.entries(report.metrics).map(([metricId, metric]) => ({
    metricId,
    label: metric.label,
    value: metric.value,
    denominator: metric.denominator,
    includedPopulation: metric.includedPopulation,
    excludedPopulation: metric.excludedPopulation,
      confidence: metric.confidence,
      sourceCoverage: metric.sourceCoverage,
      calculationWindow: metric.calculationWindow,
      exclusionReasons: metric.exclusionReasons,
      methodology: metric.methodology,
  }));
  return {
    tables: {
      metrics,
      students: report.studentDrilldowns.map((student) => ({
        userId: student.userId,
        name: student.name,
        evidenceState: student.evidenceState,
        pathStatus: student.path.pathStatus,
        terminalValidationState: student.path.terminalValidationState,
        competencyLift: student.learnerState.competencyLift,
        interventionCount: student.path.interventionCount,
        acceptedInterventionCount: student.path.acceptedInterventionCount,
      })),
      resources: report.resourceContribution,
    },
    chartData: {
      metrics: metrics.map((metric) => ({ metricId: metric.metricId, label: metric.label, value: metric.value })),
      resourceContribution: report.resourceContribution,
    },
    methodologyNotes: report.methodologyNotes,
    redactionPolicyNotes: report.redactionPolicyNotes,
  };
}

function latestByUser(paths: Array<Record<string, any>>) {
  const sorted = [...paths].sort((left, right) => dateMs(right.updatedAt) - dateMs(left.updatedAt));
  const map = new Map<string, Record<string, any>>();
  for (const path of sorted) {
    if (typeof path.userId === 'string' && !map.has(path.userId)) map.set(path.userId, path);
  }
  return map;
}

function groupSnapshotsByUser(snapshots: Array<Record<string, any>>) {
  const map = new Map<string, Array<Record<string, any>>>();
  for (const snapshot of snapshots) {
    if (typeof snapshot.userId !== 'string') continue;
    const items = map.get(snapshot.userId) ?? [];
    items.push(snapshot);
    items.sort((left, right) => dateMs(right.snapshotAt) - dateMs(left.snapshotAt));
    map.set(snapshot.userId, items);
  }
  return map;
}

function buildStudentDrilldown(
  student: ControlCorrectionReportStudent,
  path: Record<string, any> | null,
  snapshots: Array<Record<string, any>>,
  cache: Record<string, any> | null,
): ControlCorrectionStudentDrilldown {
  const terminal = readRecord(path?.terminalValidation);
  const executions = Array.isArray(path?.executions) ? path!.executions : [];
  const deviations = Array.isArray(path?.deviations) ? path!.deviations : [];
  const interventions = Array.isArray(path?.interventions) ? path!.interventions : [];
  return {
    ...student,
    evidenceState: evidenceState(cache),
    confidenceMarkers: arrayOfStrings(cache?.statusMarkers),
    path: {
      pathId: typeof path?.id === 'string' ? path.id : null,
      pathStatus: typeof path?.pathStatus === 'string' ? path.pathStatus : null,
      terminalValidationState: stringValue(terminal.state),
      terminalValidationMarkers: arrayOfStrings(terminal.lowConfidenceMarkers),
      terminalFailureReasons: arrayOfStrings(terminal.failureReasons),
      completedExecutionCount: executions.filter((item) => item.status === 'completed').length,
      deviationCount: deviations.length,
      interventionCount: interventions.length,
      acceptedInterventionCount: interventions.filter(isAcceptedIntervention).length,
      evidenceRefs: collectSafeRefs(path),
    },
    learnerState: {
      competencyLift: competencyLift(snapshots),
      latestSnapshotAt: dateIso(snapshots[0]?.snapshotAt),
      previousSnapshotAt: dateIso(snapshots[1]?.snapshotAt),
    },
  };
}

function metric(id: string, label: string, included: number, denominator: number, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>, methodology: string): ControlCorrectionReportMetric {
  return createMetric(id, label, denominator === 0 ? null : round(included / denominator), denominator, included, coverage, window, methodology);
}

function ratioMetric(id: string, label: string, included: number, denominator: number, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>, methodology: string): ControlCorrectionReportMetric {
  return createMetric(id, label, denominator === 0 ? null : round(included / denominator), denominator, included, coverage, window, methodology);
}

function averageMetric(id: string, label: string, values: number[], denominator: number, classSize: number, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>, methodology: string) {
  const value = values.length ? round(values.reduce((sum, item) => sum + item, 0) / values.length) : null;
  return createMetric(id, label, value, denominator, values.length, coverage, window, methodology, classSize - denominator);
}

function terminalEvidenceRateMetric(id: string, label: string, paths: Array<Record<string, any>>, predicate: (path: Record<string, any>) => boolean, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>, methodology: string) {
  return ratioMetric(id, label, paths.filter(predicate).length, paths.length, coverage, window, methodology);
}

function interventionRateMetric(id: string, label: string, paths: Array<Record<string, any>>, predicate: (intervention: Record<string, any>) => boolean, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>, methodology: string) {
  const interventions = paths.flatMap((path) => Array.isArray(path.interventions) ? path.interventions : []);
  return ratioMetric(id, label, interventions.filter(predicate).length, interventions.length, coverage, window, methodology);
}

function interventionAfterSuccessMetric(paths: Array<Record<string, any>>, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>) {
  const completedPaths = paths.filter((path) => readRecord(path.terminalValidation).state === 'completed');
  const pathsWithSuccessIntervention = completedPaths.filter((path) => {
    const successTime = terminalCompletedAt(path);
    return successTime !== null && Array.isArray(path.interventions) && path.interventions.some((intervention) => dateMs(intervention.createdAt) > successTime);
  });
  return ratioMetric('interventionAfterSuccess', '成功后干预率', pathsWithSuccessIntervention.length, completedPaths.length, coverage, window, 'Completed paths with at least one intervention after terminal success divided by completed path denominator.');
}

function resourceContributionMetric(paths: Array<Record<string, any>>, coverage: ReturnType<typeof summarizeCoverage>, window: ReturnType<typeof collectWindow>) {
  const expectedResourceTypes = new Set(['knowledge_card', 'simulation', 'arena_task', 'intervention', 'reflection']);
  const categories = new Set(
    summarizeResourceContribution(paths)
      .map((item) => item.resourceType)
      .filter((item) => expectedResourceTypes.has(item)),
  );
  return ratioMetric('resourceContribution', '资源贡献覆盖率', categories.size, expectedResourceTypes.size, coverage, window, 'Distinct executed resource categories divided by the expected control-correction resource category denominator.');
}

function createMetric(
  id: string,
  label: string,
  value: number | null,
  denominator: number,
  included: number,
  coverage: ReturnType<typeof summarizeCoverage>,
  window: ReturnType<typeof collectWindow>,
  methodology: string,
  excludedOverride?: number,
): ControlCorrectionReportMetric {
  return {
    id,
    label,
    value,
    denominator,
    includedPopulation: included,
    excludedPopulation: excludedOverride ?? Math.max(denominator - included, 0),
    exclusionReasons: denominator === 0 ? ['evidence-denominator-empty'] : [],
    calculationWindow: window,
    confidence: confidenceFor(denominator, coverage),
    sourceCoverage: coverage,
    methodology,
  };
}

function summarizeCoverage(students: ControlCorrectionReportStudent[], caches: Map<string, Record<string, any>>) {
  let readyStudents = 0;
  let staleStudents = 0;
  let lowConfidenceStudents = 0;
  for (const student of students) {
    const cache = caches.get(student.userId);
    if (!cache) continue;
    const state = evidenceState(cache);
    if (state === 'ready') readyStudents += 1;
    if (state === 'stale') staleStudents += 1;
    if (arrayOfStrings(cache.statusMarkers).includes('low-confidence')) lowConfidenceStudents += 1;
  }
  return {
    readyStudents,
    staleStudents,
    missingStudents: Math.max(students.length - caches.size, 0),
    lowConfidenceStudents,
  };
}

function collectWindow(paths: Array<Record<string, any>>) {
  const times = paths.flatMap((path) => [
    dateIso(path.createdAt),
    dateIso(path.updatedAt),
    ...(Array.isArray(path.executions) ? path.executions.flatMap((execution) => [dateIso(execution.completedAt), dateIso(execution.failedAt), dateIso(execution.startedAt)]) : []),
  ]).filter((item): item is string => Boolean(item));
  times.sort();
  return { start: times[0] ?? null, end: times.at(-1) ?? null };
}

function summarizeResourceContribution(paths: Array<Record<string, any>>) {
  const map = new Map<string, { resourceType: string; nodeId: string; executionCount: number; completedCount: number }>();
  for (const execution of paths.flatMap((path) => Array.isArray(path.executions) ? path.executions : [])) {
    const resourceType = stringValue(execution.resourceType) ?? 'unknown';
    const nodeId = stringValue(execution.nodeId) ?? 'unknown';
    const key = `${resourceType}:${nodeId}`;
    const item = map.get(key) ?? { resourceType, nodeId, executionCount: 0, completedCount: 0 };
    item.executionCount += 1;
    if (execution.status === 'completed') item.completedCount += 1;
    map.set(key, item);
  }
  return [...map.values()].sort((left, right) => right.executionCount - left.executionCount || left.nodeId.localeCompare(right.nodeId));
}

function hasAcceptedTerminalSimulation(path: Record<string, any>) {
  const terminal = readRecord(path.terminalValidation);
  const evidence = readRecord(terminal.evidence);
  const simulation = readRecord(evidence.simulation);
  return isAcceptedTerminalValidation(terminal) && simulation.id !== undefined && simulation.status !== 'failed';
}

function hasAcceptedTerminalArena(path: Record<string, any>) {
  const terminal = readRecord(path.terminalValidation);
  const evidence = readRecord(terminal.evidence);
  const arena = readRecord(evidence.arena);
  return isAcceptedTerminalValidation(terminal) && arena.valid === true;
}

function isAcceptedTerminalValidation(terminal: Record<string, any>) {
  return terminal.state === 'completed' &&
    terminal.fallbackRequired !== true &&
    arrayOfStrings(terminal.lowConfidenceMarkers).length === 0 &&
    arrayOfStrings(terminal.failureReasons).length === 0;
}

function terminalCompletedAt(path: Record<string, any>) {
  const executions = Array.isArray(path.executions) ? path.executions : [];
  const terminalNodeId = stringValue(readRecord(path.terminalValidation).nodeId);
  const terminalExecution = executions
    .filter((execution) => execution.status === 'completed' && (!terminalNodeId || execution.nodeId === terminalNodeId))
    .sort((left, right) => dateMs(right.completedAt) - dateMs(left.completedAt))[0];
  const time = dateMs(terminalExecution?.completedAt);
  return time > 0 ? time : null;
}

function isAcceptedIntervention(intervention: Record<string, any>) {
  return ['accepted', 'completed', 'partially-accepted'].includes(String(intervention.studentOutcome));
}

function hasCitations(intervention: Record<string, any>) {
  return safeRefs(intervention.citedEvidence).length > 0;
}

function collectSafeRefs(path: Record<string, any> | null) {
  const refs = [
    ...(Array.isArray(path?.executions) ? path!.executions.flatMap((execution) => [
      ...safeRefs(execution.evidenceRefs),
      safeRef('SimulationRun', readRecord(execution.simulationRef).id),
      safeRef(stringValue(readRecord(execution.arenaRef).kind) ?? 'ArenaSubmission', readRecord(execution.arenaRef).id),
    ]) : []),
    ...(Array.isArray(path?.interventions) ? path!.interventions.flatMap((intervention) => safeRefs(intervention.citedEvidence)) : []),
  ].filter((item): item is { kind: string; id: string } => Boolean(item));
  return Array.from(new Map(refs.map((item) => [`${item.kind}:${item.id}`, item])).values());
}

function safeRefs(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => {
        const record = readRecord(item);
        return safeRef(
          stringValue(record.kind) ?? stringValue(record.sourceType) ?? '',
          stringValue(record.id) ?? stringValue(record.sourceId) ?? stringValue(record.ref),
        );
      }).filter((item): item is { kind: string; id: string } => Boolean(item))
    : [];
}

function safeRef(kind: unknown, id: unknown) {
  const allowed = new Set([
    'LearningFact',
    'LearningPathExecution',
    'LearningPathDeviation',
    'SimulationRun',
    'ArenaSubmission',
    'ArenaVirtualSimulationRun',
    'ai-intervention',
    'learning-path-node',
  ]);
  return typeof kind === 'string' && allowed.has(kind) && typeof id === 'string' && id.length > 0 ? { kind, id } : null;
}

function competencyLift(snapshots: Array<Record<string, any>>) {
  if (snapshots.length < 2) return null;
  const latest = averageVector(readRecord(snapshots[0].competencyVector));
  const previous = averageVector(readRecord(snapshots[1].competencyVector));
  if (latest === null || previous === null) return null;
  return round(latest - previous);
}

function averageVector(vector: Record<string, unknown>) {
  const values = Object.values(vector).map((item) => readRecord(item).score).filter(isNumber);
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
}

function confidenceFor(denominator: number, coverage: ReturnType<typeof summarizeCoverage>): Confidence {
  if (denominator === 0) return 'none';
  if (coverage.staleStudents > 0 || coverage.lowConfidenceStudents > 0 || coverage.missingStudents > 0) return 'low';
  if (denominator < 2) return 'medium';
  return 'high';
}

function evidenceState(cache: Record<string, any> | null): 'ready' | 'stale' | 'missing' {
  if (!cache) return 'missing';
  const markers = arrayOfStrings(cache.statusMarkers);
  return markers.includes('stale') ? 'stale' : 'ready';
}

function readRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function dateIso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? new Date(value).toISOString() : null;
}

function dateMs(value: unknown): number {
  return value instanceof Date ? value.getTime() : typeof value === 'string' ? new Date(value).getTime() : 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
