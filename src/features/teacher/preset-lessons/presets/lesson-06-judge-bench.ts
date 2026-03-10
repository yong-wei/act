/**
 * 预置教案：Lesson 06 - 控制奥德赛·指标裁判席
 *
 * 基于 BOPPPS 教学框架设计的 35-40 分钟流程
 */

import { ResourceType } from '@prisma/client';
import type { PresetLessonConfig } from '../types';

export const LESSON_06_JUDGE_BENCH_PRESET: PresetLessonConfig = {
  key: 'lesson-06-judge-bench-v1',
  title: '控制奥德赛·指标裁判席',
  description:
    '通过裁判席案例理解时域性能指标与控制效果评价逻辑，完成指标速判与参数评估。',
  totalDuration: 36,
  thumbnail: '/images/presets/lesson-06-judge-bench.jpg',
  tags: ['时域分析', '性能指标', '裁判席', '控制评价'],
  items: [
    {
      stage: 'BRIDGE_IN',
      order: 1,
      registryId: 'classroom-video',
      resourceType: ResourceType.INTERACTIVE_COMP,
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
      resourceType: ResourceType.INTERACTIVE_COMP,
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
      resourceType: ResourceType.INTERACTIVE_COMP,
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
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 5,
      title: '前测：指标速判',
      description: '识别上升时间、峰值时间、调节时间与超调量。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 1,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-time-domain-metrics',
      duration: 2,
      title: '知识卡片：时域性能指标',
      description: '上升时间、超调量、调节时间与稳态误差。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 2,
      registryId: 'lesson06-metric-handbook',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 4,
      title: '指标裁判手册',
      description: '掌握时域性能指标的定义与判读方法。',
      config: {},
    },
    {
      stage: 'PARTICIPATORY',
      order: 3,
      itemType: 'KNOWLEDGE_NODE',
      knowledgeNodeId: 'node-metric-judgement',
      duration: 3,
      title: '知识卡片：指标裁判规则',
      description: '理解速度、稳定与精度的综合评分逻辑。',
    },
    {
      stage: 'PARTICIPATORY',
      order: 4,
      registryId: 'lesson06-judge-bench',
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 11,
      title: '裁判席计分器',
      description: '调节阻尼比与响应速度，挑战裁判标准。',
      config: {},
    },
    {
      stage: 'POST_ASSESSMENT',
      order: 1,
      registryId: 'classroom-assessment',
      resourceType: ResourceType.INTERACTIVE_COMP,
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
      resourceType: ResourceType.INTERACTIVE_COMP,
      duration: 2,
      title: '总结：裁判席报告',
      description: 'AI 生成课堂数据报告与反馈。',
      config: {
        mode: 'play',
        config: {
          id: 'report-judge-summary',
          type: 'ai-report',
          title: '裁判席课堂报告',
          reportTemplate: `本节课共有 {totalStudents} 名同学参与评判训练，{completedStudents} 人完成全部挑战，完成率 {completionRate}%。

班级平均得分 {averageScore} 分。典型短板集中在“调节时间过长”和“超调量偏大”。

通过本节课的学习，同学们掌握了时域性能指标的定义、判读方法以及指标权衡原则。`,
          visualizations: ['bar', 'pie'],
          enableVoice: true,
          voiceScript: '',
        },
      },
    },
  ],
};
