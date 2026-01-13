/**
 * 预置教案：Lesson 13 - 幅相特性与稳定判据
 *
 * 基于 BOPPPS 教学框架设计的 90 分钟线下课堂流程
 */

import { ResourceType } from '@prisma/client';
import type { PresetLessonConfig } from '../types';

export const LESSON_13_PHASE_STABILITY_PRESET: PresetLessonConfig = {
  key: 'lesson-13-phase-stability-v1',
  title: '幅相特性与稳定判据：频域的启示',
  description: '围绕 Nyquist 图与对数稳定判据，建立“幅相特性 → 判稳结论”的频域思维链路。',
  totalDuration: 90,
  thumbnail: '/images/presets/lesson-13-phase-stability.svg',
  tags: ['Nyquist', '幅相特性', '幅角原理', '对数稳定判据', '穿越频率', '频域判稳'],
  items: [
    // ==================== Stage 1: Bridge-in (导入) - 10分钟 ====================
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '导入：一条曲线能否判稳？',
      description: '引发学生对“幅相特性与稳定性关系”的兴趣。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-13-intro',
          type: 'video',
          title: '导入：一条曲线能否判稳？',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-13/nyquist-intro.svg',
          splitMode: 'none',
          narration: '如果没有明确的传递函数，还能判断系统稳定吗？幅相特性给我们一条几何线索。',
          description: '从 Nyquist 图切入频域稳定性问题。',
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
      title: '投票：频域判稳的关键是什么？',
      description: '了解学生对判稳核心要素的直觉。',
      config: {
        mode: 'play',
        config: {
          id: 'poll-lesson-13-focus',
          type: 'poll',
          question: '你认为 Nyquist 判稳最关键的元素是？',
          options: [
            { key: 'A', text: '起点与终点位置', color: '#38bdf8' },
            { key: 'B', text: '是否包围 -1 点', color: '#22c55e' },
            { key: 'C', text: 'Bode 图斜率变化', color: '#f97316' },
            { key: 'D', text: '系统阶次高低', color: '#a855f7' },
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
      description: '明确幅相特性与稳定判据的核心能力。',
      config: {
        mode: 'play',
        config: {
          id: 'objective-lesson-13',
          type: 'objective',
          title: '幅相特性与稳定判据 学习目标',
          objectives: [
            {
              id: 'obj-1',
              type: 'knowledge',
              description: '解释开环幅相特性与 Nyquist 图的含义',
              badgeName: '幅相翻译官',
              badgeIcon: 'brain',
              unlocked: false,
            },
            {
              id: 'obj-2',
              type: 'ability',
              description: '找出幅相曲线的起点、终点与负实轴交点',
              badgeName: '特征点猎手',
              badgeIcon: 'target',
              unlocked: false,
            },
            {
              id: 'obj-3',
              type: 'ability',
              description: '使用 Nyquist 判据判断闭环稳定性',
              badgeName: '判稳仲裁者',
              badgeIcon: 'shield',
              unlocked: false,
            },
            {
              id: 'obj-4',
              type: 'value',
              description: '建立频域判稳思维并理解其工程意义',
              badgeName: '频域守护者',
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
      title: '课程路线图：幅相特性 → 判稳结论',
      description: '梳理频域判稳的主线逻辑。',
      config: {
        mode: 'play',
        config: {
          id: 'video-lesson-13-roadmap',
          type: 'video',
          title: '课程路线图',
          sourceType: 'placeholder',
          primarySource: '/assets/lesson-13/phase-roadmap.svg',
          splitMode: 'none',
          narration: '从频率响应到 Nyquist 图，再到稳定判据，是频域分析的核心链路。',
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
      registryId: 'lesson13-phase-concept-quiz',
      duration: 10,
      title: '前测：幅相概念速判',
      description: '快速检查 Nyquist 图与穿越频率概念掌握。',
      config: {},
    },

    // ==================== Stage 4: Participatory (参与式学习) - 50分钟 ====================
    {
      stage: 'PARTICIPATORY',
      order: 1,
      registryId: 'lesson13-phase-knowledge-deck',
      duration: 18,
      title: '知识卡片：幅相特性关键点',
      description: '系统梳理定义、特征点与判据基础。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 2,
      registryId: 'lesson12-bode-plot-recognition',
      duration: 12,
      title: '参与式学习：伯德图判读',
      description: '用幅频曲线识别环节并联系相位变化。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 3,
      registryId: 'lesson13-nyquist-stability-scenario',
      duration: 20,
      title: '参与式学习：Nyquist 判稳场景',
      description: '用包围次数与右半平面极点数判断闭环稳定性。',
      config: {},
    },

    // ==================== Stage 5: Post-assessment (后测) - 8分钟 ====================
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'lesson13-phase-stability-exit-quiz',
      duration: 8,
      title: '后测：对数判据速测',
      description: '复盘对数稳定判据与判稳结论。',
      config: {},
    },

    // ==================== Stage 6: Summary (总结) - 4分钟 ====================
    {
      stage: 'SUMMARY',
      order: 1,
      registryId: 'lesson13-summary-card',
      duration: 4,
      title: '课程总结',
      description: '回顾频域判稳主线与课后思考。',
      config: {},
    },
  ],
};

export default LESSON_13_PHASE_STABILITY_PRESET;
