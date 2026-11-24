import { cruiseExperiment } from '../simulations/vessel-experiments';
import type { VesselExperiment, VesselField } from '../simulations/vessel-experiment';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import { CRUISE_COURSE_STEPS } from './cruise-course';
import { CRUISE_STEP_SPECS } from './cruise-step-specs';
import { VESSEL_COURSES } from './course-catalog';

export const cruiseCourseExperiment: VesselExperiment = {
  ...cruiseExperiment,
  title: VESSEL_COURSES.cruise.title,
  courseVersion: CRUISE_COURSE_STEPS[0].experimentVersion,
  steps: CRUISE_COURSE_STEPS.map((step) => {
    const spec = CRUISE_STEP_SPECS[step.sequence];
    const fields: VesselField[] =
      step.sequence === 20
        ? Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key, label]) => ({
            key,
            label: spec?.reportFieldGuides?.[key]
              ? `${label} — ${spec.reportFieldGuides[key]}`
              : label,
            kind: 'text',
          }))
        : [
            { key: 'prediction', label: '运行前预测与方案依据', kind: 'text' },
            { key: 'observation', label: '本人读数与比较结果', kind: 'text' },
            { key: 'interpretation', label: '因果解释与适用边界', kind: 'text' },
          ];
    return {
      seq: step.sequence,
      title: step.title,
      goal: spec?.goal ?? step.learningObjective,
      actionSteps: spec?.actionSteps,
      watch: spec?.watch ?? step.rubric.performanceCriteria ?? step.learningObjective,
      conditionText: spec?.conditionText,
      suggestion: spec?.suggestion ?? step.hints[0],
      scene: 'cruise-course',
      duration: step.runDurationS ?? 600,
      minRunS: step.runDurationS ?? 0,
      maxPoints: step.points,
      expectTime: 6,
      fields,
      predictionSpec: spec?.predictionSpec,
      observationSpec: spec?.observationSpec,
      interpretationSpec: spec?.interpretationSpec,
      sketchSpec: spec?.sketchSpec,
    };
  }),
  series: [
    { id: 'heading', label: '航向量测 °' },
    { id: 'portPod', label: '左吊舱方位量测 °' },
    { id: 'starboardPod', label: '右吊舱方位量测 °' },
    { id: 'roll', label: '横摇姿态估计 °', digits: 3 },
    { id: 'rollRate', label: '横摇角速度量测 °/s', digits: 3 },
    { id: 'portFin', label: '左鳍角量测 °' },
    { id: 'starboardFin', label: '右鳍角量测 °' },
    { id: 'speed', label: '对水航速量测 m/s', digits: 2 },
    { id: 'finMoment', label: '分配横摇力矩 N·m' },
    { id: 'actualRoll', label: '横摇真值 °', digits: 3 },
  ],
};
