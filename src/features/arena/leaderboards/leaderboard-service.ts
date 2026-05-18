import type { ControllerMethod, LeaderboardType, MetricDefinition } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { getArenaChallengeTask, getArenaMetricProfile } from '../data/seed-challenges';
import {
  ARENA_STUDENT_LEADERBOARD_TYPES,
  arenaMethodLabels,
  formatArenaLeaderboardType,
  formatArenaMetric,
} from '../display-labels';
import { buildArenaLeaderboard, type ArenaLeaderboard, type ArenaLeaderboardEntry, type ArenaLeaderboardOptions } from './leaderboard';

export { type ArenaLeaderboard, type ArenaLeaderboardEntry, type ArenaLeaderboardOptions };

export interface LeaderboardViewModel {
  taskId: string;
  type: LeaderboardType;
  typeLabel: string;
  entries: ArenaLeaderboardEntry[];
  isEmpty: boolean;
  hasNoValidSubmissions: boolean;
  totalSubmissions: number;
  totalParticipants: number;
  availableTypes: LeaderboardType[];
  availableMethods: string[];
}

type ChallengeLeaderboardType = Extract<LeaderboardType, 'main' | 'method' | 'metric'>;

export interface ChallengeLeaderboardOption {
  id: string;
  label: string;
}

export interface ChallengeLeaderboardCategoryOption extends ChallengeLeaderboardOption {
  type: ChallengeLeaderboardType;
}

export interface ChallengeLeaderboardMetricCell {
  id: string;
  label: string;
  unit?: string;
  value?: number;
}

export interface ChallengeLeaderboardDetailRow {
  rank: number;
  submissionId: string;
  studentName: string;
  studentNumber?: string;
  studentNumberLabel: string;
  method: ControllerMethod;
  methodLabel: string;
  score: number;
  submittedAt: string;
  metrics: ChallengeLeaderboardMetricCell[];
}

export interface ChallengeLeaderboardCategoryModel {
  type: ChallengeLeaderboardType;
  label: string;
  subOptions: ChallengeLeaderboardOption[];
  selectedSubId?: string;
  entries: ChallengeLeaderboardDetailRow[];
  metricColumns: ChallengeLeaderboardOption[];
  emptyMessage: string;
}

export interface ChallengeLeaderboardBrowserViewModel {
  taskId: string;
  categories: ChallengeLeaderboardCategoryOption[];
  selectedType: ChallengeLeaderboardType;
  methodOptions: ChallengeLeaderboardOption[];
  metricOptions: ChallengeLeaderboardOption[];
  current: ChallengeLeaderboardCategoryModel;
}

export interface ChallengeLeaderboardBrowserData {
  taskId: string;
  categories: ChallengeLeaderboardCategoryOption[];
  methodOptions: ChallengeLeaderboardOption[];
  metricOptions: ChallengeLeaderboardOption[];
  views: ChallengeLeaderboardCategoryModel[];
}

const TYPE_LABELS: Record<LeaderboardType, string> = {
  main: '主榜',
  method: '方法榜',
  metric: '指标榜',
  pareto: 'Pareto 榜',
  class: '班级榜',
  season: '赛季榜',
};

export function getLeaderboardViewModel(
  submissions: readonly ArenaSubmissionRecord[],
  taskId: string,
  currentType: LeaderboardType,
  availableTypes: LeaderboardType[],
  options?: Partial<ArenaLeaderboardOptions>,
): LeaderboardViewModel {
  const taskSubmissions = submissions.filter((s) => s.taskId === taskId);
  const validSubmissions = taskSubmissions.filter((s) => s.evaluation.valid);
  const allMethods = Array.from(new Set(taskSubmissions.map((s) => s.artifact.method)));

  const { taskId: _optsTaskId, type: _optsType, ...safeOptions } = options ?? {};
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId,
    type: currentType,
    ...safeOptions,
  });

  return {
    taskId,
    type: currentType,
    typeLabel: TYPE_LABELS[currentType] ?? currentType,
    entries: leaderboard.entries,
    isEmpty: taskSubmissions.length === 0,
    hasNoValidSubmissions: taskSubmissions.length > 0 && validSubmissions.length === 0,
    totalSubmissions: taskSubmissions.length,
    totalParticipants: new Set(taskSubmissions.map((s) => s.userId ?? s.studentLabel)).size,
    availableTypes,
    availableMethods: allMethods,
  };
}

