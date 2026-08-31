/**
 * 学情诊断基准场景（Issue #1729）：8 类场景与版本化真值。
 *
 * 真值由注入计划直接给出——被注入弱势的节点即真实薄弱节点，
 * 标记 primary 的注入即首要薄弱节点；场景携带固定 seed，
 * 同版本同 seed 的生成结果逐字节稳定。
 */

import type {
  DiagnosisBenchmarkGroundTruth,
  DiagnosisBenchmarkScenario,
} from '@/lib/diagnosis-benchmark/types';

const BENCHMARK_STUDENT_COUNT = 100;
const BENCHMARK_NODE_COUNT = 12;
const SCENARIO_VERSION = 'bench-v1';

export const DIAGNOSIS_BENCHMARK_SCENARIO_VERSION = SCENARIO_VERSION;

function healthyBoundary() {
  return {
    allowedConclusionBoundary: {
      requireLimitations: false,
      maxConfidence: 'high' as const,
    },
  };
}

function degradedBoundary() {
  return {
    allowedConclusionBoundary: {
      requireLimitations: true,
      maxConfidence: 'medium' as const,
    },
  };
}

/**
 * 8 类基准场景（Issue #1729 基准场景清单）：
 * 健康班级、单薄弱、多薄弱、子群风险、分层风险、作业测评冲突、
 * 30% 数据缺失、归因压力。节点编号 bench-node-01..12。
 */
export const DIAGNOSIS_BENCHMARK_SCENARIOS: DiagnosisBenchmarkScenario[] = [
  {
    id: 'healthy-class',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260831,
    description: '健康班级：全部节点正常，真值为无薄弱节点。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
  {
    id: 'single-weak-node',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260832,
    description: '单一薄弱节点：node-03 注入 28 名弱势学生。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [{ nodeId: 'bench-node-03', weakStudents: 28, primary: true }],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
  {
    id: 'multiple-weak-nodes',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260833,
    description: '多薄弱节点：node-02、node-07、node-11 注入弱势。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [
      { nodeId: 'bench-node-02', weakStudents: 35 },
      { nodeId: 'bench-node-07', weakStudents: 22, primary: true },
      { nodeId: 'bench-node-11', weakStudents: 41 },
    ],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
  {
    id: 'subgroup-risk',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260834,
    description: '局部子群风险：node-05 仅一个学生子群弱势（24 人）。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [{ nodeId: 'bench-node-05', weakStudents: 24, primary: true }],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
  {
    id: 'stratified-risk',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260835,
    description: '分层风险：node-04 与 node-09 不同强度弱势（45 与 25 人）。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [
      { nodeId: 'bench-node-04', weakStudents: 45, primary: true },
      { nodeId: 'bench-node-09', weakStudents: 25 },
    ],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
  {
    id: 'assignment-assessment-conflict',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260836,
    description: '作业与测评证据冲突：node-06 弱势同时作业高分、测评低分。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [{ nodeId: 'bench-node-06', weakStudents: 26, primary: true }],
    progressCoverage: 1,
    assignmentAssessmentConflict: true,
    ...degradedBoundary(),
  },
  {
    id: 'thirty-percent-missing',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260837,
    description: '30% 数据缺失：node-08 弱势，知识进度行覆盖率 70%。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [{ nodeId: 'bench-node-08', weakStudents: 30, primary: true }],
    progressCoverage: 0.7,
    assignmentAssessmentConflict: false,
    ...degradedBoundary(),
  },
  {
    id: 'attribution-pressure',
    scenarioVersion: SCENARIO_VERSION,
    seed: 20260838,
    description: '归因压力：node-01 与 node-12 相邻注入，考验节点归因不串扰。',
    studentCount: BENCHMARK_STUDENT_COUNT,
    nodeCount: BENCHMARK_NODE_COUNT,
    weaknessInjection: [
      { nodeId: 'bench-node-01', weakStudents: 30, primary: true },
      { nodeId: 'bench-node-12', weakStudents: 20 },
    ],
    progressCoverage: 1,
    assignmentAssessmentConflict: false,
    ...healthyBoundary(),
  },
];

export function scenarioById(scenarioId: string): DiagnosisBenchmarkScenario {
  const scenario = DIAGNOSIS_BENCHMARK_SCENARIOS.find((entry) => entry.id === scenarioId);
  if (!scenario) {
    throw new Error(`unknown diagnosis benchmark scenario: ${scenarioId}`);
  }
  return scenario;
}

export function benchmarkGroundTruth(scenario: DiagnosisBenchmarkScenario): DiagnosisBenchmarkGroundTruth {
  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.scenarioVersion,
    trueWeakNodes: scenario.weaknessInjection.map((injection) => injection.nodeId),
    primaryWeakNode: scenario.weaknessInjection.find((injection) => injection.primary)?.nodeId ?? null,
    actualProgressCoverage: scenario.progressCoverage,
    assignmentAssessmentConflict: scenario.assignmentAssessmentConflict,
  };
}

export function benchmarkNodeIds(scenario: DiagnosisBenchmarkScenario): string[] {
  return Array.from({ length: scenario.nodeCount }, (_, index) => (
    `bench-node-${String(index + 1).padStart(2, '0')}`
  ));
}
