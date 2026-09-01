import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PersonalLearningCenter } from '@/features/ai/personal-learning-center';
import { createUnavailableAiWorkshopEvidence } from '@/features/ai/ai-workshop-evidence';
import type { AiWorkshopCollections } from '@/features/ai/ai-workshop-collections';
import {
  availableCollection,
  emptyCollection,
  unavailableCollection,
  AI_WORKSHOP_COLLECTION_ACTIONS,
} from '@/features/ai/ai-workshop-collections';

function mixedCollections(): AiWorkshopCollections {
  return {
    authority: 'server-owned',
    generatedAt: '2026-09-01T00:00:00.000Z',
    tasks: availableCollection([{
      id: 'assignment:a1', title: '时域分析作业', category: 'theory', status: 'in_progress',
      progress: 50, sourceKind: 'assignment', sourceLabel: '课程作业',
    }], 1, AI_WORKSHOP_COLLECTION_ACTIONS.tasks),
    milestones: availableCollection([{
      id: 'path:p1:n1', title: '根轨迹', order: 1, status: 'CURRENT', sourceLabel: '控制矫正路径',
    }], 3, AI_WORKSHOP_COLLECTION_ACTIONS.milestones),
    achievements: emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.achievements),
    experiments: unavailableCollection('实验记录来源暂时无法确认，请稍后重试。'),
    journals: availableCollection([{
      id: 'growth:j1', title: '反思一', content: '复盘根轨迹。', entryType: 'REFLECTION',
      createdAt: '2026-08-22T08:00:00.000Z', sourceLabel: '成长记录',
    }], 1, AI_WORKSHOP_COLLECTION_ACTIONS.journals),
  };
}

describe('PersonalLearningCenter governed collections', () => {
  it('renders available, empty and unavailable states independently', () => {
    const html = renderToStaticMarkup(
      <PersonalLearningCenter evidence={createUnavailableAiWorkshopEvidence()} collections={mixedCollections()} />,
    );

    expect(html).toContain('data-ai-workshop-collection-state="available"');
    expect(html).toContain('data-ai-workshop-collection-state="empty"');
    expect(html).toContain('data-ai-workshop-collection-state="unavailable"');
    // 可用集合渲染真实记录与来源标签，不回退为空态。
    expect(html).toContain('时域分析作业');
    expect(html).toContain('课程作业');
    expect(html).toContain('根轨迹');
    expect(html).toContain('反思一');
    // 空态与不可用态互不混用文案。
    expect(html).toContain('暂无已验证的成就记录');
    expect(html).toContain('实验记录来源暂时无法确认');
    expect(html).not.toContain('仿真训练记录。完成学习活动后');
  });

  it('keeps unavailable totals unknown instead of fabricated zero', () => {
    const html = renderToStaticMarkup(
      <PersonalLearningCenter evidence={createUnavailableAiWorkshopEvidence()} collections={mixedCollections()} />,
    );

    expect(html).toContain('不可用');
    expect(html).not.toContain('>0<');
  });
});
