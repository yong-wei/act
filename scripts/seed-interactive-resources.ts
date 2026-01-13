/**
 * 种子脚本：注册所有互动学习组件到数据库
 *
 * 运行命令：npx ts-node scripts/seed-interactive-resources.ts
 */

import { PrismaClient, ResourceType, InteractiveCategory } from '@prisma/client';

const prisma = new PrismaClient();

// 互动学习组件数据
const INTERACTIVE_RESOURCES = [
  // ===== 系统建模 =====
  {
    registryId: 'widget-physics-mech',
    title: '机械系统建模',
    displayName: '机械系统建模',
    description: '通过拖拽构建弹簧-质量-阻尼系统，理解机械系统动力学建模',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 1,
  },
  {
    registryId: 'widget-physics-elec',
    title: '电气系统建模',
    displayName: '电气系统建模',
    description: '构建RLC电路，理解电气系统与机械系统的类比关系',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 2,
  },
  {
    registryId: 'widget-analogy-mapper',
    title: '机电类比映射',
    displayName: '机电类比映射',
    description: '探索机械系统与电气系统之间的对偶关系',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 3,
  },
  {
    registryId: 'physics-modeling-intro-v1',
    title: '物理建模导论',
    displayName: '物理建模导论',
    description: '理解为什么需要数学建模，以及建模的基本方法',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 4,
  },
  // Lesson-02 阶段组件
  {
    registryId: 'lesson02-bridge-v1',
    title: '课程导入：驱逐舰转向',
    displayName: '课程导入：驱逐舰转向',
    description: 'Lesson-02 导入阶段，通过驱逐舰转向场景引入机理建模',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 5,
  },
  {
    registryId: 'lesson02-objective-v1',
    title: '学习目标展示',
    displayName: '学习目标展示',
    description: 'Lesson-02 目标阶段，展示机理建模学习目标',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 6,
  },
  {
    registryId: 'lesson02-pretest-v1',
    title: '前测：建模基础',
    displayName: '前测：建模基础',
    description: 'Lesson-02 前测阶段，检验机理建模先验知识',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 7,
  },
  {
    registryId: 'lesson02-mechanical-v1',
    title: '机械系统机理建模',
    displayName: '机械系统机理建模',
    description: 'Lesson-02 机械系统建模交互学习',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 8,
  },
  {
    registryId: 'lesson02-electrical-v1',
    title: '电气系统机理建模',
    displayName: '电气系统机理建模',
    description: 'Lesson-02 电气系统建模交互学习',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 9,
  },
  {
    registryId: 'lesson02-analogy-v1',
    title: '机电系统类比',
    displayName: '机电系统类比',
    description: 'Lesson-02 机电类比映射交互学习',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 10,
  },
  {
    registryId: 'lesson02-posttest-v1',
    title: '后测：建模验证',
    displayName: '后测：建模验证',
    description: 'Lesson-02 后测阶段，验证机理建模学习成果',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 11,
  },
  {
    registryId: 'lesson02-summary-v1',
    title: '课程总结',
    displayName: '课程总结',
    description: 'Lesson-02 总结阶段，回顾机理建模核心概念',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 12,
  },
  // physics-modeling 阶段组件
  {
    registryId: 'physics-modeling-mechanical-v1',
    title: '机械系统物理建模',
    displayName: '机械系统物理建模',
    description: '深入学习机械系统的物理建模方法',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 13,
  },
  {
    registryId: 'physics-modeling-electrical-v1',
    title: '电气系统物理建模',
    displayName: '电气系统物理建模',
    description: '深入学习电气系统的物理建模方法',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 14,
  },
  {
    registryId: 'physics-modeling-analogy-v1',
    title: '机电类比物理建模',
    displayName: '机电类比物理建模',
    description: '理解机电系统类比的物理本质',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 15,
  },
  {
    registryId: 'physics-modeling-practice-v1',
    title: '物理建模实践',
    displayName: '物理建模实践',
    description: '综合运用物理建模方法解决实际问题',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 16,
  },

  // ===== 时域分析 =====
  {
    registryId: 'lesson13-physics-builder-simple',
    title: '阻尼调节实验',
    displayName: '阻尼调节实验',
    description: '通过弹簧-阻尼-质量系统理解阻尼比对系统响应的影响',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 1,
  },
  {
    registryId: 'lesson13-iso2631-mapping',
    title: 'ISO 2631 舒适度映射',
    displayName: 'ISO 2631 舒适度映射',
    description: '理解控制指标与乘客舒适度之间的映射关系',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 2,
  },
  {
    registryId: 'lesson07-damping-quick-check',
    title: '欠阻尼速判',
    displayName: '欠阻尼速判',
    description: '通过快速测验确认二阶系统标准型与欠阻尼判据',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 3,
  },
  {
    registryId: 'lesson07-second-order-theory',
    title: '二阶系统标准型知识卡',
    displayName: '二阶系统标准型知识卡',
    description: '系统梳理标准型、极点关系与性能指标公式',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 4,
  },
  {
    registryId: 'lesson07-response-explorer',
    title: '衰减振荡实验室',
    displayName: '衰减振荡实验室',
    description: '拖动阻尼比与自然频率观察阶跃响应变化',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 5,
  },
  {
    registryId: 'lesson07-parameter-challenge',
    title: '参数匹配挑战',
    displayName: '参数匹配挑战',
    description: '根据目标超调与调节时间完成参数匹配挑战',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 6,
  },
  {
    registryId: 'lesson07-summary-card',
    title: '课程总结',
    displayName: '课程总结',
    description: '复盘欠阻尼二阶系统的关键指标与课后思考',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 7,
  },
  {
    registryId: 'lesson08-stability-precheck',
    title: '稳定与误差前测',
    displayName: '稳定与误差前测',
    description: '检测稳定性判据与稳态误差基础概念掌握情况',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 8,
  },
  {
    registryId: 'lesson08-routh-guide',
    title: '劳斯判据速览',
    displayName: '劳斯判据速览',
    description: '梳理劳斯判据与劳斯表构造流程',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 9,
  },
  {
    registryId: 'lesson08-routh-practice',
    title: '劳斯判据练习',
    displayName: '劳斯判据练习',
    description: '通过典型例题判断系统稳定性',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 10,
  },
  {
    registryId: 'lesson08-steady-error-deck',
    title: '稳态误差知识卡',
    displayName: '稳态误差知识卡',
    description: '掌握终值定理、静态误差系数与系统型别关系',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 11,
  },
  {
    registryId: 'lesson08-post-quiz',
    title: '稳定与误差后测',
    displayName: '稳定与误差后测',
    description: '综合检验稳定性与稳态误差分析能力',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 12,
  },
  {
    registryId: 'lesson08-summary-card',
    title: '课程总结',
    displayName: '课程总结',
    description: '总结稳定判据与稳态误差的关键结论',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 13,
  },

  // ===== 根轨迹分析 =====
  {
    registryId: 'widget-argument-principle',
    title: '论证原理可视化',
    displayName: '论证原理可视化',
    description: '在复平面上探索闭环极点与系统稳定性的关系',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 1,
  },
  {
    registryId: 'lesson10-root-locus-workshop',
    title: '根轨迹规则工作坊',
    displayName: '根轨迹规则工作坊',
    description: '通过规则速判与细节修正练习掌握根轨迹绘制要点',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 2,
  },

  // ===== 频域分析 =====
  {
    registryId: 'lesson12-frequency-precheck',
    title: '频率响应速判',
    displayName: '频率响应速判',
    description: '快速检测频率响应与对数坐标基础概念',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 1,
  },
  {
    registryId: 'lesson12-bode-step-sorter',
    title: '伯德图绘制步骤',
    displayName: '伯德图绘制步骤',
    description: '梳理伯德图绘制流程与顺序',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 2,
  },
  {
    registryId: 'lesson12-bode-slope-puzzle',
    title: '斜率叠加拼图',
    displayName: '斜率叠加拼图',
    description: '拖拽斜率卡片完成转折频率分段叠加',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 3,
  },
  {
    registryId: 'lesson12-bode-plot-recognition',
    title: '伯德图识别练习',
    displayName: '伯德图识别练习',
    description: '根据幅频曲线识别典型环节与共振峰',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 4,
  },
  {
    registryId: 'lesson12-bode-post-quiz',
    title: '伯德图后测',
    displayName: '伯德图后测',
    description: '复盘绘图步骤与斜率叠加关键点',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 5,
  },
  {
    registryId: 'lesson12-summary-card',
    title: '课程总结',
    displayName: '课程总结',
    description: '总结频率响应与伯德图核心结论',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 6,
  },

  // ===== 系统校正 =====
  {
    registryId: 'sim-pid-v1',
    title: 'PID参数整定仿真',
    displayName: 'PID参数整定仿真',
    description: '实时调节PID参数，观察船舶航向控制响应',
    type: ResourceType.SIMULATION_APP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 1,
  },
  {
    registryId: 'lesson13-cruise-typhoon-sim',
    title: '香槟塔保卫战',
    displayName: '香槟塔保卫战',
    description: '在台风避障场景中完成30°紧急转向，保护香槟塔不倒',
    type: ResourceType.SIMULATION_APP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 2,
  },
  {
    registryId: 'lesson09-correction-precheck',
    title: '校正前测',
    displayName: '校正前测',
    description: '快速检验 PD、输出反馈与补偿基础概念',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 3,
  },
  {
    registryId: 'lesson09-correction-strategy',
    title: '校正手段速览',
    displayName: '校正手段速览',
    description: '对比串联校正、输出反馈、前馈与扰动补偿',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 4,
  },
  {
    registryId: 'lesson09-time-domain-synthesis',
    title: '时域综合流程',
    displayName: '时域综合流程',
    description: '梳理稳定范围、误差与扰动响应的分析步骤',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 5,
  },
  {
    registryId: 'lesson09-summary-card',
    title: '课程总结',
    displayName: '课程总结',
    description: '复盘校正与时域综合的关键结论',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 6,
  },

  // ===== 非线性 =====
  {
    registryId: 'ethics-arctic-v1',
    title: '北极航行伦理决策',
    displayName: '北极航行伦理决策',
    description: '在北极冰区航行场景中做出控制系统伦理决策',
    type: ResourceType.ETHICS_SCENARIO,
    category: InteractiveCategory.NONLINEAR,
    displayOrder: 1,
  },

  // ===== 趣味探索 =====
  {
    registryId: 'control-odyssey-v1',
    title: 'Control Odyssey: 穿越误差带',
    displayName: 'Control Odyssey: 穿越误差带',
    description: '通过游戏化方式体验比例控制、系统惯性与误差带限制，穿越控制系统的"奥德赛"之旅。',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FUN_EXPLORATION,
    displayOrder: 1,
  },
  {
    registryId: 'ten-drops-game-v1',
    title: '十滴水益智游戏',
    displayName: '十滴水益智游戏',
    description: '经典的逻辑消除游戏，培养多步预测与连锁反应思维。',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.FUN_EXPLORATION,
    displayOrder: 2,
  },
];

