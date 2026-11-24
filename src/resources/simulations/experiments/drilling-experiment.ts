import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import type { VesselExperiment, VesselField } from '../simulations/vessel-experiment';
import { drillingExperiment } from '../simulations/vessel-experiments';
import { VESSEL_COURSES } from './course-catalog';
import { DRILLING_COURSE_STEPS } from './drilling-course';
import { DRILLING_STEP_SPECS } from './drilling-step-specs';

export const DRILLING_COURSE_EXPERIMENT: VesselExperiment = {
  ...drillingExperiment,
  title: VESSEL_COURSES.drilling.title,
  courseVersion: DRILLING_COURSE_STEPS[0].experimentVersion,
  steps: DRILLING_COURSE_STEPS.map((step) => {
    const spec = DRILLING_STEP_SPECS[step.sequence];
    const fields: VesselField[] = step.sequence === 20
      ? Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key, label]) => ({
          key,
          label: spec?.reportFieldGuides?.[key] ? `${label} — ${spec.reportFieldGuides[key]}` : label,
          kind: 'text',
        }))
      : [
          { key: 'prediction', label: '运行前预测与方案依据', kind: 'text' },
          ...(step.sequence === 18 ? [{ key: 'capacity', label: '静态能力计算与实际验证', kind: 'text' as const }] : []),
          { key: 'observation', label: '本人读数与比较结果', kind: 'text' },
          { key: 'interpretation', label: '因果解释与适用边界', kind: 'text' },
        ];
    return {
      seq: step.sequence,
      title: step.title,
      goal: spec?.goal ?? step.learningObjective,
      watch: spec?.watch ?? step.learningObjective,
      suggestion: spec?.suggestion ?? step.hints[0],
      actionSteps: spec?.actionSteps,
      conditionText: spec?.conditionText,
      predictionSpec: spec?.predictionSpec,
      observationSpec: spec?.observationSpec,
      interpretationSpec: spec?.interpretationSpec,
      scene: 'drilling-course',
      duration: step.runDurationS ?? 300,
      minRunS: step.runDurationS ?? 0,
      maxPoints: step.points,
      expectTime: 6,
      fields,
    };
  }),
  series: [
    { id: 'north', label: '北向量测 / m' },
    { id: 'east', label: '东向量测 / m' },
    { id: 'heading', label: '航向量测 / °' },
    { id: 'lfNorth', label: '低频北向 / m' },
    { id: 'lfEast', label: '低频东向 / m' },
    { id: 'lfHeading', label: '低频航向 / °' },
    { id: 'requestedX', label: '期望纵向力 / kN' },
    { id: 'actualX', label: '实际纵向力 / kN' },
    { id: 'requestedY', label: '期望横向力 / kN' },
    { id: 'actualY', label: '实际横向力 / kN' },
    { id: 'requestedYaw', label: '期望艏摇力矩 / MN·m' },
    { id: 'actualYaw', label: '实际艏摇力矩 / MN·m' },
    { id: 'roll', label: '横摇 / °' },
    { id: 'pitch', label: '纵摇 / °' },
    { id: 'heave', label: '升沉 / m' },
    { id: 'power', label: '正机械功率 / MW' },
    { id: 'waterSpeed', label: '对水纵向速度 / m/s' },
    { id: 'groundSpeed', label: '对地纵向速度 / m/s' },
  ],
};

export const drillingCourseExperiment = DRILLING_COURSE_EXPERIMENT;
