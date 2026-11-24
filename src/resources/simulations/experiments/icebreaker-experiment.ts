import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import type { VesselExperiment, VesselField } from '../simulations/vessel-experiment';
import { iceExperiment } from '../simulations/vessel-experiments';
import { VESSEL_COURSES } from './course-catalog';
import { ICEBREAKER_COURSE_STEPS } from './icebreaker-course';
import { ICEBREAKER_STEP_SPECS } from './icebreaker-step-specs';

export const icebreakerCourseExperiment: VesselExperiment = {
  ...iceExperiment,
  title: VESSEL_COURSES.icebreaker.title,
  courseVersion: ICEBREAKER_COURSE_STEPS[0].experimentVersion,
  steps: ICEBREAKER_COURSE_STEPS.map((step) => {
    const spec = ICEBREAKER_STEP_SPECS[step.sequence];
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
            { key: 'observation', label: '本人观察与读数', kind: 'text' },
            { key: 'interpretation', label: '证据解释与适用边界', kind: 'text' },
          ];
    return {
      seq: step.sequence,
      title: step.title,
      goal: spec?.goal ?? step.learningObjective,
      actionSteps: spec?.actionSteps,
      watch: spec?.watch ?? step.learningObjective,
      conditionText: spec?.conditionText,
      suggestion: spec?.suggestion ?? step.hints[0],
      predictionSpec: spec?.predictionSpec,
      observationSpec: spec?.observationSpec,
      interpretationSpec: spec?.interpretationSpec,
      sketchSpec: spec?.sketchSpec,
      scene: 'icebreaker-course',
      duration: step.runDurationS ?? 1200,
      minRunS: step.runDurationS ?? 0,
      maxPoints: step.points,
      expectTime: 6,
      fields,
    };
  }),
  series: [
    { id: 'target', label: '参考航向 °' },
    { id: 'heading', label: '航向量测 °' },
    { id: 'yawRate', label: '转艏速率量测 °/s' },
    { id: 'equivalent', label: '实际等效偏转量测 °' },
    { id: 'speed', label: '对水航速量测 m/s', digits: 2 },
    { id: 'iceForce', label: '冰接触纵向阻力真值 kN' },
    { id: 'roll', label: '横摇真值 °' },
    { id: 'pitch', label: '纵摇真值 °' },
    { id: 'power', label: '正机械功率真值 MW' },
  ],
};

export const ICEBREAKER_COURSE_EXPERIMENT = icebreakerCourseExperiment;

export function icebreakerTraceSamples(trace: VesselTracePoint[]) {
  return trace
    .filter((_, index) => index % 20 === 0 || index === trace.length - 1)
    .map((point) => {
      const measured = (key: string) =>
        point.measurements[key]?.quality === 'Good' ? (point.measurements[key].value ?? Number.NaN) : Number.NaN;
      return {
        time: point.timeS,
        values: {
          target: point.command.headingDeg,
          heading: measured('Heading'),
          yawRate: measured('YawRate'),
          equivalent: measured('EquivalentAzimuth'),
          speed: measured('SpeedLog'),
          iceForce: -(point.ice?.loadBody[0] ?? 0) / 1000,
          roll: point.truth.rollDeg,
          pitch: point.truth.pitchDeg,
          power: point.truth.motorPowerW.reduce((sum, power) => sum + Math.max(power, 0), 0) / 1e6,
        },
      };
    });
}
