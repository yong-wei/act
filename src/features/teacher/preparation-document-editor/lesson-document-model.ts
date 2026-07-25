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
    return errors;
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
  return errors;
}

function validMinutes(value: unknown) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 120;
}

function stepMinutes(steps: PreparationRecord[]) {
  return steps.reduce((total, step) => total + (validMinutes(step.minutes) ? Number(step.minutes) : 0), 0);
}