const STATIC_MEDIA_RESOURCES = [
  {
    registryId: 'lesson07-static-classification',
    title: '二阶系统传递函数与分类',
    displayName: '二阶系统传递函数与分类',
    description: '展示二阶系统标准型与阻尼分类要点',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 8,
    content: '/assets/lesson-07/second-order-classification.svg',
  },
  {
    registryId: 'lesson07-static-step-response',
    title: '单位阶跃响应与指标',
    displayName: '单位阶跃响应与指标',
    description: '展示超调量、峰值时间与调节时间定义',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 9,
    content: '/assets/lesson-07/step-response-metrics.svg',
  },
  {
    registryId: 'lesson08-static-roadmap',
    title: '课程路线图：稳定与稳态误差',
    displayName: '课程路线图：稳定与稳态误差',
    description: '展示稳定判据与稳态误差两条学习主线',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 10,
    content: '/assets/lesson-08/roadmap-stability-accuracy.svg',
  },
  {
    registryId: 'lesson08-static-stability-concept',
    title: '稳定性的概念与充要条件',
    displayName: '稳定性的概念与充要条件',
    description: '用极点位置解释稳定、临界稳定与不稳定',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 11,
    content: '/assets/lesson-08/stability-concept.svg',
  },
  {
    registryId: 'lesson08-static-routh-table',
    title: '劳斯表构造与判别步骤',
    displayName: '劳斯表构造与判别步骤',
    description: '总结劳斯表构造与符号判别流程',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 12,
    content: '/assets/lesson-08/routh-table-guide.svg',
  },
  {
    registryId: 'lesson08-static-error-flow',
    title: '稳态误差计算流程',
    displayName: '稳态误差计算流程',
    description: '从误差来源到终值定理的计算流程',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.TIME_DOMAIN,
    displayOrder: 13,
    content: '/assets/lesson-08/steady-error-flow.svg',
  },
  {
    registryId: 'lesson09-static-roadmap',
    title: '课程路线图：校正与时域综合',
    displayName: '课程路线图：校正与时域综合',
    description: '展示校正方法与时域综合分析的双主线',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 3,
    content: '/assets/lesson-09/roadmap-correction-time-domain.svg',
  },
  {
    registryId: 'lesson09-static-pd-feedback',
    title: '比例-微分控制 vs 输出微分反馈',
    displayName: '比例-微分控制 vs 输出微分反馈',
    description: '对比两种增阻尼方式的零点与响应差异',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 4,
    content: '/assets/lesson-09/pd-vs-feedback.svg',
  },
  {
    registryId: 'lesson09-static-feedforward-disturbance',
    title: '前馈补偿与扰动补偿',
    displayName: '前馈补偿与扰动补偿',
    description: '比较输入补偿与扰动补偿的作用路径',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 5,
    content: '/assets/lesson-09/feedforward-disturbance.svg',
  },
  {
    registryId: 'lesson09-static-time-domain-workflow',
    title: '航向系统时域综合流程',
    displayName: '航向系统时域综合流程',
    description: '从稳定性到场景性能的时域综合步骤',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.SYSTEM_CORRECTION,
    displayOrder: 6,
    content: '/assets/lesson-09/time-domain-workflow.svg',
  },
  {
    registryId: 'lesson10-static-roadmap',
    title: '课程路线图：根轨迹法',
    displayName: '课程路线图：根轨迹法',
    description: '展示根轨迹法从大局到细节的学习主线',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 3,
    content: '/assets/lesson-10/root-locus-roadmap.svg',
  },
  {
    registryId: 'lesson10-static-conditions',
    title: '根轨迹条件：模值与相角',
    displayName: '根轨迹条件：模值与相角',
    description: '梳理根轨迹的模值条件与相角条件',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 4,
    content: '/assets/lesson-10/root-locus-conditions.svg',
  },
  {
    registryId: 'lesson10-static-rules',
    title: '根轨迹基本法则',
    displayName: '根轨迹基本法则',
    description: '实轴段、渐近线与分离点等绘制规则总览',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 5,
    content: '/assets/lesson-10/root-locus-rules.svg',
  },
  {
    registryId: 'lesson10-static-detail-corrections',
    title: '根轨迹细节修正',
    displayName: '根轨迹细节修正',
    description: '出射/入射角、虚轴交点与参数修正提示',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.ROOT_LOCUS,
    displayOrder: 6,
    content: '/assets/lesson-10/root-locus-detail-corrections.svg',
  },
  {
    registryId: 'lesson12-static-roadmap',
    title: '课程路线图：频率特性与伯德图',
    displayName: '课程路线图：频率特性与伯德图',
    description: '展示频率响应与伯德图绘制的学习主线',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 1,
    content: '/assets/lesson-12/roadmap-frequency-bode.svg',
  },
  {
    registryId: 'lesson12-static-frequency-response',
    title: '频率响应定义',
    displayName: '频率响应定义',
    description: '正弦稳态响应下的幅值与相位关系',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 2,
    content: '/assets/lesson-12/frequency-response-overview.svg',
  },
  {
    registryId: 'lesson12-static-bode-steps',
    title: '伯德图绘制步骤',
    displayName: '伯德图绘制步骤',
    description: '近似叠加绘图流程与斜率变化示意',
    type: ResourceType.STATIC_MEDIA,
    category: InteractiveCategory.FREQUENCY_DOMAIN,
    displayOrder: 3,
    content: '/assets/lesson-12/bode-steps-overlay.svg',
  },
];

