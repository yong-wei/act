import { lngExperiment } from '../simulations/vessel-experiments';
import type { VesselExperiment, VesselField } from '../simulations/vessel-experiment';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import { LNG_COURSE_STEPS } from './lng-course';
import { VESSEL_COURSES } from './course-catalog';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const observationLabels: Record<number, string> = {
  1: '轴速指令、实际轴速、推力、航速及距离的响应先后顺序',
  3: '模型参数、轴系与船体惯性的区分',
  4: '留出运行的预测误差及来源',
  5: '降至0.2m/s所需时间及距离，窗口内未达到请明确记录',
  6: '两种反车强度的制动距离、轴速过零及功率约束',
  8: '理想预测与实际速度、距离的偏差',
  12: '三种填充率的质量、吃水、稳性及模型变化',
  13: '转向、横摇与液面响应的因果关系',
  14: '三种填充率的公式频率、谱峰及量纲',
  15: '两种转向斜坡的峰值、均方根及完成时间',
};

export const lngCourseExperiment: VesselExperiment = {
  ...lngExperiment,
  title: VESSEL_COURSES.lng.title,
  courseVersion: LNG_COURSE_STEPS[0].experimentVersion,
  steps: LNG_COURSE_STEPS.map((step) => {
    const fields: VesselField[] = step.sequence === 20
      ? Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key, label]) => ({ key, label, kind: 'text' }))
      : [{ key: 'prediction', label: '运行或分析前的预测', kind: 'text' },
        { key: 'observation', label: observationLabels[step.sequence] ?? '本次方案、读数与比较结果', kind: 'text' },
        { key: 'interpretation', label: '依据本人证据解释原因与适用边界', kind: 'text' }];
    return { seq: step.sequence, title: step.title, goal: step.learningObjective,
      watch: observationLabels[step.sequence] ?? '比较指令、仪器量测、实际运动及约束状态，保留本次方案的证据。',
      suggestion: step.hints[0], scene: 'lng-course', duration: step.runDurationS ?? 1200,
      minRunS: step.runDurationS ?? 0, maxPoints: step.points, expectTime: 6, fields };
  }),
  series: [
    { id: 'referenceRpm', label: '轴速指令 r/min' },
    { id: 'shaftRpm', label: '轴速量测 r/min' },
    { id: 'speed', label: '计程仪 m/s', digits: 2 },
    { id: 'speedReference', label: '计划航速 m/s', digits: 2 },
    { id: 'filteredSpeed', label: '滤波计程仪 m/s', digits: 2 },
    { id: 'lowFrequencySpeed', label: '低频航速估计 m/s', digits: 2 },
    { id: 'heading', label: '航向量测 °' },
    { id: 'distance', label: '船艏剩余距离真值 m' },
    { id: 'north', label: '北向位置真值 m' },
    { id: 'actuatorForce', label: '执行器纵向合力真值 kN' },
    { id: 'east', label: '横向位置量测 m' },
    { id: 'slosh', label: '液面幅值真值 m', digits: 3 },
  ],
};

export function lngCourseTraceSamples(trace: VesselTracePoint[]) {
  return trace.filter((_, index) => index % 20 === 0 || index === trace.length - 1).map((point) => {
    const measured = (key: string) => point.measurements[key]?.quality === 'Good' ? point.measurements[key].value ?? NaN : NaN;
    return {time: point.timeS, values: {referenceRpm: point.command.shaftRpm[0], shaftRpm: measured('ShaftSpeed0'),
      speed: measured('SpeedLog'), speedReference: point.longitudinal?.referenceMps ?? NaN,
      filteredSpeed: point.longitudinal?.filteredMeasurementMps ?? NaN, lowFrequencySpeed: point.estimate.groundBodySpeedMps,
      heading: measured('Heading'), distance: point.truth.bowClearanceM ?? NaN,
      east: measured('East'), north: point.truth.northM,
      actuatorForce: (point.dynamics?.external_components?.tau_actuator[0] ?? NaN) / 1000,
      slosh: point.liquid ? Math.max(0, ...point.liquid.cornerHeightsM) : NaN}};
  });
}
