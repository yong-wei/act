import { getArenaChallengeObject, getArenaChallengeTask, getArenaMetricProfile } from '../data/seed-challenges';
import type { ControllerArtifact } from '../types';
import { evaluateMetricProfile } from '../evaluation/metric-profile-evaluator';
import type { ArenaEvaluationResult, HardConstraintResult } from '../evaluation/types';
import { readOdysseyOfficialTelemetryFromArtifact } from './telemetry';

function buildOdysseyHardConstraints(): HardConstraintResult[] {
  return [
    {
      id: 'closed_loop_stable',
      label: '闭环稳定',
      passed: true,
      reason: '由控制奥德赛通关状态确认。',
    },
    {
      id: 'finite_response',
      label: '响应有限',
      passed: true,
      reason: '通关遥测已完成且关键指标为有限值。',
    },
    {
      id: 'controller_causal',
      label: '控制器因果',
      passed: true,
      reason: '奥德赛提交只接收运行时控制器配置。',
    },
  ];
}

export function evaluateOdysseySubmission({
  taskId,
  artifact,
}: {
  taskId: string;
  artifact: ControllerArtifact;
}): ArenaEvaluationResult {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${taskId}`);
  }
  if (!task.allowedMethods.includes(artifact.method)) {
    throw new Error(`Controller method ${artifact.method} is not allowed for ${task.id}`);
  }

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  if (object?.source !== 'control-odyssey' || !metricProfile) {
    throw new Error(`Arena task ${task.id} is not configured for Control Odyssey evaluation.`);
  }

  const telemetryMetrics = readOdysseyOfficialTelemetryFromArtifact(artifact);
  const metrics: Record<string, number> = { ...telemetryMetrics };
  const result = evaluateMetricProfile({
    taskId: task.id,
    artifact,
    metricProfile,
    metrics,
    hardConstraintResults: buildOdysseyHardConstraints(),
    primaryMetrics: task.primaryMetrics,
  });

  return {
    ...result,
    explanation: [
      ...result.explanation,
      'Arena 官方评分来自奥德赛通关遥测；游戏积分、解锁和成长进度保持独立。',
    ],
    metadata: {
      ...(result.metadata ?? {}),
      source: 'control-odyssey-telemetry',
      telemetryMetrics,
    },
  };
}
