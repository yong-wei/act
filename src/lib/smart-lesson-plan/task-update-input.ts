/**
 * 从公开任务投影重建 PATCH 更新输入的唯一转换。
 *
 * 工作区与后续 caller 不得各自重新拼装 task revision、source binding 与
 * goal/knowledge point 身份；字段缺省语义与 updateTaskSchema 保持一致。
 */
export type SmartTaskUpdateSourceTask = {
  courseBasisId: string;
  topic: string;
  audience: string;
  prerequisites?: string | null;
  durationMinutes: number;
  outlineConfirmationRequired?: boolean | null;
  selectedClassId?: string | null;
  textbookRanges?: Array<{
    bookId: string;
    level: 'BOOK' | 'CHAPTER' | 'SECTION';
    unitId: string | null;
    structuralPath: string[];
  }>;
  sources?: Array<{ sourceVersionId: string; state: string }>;
  knowledgePoints?: Array<{
    id: string;
    lineageId: string;
    title: string;
    origin: 'SUGGESTED' | 'TEACHER_CREATED';
    sourceState: string;
    sourceBindings: Array<Record<string, unknown>>;
    gapReason?: string | null;
    supersedesIds?: string[];
    state: string;
  }>;
  goals?: Array<{
    id: string;
    lineageId: string;
    content: string;
    sourceState: string;
    sourceBindings: Array<Record<string, unknown>>;
    gapReason?: string | null;
    standardsMappings?: Array<{ standardId: string; label: string }>;
    state: string;
  }>;
};

export function buildSmartTaskUpdateInput(task: SmartTaskUpdateSourceTask) {
  return {
    courseBasisId: task.courseBasisId,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites ?? '',
    durationMinutes: task.durationMinutes,
    outlineConfirmationRequired: Boolean(task.outlineConfirmationRequired),
    selectedClassId: task.selectedClassId ?? null,
    textbookRanges: task.textbookRanges ?? [],
    sourceVersionIds: task.sources?.filter((source) => source.state === 'SELECTED').map((source) => source.sourceVersionId) ?? [],
    knowledgePoints: task.knowledgePoints?.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, title: item.title, content: item.title, origin: item.origin,
      sourceState: item.sourceState, sourceBindings: item.sourceBindings, gapReason: item.gapReason ?? null, supersedesIds: item.supersedesIds ?? [],
    })) ?? [],
    goals: task.goals?.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, content: item.content, sourceState: item.sourceState,
      sourceBindings: item.sourceBindings, gapReason: item.gapReason ?? null, standardsMappings: item.standardsMappings ?? [],
    })) ?? [],
    confirmScope: true,
    confirmGoals: true,
  };
}
