import { readdirSync, readFileSync } from 'node:fs';
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
import { GOVERNED_PATH_NODE_TYPES } from '@/lib/resource-node-registry';

const rootDir = path.resolve(__dirname, '../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function findJourneyControlMounts(directory: string): string[] {
  return readdirSync(path.join(rootDir, directory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(directory.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory() && entry.name === '__tests__') return [];
    if (entry.isDirectory()) return findJourneyControlMounts(relativePath);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return [];
    return readSource(relativePath).includes('<AdaptivePathJourneyControlFromRoute') ? [relativePath] : [];
  });
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

  it('renders an inspectable, read-only correction proposal with its path comparison', () => {
    const journeyWithCorrection = journey({
      state: 'blocked',
      nodeId: 'node-2',
      title: '校正检查点',
      type: 'checkpoint',
      href: null,
      reason: '检查点未通过',
      recovery: { label: '返回学习路径', href: launchContext().returnHref },
    });
    journeyWithCorrection.correction = {
      proposal: {
        trigger: { kind: 'failed-checkpoint', nodeId: 'node-2', title: '校正检查点', reason: '检查点结果未通过。' },
        originalRemaining: [
          { nodeId: 'node-2', title: '校正检查点', type: 'checkpoint', estimatedTimeMinutes: 15 },
          { nodeId: 'node-3', title: '误差复习', type: 'knowledge_card', estimatedTimeMinutes: 20 },
        ],
        proposedRemaining: [
          { nodeId: 'node-3', title: '误差复习', type: 'knowledge_card', estimatedTimeMinutes: 20 },
          { nodeId: 'node-2', title: '校正检查点', type: 'checkpoint', estimatedTimeMinutes: 15 },
        ],
        changes: [{ kind: 'reordered', nodeId: 'node-2', title: '校正检查点', movedAfterNodeId: 'node-3' }],
        supportingFacts: ['检查点结果未通过。'],
        estimatedRemainingWork: { originalMinutes: 35, proposedMinutes: 35, differenceMinutes: 0 },
      },
      unavailableReason: null,
      candidateFingerprint: 'correction-12345678',
      pathUpdatedAt: '2026-08-04T09:00:00.000Z',
      decision: null,
      history: [],
    };

    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journeyWithCorrection,
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html).toContain('data-adaptive-path-correction="available"');
    expect(html).toContain('查看纠偏方案');
    expect(html).toContain('当前未完成路径');
    expect(html).toContain('建议顺序');
    expect(html).toContain('本方案仅供查看，尚未应用到当前学习路径。');
    expect(html).toContain('data-adaptive-path-correction-actions="available"');
    expect(html).toContain('确认调整');

    journeyWithCorrection.correction.decision = {
      decision: 'rejected',
      createdAt: '2026-08-04T09:01:00.000Z',
      applied: false,
    };
    const rejectedHtml = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journeyWithCorrection,
      error: null,
      onRefresh: () => undefined,
    }));
    expect(rejectedHtml).toContain('data-adaptive-path-correction-decision="rejected"');
    expect(rejectedHtml).not.toContain('data-adaptive-path-correction-actions="available"');
  });

  it('renders a student-safe unavailable reason without an applied correction', () => {
    const journeyWithoutCorrection = journey({
      state: 'blocked',
      nodeId: 'node-2',
      title: '校正检查点',
      type: 'checkpoint',
      href: null,
      reason: '检查点未通过',
      recovery: { label: '返回学习路径', href: launchContext().returnHref },
    });
    journeyWithoutCorrection.correction = {
      proposal: null,
      unavailableReason: '检查点未通过，但路径中没有可用于调整顺序的受治理复习节点。',
      candidateFingerprint: null,
      pathUpdatedAt: null,
      decision: null,
      history: [],
    };

    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journeyWithoutCorrection,
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html).toContain('data-adaptive-path-correction="unavailable"');
    expect(html).toContain('暂无法生成纠偏方案');
    expect(html).not.toContain('查看纠偏方案');
  });

  it('uses the current path overview for the fallback return action', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'error',
      journey: null,
      error: 'journey-read-rejected',
      onRefresh: () => undefined,
    }));

    expect(html).toContain('href="/assessment/adaptive-practice?goal=control-correction"');
    expect(html).not.toContain('nodeId=node-1');
  });

  it('renders only one return action when the ready next action resolves to the path return', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'ready',
        nodeId: 'node-1',
        title: '返回学习路径',
        type: 'adaptive_quiz',
        href: launchContext().returnHref,
        reason: null,
        recovery: null,
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(1);
    expect(html).not.toContain('data-adaptive-path-next-action="ready"');
  });

  it('normalizes query ordering before deduplicating an equivalent return target', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'ready',
        nodeId: 'node-1',
        title: '返回学习路径',
        type: 'adaptive_quiz',
        href: '/assessment/adaptive-practice?nodeId=node-1&pathId=path-1&intent=path-execution&goal=control-correction',
        reason: null,
        recovery: null,
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(1);
    expect(html).not.toContain('data-adaptive-path-next-action="ready"');
  });

  it('suppresses a ready action that links the active launch node to itself after return moves to the path overview', () => {
    const currentJourney = journey({
      state: 'ready',
      nodeId: 'node-2',
      title: '返回学习路径',
      type: 'adaptive_quiz',
      href: launchContext().returnHref,
      reason: null,
      recovery: null,
    });
    currentJourney.return = {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1',
    };

    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: currentJourney,
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(1);
    expect(html).toContain('href="/assessment/adaptive-practice?goal=control-correction"');
    expect(html).not.toContain('data-adaptive-path-next-action="ready"');
  });

  it('keeps a same-label next action when its normalized target differs from the return target', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'ready',
        nodeId: 'node-2',
        title: '返回学习路径',
        type: 'knowledge_card',
        href: '/knowledge?nodeId=node-2',
        reason: null,
        recovery: null,
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(2);
    expect(html).toContain('data-adaptive-path-next-action="ready"');
    expect(html).toContain('href="/knowledge?nodeId=node-2"');
  });

  it('does not repeat the return action as blocked recovery', () => {
    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: journey({
        state: 'blocked',
        nodeId: 'node-1',
        title: '理解频域指标',
        type: 'knowledge_card',
        href: null,
        reason: '当前结果未通过路径验证',
        recovery: { label: '返回学习路径', href: launchContext().returnHref },
      }),
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(1);
  });

  it('suppresses a blocked recovery that links back to the active launch node', () => {
    const blockedJourney = journey({
      state: 'blocked',
      nodeId: 'node-1',
      title: '当前节点暂不可继续',
      type: 'knowledge_card',
      href: null,
      reason: '当前节点暂不可继续',
      recovery: { label: '返回学习路径', href: launchContext().returnHref },
    });
    blockedJourney.return = {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1',
    };

    const html = renderToStaticMarkup(createElement(AdaptivePathJourneyControl, {
      launchContext: launchContext(),
      status: 'ready',
      journey: blockedJourney,
      error: null,
      onRefresh: () => undefined,
    }));

    expect(html.match(/返回学习路径/g)).toHaveLength(1);
    expect(html).not.toContain(`href="${launchContext().returnHref.replaceAll('&', '&amp;')}"`);
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

  it('audits every direct shared journey-control mount', () => {
    expect(findJourneyControlMounts('src').sort()).toEqual([
      'src/app/assessment/adaptive-practice/page.tsx',
      'src/app/knowledge/page.tsx',
      'src/app/simulations/_components/simulation-shell.tsx',
      'src/features/arena/arena-path-journey-control.tsx',
      'src/features/control-workbench/shell/control-workbench-shell.tsx',
      'src/features/interactive/interactive-learning-shell.tsx',
      'src/features/interactive/shared/lesson-runtime-shell.tsx',
    ]);
  });

  it('suppresses resource-page return actions when the shared path journey owns navigation', () => {
    const resourcePageSource = readSource('src/app/interactive-learning/resources/[id]/page.tsx');

    expect(resourcePageSource).toContain('const showLocalReturnAction = !pathLaunchContext;');
    expect(resourcePageSource).toContain('actions={showLocalReturnAction ? (');
    expect(resourcePageSource).toContain('action={showLocalReturnAction ? (');
    expect(resourcePageSource).toContain('pathLaunchContext');
    expect(resourcePageSource).toContain('{ label: sourceContext.label }');
  });

  it('keeps the resource-page return action for non-path sources', () => {
    const resourcePageSource = readSource('src/app/interactive-learning/resources/[id]/page.tsx');

    expect(resourcePageSource).toContain('const showLocalReturnAction = !pathLaunchContext;');
    expect(resourcePageSource).toContain('href={sourceContext.href}');
    expect(resourcePageSource).toContain('返回{sourceContext.label}');
  });

  it('suppresses invalid lesson-runtime return actions when the shared path journey owns navigation', () => {
    const lessonShellSource = readSource('src/features/interactive/shared/lesson-runtime-shell.tsx');

    expect(lessonShellSource).toContain('const showRuntimeReturnAction = !pathLaunchContext;');
    expect(lessonShellSource).toContain('{showRuntimeReturnAction ? (');
    expect(lessonShellSource).toContain("{ label: '学习路径' },");
    expect(lessonShellSource).not.toContain('{ label: runtimeReturnLabel, href: runtimeReturnHref },');
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
    expect(resolveAdaptivePathJourneyTargetDisposition(
      'arena_task',
      '/arena/challenges/task-second-order-lead-pid',
    )).toBe('destination-control');
    expect(resolveAdaptivePathJourneyTargetDisposition('arena_task', '/arena/challenges/task-unknown')).toBe('blocked');
    expect(resolveAdaptivePathJourneyTargetDisposition('arena_task', '/arena')).toBe('blocked');
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

  it('keeps every governed path node type in the destination support matrix', () => {
    const targets: Record<(typeof GOVERNED_PATH_NODE_TYPES)[number], {
      target: string;
      disposition: ReturnType<typeof resolveAdaptivePathJourneyTargetDisposition>;
    }> = {
      interactive_lesson: { target: '/interactive-learning/courses/control-foundations', disposition: 'destination-control' },
      knowledge_card: { target: '/course-runtime/knowledge/cards/control-foundations.md', disposition: 'path-center-explicit' },
      textbook_section: { target: '/course-runtime/resources/textbooks/control/sections/ch01.md', disposition: 'path-center-explicit' },
      slides: { target: '/course-runtime/lessons/control/slides.pdf', disposition: 'path-center-explicit' },
      adaptive_quiz: { target: '/assessment/adaptive-practice', disposition: 'destination-control' },
      control_workbench: { target: '/interactive-learning/control-workbench', disposition: 'destination-control' },
      simulation: { target: '/simulations/step-response', disposition: 'destination-control' },
      arena_task: { target: '/arena/challenges/task-second-order-lead-pid', disposition: 'destination-control' },
      external_resource: { target: 'https://example.edu/control-resource', disposition: 'external-fallback' },
      reflection: { target: '/assessment/adaptive-practice', disposition: 'destination-control' },
      checkpoint: { target: '/assessment/adaptive-practice', disposition: 'destination-control' },
      konling: { target: '/assessment/adaptive-practice', disposition: 'destination-control' },
    };

    expect(Object.keys(targets)).toEqual([...GOVERNED_PATH_NODE_TYPES]);
    for (const type of GOVERNED_PATH_NODE_TYPES) {
      expect(resolveAdaptivePathJourneyTargetDisposition(type, targets[type].target), type).toBe(targets[type].disposition);
    }
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
