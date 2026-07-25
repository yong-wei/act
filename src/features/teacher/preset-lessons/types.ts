/**
 * 预置教案类型定义
 */

import { BopppsStage, LessonItemType, ResourceType } from '@prisma/client';

/**
 * 预置教案环节配置
 */
export interface PresetLessonItem {
  /** 对应互动课 runtime manifest 的稳定环节 ID */
  runtimeStepId?: string;
  /** BOPPPS 阶段 */
  stage: BopppsStage;
  /** 环节顺序 */
  order: number;
  /** 环节类型（默认 RESOURCE） */
  itemType?: LessonItemType;
  /** 组件注册 ID（资源类环节） */
  registryId?: string;
  /** 知识节点 ID（知识卡片环节） */
  knowledgeNodeId?: string;
  /** 资源类型（默认 INTERACTIVE_COMP） */
  resourceType?: ResourceType;
  /** 环节时长（分钟）*/
  duration: number;
  /** 环节标题 */
  title: string;
  /** 环节描述 */
  description?: string;
  /** 组件配置覆盖 */
  config?: Record<string, unknown>;
}

/**
 * 预置教案配置
 */
export interface PresetLessonConfig {
  /** 唯一标识 */
  key: string;
  /** 教案标题 */
  title: string;
  /** 教案描述 */
  description: string;
  /** 总时长（分钟）*/
  totalDuration: number;
  /** 缩略图路径 */
  thumbnail?: string;
  /** 标签 */
  tags: string[];
  /** 教案环节 */
  items: PresetLessonItem[];
}

/**
 * 预置教案摘要（用于列表展示）
 */
export interface PresetLessonSummary {
  key: string;
  title: string;
  description: string;
  totalDuration: number;
  thumbnail?: string;
  tags: string[];
  stageCount: Record<BopppsStage, number>;
}

/**
 * BOPPPS 阶段信息
 */
export const BOPPPS_STAGES: Record<BopppsStage, { label: string; color: string; description: string }> = {
  BRIDGE_IN: {
    label: 'B - 导入',
    color: 'bg-blue-500',
    description: '情境营造与学生兴趣激发',
  },
  OBJECTIVE: {
    label: 'O - 目标',
    color: 'bg-green-500',
    description: '清晰陈述学习目标与通关任务',
  },
  PRE_ASSESSMENT: {
    label: 'P - 前测',
    color: 'bg-yellow-500',
    description: '基础概念掌握评估',
  },
  PARTICIPATORY: {
    label: 'P - 参与式学习',
    color: 'bg-purple-500',
    description: '核心内容与交互式仿真',
  },
  POST_ASSESSMENT: {
    label: 'P - 后测',
    color: 'bg-orange-500',
    description: '综合能力评估与打分',
  },
  SUMMARY: {
    label: 'S - 总结',
    color: 'bg-slate-500',
    description: 'AI驱动的课堂数据报告',
  },
};
