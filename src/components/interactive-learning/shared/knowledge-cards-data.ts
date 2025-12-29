/**
 * 知识卡片数据访问
 * Knowledge Cards Data Access
 *
 * 从首页知识图谱模块获取课程知识卡片
 */

import {
  getLessonKnowledgeCard,
  getCardsByLesson,
  getCardByPhase,
  type LessonKnowledgeCard,
} from '@/components/knowledge/data/lesson-knowledge-cards';

/** 知识卡片 ID 列表 (Lesson 02) */
export const LESSON_02_CARD_IDS = [
  'concept-modeling-intro',
  'concept-newton-law-application',
  'concept-kirchhoff-law',
  'concept-linearization',
] as const;

export type Lesson02CardId = (typeof LESSON_02_CARD_IDS)[number];

/**
 * 根据 ID 获取知识卡片
 */
export function getKnowledgeCard(id: string): LessonKnowledgeCard | undefined {
  return getLessonKnowledgeCard(id);
}

/**
 * 获取 Lesson 02 的所有知识卡片
 */
export function getLesson02Cards(): LessonKnowledgeCard[] {
  return getCardsByLesson('lesson-02');
}

/**
 * 知识卡片与课程阶段的映射关系
 */
export const CARD_PHASE_MAPPING: Record<Lesson02CardId, string> = {
  'concept-modeling-intro': 'bridge',        // 导入阶段
  'concept-newton-law-application': 'mechanical',  // 机械建模阶段
  'concept-kirchhoff-law': 'electrical',     // 电路建模阶段
  'concept-linearization': 'posttest',       // 后测阶段
};

/**
 * 根据阶段获取对应的知识卡片
 */
export function getCardForPhase(phase: string): LessonKnowledgeCard | undefined {
  return getCardByPhase('lesson-02', phase);
}

// 重新导出类型
export type { LessonKnowledgeCard };
