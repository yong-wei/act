import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AdaptivePathJourneyControl,
  buildAdaptivePathJourneyReadHref,
  parseAdaptivePathJourneyResponse,
} from '@/features/adaptive/adaptive-path-journey-control';
import {
  buildAdaptivePathCompletionRequest,
  buildAdaptivePathLaunchContext,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import type { AuthorizedAdaptivePathJourney } from '@/features/adaptive/adaptive-path-journey-contracts';
import {
  buildAuthorizedAdaptivePathJourney,
  resolveAdaptivePathCenterOwnedTargetHref,
  resolveAdaptivePathJourneyTargetDisposition,
} from '@/features/adaptive/adaptive-path-journey-contracts';

const rootDir = path.resolve(__dirname, '../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function launchContext(resourceType = 'knowledge_card') {
  return buildAdaptivePathLaunchContext({
    goalId: 'control-correction',
    pathId: 'path-1',
    nodeId: 'node-1',
    routeIntent: 'path-execution',
    resourceType,
  });
}

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
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
    },
    pathStatus: 'active',
    nextAction,
  };
}

describe('adaptive path journey control', () => {
  it('builds an owner-validated journey read URL from normalized launch context', () => {
    expect(buildAdaptivePathJourneyReadHref(launchContext())).toBe(
      '/api/learning-paths/path-1/journey?nodeId=node-1&goalId=control-correction',
    );
  });

  it('renders return, current progress, and a named ready next node', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'ready',
        nodeId: 'node-2',
        title: '进入校正工作台',
        type: 'control_workbench',
        href: '/interactive-learning/control-workbench?pathId=path-1',
        reason: null,
        recovery: null,
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html).toContain('data-adaptive-path-journey-control="ready"');
    expect(html).toContain('返回学习路径');
    expect(html).toContain('理解频域指标');
    expect(html).toContain('1 / 3');
    expect(html).toContain('进入校正工作台');
    expect(html).toContain('href="/interactive-learning/control-workbench?pathId=path-1"');
  });

  it.each([
    ['pending-result', '结果正在同步', '刷新结果状态'],
    ['blocked', '当前结果未通过路径验证', '恢复学习路径'],
  ] as const)('renders the %s state without a navigable next target', (state, reason, recoveryLabel) => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state,
        nodeId: 'node-1',
        title: '理解频域指标',
        type: 'knowledge_card',
        href: null,
        reason,
        recovery: { label: recoveryLabel, href: launchContext().returnHref },
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html).toContain(`data-adaptive-path-journey-control="${state}"`);
    expect(html).toContain(reason);
    expect(html).not.toContain('data-adaptive-path-next-action="ready"');
  });

  it('renders path completion with the server-owned summary target', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'path-complete',
        nodeId: null,
        title: '查看路径总结',
        type: null,
        href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1',
        reason: null,
        recovery: null,
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html).toContain('data-adaptive-path-journey-control="path-complete"');
    expect(html).toContain('查看路径总结');
  });

  it('fails closed on malformed journey responses', () => {
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'ready',
      nodeId: 'node-2',
      title: '下一节点',
      type: 'slides',
      href: '/slides/2',
      reason: null,
      recovery: null,
    }) })).toMatchObject({ path: { id: 'path-1' }, nextAction: { state: 'ready' } });
    expect(parseAdaptivePathJourneyResponse({ journey: { path: { id: 'path-1' } } })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ error: 'forbidden' })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'ready', nodeId: null, title: '下一节点', type: null, href: '/knowledge', reason: null, recovery: null,
    }) })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'path-complete', nodeId: 'node-2', title: '总结', type: 'quiz', href: '/assessment/adaptive-practice', reason: null, recovery: null,
    }) })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'blocked', nodeId: 'node-1', title: '阻塞', type: 'knowledge_card', href: '/knowledge', reason: '阻塞', recovery: null,
    }) })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'ready', nodeId: 'node-2', title: '下一节点', type: 'knowledge_card', href: '/knowledge/%2e%2e/api/private', reason: null, recovery: null,
    }) })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'ready', nodeId: 'node-2', title: '下一节点', type: 'knowledge_card', href: '/knowledge\\..\\api', reason: null, recovery: null,
    }) })).toBeNull();
    expect(parseAdaptivePathJourneyResponse({ journey: journey({
      state: 'ready',
      nodeId: 'node-2',
      title: '下一节点',
      type: 'knowledge_card',
      href: '/knowledge/%2525252525252525252e%2525252525252525252e/api/private',
      reason: null,
      recovery: null,
    }) })).toBeNull();
  });

  it('integrates route-aware controls through AppShell without changing non-path shells', () => {
    const appShellSource = readSource('src/components/platform/app-shell.tsx');
    const lessonShellSource = readSource('src/features/interactive/shared/lesson-runtime-shell.tsx');
    const simulationShellSource = readSource('src/app/simulations/_components/simulation-shell.tsx');
    const workbenchShellSource = readSource('src/features/control-workbench/shell/control-workbench-shell.tsx');

    expect(appShellSource).toContain('{journeyControl}');
    expect(appShellSource).not.toContain("from '@/features/");
    expect(readSource('src/features/interactive/interactive-learning-shell.tsx')).toContain(
      'journeyControl={<AdaptivePathJourneyControlFromRoute />}',
    );
    expect(lessonShellSource).toContain('<AppShell');
    expect(lessonShellSource).not.toContain('buildAdaptivePathCompletionRequest');
    expect(lessonShellSource).toContain('journeyControl={<AdaptivePathJourneyControlFromRoute />}');
    expect(simulationShellSource).toContain('<AppShell');
    expect(simulationShellSource).toContain('journeyControl={<AdaptivePathJourneyControlFromRoute />}');
    expect(workbenchShellSource).toContain('<AppShell');
    expect(workbenchShellSource).toContain('journeyControl={<AdaptivePathJourneyControlFromRoute />}');
    expect(readSource('src/app/knowledge/page.tsx')).toContain(
      'journeyControl={<AdaptivePathJourneyControlFromRoute />}',
    );
  });

  it('keeps raw course content in the owning path center instead of claiming destination controls', () => {
    const view = buildAuthorizedAdaptivePathJourney({
      id: 'path-1',
      title: '路径',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'node-1',
      pathPayload: {
        mainPathNodeIds: ['node-1', 'node-2'],
        planNodes: [
          { nodeId: 'node-1', title: '已完成', type: 'knowledge_card', target: '/knowledge', status: 'completed', readiness: { state: 'ready' } },
          {
            nodeId: 'node-2',
            title: '教材阅读',
            type: 'textbook_section',
            target: '/course-runtime/resources/textbooks/book/sections/ch01.md',
            status: 'next',
            readiness: { state: 'ready' },
          },
        ],
      },
      terminalValidation: { state: 'not-required', nodeId: null },
      lastExecutionMetadata: { completedNodeIds: ['node-1'], failedNodeIds: [] },
    }, { requestedNodeId: 'node-1' });

    expect(view.nextAction).toMatchObject({ state: 'ready', nodeId: 'node-2' });
    expect(view.nextAction.href).toContain('/assessment/adaptive-practice?');
    expect(view.nextAction.href).not.toContain('/course-runtime/');
  });

  it('classifies destination support without treating mislabeled external media as internal', () => {
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'textbook_section',
      '/course-runtime/resources/textbooks/book/sections/ch01.md',
    )).toBe('path-center-explicit');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'video',
      '/course-runtime/media/lesson.mp4',
    )).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'external_resource',
      'https://example.edu/resource',
    )).toBe('external-fallback');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'slides',
      'https://example.edu/slides',
    )).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('project', '/profile/evidence')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('arena_task', '/arena/challenges/task-1')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('project', '/knowledge')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('arena_task', '/knowledge')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('unknown', '/knowledge')).toBe('blocked');
    expect(resolveAdaptivePathCenterOwnedTargetHref('project', '/course-runtime/lessons/demo/handout.md')).toBeNull();
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'video',
      '/course-runtime/lessons/demo/video.mp4',
    )).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'audio',
      '/course-runtime/lessons/demo/audio.mp3',
    )).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'knowledge_node',
      '/course-runtime/knowledge/demo.md',
    )).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('knowledge_card', '/assessment/adaptive-practice')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'control_workbench',
      '/interactive-learning/control-workbench',
    )).toBe('destination-control');
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'textbook_section',
      '/course-runtime/%2e%2e/api/private',
    )).toBe('blocked');
  });

  it.each(['textbook_section', 'slides'])(
    'builds a governed completion request for %s resources',
    (resourceType) => {
      expect(buildAdaptivePathCompletionRequest({
        launchContext: launchContext(resourceType),
        completedAt: '2026-07-11T00:00:00.000Z',
      })).toMatchObject({
        href: '/api/learning-paths/path-1/execute',
        body: { nodeId: 'node-1', resourceType, status: 'completed' },
      });
    },
  );

  it('keeps the path center mounted while an external resource opens separately', () => {
    const source = readSource('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("window.open('about:blank', '_blank')");
    expect(source).not.toContain('window.location.assign(withFeedbackTaskHref(action.redirectHref))');
  });
});
