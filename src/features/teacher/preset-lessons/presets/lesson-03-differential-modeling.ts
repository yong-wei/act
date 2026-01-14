/**
 * 预置教案：Lesson 03 - 微分方程与控制系统基础模型
 *
 * 基于 BOPPPS 教学框架设计的 90 分钟线下课堂流程
 */

import { ResourceType } from '@prisma/client';
import type { PresetLessonConfig } from '../types';

export const LESSON_03_DIFFERENTIAL_MODELING_PRESET: PresetLessonConfig = {
  key: 'lesson-03-differential-modeling-v1',
  title: '微分方程与控制系统基础模型',
  description: '围绕机理建模与黑箱辨识，掌握微分方程建模的步骤、案例与线性化方法。',
  totalDuration: 90,
  thumbnail: '/images/presets/lesson-03-differential-modeling.svg',
  tags: ['微分方程', '机理建模', '系统辨识', '数学模型', '线性化'],
  items: [
    // ==================== Stage 1: Bridge-in (导入) - 10分钟 ====================
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '导入：模型从哪里来？',
      description: '以控制系统基础模型引出微分方程建模。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-03-intro',
          type: 'video',
          title: '导入：模型从哪里来？',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-03/diff-intro.svg',
          splitMode: 'none',
          narration: '模型决定分析与设计，微分方程是最基础的系统描述。',
          description: '从机理建模与黑箱建模切入课程主线。',
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
      title: '投票：你更熟悉哪种建模方式？',
      description: '了解学生对建模方法的掌握情况。',
      config: {
        mode: 'play',
        config: {
          id: 'poll-lesson-03-method',
          type: 'poll',
          question: '以下哪种建模方式你更熟悉？',
          options: [
            { key: 'A', text: '机理建模（物理定律）', color: '#38bdf8' },
            { key: 'B', text: '黑箱建模（系统辨识）', color: '#f59e0b' },
            { key: 'C', text: '都熟悉', color: '#22c55e' },
            { key: 'D', text: '都不熟悉', color: '#a855f7' },
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
      description: '明确微分方程建模的关键能力。',
      config: {
        mode: 'play',
        config: {
          id: 'objective-lesson-03',
          type: 'objective',
          title: '微分方程与基础模型 学习目标',
          objectives: [
            {
              id: 'obj-1',
              type: 'knowledge',
              description: '理解微分方程模型的基本含义',
              badgeName: '模型观察员',
              badgeIcon: 'book-open',
              unlocked: false,
            },
            {
              id: 'obj-2',
              type: 'ability',
              description: '掌握建模步骤与关键变量选择',
              badgeName: '建模流程官',
              badgeIcon: 'workflow',
              unlocked: false,
            },
            {
              id: 'obj-3',
              type: 'ability',
              description: '能为典型系统建立微分方程模型',
              badgeName: '案例建模师',
              badgeIcon: 'atom',
              unlocked: false,
            },
            {
              id: 'obj-4',
              type: 'value',
              description: '形成机理与数据双视角的建模意识',
              badgeName: '双通道建模师',
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
      title: '课程路线图：方法 → 步骤 → 案例 → 线性化',
      description: '梳理微分方程建模的核心路径。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-03-roadmap',
          type: 'video',
          title: '课程路线图',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-03/modeling-roadmap.svg',
          splitMode: 'none',
          narration: '先选方法，再走流程，最后用案例与线性化巩固。',
          description: '明确建模主线与阶段目标。',
          autoPlay: false,
          autoAdvance: false,
        },
      },
    },

    // ==================== Stage 3: Pre-assessment (前测) - 10分钟 ====================
    {
      stage: 'PRE_ASSESSMENT',
      order: 1,
      registryId: 'lesson03-diff-precheck',
      duration: 10,
      title: '前测：微分方程速判',
      description: '快速检查建模步骤与模型类型理解。',
      config: {},
    },

    // ==================== Stage 4: Participatory (参与式学习) - 50分钟 ====================
    {
      stage: 'PARTICIPATORY',
      order: 1,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-differential-equation-model',
      duration: 1,
      title: '知识卡片：微分方程模型',
      description: '理解微分方程在控制系统中的意义。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 2,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-modeling-methods',
      duration: 1,
      title: '知识卡片：机理建模方法',
      description: '掌握物理定律驱动的建模方法。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 3,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-black-box-modeling',
      duration: 1,
      title: '知识卡片：黑箱建模',
      description: '理解系统辨识与数据建模思路。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 4,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-system-model-types',
      duration: 1,
      title: '知识卡片：模型类型',
      description: '区分时域、s 域与频域模型。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 5,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-differential-modeling-steps',
      duration: 1,
      title: '知识卡片：建模步骤',
      description: '掌握变量确定与消元流程。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 6,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-modeling-examples',
      duration: 1,
      title: '知识卡片：典型案例',
      description: 'RLC、电机与机械系统建模要点。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 7,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-linearization-equilibrium',
      duration: 1,
      title: '知识卡片：非线性线性化',
      description: '理解泰勒展开线性化思路。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 8,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-motion-modes',
      duration: 1,
      title: '知识卡片：运动模态',
      description: '认识齐次解与模态叠加。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 9,
      registryId: 'lesson03-diff-knowledge-deck',
      duration: 12,
      title: '知识卡片：微分方程建模',
      description: '用互动卡片复盘建模方法与步骤。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 10,
      registryId: 'lesson03-modeling-scenario-lab',
      duration: 15,
      title: '参与式学习：建模场景决策',
      description: '按场景选择建模方法。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 11,
      registryId: 'lesson03-modeling-workflow-puzzle',
      duration: 15,
      title: '参与式学习：建模流程拼图',
      description: '完成微分方程建模步骤排序。',
      config: {},
    },

    // ==================== Stage 5: Post-assessment (后测) - 8分钟 ====================
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'lesson03-diff-exit-quiz',
      duration: 8,
      title: '后测：基础模型速测',
      description: '复盘微分方程建模重点。',
      config: {},
    },

    // ==================== Stage 6: Summary (总结) - 4分钟 ====================
    {
      stage: 'SUMMARY',
      order: 1,
      registryId: 'lesson03-summary-card',
      duration: 4,
      title: '课程总结',
      description: '回顾建模主线与迁移思考。',
      config: {},
    },
  ],
};

export default LESSON_03_DIFFERENTIAL_MODELING_PRESET;
