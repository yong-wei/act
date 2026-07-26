export const BOPPPS_STAGES = [
  ['bridgeIn', '导入'],
  ['objectives', '学习目标'],
  ['preAssessment', '前测'],
  ['participatoryLearning', '参与式学习'],
  ['postAssessment', '后测'],
  ['summary', '总结'],
] as const;

export type PreparationRecord = Record<string, unknown>;
export type LessonEditorDocumentKind = 'outline' | 'draft';

export function preparationRecord(value: unknown): PreparationRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PreparationRecord : {};
}

export function outlineDocumentSteps(value: PreparationRecord | null) {
  return Array.isArray(value?.coursewareStepOutline) ? value.coursewareStepOutline.map(preparationRecord) : [];
}

export function lessonDocumentStage(
  value: PreparationRecord | null,
  stageId: string,
): PreparationRecord & { steps: PreparationRecord[] } {
  const stage = preparationRecord(preparationRecord(value?.boppps)[stageId]);
  return { ...stage, steps: Array.isArray(stage.steps) ? stage.steps.map(preparationRecord) : [] };
}

export function replaceOutlineStageSteps(
  value: PreparationRecord,
  stageId: string,
  stageSteps: PreparationRecord[],
) {
  const current = outlineDocumentSteps(value);
  return {
    ...value,
    coursewareStepOutline: BOPPPS_STAGES.flatMap(([id]) => (
      id === stageId ? stageSteps : current.filter((step) => step.bopppsStage === id)
    )),
  };
}

export function replaceLessonStageSteps(
  value: PreparationRecord,
  stageId: string,
  steps: PreparationRecord[],
) {
  const boppps = preparationRecord(value.boppps);
  const current = preparationRecord(boppps[stageId]);
  const minutes = stepMinutes(steps);
  const coursewareStepOutline = BOPPPS_STAGES.flatMap(([id]) => {
    const candidateSteps = id === stageId ? steps : lessonDocumentStage(value, id).steps;
    return candidateSteps.map((step) => ({
      title: String(step.title ?? ''),
      bopppsStage: id,
      minutes: Number(step.minutes ?? 0),
    }));
  });
  return {
    ...value,
    boppps: { ...boppps, [stageId]: { ...current, minutes, steps } },
    coursewareStepOutline,
  };
}

export function preparationDocumentValidationErrors(
  kind: LessonEditorDocumentKind,
  value: PreparationRecord | null,
  expectedDurationMinutes: number,
) {
  if (!value) return ['文档尚未加载。'];
  const errors: string[] = [];
  if (kind === 'outline') {
    const steps = outlineDocumentSteps(value);
    for (const [stageId, title] of BOPPPS_STAGES) {
      const stageSteps = steps.filter((step) => step.bopppsStage === stageId);
      if (stageSteps.length === 0) errors.push(`${title}缺少教学步骤。`);
      stageSteps.forEach((step, index) => {
        if (!String(step.title ?? '').trim()) errors.push(`${title}第 ${index + 1} 个步骤缺少标题。`);
        if (!validMinutes(step.minutes)) errors.push(`${title}第 ${index + 1} 个步骤时长无效。`);
      });
    }
    const total = stepMinutes(steps);
    if (total !== expectedDurationMinutes) errors.push(`六阶段合计 ${total} 分钟，应为 ${expectedDurationMinutes} 分钟。`);
    return appendSchemaValidationErrors(kind, value, errors);
  }

  let total = 0;
  for (const [stageId, title] of BOPPPS_STAGES) {
    const stage = lessonDocumentStage(value, stageId);
    if (stage.steps.length === 0) errors.push(`${title}缺少教学步骤。`);
    stage.steps.forEach((step, index) => {
      if (!String(step.title ?? '').trim()) errors.push(`${title}第 ${index + 1} 个步骤缺少标题。`);
      if (!validMinutes(step.minutes)) errors.push(`${title}第 ${index + 1} 个步骤时长无效。`);
      if (!String(step.teacherActivity ?? '').trim()) errors.push(`${title}第 ${index + 1} 个步骤缺少教师活动。`);
      if (!String(step.studentActivity ?? '').trim()) errors.push(`${title}第 ${index + 1} 个步骤缺少学生活动。`);
      if (!String(step.assessment ?? '').trim()) errors.push(`${title}第 ${index + 1} 个步骤缺少评价方式。`);
    });
    const nestedMinutes = stepMinutes(stage.steps);
    const declaredMinutes = Number(stage.minutes ?? 0);
    if (declaredMinutes !== nestedMinutes) errors.push(`${title}阶段时长 ${declaredMinutes} 分钟与内部步骤 ${nestedMinutes} 分钟不一致。`);
    total += nestedMinutes;
  }
  if (total !== expectedDurationMinutes) errors.push(`六阶段合计 ${total} 分钟，应为 ${expectedDurationMinutes} 分钟。`);
  return appendSchemaValidationErrors(kind, value, errors);
}

