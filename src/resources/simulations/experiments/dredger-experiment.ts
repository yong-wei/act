import {VESSEL_REPORT_SECTION_LABELS} from '@/features/ilab/course-artifact-contract';
import {dredgerExperiment} from '../simulations/vessel-experiments';
import type {VesselExperiment} from '../simulations/vessel-experiment';
import type {VesselTracePoint} from '@/features/simulations/run-evidence';
import {DREDGER_COURSE_STEPS} from './dredger-course';

export const DREDGER_MODE_LABELS = {transit: '自航进场', prepare: '准备与落桩', spud_hold: '钢桩保持',
  cut_swing: '横移切削', pause_cut: '停止切削', recover: '抬刀安全保持', exit: '退出作业'} as const;

export const dredgerCourseExperiment: VesselExperiment = {...dredgerExperiment,
  title: '天鲸号工况切换与作业定位', sceneLabel: '天鲸号工况切换与作业定位', courseVersion: DREDGER_COURSE_STEPS[0].experimentVersion,
  steps: DREDGER_COURSE_STEPS.map((step) => ({seq: step.sequence, title: step.title, goal: step.learningObjective,
    watch: step.learningObjective, suggestion: step.hints[0], scene: 'dredger-course', duration: step.runDurationS ?? 600,
    minRunS: step.runDurationS ?? 0, maxPoints: step.points, expectTime: 6,
    fields: step.sequence === 20 ? Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key, label]) => ({key, label, kind: 'text' as const}))
      : [{key: 'prediction', label: '运行前预测与模式方案', kind: 'text' as const},
        {key: 'observation', label: '本人观察与读数', kind: 'text' as const},
        {key: 'interpretation', label: '证据解释与适用边界', kind: 'text' as const}]})),
  series: [{id: 'target', label: '横移参考 m/s', digits: 3}, {id: 'sway', label: '横移速度量测 m/s', digits: 3},
    {id: 'depth', label: '刀位深度量测 m', digits: 3}, {id: 'portTension', label: '左缆张力量测 kN'},
    {id: 'starboardTension', label: '右缆张力量测 kN'}, {id: 'spud', label: '钢桩反力量测 kN'},
    {id: 'cutter', label: '绞刀转速量测 rpm'}, {id: 'production', label: '实际移除体积 m³', digits: 3},
    {id: 'cutPower', label: '实际切削功率 kW'}, {id: 'roll', label: '横摇真值 °'}]};

export function dredgerTraceSamples(trace: VesselTracePoint[]) {
  return trace.filter((_, index) => index % 20 === 0 || index === trace.length - 1).map((point) => {
    const measured = (name: string) => point.measurements[name]?.quality === 'Good'
      ? point.measurements[name].value ?? NaN : NaN;
    const actual = point.dredger;
    return {time: point.timeS, values: {target: actual?.referenceMps ?? 0, sway: measured('DredgerSwaySpeed'),
      depth: measured('DredgerDepth'), portTension: measured('DredgerCableTension0') / 1000,
      starboardTension: measured('DredgerCableTension1') / 1000, spud: measured('DredgerSpudForce') / 1000,
      cutter: measured('DredgerCutterRpm'), production: actual?.observation.productionM3 ?? 0,
      cutPower: (actual?.observation.cuttingPowerW ?? 0) / 1000,
      roll: point.truth.rollDeg}};
  });
}
