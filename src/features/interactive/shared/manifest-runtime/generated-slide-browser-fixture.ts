import {
  BOPPPS_STAGES,
  GENERATED_SLIDE_SCHEMA_VERSION,
  type GeneratedSlideManifest,
} from './generated-slide-contract';

export const GENERATED_SLIDE_BROWSER_FIXTURE_SECRET = 'TEACHER_ONLY_SECRET_938';

const contentFixtures = [
  { canonicalClass: 'content.rich', payload: { text: '闭环系统由反馈通道构成。', bullets: ['比较输入与输出'] } },
  { canonicalClass: 'content.cardSet', payload: { items: [{ title: '稳定判据', body: '极点位于左半平面。' }] } },
  {
    canonicalClass: 'content.table',
    payload: {
      columns: ['对象', '结论 $s$'],
      rows: [['闭环极点', { kind: 'math', value: 'Re(s) < 0' }]],
    },
  },
  {
    canonicalClass: 'content.reveal',
    payload: {
      items: [
        { title: '判断', body: '先检查特征方程 $D(s)$。', formula: '$G(s)=1$' },
        { title: '增益', body: '再检查反馈增益。', formula: '增益为 $K=2$' },
      ],
    },
  },
  { canonicalClass: 'content.rich', payload: { text: '汇总六类内容 renderer 的门禁证据。' } },
] as const;

export const GENERATED_SLIDE_BROWSER_FIXTURE: GeneratedSlideManifest = {
  schemaVersion: GENERATED_SLIDE_SCHEMA_VERSION,
  lessonId: 'browser-gate-lesson',
  title: '固定浏览器测量门禁',
  durationSeconds: 360,
  stages: BOPPPS_STAGES.map((stage, index) => ({
    stage,
    durationSeconds: 60,
    steps: index === 0
      ? [{
        id: 'browser-gate-step',
        title: '闭环系统稳定性',
        durationSeconds: 60,
        layoutId: 'three-column',
        modules: [
          {
            id: 'formula-module',
            canonicalClass: 'content.formula',
            slotId: 'left',
            sizeId: 'third',
            payload: { formulas: ['G(s) = 1'] },
            roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
          },
          {
            id: 'teacher-secret',
            canonicalClass: 'content.code',
            slotId: 'center',
            sizeId: 'third',
            payload: { language: 'text', code: GENERATED_SLIDE_BROWSER_FIXTURE_SECRET },
            roleMetadata: { studentVisible: false, teacherVisible: true, referenceAnswerVisibility: 'none' },
          },
          {
            id: 'student-activity',
            canonicalClass: 'activity.panel',
            slotId: 'right',
            sizeId: 'third',
            responseKind: 'choice.single',
            evidencePath: 'responses.browser-gate-step.student-activity',
            payload: {
              prompt: '请选择稳定性判断。',
              options: [{ value: 'stable', label: '稳定' }, { value: 'unstable', label: '不稳定' }],
            },
            roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
          },
        ],
      }]
      : index === 5
        ? [{
          id: 'browser-gate-step-6',
          title: '生产 renderer 验证 6',
          durationSeconds: 30,
          layoutId: 'single',
          modules: [{
            id: 'browser-gate-module-6',
            canonicalClass: contentFixtures[4].canonicalClass,
            slotId: 'main',
            sizeId: 'full',
            payload: contentFixtures[4].payload,
            roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
          }],
        }, {
          id: 'browser-gate-multi-formula',
          title: '模块内公式身份与投影',
          durationSeconds: 30,
          layoutId: 'three-column',
          modules: [{
            id: 'visible-formula',
            canonicalClass: 'content.formula',
            slotId: 'left',
            sizeId: 'third',
            payload: { formulas: ['G(s) = 1'] },
            roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
          }, {
            id: 'teacher-formula',
            canonicalClass: 'content.formula',
            slotId: 'center',
            sizeId: 'third',
            payload: { formulas: ['H(s) = 1', 'T(s) = G(s)H(s)'] },
            roleMetadata: { studentVisible: false, teacherVisible: true, referenceAnswerVisibility: 'none' },
          }],
        }]
        : [{
        id: `browser-gate-step-${index + 1}`,
        title: `生产 renderer 验证 ${index + 1}`,
        durationSeconds: 60,
        layoutId: 'single',
        modules: [{
          id: `browser-gate-module-${index + 1}`,
          canonicalClass: contentFixtures[index - 1].canonicalClass,
          slotId: 'main',
          sizeId: 'full',
          payload: contentFixtures[index - 1].payload,
          roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
        }],
        }],
  })),
};

export const GENERATED_SLIDE_BROWSER_FIXTURE_STEPS = GENERATED_SLIDE_BROWSER_FIXTURE.stages
  .flatMap((stage) => stage.steps);
