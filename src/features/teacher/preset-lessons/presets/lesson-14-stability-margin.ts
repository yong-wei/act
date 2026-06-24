/**
 * 预置教案：Lesson 14 - 稳定裕度与三频段
 *
 * 基于 BOPPPS 教学框架设计的 90 分钟线下课堂流程
 */

import { ResourceType } from '@prisma/client';
import type { PresetLessonConfig } from '../types';

export const LESSON_14_STABILITY_MARGIN_PRESET: PresetLessonConfig = {
  key: 'lesson-14-stability-margin-v1',
  title: '稳定裕度与三频段：宽备窄用',
  description: '围绕相角/幅值裕度与三频段分工，建立频域性能评估与结构调整思路。',
  totalDuration: 90,
  thumbnail: '/images/presets/lesson-14-stability-margin.svg',
  tags: ['稳定裕度', '相角裕度', '幅值裕度', '三频段', '穿越频率', '带宽'],
  items: [
    // ==================== Stage 1: Bridge-in (导入) - 10分钟 ====================
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '导入：系统有多稳？',
      description: '引出“稳定裕度”与频域判稳问题。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-14-intro',
          type: 'video',
          title: '导入：系统有多稳？',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-14/margin-intro.svg',
          splitMode: 'none',
          narration: '稳定不是非黑即白，我们更关心离失稳还有多远。',
          description: '从稳定裕度切入频域性能评估。',
          autoPlay: false,
          autoAdvance: false,
        },
      },
    },
    {
      stage: 'BRIDGE_IN',
      order: 2,
      registryId: 'classroom-poll',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 6,
      title: '投票：最能代表“稳定储备”的指标？',
      description: '了解学生对稳定裕度的直觉理解。',
      config: {
        mode: 'play',
        config: {
          id: 'poll-lesson-14-margin',
          type: 'poll',
          question: '你认为最能代表系统稳定储备的是？',
          options: [
            { key: 'A', text: '相角裕度', color: '#f59e0b' },
            { key: 'B', text: '幅值裕度', color: '#22c55e' },
            { key: 'C', text: '闭环带宽', color: '#38bdf8' },
            { key: 'D', text: '稳态误差', color: '#a855f7' },
          ],
          multiSelect: false,
          anonymous: false,
          showLiveResults: true,
          timeLimit: 45,
        },
      },
    },

    // ==================== Stage 2: Objective (目标) - 8分钟 ====================
    {
      stage: 'OBJECTIVE',
      order: 1,
      registryId: 'classroom-objective',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '本节课学习目标',
      description: '明确稳定裕度与三频段的核心能力。',
      config: {
        mode: 'play',
        config: {
          id: 'objective-lesson-14',
          type: 'objective',
          title: '稳定裕度与三频段 学习目标',
          objectives: [
            {
              id: 'obj-1',
              type: 'knowledge',
              description: '解释稳定裕度的物理含义与两类指标',
              badgeName: '裕度观察员',
              badgeIcon: 'shield',
              unlocked: false,
            },
            {
              id: 'obj-2',
              type: 'ability',
              description: '在 Bode 图上估算相角/幅值裕度',
              badgeName: '穿越频率猎手',
              badgeIcon: 'target',
              unlocked: false,
            },
            {
              id: 'obj-3',
              type: 'ability',
              description: '掌握三频段分工与性能指标映射',
              badgeName: '频段指挥官',
              badgeIcon: 'radar',
              unlocked: false,
            },
            {
              id: 'obj-4',
              type: 'value',
              description: '理解“宽备窄用”的频域设计思维',
              badgeName: '频域调度师',
              badgeIcon: 'sparkles',
              unlocked: false,
            },
          ],
          showUnlockAnimation: true,
        },
      },
    },
    {
      stage: 'OBJECTIVE',
      order: 2,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '课程路线图：裕度评估 → 三频段分工',
      description: '梳理频域评估与结构调整的主线逻辑。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-14-roadmap',
          type: 'video',
          title: '课程路线图',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-14/three-band-roadmap.svg',
          splitMode: 'none',
          narration: '先学会算裕度，再理解低中高频各司其职。',
          description: '明确关键步骤与能力目标。',
          autoPlay: false,
          autoAdvance: false,
        },
      },
    },

    // ==================== Stage 3: Pre-assessment (前测) - 10分钟 ====================
    {
      stage: 'PRE_ASSESSMENT',
      order: 1,
      registryId: 'lesson14-margin-quick-check',
      duration: 10,
      title: '前测：稳定裕度速判',
      description: '快速检查裕度与三频段概念掌握。',
      config: {},
    },

    // ==================== Stage 4: Participatory (参与式学习) - 50分钟 ====================
    {
      stage: 'PARTICIPATORY',
      order: 1,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '稳定裕度_5_bfd54f1c',
      duration: 1,
      title: '知识卡片：稳定裕度定义',
      description: '理解稳定裕度的物理含义。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 2,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '相角裕度_5_5a74b451',
      duration: 1,
      title: '知识卡片：相角裕度',
      description: '掌握相角裕度的计算位置。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 3,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '幅值裕度_5_73af26a5',
      duration: 1,
      title: '知识卡片：幅值裕度',
      description: '掌握幅值裕度的计算位置。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 4,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '稳定裕度_5_bfd54f1c',
      duration: 1,
      title: '知识卡片：Bode 图估算裕度',
      description: '理解穿越频率与裕度的关系。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 5,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '三频段闭环性能回读_3_38003',
      duration: 1,
      title: '知识卡片：三频段理论',
      description: '明确低中高频段的分工。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 6,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '稳态误差_3_c0207063',
      duration: 1,
      title: '知识卡片：低频段与稳态误差',
      description: '理解低频增益与稳态误差关系。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 7,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '三频段闭环性能回读_3_38003',
      duration: 1,
      title: '知识卡片：中频段与动态性能',
      description: '理解中频段对超调与调节时间的影响。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 8,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '三频段闭环性能回读_3_38003',
      duration: 1,
      title: '知识卡片：高频段与抗噪鲁棒性',
      description: '理解高频衰减与噪声抑制关系。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 9,
      registryId: 'lesson14-margin-knowledge-deck',
      duration: 12,
      title: '知识卡片：稳定裕度与三频段',
      description: '用互动卡片复盘裕度与频段分工。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 10,
      registryId: 'lesson14-margin-tradeoff-lab',
      duration: 12,
      title: '参与式学习：稳定裕度策略实验室',
      description: '为不同任务设定相角/幅值裕度目标。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 11,
      registryId: 'lesson14-three-band-studio',
      duration: 10,
      title: '参与式学习：三频段调优工作台',
      description: '低/中/高频段分配，匹配性能诉求。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 12,
      registryId: 'lesson12-bode-plot-recognition',
      duration: 8,
      title: '复用：伯德图判读',
      description: '用幅频曲线识别穿越点与裕度估算。',
      config: {},
    },

    // ==================== Stage 5: Post-assessment (后测) - 8分钟 ====================
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'lesson14-margin-exit-quiz',
      duration: 8,
      title: '后测：裕度与三频段测验',
      description: '复盘稳定裕度与三频段核心概念。',
      config: {},
    },

    // ==================== Stage 6: Summary (总结) - 4分钟 ====================
    {
      stage: 'SUMMARY',
      order: 1,
      registryId: 'lesson14-summary-card',
      duration: 4,
      title: '课程总结',
      description: '回顾稳定裕度与三频段的设计逻辑。',
      config: {},
    },
  ],
};

export default LESSON_14_STABILITY_MARGIN_PRESET;