export function getEmptyLeaderboardViewModel(
  taskId: string,
  availableTypes: LeaderboardType[],
): LeaderboardViewModel {
  return {
    taskId,
    type: 'main',
    typeLabel: '主榜',
    entries: [],
    isEmpty: true,
    hasNoValidSubmissions: false,
    totalSubmissions: 0,
    totalParticipants: 0,
    availableTypes,
    availableMethods: [],
  };
}

function isStudentLeaderboardType(type: LeaderboardType): type is ChallengeLeaderboardType {
  return ARENA_STUDENT_LEADERBOARD_TYPES.includes(type) && (
    type === 'main' || type === 'method' || type === 'metric'
  );
}

function metricDefinitionsById(metrics: readonly MetricDefinition[]): Map<string, MetricDefinition> {
  return new Map(metrics.map((metric) => [metric.id, metric]));
}

function metricOptionsForTask(taskId: string): ChallengeLeaderboardOption[] {
  const task = getArenaChallengeTask(taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  const byId = metricDefinitionsById(profile?.rankingMetrics ?? []);
  const metricIds = task?.primaryMetrics?.length
    ? task.primaryMetrics
    : profile?.rankingMetrics.map((metric) => metric.id) ?? [];
  return metricIds
    .filter((metricId, index, all) => all.indexOf(metricId) === index)
    .map((metricId) => ({
      id: metricId,
      label: formatArenaMetric(metricId, byId.get(metricId)),
    }));
}

function methodOptionsForTask(taskId: string): ChallengeLeaderboardOption[] {
  const task = getArenaChallengeTask(taskId);
  return (task?.allowedMethods ?? []).map((method) => ({
    id: method,
    label: arenaMethodLabels[method],
  }));
}

function metricColumnsForType(
  selectedType: ChallengeLeaderboardType,
  metricOptions: ChallengeLeaderboardOption[],
  selectedMetricId?: string,
): ChallengeLeaderboardOption[] {
  if (selectedType === 'metric' && selectedMetricId) {
    return metricOptions.filter((option) => option.id === selectedMetricId);
  }
  return metricOptions.slice(0, 3);
}

function formatStudentNumber(studentNumber?: string): string {
  return studentNumber?.trim() ? studentNumber : '未登记';
}

function toDetailRows(
  submissions: readonly ArenaSubmissionRecord[],
  entries: readonly ArenaLeaderboardEntry[],
  metricColumns: readonly ChallengeLeaderboardOption[],
): ChallengeLeaderboardDetailRow[] {
  const bySubmissionId = new Map(submissions.map((submission) => [submission.id, submission]));
  const task = entries[0] ? getArenaChallengeTask(entries[0].taskId) : undefined;
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  const metricById = metricDefinitionsById(profile?.rankingMetrics ?? []);

  return entries.map((entry) => {
    const submission = bySubmissionId.get(entry.submissionId);
    const studentNumber = entry.studentNumber ?? submission?.studentNumber;
    return {
      rank: entry.rank,
      submissionId: entry.submissionId,
      studentName: entry.studentLabel,
      studentNumber,
      studentNumberLabel: formatStudentNumber(studentNumber),
      method: entry.method,
      methodLabel: arenaMethodLabels[entry.method],
      score: entry.score,
      submittedAt: entry.submittedAt,
      metrics: metricColumns.map((column) => {
        const metric = metricById.get(column.id);
        return {
          id: column.id,
          label: column.label,
          unit: metric?.unit,
          value: submission?.evaluation.metrics[column.id],
        };
      }),
    };
  });
}

export function getChallengeLeaderboardBrowserViewModel(input: {
  taskId: string;
  submissions: readonly ArenaSubmissionRecord[];
  selectedType?: ChallengeLeaderboardType;
  selectedMethod?: ControllerMethod;
  selectedMetricId?: string;
  leaderboardPolicyId?: string;
}): ChallengeLeaderboardBrowserViewModel {
  const task = getArenaChallengeTask(input.taskId);
  const categories = (task?.leaderboardTypes ?? ['main'])
    .filter(isStudentLeaderboardType)
    .map((type) => ({
      id: type,
      type,
      label: formatArenaLeaderboardType(type),
    }));
  const selectedType = categories.some((category) => category.type === input.selectedType)
    ? input.selectedType as ChallengeLeaderboardType
    : categories[0]?.type ?? 'main';
  const methodOptions = methodOptionsForTask(input.taskId);
  const metricOptions = metricOptionsForTask(input.taskId);
  const selectedMethod = methodOptions.some((option) => option.id === input.selectedMethod)
    ? input.selectedMethod
    : methodOptions[0]?.id as ControllerMethod | undefined;
  const selectedMetricId = metricOptions.some((option) => option.id === input.selectedMetricId)
    ? input.selectedMetricId
    : metricOptions[0]?.id;
  const leaderboardOptions: ArenaLeaderboardOptions = {
    taskId: input.taskId,
    type: selectedType,
    leaderboardPolicyId: input.leaderboardPolicyId,
    ...(selectedType === 'method' && selectedMethod ? { method: selectedMethod } : {}),
    ...(selectedType === 'metric' && selectedMetricId ? { metricId: selectedMetricId } : {}),
  };
  const leaderboard = buildArenaLeaderboard(input.submissions, leaderboardOptions);
  const metricColumns = metricColumnsForType(selectedType, metricOptions, selectedMetricId);
  const subOptions = selectedType === 'method'
    ? methodOptions
    : selectedType === 'metric'
      ? metricOptions
      : [];
  const selectedSubId = selectedType === 'method' ? selectedMethod : selectedType === 'metric' ? selectedMetricId : undefined;

  return {
    taskId: input.taskId,
    categories,
    selectedType,
    methodOptions,
    metricOptions,
    current: {
      type: selectedType,
      label: formatArenaLeaderboardType(selectedType),
      subOptions,
      selectedSubId,
      entries: toDetailRows(input.submissions, leaderboard.entries, metricColumns),
      metricColumns,
      emptyMessage: input.submissions.length === 0
        ? '当前还没有官方提交。'
        : '当前榜单暂无符合条件的有效提交。',
    },
  };
}

export function getChallengeLeaderboardBrowserData(input: {
  taskId: string;
  submissions: readonly ArenaSubmissionRecord[];
  leaderboardPolicyId?: string;
}): ChallengeLeaderboardBrowserData {
  const baseView = getChallengeLeaderboardBrowserViewModel({
    taskId: input.taskId,
    submissions: input.submissions,
    leaderboardPolicyId: input.leaderboardPolicyId,
  });
  const views = baseView.categories.flatMap((category) => {
    if (category.type === 'method') {
      if (baseView.methodOptions.length === 0) {
        return [getChallengeLeaderboardBrowserViewModel({
          taskId: input.taskId,
          submissions: input.submissions,
          selectedType: 'method',
          leaderboardPolicyId: input.leaderboardPolicyId,
        }).current];
      }
      return baseView.methodOptions.map((option) => getChallengeLeaderboardBrowserViewModel({
        taskId: input.taskId,
        submissions: input.submissions,
        selectedType: 'method',
        selectedMethod: option.id as ControllerMethod,
        leaderboardPolicyId: input.leaderboardPolicyId,
      }).current);
    }
    if (category.type === 'metric') {
      if (baseView.metricOptions.length === 0) {
        return [getChallengeLeaderboardBrowserViewModel({
          taskId: input.taskId,
          submissions: input.submissions,
          selectedType: 'metric',
          leaderboardPolicyId: input.leaderboardPolicyId,
        }).current];
      }
      return baseView.metricOptions.map((option) => getChallengeLeaderboardBrowserViewModel({
        taskId: input.taskId,
        submissions: input.submissions,
        selectedType: 'metric',
        selectedMetricId: option.id,
        leaderboardPolicyId: input.leaderboardPolicyId,
      }).current);
    }
    return [getChallengeLeaderboardBrowserViewModel({
      taskId: input.taskId,
      submissions: input.submissions,
      selectedType: 'main',
      leaderboardPolicyId: input.leaderboardPolicyId,
    }).current];
  });

  return {
    taskId: baseView.taskId,
    categories: baseView.categories,
    methodOptions: baseView.methodOptions,
    metricOptions: baseView.metricOptions,
    views,
  };
}
