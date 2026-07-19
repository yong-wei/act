import { SMART_LESSON_PLAN_SCHEMA_VERSION } from '../schema';

export const sourceBindingFixture = {
  citationId: 'citation-1',
  sourceVersionId: 'version-1',
  anchor: 'chapter-1',
  contentHash: 'a'.repeat(64),
};

function stage(title: string) {
  return {
    minutes: 5,
    teacherActivity: `${title}教师活动`,
    studentActivity: `${title}学生活动`,
    assessment: `${title}评价`,
    steps: [{ title, minutes: 5, teacherActivity: '讲解', studentActivity: '练习', assessment: '检查', sourceBindings: [sourceBindingFixture] }],
  };
}

export function validPlanFixture() {
  return {
    schemaVersion: SMART_LESSON_PLAN_SCHEMA_VERSION,
    course: '自动控制原理',
    topic: '闭环稳定性',
    audience: '自动化专业本科生',
    durationMinutes: 30,
    prerequisites: '复数与传递函数',
    goals: [{
      id: 'goal-1',
      content: '判断闭环系统稳定性',
      sourceState: 'AI_GENERATED_SOURCE_PENDING',
      sourceBindings: [],
      gapIdentity: `smart-goal-gap:${'b'.repeat(64)}`,
      standardsMappings: [],
    }],
    knowledgePoints: [{ id: 'kp-1', title: '稳定性判据', sourceState: 'VERIFIED', sourceBindings: [sourceBindingFixture], gapIdentity: null }],
    keyContent: ['闭环特征方程'],
    difficultContent: ['参数变化与稳定域'],
    boppps: {
      bridgeIn: stage('导入'),
      objectives: stage('目标'),
      preAssessment: stage('前测'),
      participatoryLearning: stage('参与式学习'),
      postAssessment: stage('后测'),
      summary: stage('总结'),
    },
    sources: [sourceBindingFixture],
    limitations: ['待补充目标的直接来源'],
    classAdaptation: null,
    coursewareStepOutline: [
      { title: '导入', bopppsStage: 'bridgeIn', minutes: 5 },
      { title: '目标', bopppsStage: 'objectives', minutes: 5 },
      { title: '前测', bopppsStage: 'preAssessment', minutes: 5 },
      { title: '参与', bopppsStage: 'participatoryLearning', minutes: 5 },
      { title: '后测', bopppsStage: 'postAssessment', minutes: 5 },
      { title: '总结', bopppsStage: 'summary', minutes: 5 },
    ],
  };
}
