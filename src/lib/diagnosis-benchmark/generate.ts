/**
 * 确定性仿真 governedInput 生成器（Issue #1729）。
 *
 * 同一场景版本 + seed 生成逐字节一致的 governedInput 与真值；
 * 弱势注入、进度覆盖缺失与作业/测评冲突全部由场景参数确定性驱动。
 */

import type {
  DiagnosisBenchmarkGovernedInput,
  DiagnosisBenchmarkScenario,
} from '@/lib/diagnosis-benchmark/types';
import { benchmarkGroundTruth } from '@/lib/diagnosis-benchmark/scenarios';

/** mulberry32：小型确定性 PRNG，避免依赖随机库。 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FROZEN_NOW = '2026-08-31T08:00:00.000Z';

/**
 * 生成场景的 governedInput。学生顺序固定为 bench-student-0001..N；
 * 非注入节点进度 60–95（IN_PROGRESS 或 COMPLETED）；注入节点的前
 * weakStudents 名学生 progress 5–30 且未完成（或 NOT_STARTED），
 * 其余学生正常。progressCoverage < 1 时按 seed 确定性省略部分行。
 */
export function generateBenchmarkGovernedInput(
  scenario: DiagnosisBenchmarkScenario,
): { governedInput: DiagnosisBenchmarkGovernedInput; actualCoverage: number } {
  const random = createSeededRandom(scenario.seed);
  const studentIds = Array.from({ length: scenario.studentCount }, (_, index) => (
    `bench-student-${String(index + 1).padStart(4, '0')}`
  ));
  const nodeIds = Array.from({ length: scenario.nodeCount }, (_, index) => (
    `bench-node-${String(index + 1).padStart(2, '0')}`
  ));
  const injectionByNode = new Map(scenario.weaknessInjection.map((injection) => [
    injection.nodeId,
    injection.weakStudents,
  ]));

  const knowledgeProgress: DiagnosisBenchmarkGovernedInput['knowledgeProgress'] = [];
  let generatedRows = 0;
  let totalRows = 0;
  for (const nodeId of nodeIds) {
    const weakStudents = injectionByNode.get(nodeId) ?? 0;
    studentIds.forEach((userId, studentIndex) => {
      totalRows += 1;
      if (random() >= scenario.progressCoverage) {
        return;
      }
      generatedRows += 1;
      const isWeak = studentIndex < weakStudents;
      const status = isWeak
        ? (studentIndex % 3 === 0 ? 'NOT_STARTED' : 'IN_PROGRESS')
        : (random() < 0.6 ? 'COMPLETED' : 'IN_PROGRESS');
      const progress = isWeak
        ? 5 + Math.floor(random() * 26)
        : status === 'COMPLETED' ? 88 + Math.floor(random() * 12) : 60 + Math.floor(random() * 36);
      knowledgeProgress.push({
        id: `progress-${nodeId}-${userId}`,
        userId,
        nodeId,
        status,
        progress,
        timeSpent: 60 + Math.floor(random() * 600),
        lastVisited: FROZEN_NOW,
      });
    });
  }

  // 作业与测评：默认温和正相关；冲突场景对注入节点的弱势学生注入
  // 作业高分 + 测评低分的矛盾证据（真值仍以进度注入为准）。
  const assignmentSubmissions: NonNullable<DiagnosisBenchmarkGovernedInput['assignmentSubmissions']> = [];
  const assessmentSessions: NonNullable<DiagnosisBenchmarkGovernedInput['assessmentSessions']> = [];
  studentIds.forEach((userId, studentIndex) => {
    const anyWeakHere = scenario.weaknessInjection.some((injection) => studentIndex < injection.weakStudents);
    const assignmentScore = scenario.assignmentAssessmentConflict && anyWeakHere
      ? 90 + Math.floor(random() * 8)
      : 72 + Math.floor(random() * 24);
    const assessmentPercent = scenario.assignmentAssessmentConflict && anyWeakHere
      ? 30 + Math.floor(random() * 20)
      : 70 + Math.floor(random() * 25);
    assignmentSubmissions.push({
      id: `assignment-${userId}`,
      userId,
      assignmentRevisionId: 'bench-assignment-revision-1',
      contentHash: `bench-content-${scenario.seed}-${userId}`,
      score: assignmentScore,
      totalPoints: 100,
      reviewedAt: FROZEN_NOW,
    });
    const itemCount = 20;
    assessmentSessions.push({
      id: `assessment-${userId}`,
      userId,
      assessmentId: 'bench-assessment-1',
      contentDigest: `bench-digest-${scenario.seed}-${userId}`,
      itemCount,
      correctCount: Math.round(itemCount * assessmentPercent / 100),
      score: assessmentPercent,
      completedAt: FROZEN_NOW,
    });
  });

  return {
    governedInput: {
      schemaVersion: 'teacher-diagnosis-governed-input.v1',
      classId: `bench-class-${scenario.id}`,
      studentIds,
      assignmentSubmissions,
      assessmentSessions,
      riskFlags: [],
      competencySnapshots: [],
      knowledgeProgress,
    },
    actualCoverage: totalRows === 0 ? 1 : generatedRows / totalRows,
  };
}

/** 场景真值 + governedInput 的一次性产出（评测 runner 与测试共用）。 */
export function materializeScenario(scenario: DiagnosisBenchmarkScenario) {
  const { governedInput, actualCoverage } = generateBenchmarkGovernedInput(scenario);
  return {
    scenario,
    governedInput,
    groundTruth: { ...benchmarkGroundTruth(scenario), actualProgressCoverage: actualCoverage },
  };
}
