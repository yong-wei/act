export const SMART_PREPARATION_STAGE_ORDER = [
  'course-basis',
  'topic-goals',
  'class-attainment',
  'lesson-generation',
  'courseware-generation',
] as const;

export type SmartPreparationStageId = typeof SMART_PREPARATION_STAGE_ORDER[number];
export type SmartPreparationStageState = 'complete' | 'current' | 'blocked' | 'pending' | 'unavailable';

export type SmartPreparationStageProjection = {
  id: SmartPreparationStageId;
  title: string;
  state: SmartPreparationStageState;
  statusLabel: string;
  complete: boolean;
  blockingReason: string | null;
  nextAction: string | null;
};

export type SmartPreparationTaskProjection = {
  currentStage: SmartPreparationStageId;
  statusLabel: string;
  resumable: boolean;
  unsupportedPayload: boolean;
  stages: SmartPreparationStageProjection[];
};

const TASK_STATE_LABELS: Record<string, string> = {
  QUEUED: '等待生成',
  RUNNING: '正在生成',
  PAUSED: '等待确认',
  RETRYABLE: '可以重试',
  FAILED: '生成失败',
  CANCELLED: '已取消',
  COMPLETED: '生成完成',
  EDITABLE: '可编辑',
  GENERATING: '生成中',
  READY: '待审核',
  APPROVED: '已批准',
};

export function smartPreparationStatusLabel(value: string | null | undefined) {
  if (!value) return '尚未开始';
  return TASK_STATE_LABELS[value] ?? '状态不可用';
}

export function projectSmartPreparationTask(task: Record<string, unknown>): SmartPreparationTaskProjection {
  const sources = records(task.sources).filter((item) => item.state === 'SELECTED' && item.sourceValid !== false);
  const points = records(task.knowledgePoints).filter((item) => item.state !== 'REMOVED');
  const goals = records(task.goals).filter((item) => item.state !== 'REMOVED');
  const drafts = records(task.drafts);
  const draft = drafts[0];
  const jobs = records(draft?.jobs);
  const job = jobs[0];
  const revisions = records(task.revisions);
  const currentTaskRevision = number(task.revision);
  const currentRevisions = revisions.filter((revision) => number(revision.taskRevision) === currentTaskRevision);
  const currentRevisionIds = new Set(currentRevisions.map((revision) => text(revision.id)).filter(Boolean));
  const publicationSeries = record(task.coursewarePublicationSeries);
  const publications = records(publicationSeries?.revisions)
    .filter((publication) => currentRevisionIds.has(text(publication.planRevisionId)));
  const coursewareDrafts = currentRevisions.flatMap((revision) => records(revision.coursewareDrafts));
  const coursewareContentAvailable = publications.length > 0
    || coursewareDrafts.some((item) => item.state === 'ACCEPTED');

  const sourceComplete = sources.length > 0;
  const scopeComplete = sourceComplete
    && Boolean(task.topic && task.audience && task.scopeConfirmedAt && task.goalsConfirmedAt)
    && points.length > 0
    && goals.length > 0;
  const classComplete = scopeComplete && Boolean(task.scopeConfirmedAt);
  const lessonContentAvailable = currentRevisions.length > 0;
  const lessonComplete = classComplete && lessonContentAvailable;
  const coursewareReady = lessonComplete && coursewareContentAvailable;
  const jobState = text(job?.state);
  const resumable = ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(jobState)
    && !job?.supersededAt;
  const content = draft?.content;
  const unsupportedPayload = content != null && !isRenderableDocument(content);

  const stages: SmartPreparationStageProjection[] = [
    stage('course-basis', '课程依据', sourceComplete, null, '选择课程依据'),
    stage('topic-goals', '主题与目标', scopeComplete, sourceComplete ? null : '请先确认课程依据', '确认主题、知识点与教学目标'),
    stage('class-attainment', '班级学情', classComplete, scopeComplete ? null : '请先确认主题与目标', '确认是否使用班级累计学情'),
    stage(
      'lesson-generation',
      '生成与审核教案',
      lessonComplete,
      classComplete ? null : '请先完成班级学情阶段',
      resumable ? '从首个未完成阶段恢复' : lessonComplete ? null : '生成并审核教案',
      unsupportedPayload && classComplete ? 'unavailable' : undefined,
    ),
    stage(
      'courseware-generation',
      '生成课件',
      coursewareReady,
      lessonComplete ? null : '请先批准教案版本',
      coursewareContentAvailable && !lessonComplete
        ? '重新确认上游信息后复核已有课件'
        : coursewareReady
          ? null
          : '根据已批准教案生成课件',
    ),
  ];
  const current = stages.find((item) => !item.complete) ?? stages.at(-1)!;
  return {
    currentStage: current.id,
    statusLabel: task.archivedAt ? '已归档' : smartPreparationStatusLabel(jobState || text(draft?.state)),
    resumable,
    unsupportedPayload,
    stages,
  };
}

function stage(
  id: SmartPreparationStageId,
  title: string,
  complete: boolean,
  blockingReason: string | null,
  nextAction: string | null,
  forcedState?: SmartPreparationStageState,
): SmartPreparationStageProjection {
  const state = forcedState ?? (complete ? 'complete' : blockingReason ? 'blocked' : 'current');
  return {
    id,
    title,
    state,
    statusLabel: state === 'complete'
      ? '已完成'
      : state === 'blocked'
        ? '暂不可用'
        : state === 'unavailable'
          ? '内容不可显示'
          : '进行中',
    complete,
    blockingReason,
    nextAction,
  };
}

function isRenderableDocument(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === 'string'
    || (typeof candidate.topic === 'string' && Boolean(record(candidate.boppps)))
    || Array.isArray(candidate.stages)
    || Array.isArray(candidate.sections);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : -1;
}
