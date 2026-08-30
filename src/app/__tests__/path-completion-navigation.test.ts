import { describe, expect, it } from 'vitest';

import { resolveAdaptivePathCompletionContinueHref } from '@/app/interactive-learning/resources/[id]/path-completion-navigation';
import type { AuthorizedAdaptivePathJourney } from '@/features/adaptive/adaptive-path-journey-contracts';

const fallbackHref = '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1';
const currentHref = '/interactive-learning/resources/lesson13-cruise-bridge?source=adaptive-path-center&goal=control-correction&pathId=path-1&nodeId=registry%3Alesson13-cruise-bridge';
const nextHref = '/interactive-learning/resources/lesson13-phase-concept-quiz?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=registry%3Alesson13-phase-concept-quiz&intent=path-execution';

function journey(
  nextAction: AuthorizedAdaptivePathJourney['nextAction'],
): AuthorizedAdaptivePathJourney {
  return {
    path: { id: 'path-1', title: '控制系统校正路径' },
    goal: { id: 'control-correction' },
    context: { pathId: 'path-1', goalId: 'control-correction', requestedNodeId: 'node-1' },
    current: { nodeId: 'node-1', title: '理解频域指标', type: 'knowledge_card' },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: fallbackHref,
    },
    pathStatus: 'active',
    nextAction,
  };
}

describe('adaptive path completion continue href', () => {
  it('continues to the next ready destination when it is not the current resource', () => {
    expect(resolveAdaptivePathCompletionContinueHref({
      payload: {
        journey: journey({
          state: 'ready',
          nodeId: 'registry:lesson13-phase-concept-quiz',
          title: '幅相概念速判',
          type: 'quiz',
          href: nextHref,
          reason: null,
          recovery: null,
        }),
      },
      currentHref,
      fallbackHref,
    })).toBe(nextHref);
  });

  it('opens the path summary when the journey is complete', () => {
    const summaryHref = '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1';
    expect(resolveAdaptivePathCompletionContinueHref({
      payload: {
        journey: journey({
          state: 'path-complete',
          nodeId: null,
          title: '查看路径总结',
          type: null,
          href: summaryHref,
          reason: null,
          recovery: null,
        }),
      },
      currentHref,
      fallbackHref,
    })).toBe(summaryHref);
  });

  it('returns to the path center when the next action is not a distinct destination', () => {
    expect(resolveAdaptivePathCompletionContinueHref({
      payload: {
        journey: journey({
          state: 'pending-result',
          nodeId: 'node-1',
          title: '结果同步中',
          type: 'knowledge_card',
          href: null,
          reason: '结果正在同步，完成绑定后即可继续。',
          recovery: { label: '刷新结果状态', href: fallbackHref },
        }),
      },
      currentHref,
      fallbackHref,
    })).toBe(fallbackHref);
    expect(resolveAdaptivePathCompletionContinueHref({
      payload: { error: 'invalid' },
      currentHref,
      fallbackHref,
    })).toBe(fallbackHref);
    expect(resolveAdaptivePathCompletionContinueHref({
      payload: {
        journey: journey({
          state: 'ready',
          nodeId: 'registry:lesson13-cruise-bridge',
          title: '邮轮导入',
          type: 'knowledge_card',
          href: `${currentHref}&intent=path-execution`,
          reason: null,
          recovery: null,
        }),
      },
      currentHref: `${currentHref}&intent=path-execution`,
      fallbackHref,
    })).toBe(fallbackHref);
  });

  it('rejects an unsafe fallback instead of staying on the resource page', () => {
    expect(() => resolveAdaptivePathCompletionContinueHref({
      payload: null,
      currentHref,
      fallbackHref: 'https://example.com/assessment/adaptive-practice',
    })).toThrow('路径完成回退地址不受平台支持');
  });
});