// 课堂组件数据（教师专用）
const CLASSROOM_RESOURCES = [
  {
    registryId: 'classroom-video',
    title: '视频播放组件',
    displayName: '视频播放组件',
    description: '播放教学视频，支持分屏对比和AI旁白',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 1,
  },
  {
    registryId: 'classroom-poll',
    title: '课堂投票组件',
    displayName: '课堂投票组件',
    description: '实时投票，自动统计并展示结果',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 2,
  },
  {
    registryId: 'classroom-objective',
    title: '学习目标展示',
    displayName: '学习目标展示',
    description: '展示课程目标和徽章解锁状态',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 3,
  },
  {
    registryId: 'classroom-assessment',
    title: '后测评估探针',
    displayName: '后测评估探针',
    description: '收集学生参数设计，运行仿真评分',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 4,
  },
  {
    registryId: 'classroom-ethical-trigger',
    title: '伦理熔断触发器',
    displayName: '伦理熔断触发器',
    description: '监测违规行为，触发全屏警告和整改问答',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 5,
  },
  {
    registryId: 'classroom-ai-report',
    title: 'AI动态报告',
    displayName: 'AI动态报告',
    description: 'AI生成课堂总结报告，展示班级数据可视化',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.CLASSROOM,
    teacherOnly: true,
    displayOrder: 6,
  },
];

