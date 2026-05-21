import {
  ARENA_HIDDEN_TEST_SIGNAL_LABELS,
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
  getArenaChallengeObject,
  type ChallengeTask,
} from '../domain';
import type { ArenaPublicationVisibility } from './configuration';

export interface TeacherArenaChallengeRecommendation {
  taskId: string;
  title: string;
  objectName: string;
  stageLabel: string;
  capabilityLabels: string[];
  methodLabels: string[];
  suitabilityEvidence: string[];
  classContext: string;
  optionLabel: string;
}

export interface BuildTeacherArenaChallengeRecommendationOptions {
  classId: string;
  visibility: ArenaPublicationVisibility;
  homeworkBinding: boolean;
}

function classContext(options: BuildTeacherArenaChallengeRecommendationOptions): string {
  if (options.visibility === 'class') {
    return `${options.classId} 班级挑战，可追踪未提交、有效提交率和课堂复盘证据。`;
  }
  if (options.visibility === 'course') {
    return '课程范围发布，报告按同一发布任务汇总，不按单一班级过滤提交。';
  }
  return '公开发布，适合展示或开放练习，默认不使用班级名单判断未提交。';
}

export function buildTeacherArenaChallengeRecommendation(
  task: ChallengeTask,
  options: BuildTeacherArenaChallengeRecommendationOptions,
): TeacherArenaChallengeRecommendation {
  const object = getArenaChallengeObject(task.objectId);
  const stageLabel = ARENA_TRAINING_STAGE_LABELS[task.training.stage];
  const capabilityLabels = task.training.capabilityTags.map((capability) => ARENA_TRAINING_CAPABILITY_LABELS[capability]);
  const methodLabels = task.allowedMethods.map((method) => method);
  const hiddenTestLabel = ARENA_HIDDEN_TEST_SIGNAL_LABELS[task.training.hiddenTestSignal];
  const suitabilityEvidence = [
    `对象：${object?.name ?? task.objectId}`,
    `阶段：${stageLabel}`,
    `能力：${capabilityLabels.join('、')}`,
    `方法：${methodLabels.join('、')}`,
    `评测：${hiddenTestLabel}`,
    options.homeworkBinding ? '适合作业成绩构成中的达标与掌握度证据' : '适合课堂练习或开放比较反馈',
  ];

  return {
    taskId: task.id,
    title: task.title,
    objectName: object?.name ?? task.objectId,
    stageLabel,
    capabilityLabels,
    methodLabels,
    suitabilityEvidence,
    classContext: classContext(options),
    optionLabel: `${task.title} · ${stageLabel} · ${capabilityLabels.slice(0, 2).join('/')}`,
  };
}

export function buildTeacherArenaChallengeRecommendations(
  tasks: readonly ChallengeTask[],
  options: BuildTeacherArenaChallengeRecommendationOptions,
): TeacherArenaChallengeRecommendation[] {
  return tasks.map((task) => buildTeacherArenaChallengeRecommendation(task, options));
}
