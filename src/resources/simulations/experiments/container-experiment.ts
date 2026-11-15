import { containerExperiment } from '../simulations/vessel-experiments';
import type { VesselExperiment, VesselField } from '../simulations/vessel-experiment';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import { CONTAINER_COURSE_STEPS } from './container-course';
import { VESSEL_COURSES } from './course-catalog';

export const containerCourseExperiment: VesselExperiment = {
  ...containerExperiment, title: VESSEL_COURSES.container.title,
  courseVersion: CONTAINER_COURSE_STEPS[0].experimentVersion,
  steps: CONTAINER_COURSE_STEPS.map((step) => {
    const fields: VesselField[] = step.sequence === 20
      ? Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key, label]) => ({key, label, kind: 'text'}))
      : [{key: 'prediction', label: '运行前预测与方案依据', kind: 'text'},
        {key: 'observation', label: '本人读数与比较结果', kind: 'text'},
        {key: 'interpretation', label: '因果解释与适用边界', kind: 'text'}];
    return {seq: step.sequence, title: step.title, goal: step.learningObjective, watch: step.rubric.performanceCriteria ?? step.learningObjective,
      suggestion: step.hints[0], scene: 'container-course', duration: step.runDurationS ?? 1200,
      minRunS: step.runDurationS ?? 0, maxPoints: step.points, expectTime: 6, fields};
  }),
  series: [{id: 'speed', label: '对水航速量测 m/s', digits: 2}, {id: 'groundSpeed', label: '低频对地航速估计 m/s', digits: 2},
    {id: 'reference', label: '受限航速参考 m/s', digits: 2}, {id: 'shaftRpm', label: '实际轴速 r/min'},
    {id: 'referenceRpm', label: '轴速指令 r/min'}, {id: 'heading', label: '航向量测 °'},
    {id: 'north', label: '实际航程 m'}, {id: 'east', label: '横偏量测 m'},
    {id: 'power', label: '轴功率 MW', digits: 2}, {id: 'fuel', label: '教学估计燃油 kg'},
    {id: 'firstOrder', label: '一阶纵向波浪力 kN'}, {id: 'secondOrder', label: '二阶纵向波浪力 kN'}],
};