async function main() {
  console.log('🌱 开始注册互动学习组件...\n');

  // 获取或创建系统用户作为资源作者
  let systemUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!systemUser) {
    console.log('⚠️ 未找到管理员用户，创建系统用户...');
    systemUser = await prisma.user.create({
      data: {
        name: '系统',
        email: 'system@act.just.edu.cn',
        role: 'ADMIN',
      }
    });
  }

  const authorId = systemUser.id;

  // 注册互动学习组件
  console.log('📦 注册互动学习组件...');
  for (const resource of INTERACTIVE_RESOURCES) {
    console.log(`  - ${resource.displayName}`);

    await prisma.teachingResource.upsert({
      where: {
        // 使用 registryId 作为唯一标识
        id: resource.registryId
      },
      update: {
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        teacherOnly: false,
      },
      create: {
        id: resource.registryId,
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        teacherOnly: false,
        authorId: authorId,
      }
    });
  }

  console.log(`\n✅ 已注册 ${INTERACTIVE_RESOURCES.length} 个互动学习组件`);

  console.log('\n🖼️ 注册静态媒体资源...');
  for (const resource of STATIC_MEDIA_RESOURCES) {
    console.log(`  - ${resource.displayName}`);

    await prisma.teachingResource.upsert({
      where: {
        id: resource.registryId
      },
      update: {
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        content: resource.content,
        teacherOnly: false,
      },
      create: {
        id: resource.registryId,
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        content: resource.content,
        teacherOnly: false,
        authorId: authorId,
      }
    });
  }

  console.log(`\n✅ 已注册 ${STATIC_MEDIA_RESOURCES.length} 个静态媒体资源`);

  // 注册课堂组件
  console.log('\n📦 注册课堂组件（教师专用）...');
  for (const resource of CLASSROOM_RESOURCES) {
    console.log(`  - ${resource.displayName}`);

    await prisma.teachingResource.upsert({
      where: {
        id: resource.registryId
      },
      update: {
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        teacherOnly: true,
      },
      create: {
        id: resource.registryId,
        title: resource.title,
        displayName: resource.displayName,
        description: resource.description,
        type: resource.type,
        category: resource.category,
        displayOrder: resource.displayOrder,
        registryId: resource.registryId,
        teacherOnly: true,
        authorId: authorId,
      }
    });
  }

  console.log(`\n✅ 已注册 ${CLASSROOM_RESOURCES.length} 个课堂组件`);

  // 统计信息
  const stats = await prisma.teachingResource.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log('\n📊 组件分类统计:');
  const categoryLabels: Record<string, string> = {
    SYSTEM_MODELING: '系统建模',
    TIME_DOMAIN: '时域分析',
    ROOT_LOCUS: '根轨迹分析',
    FREQUENCY_DOMAIN: '频域分析',
    SYSTEM_CORRECTION: '系统校正',
    NONLINEAR: '非线性',
    CLASSROOM: '课堂组件',
  };

  for (const stat of stats) {
    if (stat.category) {
      console.log(`  - ${categoryLabels[stat.category] || stat.category}: ${stat._count} 个`);
    }
  }

  console.log('\n🎉 组件注册完成!');
}

main()
  .catch((e) => {
    console.error('❌ 注册失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
