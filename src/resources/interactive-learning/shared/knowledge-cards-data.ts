/**
 * 知识卡片数据访问
 * Knowledge Cards Data Access
 *
 * 从知识库 API 获取课程知识卡片（数据库唯一源头）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

/** 知识卡片 ID 列表 (Lesson 02) */
export const LESSON_02_CARD_IDS = [
  '拉普拉斯变换_2_c635236f',
  '拉氏变换工程动机_2_11001',
  '微分定理_2_11002',
  '部分分式展开_7_d822352e',
] as const;

export type Lesson02CardId = (typeof LESSON_02_CARD_IDS)[number];

export interface LessonKnowledgeCard {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  lessonId: string;
  phase?: string;
  explanation?: string;
  formulaContinuous?: string;
  formulaDiscrete?: string;
  applications?: string[];
  prerequisites?: string[];
  relatedTopics?: string[];
  resources?: unknown[];
}

interface KnowledgeNodeResponse {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  bloomLevel?: string | null;
  knowledgeDim?: string | null;
  content?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  resources?: unknown[] | null;
}

function normalizeCard(node: KnowledgeNodeResponse): LessonKnowledgeCard {
  const metadata = (node.metadata || {}) as Record<string, unknown>;
  const content = (node.content || {}) as Record<string, unknown>;
  const getString = (key: string, fallback = '') =>
    (metadata[key] as string | undefined) ?? (content[key] as string | undefined) ?? fallback;
  const getArray = (key: string) => {
    const value = (metadata[key] ?? content[key]) as unknown;
    return Array.isArray(value) ? value : undefined;
  };

  return {
    id: node.id,
    name: node.name,
    nodeType: node.nodeType,
    description: node.description,
    bloomLevel: node.bloomLevel ?? undefined,
    knowledgeDim: node.knowledgeDim ?? undefined,
    lessonId: getString('lessonId', ''),
    phase: getString('phase', ''),
    explanation: getString('explanation', ''),
    formulaContinuous: getString('formulaContinuous', ''),
    formulaDiscrete: getString('formulaDiscrete', ''),
    applications: getArray('applications'),
    prerequisites: getArray('prerequisites'),
    relatedTopics: getArray('relatedTopics'),
    resources: Array.isArray(node.resources) ? node.resources : undefined,
  };
}

export function useKnowledgeCard(id: string) {
  const [card, setCard] = useState<LessonKnowledgeCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchCard = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${id}`);
        if (!res.ok) {
          setError('知识卡片未找到');
          setIsLoading(false);
          return;
        }
        const data = (await res.json()) as KnowledgeNodeResponse;
        setCard(normalizeCard(data));
      } catch (err) {
        console.error('Failed to load knowledge card', err);
        setError('知识卡片加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCard();
  }, [id]);

  return { card, isLoading, error };
}

/**
 * 获取 Lesson 02 的所有知识卡片
 */
export const CARD_PHASE_MAPPING: Record<Lesson02CardId, string> = {
  '拉普拉斯变换_2_c635236f': 'bridge',
  '拉氏变换工程动机_2_11001': 'participatory',
  '微分定理_2_11002': 'participatory',
  '部分分式展开_7_d822352e': 'posttest',
};

export function useLesson02Cards() {
  const [cards, setCards] = useState<LessonKnowledgeCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await fetch('/api/knowledge/nodes?search=lesson-02');
        if (!res.ok) return;
        const data = (await res.json()) as KnowledgeNodeResponse[];
        setCards(data.map(normalizeCard));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCards();
  }, []);

  const cardsByPhase = useMemo(() => {
    const mapping: Record<string, LessonKnowledgeCard[]> = {};
    cards.forEach((card) => {
      const phase = card.phase || 'default';
      if (!mapping[phase]) mapping[phase] = [];
      mapping[phase].push(card);
    });
    return mapping;
  }, [cards]);

  return { cards, cardsByPhase, isLoading };
}