function appendSchemaValidationErrors(
  kind: LessonEditorDocumentKind,
  value: PreparationRecord,
  errors: string[],
) {
  const parsed = (kind === 'outline' ? smartLessonOutlineOutputSchema : smartLessonPlanSchema).safeParse(value);
  if (parsed.success) return [...new Set(errors)];
  for (const issue of parsed.error.issues) {
    errors.push(`${lessonDocumentFieldLabel(issue.path)}${schemaIssueMessage(issue)}`);
  }
  return [...new Set(errors)];
}

function lessonDocumentFieldLabel(path: PropertyKey[]) {
  const [head, second, third, fourth, fifth] = path.map(String);
  const topLevel = ({
    schemaVersion: '文档版本',
    course: '课程',
    topic: '主题',
    audience: '授课对象',
    durationMinutes: '课程时长',
    prerequisites: '先修要求',
    goals: '学习目标',
    knowledgePoints: '知识点',
    keyContent: '重点内容',
    difficultContent: '难点内容',
    limitations: '教学限制与待补信息',
    classAdaptation: '班级适配',
    sources: '来源绑定',
    coursewareStepOutline: '课件步骤提纲',
  } as Record<string, string>)[head];
  if (head === 'coursewareStepOutline' && second !== undefined) {
    return `课件步骤提纲第 ${Number(second) + 1} 项${fieldSuffix(third)}`;
  }
  if (head === 'boppps' && second) {
    const stage = BOPPPS_STAGES.find(([stageId]) => stageId === second)?.[1] ?? second;
    if (third === 'steps' && fourth !== undefined) {
      return `${stage}第 ${Number(fourth) + 1} 个步骤${fieldSuffix(fifth)}`;
    }
    return `${stage}${fieldSuffix(third)}`;
  }
  if (second !== undefined && ['keyContent', 'difficultContent', 'limitations'].includes(head)) {
    return `${topLevel ?? head}第 ${Number(second) + 1} 项`;
  }
  return topLevel ?? (path.map(String).join(' / ') || '文档');
}

function fieldSuffix(field: string | undefined) {
  return ({
    title: '标题',
    minutes: '时长',
    teacherActivity: '教师活动',
    studentActivity: '学生活动',
    assessment: '评价方式',
    sourceBindings: '来源绑定',
    steps: '内部步骤',
  } as Record<string, string>)[field ?? ''] ?? (field ? ` / ${field}` : '');
}

function schemaIssueMessage(issue: { code: string; message: string; type?: string }) {
  if (issue.code === 'too_small') {
    return issue.type === 'string' ? '不能为空或长度不足。' : '数量不足。';
  }
  if (issue.code === 'too_big') {
    return issue.type === 'string' ? '超过允许长度。' : '数量超过上限。';
  }
  if (issue.code === 'invalid_type') return '类型无效。';
  if (issue.code === 'invalid_value') return '取值无效。';
  return `不符合保存要求（${issue.message}）。`;
}

function validMinutes(value: unknown) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 120;
}

function stepMinutes(steps: PreparationRecord[]) {
  return steps.reduce((total, step) => total + (validMinutes(step.minutes) ? Number(step.minutes) : 0), 0);
}
import {
  smartLessonOutlineOutputSchema,
  smartLessonPlanSchema,
} from '@/lib/smart-lesson-plan/schema';
