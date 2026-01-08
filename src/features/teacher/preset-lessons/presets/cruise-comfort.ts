/**
 * 预置教案：柔性之海——豪华邮轮的舒适度控制
 *
 * 基于 BOPPPS 教学框架设计的 45 分钟完整教学流程
 * 主题：多约束条件下的 PID 参数设计
 */

import type { PresetLessonConfig } from '../types';

export const CRUISE_COMFORT_PRESET: PresetLessonConfig = {
  key: 'cruise-comfort-v1',
  title: '柔性之海——豪华邮轮的舒适度控制',
  description:
    '基于爱达·魔都号邮轮的舒适度控制教学案例。学生将学习在多约束条件下（速度 vs 舒适）设计 PID 控制器，理解工程伦理在控制系统设计中的重要性。',
  totalDuration: 45,
  thumbnail: '/images/presets/cruise-comfort.jpg',
  tags: ['时域分析', '系统校正', '工程伦理', 'PID控制'],
  items: [
    // ==================== Stage 1: Bridge-in (导入) - 3分钟 ====================
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'lesson13-cruise-bridge',
      duration: 2,
      title: '快艇 vs 邮轮：舒适度的天壤之别',
      description: '通过对比快艇与邮轮的乘坐体验，引发学生对"舒适度控制"的思考',
      config: {
        autoPlay: true,
        narration: '控制不仅是让机器动起来，更是为了"人"的尊严。在豪华邮轮上，乘客的舒适体验是控制系统设计的第一要务。',
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
        question: '你认为衡量豪华邮轮控制好坏的第一标准是什么？',
        options: [
          { key: 'A', text: '速度', color: '#3b82f6' },
          { key: 'B', text: '节能', color: '#10b981' },
          { key: 'C', text: '不晕船', color: '#f59e0b' },
          { key: 'D', text: '准点', color: '#ef4444' },
        ],
        showLiveResults: true,
        timeLimit: 30,
      },
    },

    // ==================== Stage 2: Objective (目标) - 2分钟 ====================
    {
      stage: 'OBJECTIVE',
      order: 1,
      registryId: 'classroom-objective',
      duration: 2,
      title: '本节课学习目标',
      description: '展示三层递进式通关任务',
      config: {
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
            description: '在工程决策中将乘客安全置于效率之上，获得"五星舒适度工程师"徽章',
            badgeName: '五星舒适度工程师',
            badgeIcon: 'star',
            unlocked: false,
          },
        ],
      },
    },

    // ==================== Stage 3: Pre-assessment (前测) - 5分钟 ====================
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
        showFormula: true,
        autoGrade: true,
      },
    },

    // ==================== Stage 4: Participatory (参与式学习) - 30分钟 ====================
    {
      stage: 'PARTICIPATORY',
      order: 1,
      registryId: 'lesson13-iso2631-mapping',
      duration: 5,
      title: 'ISO 2631 舒适度映射',
      description: '学习控制指标与用户体验后果的对应关系',
      config: {
        showAIExplanation: true,
        interactiveCards: true,
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
            maxLateralAccel: 0.15, // 最大侧向加速度 0.15g
            ethicalThreshold: 0.2, // 伦理熔断阈值 0.2g
            maxTime: 120, // 最大时间 120秒
          },
        },
      },
    },

    // ==================== Stage 5: Post-assessment (后测) - 3分钟 ====================
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'classroom-assessment',
      duration: 3,
      title: 'PID 参数评估',
      description: '提交最终PID参数，系统计算综合得分',
      config: {
        title: '提交你的控制方案',
        parameters: [
          { id: 'kp', label: '比例系数 Kp', min: 0, max: 10, step: 0.1, unit: '' },
          { id: 'ki', label: '积分系数 Ki', min: 0, max: 1, step: 0.01, unit: '' },
          { id: 'kd', label: '微分系数 Kd', min: 0, max: 5, step: 0.1, unit: '' },
        ],
        scoringFormula: 'Score = 100 / (1 + MSI) - Penalty × N_fail',
        weights: {
          msi: 0.5,
          settlingTime: 0.3,
          violations: 0.2,
        },
      },
    },

    // ==================== Stage 6: Summary (总结) - 2分钟 ====================
    {
      stage: 'SUMMARY',
      order: 1,
      registryId: 'classroom-ai-report',
      duration: 2,
      title: 'AI 课堂报告',
      description: 'AI 生成本节课的学习数据分析报告',
      config: {
        reportTemplate: `本节课全班 {{studentCount}} 人参与学习。
共有 {{violationCount}} 人触发了伦理熔断，主要原因是过度追求响应速度。
经过调整，{{successRate}}% 的同学成功保住了香槟塔。
表现最佳的是 {{topPerformer}}，采用了高阻尼策略。
全班平均晕船指数 MSI = {{avgMSI}}。`,
        visualizations: ['scatter', 'bar'],
        voiceEnabled: true,
      },
    },
  ],
};

/**
 * 所有预置教案列表
 */
export const ALL_PRESETS: PresetLessonConfig[] = [CRUISE_COMFORT_PRESET];
