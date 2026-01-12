#!/usr/bin/env node
/**
 * 旧资源迁移脚本（知识卡片 + 资源注册）
 * 运行: node scripts/seed-legacy-content.mjs
 */

import { PrismaClient, ResourceType, KnowledgeNodeType, InteractiveCategory, LessonItemType } from '@prisma/client';

const prisma = new PrismaClient();

const knowledgeCards = [
  {
    id: 'concept-modeling-intro',
    name: '为什么需要建模？',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '模型是控制的基础——不懂舵机的"脾气"，控制器就只能瞎指挥。',
    explanation:
      '物理系统与数学模型的关系：控制器需要一个"数学档案"来了解被控对象的特性。没有模型，控制器无法预测系统行为，只能被动响应。就像医生需要先了解病情才能开药。强调"模型是控制的基础"。',
    positionX: -50,
    positionY: 0,
    positionZ: 30,
    lessonId: 'lesson-02',
    phase: 'bridge',
    formulaContinuous: null,
    formulaDiscrete: null,
    applications: ['舵机控制', '电机调速', '温度控制', '航向控制'],
    prerequisites: [],
    relatedTopics: ['concept-newton-law-application', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-newton-law-application',
    name: '牛顿定律在旋转体中的应用',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: '转动版的 F=ma：T = Jα，力矩等于转动惯量乘以角加速度。',
    explanation:
      '牛顿第二定律 F=ma 适用于平动，对于旋转运动则变成 T=Jα。其中 J 是转动惯量（类似质量的旋转版），α 是角加速度。不同形状物体的转动惯量不同，这决定了它们"转起来有多费劲"。',
    positionX: -30,
    positionY: 15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'mechanical',
    formulaContinuous: 'T = J\\alpha = J\\ddot{\\theta}',
    formulaDiscrete: null,
    applications: ['舵机系统', '机械臂', '飞轮储能', '陀螺仪'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-linearization', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-kirchhoff-law',
    name: 'KVL与动态电路',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: 'KVL：回路中电压升等于电压降。动态元件让方程变成微分方程。',
    explanation:
      '基尔霍夫电压定律(KVL)说明回路电压代数和为零。电感和电容是"动态元件"：电感电压与电流变化率成正比(u=L·di/dt)，电容电压与电荷成正比(u=q/C)。这让电路方程变成微分方程，与机械系统形成对偶。',
    positionX: -30,
    positionY: -15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'electrical',
    formulaContinuous: 'L\\frac{di}{dt} + Ri + \\frac{1}{C}\\int i\\,dt = u(t)',
    formulaDiscrete: null,
    applications: ['电机电枢回路', 'RLC滤波器', '电力电子', '信号处理'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-newton-law-application'],
  },
  {
    id: 'concept-linearization',
    name: '非线性线性化',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '在工作点附近，用直线近似曲线。小偏差时 sinθ ≈ θ。',
    explanation:
      '很多物理系统是非线性的（如重力摆的 sinθ 项），但线性控制理论更成熟。通过泰勒展开，在平衡点附近将非线性项线性化。例如 sinθ 在 θ=0 附近展开：sinθ≈θ。这让我们能用线性工具分析非线性系统。',
    positionX: -10,
    positionY: 0,
    positionZ: 35,
    lessonId: 'lesson-02',
    phase: 'posttest',
    formulaContinuous: '\\sin\\theta \\approx \\theta \\quad (|\\theta| \\ll 1)',
    formulaDiscrete: null,
    applications: ['倒立摆', '导弹发射架', '悬挂系统', '机器人关节'],
    prerequisites: ['concept-newton-law-application'],
    relatedTopics: ['concept-kirchhoff-law'],
  },
  {
    id: 'concept-laplace-transform',
    name: '拉普拉斯变换',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将时域信号转换到复频域的数学工具，是控制系统分析的核心。',
    explanation: '用于将微分方程转化为代数方程，便于系统分析与设计。',
    positionX: 10,
    positionY: 10,
    positionZ: 10,
    lessonId: 'lesson-02',
    phase: 'summary',
    formulaContinuous: '\\mathcal{L}\\{f(t)\\} = F(s) = \\int_0^{\\infty} f(t) e^{-st} dt',
    formulaDiscrete: null,
    applications: ['传递函数', '系统稳定性分析', '控制器设计'],
    prerequisites: [],
    relatedTopics: [],
  },
];

const attachmentMap = {
  'concept-modeling-intro': ['content/quizzes/modeling-basics.json', 'content/concepts/modeling-intro.mdx'],
  'concept-newton-law-application': ['content/concepts/newton-laws.mdx'],
  'concept-kirchhoff-law': ['content/concepts/kvl-dynamic-circuit.mdx'],
  'concept-linearization': ['content/concepts/linearization.mdx'],
  'concept-laplace-transform': ['content/concepts/laplace-transform.mdx'],
};

const knowledgeLinks = [
  {
    id: 'lk1',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-newton-law-application',
    relation: '引出机械建模',
  },
  {
    id: 'lk2',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-kirchhoff-law',
    relation: '引出电路建模',
  },
  {
    id: 'lk3',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-kirchhoff-law',
    relation: '机电类比',
  },
  {
    id: 'lk4',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-linearization',
    relation: '非线性扩展',
  },
  {
    id: 'lk5',
    sourceId: 'concept-modeling-intro',
    targetId: '1',
    relation: '建模基础',
  },
  {
    id: 'lk6',
    sourceId: 'concept-kirchhoff-law',
    targetId: '3',
    relation: '电路应用',
  },
];

const teachingResources = [
  {
    registryId: 'sim-pid-v1',
    title: 'PID Parameter Tuning Simulator',
    type: ResourceType.SIMULATION_APP,
    description: 'PID 参数整定仿真器',
    config: { kp: 1, ki: 0.1, kd: 0.5, model: 'ship' },
  },
  {
    registryId: 'ethics-arctic-v1',
    title: 'Arctic Navigation Ethics Sandbox',
    type: ResourceType.INTERACTIVE_COMP,
    description: '北极航行伦理沙盒',
    config: { scenario: 'arctic_collision' },
  },
  {
    registryId: 'widget-physics-mech',
    title: 'Physics Builder (Mechanical)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '机械建模拖拽组件',
    config: { mode: 'mechanical', items: ['mass', 'spring', 'damper', 'force'] },
  },
  {
    registryId: 'widget-physics-elec',
    title: 'Physics Builder (Electrical)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '电路建模拖拽组件',
    config: { mode: 'electrical', items: ['resistor', 'inductor', 'capacitor', 'source'] },
  },
  {
    registryId: 'widget-analogy-mapper',
    title: 'Analogy Mapper',
    type: ResourceType.INTERACTIVE_COMP,
    description: '机电类比映射组件',
    config: { leftEq: "m*x''+f*x'+k*x=F", rightEq: "L*q''+R*q'+(1/C)*q=E" },
  },
  {
    registryId: 'widget-argument-principle',
    title: 'Argument Principle (Nyquist)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '幅角原理可视化组件',
    config: { showControls: true },
  },
  { registryId: 'lesson02-bridge-v1', title: 'Lesson 02 - Bridge In', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 导入环节', config: {} },
  { registryId: 'lesson02-objective-v1', title: 'Lesson 02 - Objectives', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 学习目标', config: {} },
  { registryId: 'lesson02-pretest-v1', title: 'Lesson 02 - Pretest', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 前测', config: {} },
  { registryId: 'lesson02-mechanical-v1', title: 'Lesson 02 - Mechanical Modeling', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 机械建模', config: {} },
  { registryId: 'lesson02-electrical-v1', title: 'Lesson 02 - Electrical Modeling', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 电路建模', config: {} },
  { registryId: 'lesson02-analogy-v1', title: 'Lesson 02 - Analogy Mapping', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 机电相似映射', config: {} },
  { registryId: 'lesson02-posttest-v1', title: 'Lesson 02 - Posttest', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 后测', config: {} },
  { registryId: 'lesson02-summary-v1', title: 'Lesson 02 - Summary', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 总结', config: {} },
  { registryId: 'physics-modeling-intro-v1', title: 'Physics Modeling - Intro', type: ResourceType.INTERACTIVE_COMP, description: '物理建模导入', config: {} },
  { registryId: 'physics-modeling-mechanical-v1', title: 'Physics Modeling - Mechanical', type: ResourceType.INTERACTIVE_COMP, description: '物理建模机械环节', config: {} },
  { registryId: 'physics-modeling-electrical-v1', title: 'Physics Modeling - Electrical', type: ResourceType.INTERACTIVE_COMP, description: '物理建模电路环节', config: {} },
  { registryId: 'physics-modeling-analogy-v1', title: 'Physics Modeling - Analogy', type: ResourceType.INTERACTIVE_COMP, description: '物理建模相似映射', config: {} },
  { registryId: 'physics-modeling-practice-v1', title: 'Physics Modeling - Practice', type: ResourceType.INTERACTIVE_COMP, description: '物理建模实战', config: {} },
  {
    registryId: 'lesson06-metric-quick-check',
    title: '指标速判',
    type: ResourceType.INTERACTIVE_COMP,
    description: '时域指标快速识别',
    displayName: '指标速判',
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 20,
    config: {},
  },
  {
    registryId: 'lesson06-metric-handbook',
    title: '指标裁判手册',
    type: ResourceType.INTERACTIVE_COMP,
    description: '时域指标说明与判读',
    displayName: '指标裁判手册',
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 21,
    config: {},
  },
  {
    registryId: 'lesson06-judge-bench',
    title: '裁判席计分器',
    type: ResourceType.INTERACTIVE_COMP,
    description: '调参判分仿真',
    displayName: '裁判席计分器',
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 22,
    config: {},
  },
  {
    registryId: 'lesson13-physics-builder-simple',
    title: '阻尼调节实验',
    type: ResourceType.INTERACTIVE_COMP,
    description: '阻尼比与响应特性实验',
    displayName: '阻尼调节实验',
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 30,
    config: {},
  },
  {
    registryId: 'lesson13-iso2631-mapping',
    title: 'ISO 2631 舒适度映射',
    type: ResourceType.INTERACTIVE_COMP,
    description: '舒适度指标映射',
    displayName: 'ISO 2631 舒适度映射',
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 31,
    config: {},
  },
  {
    registryId: 'lesson13-cruise-typhoon-sim',
    title: '香槟塔保卫战',
    type: ResourceType.SIMULATION_APP,
    description: '邮轮台风避障仿真',
    displayName: '香槟塔保卫战',
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 32,
    config: {},
  },
  {
    registryId: 'lesson13-cruise-bridge',
    title: '邮轮舒适度导入视频',
    type: ResourceType.INTERACTIVE_COMP,
    description: '邮轮舒适度导入场景',
    displayName: '邮轮舒适度导入视频',
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 33,
    config: {},
  },
  {
    registryId: 'classroom-video',
    title: '课堂视频组件',
    type: ResourceType.INTERACTIVE_COMP,
    description: '课堂视频播放',
    displayName: '课堂视频',
    category: InteractiveCategory.CLASSROOM,
    displayOrder: 90,
    config: {},
    teacherOnly: true,
  },
  {
    registryId: 'classroom-poll',
    title: '课堂投票组件',
    type: ResourceType.INTERACTIVE_COMP,
    description: '课堂投票',
    displayName: '课堂投票',
    category: InteractiveCategory.CLASSROOM,
    displayOrder: 91,
    config: {},
    teacherOnly: true,
  },
  {
    registryId: 'classroom-objective',
    title: '课堂学习目标组件',
    type: ResourceType.INTERACTIVE_COMP,
    description: '学习目标展示',
    displayName: '学习目标',
    category: InteractiveCategory.CLASSROOM,
    displayOrder: 92,
    config: {},
    teacherOnly: true,
  },
  {
    registryId: 'classroom-assessment',
    title: '课堂评估组件',
    type: ResourceType.INTERACTIVE_COMP,
    description: '后测评估探针',
    displayName: '后测评估',
    category: InteractiveCategory.CLASSROOM,
    displayOrder: 93,
    config: {},
    teacherOnly: true,
  },
  {
    registryId: 'classroom-ai-report',
    title: '课堂 AI 报告组件',
    type: ResourceType.INTERACTIVE_COMP,
    description: 'AI 动态课堂报告',
    displayName: 'AI 课堂报告',
    category: InteractiveCategory.CLASSROOM,
    displayOrder: 94,
    config: {},
    teacherOnly: true,
  },
  {
    registryId: 'ten-drops-game-v1',
    title: 'Ten Drops Game',
    type: ResourceType.INTERACTIVE_COMP,
    description: '十滴水益智游戏',
    displayName: '十滴水益智游戏',
    category: InteractiveCategory.FUN_EXPLORATION,
    displayOrder: 10,
    config: { initialLevelId: 'tutorial-1', showEducation: true },
  },
];

const presetLessonPlans = [
  {
    key: 'lesson-02-modeling-v1',
    title: '机理建模·微分方程',
    description: '通过舵机系统案例引导学生完成机械/电路建模与机电相似映射，形成微分方程统一框架。',
    items: [
      {
        stage: 'BRIDGE_IN',
        order: 1,
        registryId: 'lesson02-bridge-v1',
        duration: 5,
        title: '导入：透视舵机系统',
        description: '从舵机结构引出建模任务。',
        config: {},
      },
      {
        stage: 'OBJECTIVE',
        order: 1,
        registryId: 'lesson02-objective-v1',
        duration: 2,
        title: '学习目标',
        description: '本节课通关目标与技能清单。',
        config: {},
      },
      {
        stage: 'PRE_ASSESSMENT',
        order: 1,
        registryId: 'lesson02-pretest-v1',
        duration: 8,
        title: '前测：物理基础连线',
        description: '确认机械与电气基础概念掌握情况。',
        config: {},
      },
      {
        stage: 'PARTICIPATORY',
        order: 1,
        registryId: 'lesson02-mechanical-v1',
        duration: 25,
        title: '参与式学习：机械建模工坊',
        description: '搭建弹簧-质量-阻尼模型并写出方程。',
        config: {},
      },
      {
        stage: 'PARTICIPATORY',
        order: 2,
        registryId: 'lesson02-electrical-v1',
        duration: 20,
        title: '参与式学习：电路建模工坊',
        description: '建立 RLC 电路模型并写出方程。',
        config: {},
      },
      {
        stage: 'PARTICIPATORY',
        order: 3,
        registryId: 'lesson02-analogy-v1',
        duration: 15,
        title: '参与式学习：机电相似映射',
        description: '完成机械与电气量的对应关系。',
        config: {},
      },
      {
        stage: 'POST_ASSESSMENT',
        order: 1,
        registryId: 'lesson02-posttest-v1',
        duration: 10,
        title: '后测：导弹发射架建模',
        description: '检查非线性项与线性化理解。',
        config: {},
      },
      {
        stage: 'SUMMARY',
        order: 1,
        registryId: 'lesson02-summary-v1',
        duration: 5,
        title: '总结：知识图谱',
        description: '复盘本节课核心概念与关联知识点。',
        config: {},
      },
    ],
  },
  {
    key: 'lesson-06-judge-bench-v1',
    title: '控制奥德赛·指标裁判席',
    description: '通过裁判席案例理解时域性能指标与控制效果评价逻辑，完成指标速判与参数评估。',
    items: [
      {
        stage: 'BRIDGE_IN',
        order: 1,
        registryId: 'classroom-video',
        duration: 3,
        title: '裁判席开场：快与稳的对决',
        description: '分屏对比快响应与稳响应，引导指标意识。',
        config: {
          mode: 'play',
          config: {
            id: 'video-judge-contrast',
            type: 'video',
            title: '裁判席开场：快与稳的对决',
            sourceType: 'placeholder',
            primarySource: '/assets/placeholder-judge-fast.svg',
            secondarySource: '/assets/placeholder-judge-stable.svg',
            splitMode: 'horizontal',
            narration: '裁判席只看指标：速度够快、超调够小、调节够稳。你准备好接受评分了吗？',
            description: '分屏对比：快但超调 vs 稳但慢的典型响应',
            autoPlay: false,
            autoAdvance: false,
          },
        },
      },
      {
        stage: 'BRIDGE_IN',
        order: 2,
        registryId: 'classroom-poll',
        duration: 1,
        title: '投票：好控制的标准',
        description: '收集学生对指标的直观认知。',
        config: {
          mode: 'play',
          config: {
            id: 'poll-judge-criteria',
            type: 'poll',
            question: '如果你是裁判，哪一项更能代表“好控制”？',
            options: [
              { key: 'A', text: '速度第一：上升时间越短越好', color: '#ef4444' },
              { key: 'B', text: '稳为王：超调量越小越好', color: '#f59e0b' },
              { key: 'C', text: '平衡：速度与稳定兼顾', color: '#22c55e' },
              { key: 'D', text: '精度：稳态误差趋近零', color: '#3b82f6' },
            ],
            multiSelect: false,
            anonymous: false,
            showLiveResults: true,
            timeLimit: 30,
          },
        },
      },
      {
        stage: 'OBJECTIVE',
        order: 1,
        registryId: 'classroom-objective',
        duration: 2,
        title: '指标裁判席 学习目标',
        description: '明确本节课的通关任务与评价标准。',
        config: {
          mode: 'play',
          config: {
            id: 'card-lesson-objectives',
            type: 'objective',
            title: '指标裁判席 学习目标',
            objectives: [
              {
                id: 'obj-1',
                type: 'knowledge',
                description: '掌握时域性能指标的定义与判读方法',
                badgeName: '指标读谱师',
                badgeIcon: 'LineChart',
                unlocked: false,
              },
              {
                id: 'obj-2',
                type: 'ability',
                description: '能够根据指标阈值给出判分结论',
                badgeName: '裁判助理',
                badgeIcon: 'ClipboardCheck',
                unlocked: false,
              },
              {
                id: 'obj-3',
                type: 'ability',
                description: '理解“稳定、准确、快速”的权衡',
                badgeName: '权衡大师',
                badgeIcon: 'Scale',
                unlocked: false,
              },
              {
                id: 'obj-4',
                type: 'value',
                description: '形成可解释、可复现的评价习惯',
                badgeName: '公平裁判',
                badgeIcon: 'ShieldCheck',
                unlocked: false,
              },
            ],
            showUnlockAnimation: true,
          },
        },
      },
      {
        stage: 'PRE_ASSESSMENT',
        order: 1,
        registryId: 'lesson06-metric-quick-check',
        duration: 5,
        title: '前测：指标速判',
        description: '识别上升时间、峰值时间、调节时间与超调量。',
        config: {},
      },
      {
        stage: 'PARTICIPATORY',
        order: 1,
        registryId: 'lesson06-metric-handbook',
        duration: 6,
        title: '指标裁判手册',
        description: '掌握时域性能指标的定义与判读方法。',
        config: {},
      },
      {
        stage: 'PARTICIPATORY',
        order: 2,
        registryId: 'lesson06-judge-bench',
        duration: 15,
        title: '裁判席计分器',
        description: '调节阻尼比与响应速度，挑战裁判标准。',
        config: {},
      },
      {
        stage: 'POST_ASSESSMENT',
        order: 1,
        registryId: 'classroom-assessment',
        duration: 3,
        title: '后测：参数提交',
        description: '提交控制参数，获得裁判评分与反馈。',
        config: {
          mode: 'play',
          config: {
            id: 'quiz-judge-assessment',
            type: 'assessment',
            title: '后测：指标达标挑战',
            description: '提交一组控制参数，让系统同时满足超调量与调节时间的裁判标准。',
            parameters: [
              { id: 'kp', name: '比例系数', symbol: 'Kp', min: 0, max: 5, step: 0.1, defaultValue: 1.2 },
              { id: 'ki', name: '积分系数', symbol: 'Ki', min: 0, max: 1, step: 0.05, defaultValue: 0.1 },
              { id: 'kd', name: '微分系数', symbol: 'Kd', min: 0, max: 2, step: 0.1, defaultValue: 0.4 },
            ],
            scoring: { baseScore: 100, msiWeight: 1.2, penaltyPerViolation: 8 },
          },
        },
      },
      {
        stage: 'SUMMARY',
        order: 1,
        registryId: 'classroom-ai-report',
        duration: 2,
        title: '总结：裁判席报告',
        description: 'AI 生成课堂数据报告与反馈。',
        config: {
          mode: 'play',
          config: {
            id: 'report-judge-summary',
            type: 'ai-report',
            title: '裁判席课堂报告',
            reportTemplate: `本节课共有 {totalStudents} 名同学参与评判训练，{completedStudents} 人完成全部挑战，完成率 {completionRate}%。\n\n班级平均得分 {averageScore} 分。典型短板集中在“调节时间过长”和“超调量偏大”。\n\n通过本节课的学习，同学们掌握了时域性能指标的定义、判读方法以及指标权衡原则。`,
            visualizations: ['bar', 'pie'],
            enableVoice: true,
            voiceScript: '',
          },
        },
      },
    ],
  },
  {
    key: 'cruise-comfort-v1',
    title: '柔性之海——豪华邮轮的舒适度控制',
    description: '基于爱达·魔都号邮轮的舒适度控制教学案例。',
    items: [
      {
        stage: 'BRIDGE_IN',
        order: 1,
        registryId: 'lesson13-cruise-bridge',
        duration: 2,
        title: '快艇 vs 邮轮：舒适度的天壤之别',
        description: '通过对比快艇与邮轮的乘坐体验，引发学生对\"舒适度控制\"的思考',
        config: {
          autoPlay: true,
          narration: '控制不仅是让机器动起来，更是为了\"人\"的尊严。在豪华邮轮上，乘客的舒适体验是控制系统设计的第一要务。',
        },
      },
      {
        stage: 'BRIDGE_IN',
        order: 2,
        registryId: 'classroom-poll',
        duration: 1,
        title: '邮轮控制最重要的标准是什么？',
        description: '收集学生对舒适度定义的初步认知',
        config: {
          mode: 'play',
          config: {
            id: 'poll-comfort-definition',
            type: 'poll',
            question: '你认为衡量豪华邮轮控制好坏的第一标准是什么？',
            options: [
              { key: 'A', text: '速度', color: '#3b82f6' },
              { key: 'B', text: '节能', color: '#10b981' },
              { key: 'C', text: '不晕船', color: '#f59e0b' },
              { key: 'D', text: '准点', color: '#ef4444' },
            ],
            multiSelect: false,
            anonymous: false,
            showLiveResults: true,
            timeLimit: 30,
          },
        },
      },
      {
        stage: 'OBJECTIVE',
        order: 1,
        registryId: 'classroom-objective',
        duration: 2,
        title: '本节课学习目标',
        description: '展示三层递进式通关任务',
        config: {
          mode: 'play',
          config: {
            id: 'objective-lesson-13',
            type: 'objective',
            title: '三层通关任务',
            objectives: [
              {
                id: 'obj-knowledge',
                type: 'knowledge',
                description: '理解阻尼系数与舒适度的关系，掌握超调量、调节时间与用户体验的映射',
                badgeName: '理论达人',
                badgeIcon: 'brain',
                unlocked: false,
              },
              {
                id: 'obj-ability',
                type: 'ability',
                description: '在多约束条件下完成台风避障挑战，使香槟塔保持稳定',
                badgeName: '风浪征服者',
                badgeIcon: 'zap',
                unlocked: false,
              },
              {
                id: 'obj-value',
                type: 'value',
                description: '在工程决策中将乘客安全置于效率之上，获得\"五星舒适度工程师\"徽章',
                badgeName: '五星舒适度工程师',
                badgeIcon: 'star',
                unlocked: false,
              },
            ],
            showUnlockAnimation: true,
          },
        },
      },
      {
        stage: 'PRE_ASSESSMENT',
        order: 1,
        registryId: 'lesson13-physics-builder-simple',
        duration: 5,
        title: '阻尼系数调节实验',
        description: '通过弹簧-质量-阻尼系统，理解阻尼与响应特性的关系',
        config: {
          initialDamping: 0.1,
          targetDampingRange: [0.6, 0.8],
          autoGrade: true,
        },
      },
      {
        stage: 'PARTICIPATORY',
        order: 1,
        registryId: 'lesson13-iso2631-mapping',
        duration: 5,
        title: 'ISO 2631 舒适度映射',
        description: '学习控制指标与用户体验后果的对应关系',
        config: {
          showHints: true,
          initialExpanded: 0,
        },
      },
      {
        stage: 'PARTICIPATORY',
        order: 2,
        registryId: 'lesson13-cruise-typhoon-sim',
        duration: 25,
        title: '香槟塔保卫战',
        description: '在台风避障场景中调节PID参数，保护香槟塔不倒',
        config: {
          embedded: true,
          showMissionPanel: true,
          showChampagnePIP: true,
          scenario: {
            name: '台风规避挑战',
            description: '爱达·魔都号前方2海里发现台风外围涌浪，需执行30°紧急转向。宴会厅正在举行晚宴，香槟塔不能倒！',
            initialHeading: 0,
            targetHeading: 30,
            seaState: 5,
            constraints: {
              maxLateralAccel: 0.15,
              ethicalThreshold: 0.2,
              maxTime: 120,
            },
          },
        },
      },
      {
        stage: 'POST_ASSESSMENT',
        order: 1,
        registryId: 'classroom-assessment',
        duration: 3,
        title: 'PID 参数评估',
        description: '提交最终PID参数，系统计算综合得分',
        config: {
          mode: 'play',
          config: {
            id: 'quiz-design-verify',
            type: 'assessment',
            title: '提交你的控制方案',
            description: '根据阻尼调节理解，提交一组 PID 参数并获取评分反馈。',
            parameters: [
              { id: 'kp', name: '比例系数', symbol: 'Kp', min: 0, max: 10, step: 0.1, defaultValue: 1.0 },
              { id: 'ki', name: '积分系数', symbol: 'Ki', min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
              { id: 'kd', name: '微分系数', symbol: 'Kd', min: 0, max: 5, step: 0.1, defaultValue: 0.5 },
            ],
            scoring: { baseScore: 100, msiWeight: 1.0, penaltyPerViolation: 10 },
          },
        },
      },
      {
        stage: 'SUMMARY',
        order: 1,
        registryId: 'classroom-ai-report',
        duration: 2,
        title: 'AI 课堂报告',
        description: 'AI 生成本节课的学习数据分析报告',
        config: {
          mode: 'play',
          config: {
            id: 'report-class-summary',
            type: 'ai-report',
            title: '课堂学习报告',
            reportTemplate: `本节课共有 {totalStudents} 名同学参与学习，{completedStudents} 人完成全部任务，完成率 {completionRate}%。\n\n班级平均得分 {averageScore} 分，伦理违规率 {violationRate}%。\n\n通过本节课的学习，同学们理解了控制系统性能指标与用户体验之间的映射关系，掌握了阻尼调节在舒适度控制中的关键作用。`,
            visualizations: ['bar', 'pie'],
            enableVoice: true,
            voiceScript: '',
          },
        },
      },
    ],
  },
];

async function upsertKnowledgeNodes() {
  for (const card of knowledgeCards) {
    const attachments = attachmentMap[card.id] || [];
    const tags = Array.from(new Set([...(card.applications || []), card.lessonId].filter(Boolean)));

    await prisma.knowledgeNode.upsert({
      where: { id: card.id },
      update: {
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        content: {
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
          explanation: card.explanation,
          applications: card.applications,
          lessonId: card.lessonId,
          phase: card.phase,
        },
        metadata: {
          lessonId: card.lessonId,
          phase: card.phase,
          explanation: card.explanation,
          applications: card.applications,
          prerequisites: card.prerequisites,
          relatedTopics: card.relatedTopics,
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
        },
        resources: attachments,
        tags,
        isActive: true,
      },
      create: {
        id: card.id,
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        content: {
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
          explanation: card.explanation,
          applications: card.applications,
          lessonId: card.lessonId,
          phase: card.phase,
        },
        metadata: {
          lessonId: card.lessonId,
          phase: card.phase,
          explanation: card.explanation,
          applications: card.applications,
          prerequisites: card.prerequisites,
          relatedTopics: card.relatedTopics,
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
        },
        resources: attachments,
        tags,
        isActive: true,
      },
    });
  }
}

async function upsertKnowledgeLinks() {
  let skipped = 0;
  for (const link of knowledgeLinks) {
    const [source, target] = await Promise.all([
      prisma.knowledgeNode.findUnique({ where: { id: link.sourceId }, select: { id: true } }),
      prisma.knowledgeNode.findUnique({ where: { id: link.targetId }, select: { id: true } }),
    ]);

    if (!source || !target) {
      skipped += 1;
      continue;
    }

    await prisma.knowledgeLink.upsert({
      where: {
        sourceId_targetId: {
          sourceId: link.sourceId,
          targetId: link.targetId,
        },
      },
      update: {
        relation: link.relation,
      },
      create: {
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: link.relation,
      },
    });
  }

  if (skipped > 0) {
    console.warn(`Skipped ${skipped} knowledge links due to missing nodes.`);
  }
}

async function upsertTeachingResources(authorId) {
  for (const resource of teachingResources) {
    const existing = await prisma.teachingResource.findFirst({
      where: { registryId: resource.registryId },
      select: { id: true },
    });

    if (existing) {
      await prisma.teachingResource.update({
        where: { id: existing.id },
        data: {
          title: resource.title,
          description: resource.description,
          type: resource.type,
          registryId: resource.registryId,
          config: resource.config || {},
          authorId,
          ...(resource.displayName ? { displayName: resource.displayName } : {}),
          ...(resource.category ? { category: resource.category } : {}),
          ...(typeof resource.displayOrder === 'number' ? { displayOrder: resource.displayOrder } : {}),
          ...(typeof resource.teacherOnly === 'boolean' ? { teacherOnly: resource.teacherOnly } : {}),
        },
      });
    } else {
      await prisma.teachingResource.create({
        data: {
          title: resource.title,
          description: resource.description,
          type: resource.type,
          registryId: resource.registryId,
          config: resource.config || {},
          authorId,
          ...(resource.displayName ? { displayName: resource.displayName } : {}),
          ...(resource.category ? { category: resource.category } : {}),
          ...(typeof resource.displayOrder === 'number' ? { displayOrder: resource.displayOrder } : {}),
          ...(typeof resource.teacherOnly === 'boolean' ? { teacherOnly: resource.teacherOnly } : {}),
        },
      });
    }
  }
}

async function upsertPresetLessonPlans(authorId) {
  for (const preset of presetLessonPlans) {
    const itemsToCreate = [];

    for (const item of preset.items) {
      const resource = await prisma.teachingResource.findFirst({
        where: { registryId: item.registryId },
        select: { id: true },
      });

      if (!resource) {
        console.warn(`Preset lesson item skipped: missing resource ${item.registryId}`);
        continue;
      }

      itemsToCreate.push({
        itemType: LessonItemType.RESOURCE,
        resourceId: resource.id,
        stage: item.stage,
        order: item.order,
        duration: item.duration,
        overrideConfig: {
          titleOverride: item.title,
          descriptionOverride: item.description,
          ...(item.config || {}),
        },
      });
    }

    const existing = await prisma.lessonPlan.findUnique({
      where: { presetKey: preset.key },
      select: { id: true },
    });

    if (existing) {
      await prisma.lessonItem.deleteMany({ where: { planId: existing.id } });
      await prisma.lessonPlan.update({
        where: { id: existing.id },
        data: {
          title: preset.title,
          description: preset.description,
          authorId,
          isPreset: true,
          isPublic: true,
          presetKey: preset.key,
          items: { create: itemsToCreate },
        },
      });
    } else {
      await prisma.lessonPlan.create({
        data: {
          title: preset.title,
          description: preset.description,
          authorId,
          isPreset: true,
          isPublic: true,
          presetKey: preset.key,
          items: { create: itemsToCreate },
        },
      });
    }
  }
}

async function main() {
  const author = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!author) {
    console.error('No user found. Please seed at least one user before running this script.');
    process.exit(1);
  }

  await upsertKnowledgeNodes();
  await upsertKnowledgeLinks();
  await upsertTeachingResources(author.id);
  await upsertPresetLessonPlans(author.id);

  console.log('Legacy knowledge cards and teaching resources synced.');
}

main()
  .catch((error) => {
    console.error('Failed to seed legacy content:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
