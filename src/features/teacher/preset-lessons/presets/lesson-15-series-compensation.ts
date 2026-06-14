/**
 * 预置教案：Lesson 15 - 串联校正与滞后超前
 *
 * 基于 BOPPPS 教学框架设计的 90 分钟线下课堂流程
 */

import { ResourceType } from '@prisma/client';
import type { PresetLessonConfig } from '../types';

export const LESSON_15_SERIES_COMPENSATION_PRESET: PresetLessonConfig = {
  key: 'lesson-15-series-compensation-v1',
  title: '串联校正与滞后超前：双管齐下',
  description: '围绕超前、滞后与联合校正，掌握频域指标匹配与综合设计流程。',
  totalDuration: 90,
  thumbnail: '/images/presets/lesson-15-series-compensation.svg',
  tags: ['串联校正', '超前网络', '滞后网络', '滞后-超前', '相角裕度', '频域设计'],
  items: [
    // ==================== Stage 1: Bridge-in (导入) - 10分钟 ====================
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '导入：为什么要串联校正？',
      description: '从性能冲突切入，解释串联校正的必要性。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-15-intro',
          type: 'video',
          title: '导入：为什么要串联校正？',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-15/series-intro.svg',
          splitMode: 'none',
          narration: '当相角裕度与稳态误差难以兼顾时，串联校正是核心抓手。',
          description: '引出超前、滞后与联合校正的设计主线。',
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
      title: '投票：当前系统最缺什么？',
      description: '了解学生对性能短板的直觉判断。',
      config: {
        mode: 'play',
        config: {
          id: 'poll-lesson-15-gap',
          type: 'poll',
          question: '你认为当前系统最需要改进的是？',
          options: [
            { key: 'A', text: '相角裕度不足', color: '#10b981' },
            { key: 'B', text: '稳态误差偏大', color: '#f59e0b' },
            { key: 'C', text: '两者都不满意', color: '#38bdf8' },
            { key: 'D', text: '带宽太小', color: '#a855f7' },
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
      description: '明确串联校正的核心能力目标。',
      config: {
        mode: 'play',
        config: {
          id: 'objective-lesson-15',
          type: 'objective',
          title: '串联校正与滞后超前 学习目标',
          objectives: [
            {
              id: 'obj-1',
              type: 'knowledge',
              description: '解释串联校正与超前/滞后特性',
              badgeName: '校正侦察兵',
              badgeIcon: 'compass',
              unlocked: false,
            },
            {
              id: 'obj-2',
              type: 'ability',
              description: '能为不同场景选择合适的校正策略',
              badgeName: '策略分析师',
              badgeIcon: 'sliders',
              unlocked: false,
            },
            {
              id: 'obj-3',
              type: 'ability',
              description: '掌握超前、滞后参数估算与设计步骤',
              badgeName: '频域工匠',
              badgeIcon: 'target',
              unlocked: false,
            },
            {
              id: 'obj-4',
              type: 'value',
              description: '建立“先超前后滞后”的综合设计意识',
              badgeName: '双目标调度师',
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
      title: '课程路线图：超前 → 滞后 → 联合校正',
      description: '明确联合设计的流程主线。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-15-roadmap',
          type: 'video',
          title: '课程路线图',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-15/lag-lead-roadmap.svg',
          splitMode: 'none',
          narration: '先解决相角裕度，再补偿低频增益，最终统一验算。',
          description: '串联校正的流程与关键决策点。',
          autoPlay: false,
          autoAdvance: false,
        },
      },
    },

    // ==================== Stage 3: Pre-assessment (前测) - 10分钟 ====================
    {
      stage: 'PRE_ASSESSMENT',
      order: 1,
      registryId: 'lesson15-series-precheck',
      duration: 10,
      title: '前测：串联校正速判',
      description: '快速确认超前/滞后/联合校正概念。',
      config: {},
    },

    // ==================== Stage 4: Participatory (参与式学习) - 50分钟 ====================
    {
      stage: 'PARTICIPATORY',
      order: 1,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '串联校正_6_fede5751',
      duration: 1,
      title: '知识卡片：串联校正',
      description: '理解串联校正的定位与目标。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 2,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '超前网络_6_9cc2ad14',
      duration: 1,
      title: '知识卡片：超前网络特性',
      description: '把握相角超前与幅值抬升。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 3,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '无源超前网络_6_f044ba0d',
      duration: 1,
      title: '知识卡片：最大超前角',
      description: '理解超前角与参数 a 的关系。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 4,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '超前网络_6_9cc2ad14',
      duration: 1,
      title: '知识卡片：超前设计步骤',
      description: '掌握超前网络设计流程。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 5,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '滞后网络_6_89977f28',
      duration: 1,
      title: '知识卡片：滞后网络特性',
      description: '理解低频增益与相位滞后。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 6,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '滞后网络_6_89977f28',
      duration: 1,
      title: '知识卡片：滞后设计步骤',
      description: '掌握滞后网络参数估算方法。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 7,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '串联滞后-超前校正_6_23ee8cb9',
      duration: 1,
      title: '知识卡片：滞后-超前联合',
      description: '理解联合校正的适用场景。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 8,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: '无源滞后-超前网络_6_66afb311',
      duration: 1,
      title: '知识卡片：联合设计流程',
      description: '明确先超前后滞后的流程逻辑。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 9,
      registryId: 'lesson15-series-knowledge-deck',
      duration: 12,
      title: '知识卡片：串联校正与滞后超前',
      description: '用互动卡片复盘超前/滞后联合设计。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 10,
      registryId: 'lesson15-series-strategy-lab',
      duration: 15,
      title: '参与式学习：校正策略实验室',
      description: '按场景选择合适的校正方案。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 11,
      registryId: 'lesson15-lag-lead-workshop',
      duration: 15,
      title: '参与式学习：滞后-超前流程拼图',
      description: '拼接联合设计的标准步骤。',
      config: {},
    },

    // ==================== Stage 5: Post-assessment (后测) - 8分钟 ====================
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'lesson15-series-exit-quiz',
      duration: 8,
      title: '后测：滞后超前速测',
      description: '复盘串联校正的关键概念与流程。',
      config: {},
    },

    // ==================== Stage 6: Summary (总结) - 4分钟 ====================
    {
      stage: 'SUMMARY',
      order: 1,
      registryId: 'lesson15-summary-card',
      duration: 4,
      title: '课程总结',
      description: '回顾超前/滞后联合设计的主线。',
      config: {},
    },
  ],
};

export default LESSON_15_SERIES_COMPENSATION_PRESET;
