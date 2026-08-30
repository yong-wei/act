import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ArenaHall } from '../arena-hall';
import { ChallengeDetail } from '../challenge-detail';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ArenaPublicationRecord } from '../teacher/publication-store';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function getChallengeDetailFixture(taskId: string) {
  const task = getArenaChallengeTask(taskId);
  expect(task).toBeDefined();
  const object = getArenaChallengeObject(task!.objectId);
  expect(object).toBeDefined();
  const metricProfile = getArenaMetricProfile(task!.metricProfileId);
  expect(metricProfile).toBeDefined();
  const leaderboardPolicy = getArenaLeaderboardPolicy(task!.leaderboardPolicyId);
  expect(leaderboardPolicy).toBeDefined();

  return {
    task: task!,
    object: object!,
    metricProfile: metricProfile!,
    leaderboardPolicy: leaderboardPolicy!,
  };
}

function leaderboardSubmission(overrides: Partial<ArenaSubmissionRecord>): ArenaSubmissionRecord {
  return {
    id: 'submission-ui-a',
    taskId: 'task-second-order-lead-pid',
    userId: 'student-ui-a',
    studentLabel: '学生甲',
    studentNumber: '2026001',
    artifactHash: 'artifact-ui-a',
    artifact: {
      id: 'artifact-ui-a',
      taskId: 'task-second-order-lead-pid',
      method: 'pid',
      params: { kp: 2.4, ki: 0.8, kd: 0.35 },
      createdAt: '2026-05-10T10:00:00.000Z',
    },
    evaluation: {
      taskId: 'task-second-order-lead-pid',
      artifact: {
        id: 'artifact-ui-a',
        taskId: 'task-second-order-lead-pid',
        method: 'pid',
        params: { kp: 2.4, ki: 0.8, kd: 0.35 },
        createdAt: '2026-05-10T10:00:00.000Z',
      },
      valid: true,
      score: 82,
      metrics: { settlingTime: 3.2, overshoot: 4.1, steadyStateError: 0.01, controlEnergy: 8 },
      satisfaction: {},
      hardConstraintResults: [],
      penalties: [],
      explanation: [],
    },
    submittedAt: '2026-05-10T10:01:00.000Z',
    reusedEvaluation: false,
    ...overrides,
  };
}

function arenaPublicationFixture(overrides: Partial<ArenaPublicationRecord>): ArenaPublicationRecord {
  return {
    id: 'publication-fixture',
    taskId: 'task-second-order-lead-pid',
    classId: 'class-a',
    teacherId: 'teacher-a',
    studentVisibility: 'class',
    visibility: 'class',
    deadline: '2099-06-01T08:00:00.000Z',
    leaderboardPolicyId: 'leaderboard-class-homework',
    homeworkBinding: true,
    templateId: 'template-pid-tuning',
    targetSignal: '单位阶跃参考输入',
    disturbance: '无外加扰动',
    initialCondition: '零初始状态',
    allowedMethods: [],
    hardConstraints: [],
    scoringMetricWeights: {},
    paretoEnabled: false,
    hiddenTestEnabled: false,
    gradeBinding: true,
    publicLeaderboard: false,
    telemetryLevel: 'L0',
    status: 'active',
    gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    createdAt: '2026-05-16T08:00:00.000Z',
    updatedAt: '2026-05-16T08:00:00.000Z',
    ...overrides,
  };
}

describe('arena student entry UI boundaries', () => {
  it('uses the shared Arena shell and removes public review entry links', () => {
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const shellSource = readRepoFile('src/features/arena/arena-page-shell.tsx');
    const visualAssetSource = readRepoFile('src/components/platform/visual-world-assets.ts');
    const homeSource = readRepoFile('src/app/page.tsx');
    const authLayoutSource = readRepoFile('src/app/(auth)/layout.tsx');
    const navigationSource = readRepoFile('src/lib/platform-role-navigation.ts');

    expect(hallSource).toContain('ArenaPageShell');
    expect(hallSource).toContain("from './display-labels'");
    expect(hallSource).not.toContain("from '@/features/arena'");
    expect(detailSource).toContain('ArenaPageShell');
    expect(hallSource).toContain("'首页'");
    expect(hallSource).toContain("'竞技场首页'");
    expect(detailSource).toContain("'首页'");
    expect(detailSource).toContain("'竞技场首页'");
    expect(shellSource).toContain('getPlatformRouteNavigation');
    expect(navigationSource).toContain("'虚拟仿真'");
    expect(navigationSource).toContain("'竞技场'");
    expect(navigationSource).toContain("'知识资源'");
    expect(navigationSource).toContain("'控制工作台'");
    expect(navigationSource).toContain("'学习路径'");
    expect(navigationSource).toContain("'互动学习'");
    expect(navigationSource).toContain("'个人中心'");
    expect(shellSource).not.toContain("'我的方案'");
    expect(shellSource).not.toContain("'通知消息'");
    expect(shellSource).not.toContain("'AI 助教'");
    expect(shellSource).not.toContain("'成绩与统计'");
    expect(shellSource).not.toContain("bg-[#061b3c]");
    expect(shellSource).not.toContain("bg-[#f6f9ff]");
    expect(shellSource).toContain('<AppShell');
    expect(shellSource).toContain('sidebarMode="collapsible"');
    expect(shellSource).toContain("mobileNavigation: 'drawer'");
    expect(shellSource).toContain('data-arena-workspace-shell="true"');
    expect(shellSource).not.toContain('userMenu={');
    expect(shellSource).not.toContain('href="/profile"');
    expect(shellSource).toContain('data-mobile-navigation="drawer"');
    const appShellSource = readRepoFile('src/components/platform/app-shell.tsx');
    expect(appShellSource).toContain('data-shell-navigation-state');
    expect(appShellSource).toContain('PanelLeftClose');
    expect(appShellSource).toContain('PanelLeftOpen');
    expect(visualAssetSource).toContain('/assets/platform/visual-worlds/arena/control-bench.svg');
    expect(visualAssetSource).toContain('/assets/platform/visual-worlds/arena/challenge-map.svg');
    expect(visualAssetSource).toContain('/assets/platform/visual-worlds/arena/score-field.svg');
    expect(visualAssetSource).toContain('/assets/platform/visual-worlds/arena/empty-state.svg');
    expect(hallSource).toContain("ARENA_VISUAL_ASSETS['challenge-map'].src");
    expect(hallSource).toContain("ARENA_VISUAL_ASSETS['score-field'].src");
    expect(detailSource).toContain("ARENA_VISUAL_ASSETS['control-bench'].src");
    expect(detailSource).toContain("ARENA_VISUAL_ASSETS['score-field'].src");
    expect(`${hallSource}\n${detailSource}\n${shellSource}`).not.toContain('商业');
    expect(`${hallSource}\n${detailSource}\n${shellSource}`).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(detailSource).toContain('`/arena/challenges/${task.id}`');
    expect(homeSource).not.toContain('评审入口');
    expect(homeSource).not.toContain("href: '/review'");
    expect(authLayoutSource).not.toContain('评审入口');
    expect(authLayoutSource).not.toContain('href="/review"');
  });

  it('keeps challenge detail read-only and moves official submission to workbench only', () => {
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const leaderboardBrowserSource = readRepoFile('src/features/arena/challenge-leaderboard-browser.tsx');
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const workbenchSource = readRepoFile('src/features/interactive/multi-representation-linkage/page-client.tsx');
    const legacyRouteSource = readRepoFile('src/app/interactive-learning/multi-representation-linkage/page.tsx');
    const controlWorkbenchRouteSource = readRepoFile('src/app/interactive-learning/control-workbench/page.tsx');
    const controlOdysseySource = readRepoFile('src/app/interactive-learning/control-odyssey/page.tsx');
    const predictiveControlSource = readRepoFile('src/features/interactive/course-app-routes/unit-5-4-data-driven-mpc-transition/entry.tsx');
    const cruiseSource = readRepoFile('src/app/simulations/cruise/page.tsx');
    const genericMountSource = readRepoFile('src/features/arena/workbench/arena-workbench-submission-mount.tsx');
    const submissionsApiSource = readRepoFile('src/app/api/arena/submissions/route.ts');

    expect(detailSource).not.toContain('ArenaSubmissionPanel');
    expect(detailSource).not.toContain('ArenaBlackBoxSubmissionPanel');
    expect(detailSource).toContain('AdaptivePathJourneyControlForArenaTask');
    expect(detailSource).not.toContain('ARENA_HIDDEN_TEST_SIGNAL_LABELS');
    expect(detailSource).not.toContain('task.training.hiddenTestSignal');
    expect(hallSource).not.toContain('ARENA_HIDDEN_TEST_SIGNAL_LABELS');
    expect(hallSource).not.toContain('challenge.training.hiddenTestSignal');
    expect(detailSource).toContain('评测边界');
    expect(detailSource).toContain('详情页不会完成当前路径节点');
    expect(detailSource).toContain('getChallengeLeaderboardBrowserData');
    expect(detailSource).toContain('browser={leaderboardBrowser}');
    expect(detailSource).not.toContain('submissions={submissions}');
    expect(leaderboardBrowserSource).toContain("timeZone: 'Asia/Shanghai'");
    expect(detailSource).toContain('仿真调试与方案提交均在控制工作台内完成');
    expect(detailSource).toContain('进入控制工作台');
    expect(detailSource).not.toContain('进入多表征工作台');
    expect(detailSource).not.toContain('进入黑箱仿真');
    expect(detailSource).not.toContain('进入 MPC 课程');
    expect(hallSource).toContain('推荐进入{getArenaHallEntryLabel');
    expect(hallSource).toContain('getArenaHallEntryLabel');
    expect(hallSource).toContain('控制奥德赛');
    expect(workbenchSource).toContain('<ArenaSubmitPanel');
    expect(legacyRouteSource).toContain('MultiRepresentationLinkageClient');
    expect(controlWorkbenchRouteSource).toContain('resolveControlWorkbenchSession');
    expect(controlWorkbenchRouteSource).toContain('arenaTask: firstValue(searchParams?.arenaTask)');
    expect(controlOdysseySource).toContain('<OdysseyArenaBridgeShell />');
    expect(controlOdysseySource).not.toContain('<ArenaWorkbenchSubmissionMount workspaceMode="control-odyssey"');
    expect(controlWorkbenchRouteSource).toContain('resolveControlWorkbenchSession');
    expect(predictiveControlSource).toContain('<ArenaWorkbenchSubmissionMount workspaceMode="predictive-control"');
    expect(genericMountSource).toContain('/api/arena/submissions');
    expect(genericMountSource).toContain("searchParams.get('publicationId')");
    expect(genericMountSource).toContain('publicationId={publicationId}');
    expect(genericMountSource).toContain('<ArenaSubmissionPanel');
    expect(genericMountSource).toContain('<ArenaBlackBoxSubmissionPanel');
    expect(genericMountSource).toContain("workspaceMode === 'black-box-identification'");
    expect(cruiseSource).toContain('requestedPublicationId');
    expect(cruiseSource).toContain('filterArenaSubmissionsForHiddenPublicationPolicy');
    expect(cruiseSource).toContain('publicationId={publicationContext?.id}');
    expect(submissionsApiSource).toContain('resolveAccessibleArenaPublicationForStudent');
    expect(submissionsApiSource).toContain('filterArenaSubmissionsForHiddenPublicationPolicy');
    expect(submissionsApiSource).toContain('publicationId,');
    expect(submissionsApiSource).toContain('submission.userId === viewerUserId');
  });

  it('renders the challenge detail entry link for the unified control workbench', () => {
    const props = getChallengeDetailFixture('task-second-order-lead-pid');
    const html = renderToStaticMarkup(createElement(ChallengeDetail, {
      ...props,
      submissions: [],
      publicationId: 'publication-a',
    }));

    expect(html).toContain('进入控制工作台');
    expect(html).toContain('首页');
    expect(html).toContain('竞技场首页');
    expect(html).toContain(props.task.title);
    expect(html).toContain('仿真调试与方案提交均在控制工作台内完成');
    expect(html).toContain('/interactive-learning/control-workbench?');
    expect(html).toContain('arenaTask=task-second-order-lead-pid');
    expect(html).toContain('publicationId=publication-a');
    expect(html).not.toContain('ArenaSubmissionPanel');
    expect(html).not.toContain('ArenaBlackBoxSubmissionPanel');
  });

  it('renders publication context and leaderboard source boundaries for student challenge entries', () => {
    const props = getChallengeDetailFixture('task-second-order-lead-pid');
    const html = renderToStaticMarkup(createElement(ChallengeDetail, {
      ...props,
      submissions: [],
      publicationId: 'publication-a',
      publicationContext: {
        assignmentTitle: '第三章课堂挑战',
        classTitle: '自动控制 2026 级 1 班',
        teacherLabel: '张老师',
        sourceLabel: '课堂发布',
        deadlineLabel: '2026年6月1日 16:00',
        lifecycleLabel: '进行中',
        leaderboardBoundary: '班级榜单只统计本发布的 ArenaSubmission 官方提交。',
      },
    }));

    expect(html).toContain('发布挑战');
    expect(html).toContain('第三章课堂挑战');
    expect(html).toContain('自动控制 2026 级 1 班');
    expect(html).toContain('张老师');
    expect(html).toContain('截止 2026年6月1日 16:00');
    expect(html).toContain('班级榜单只统计本发布的 ArenaSubmission 官方提交。');
  });

  it('keeps student publication leaderboard source wording aligned with public visibility', () => {
    const pageSource = readRepoFile('src/app/arena/challenges/[taskId]/page.tsx');

    expect(pageSource).toContain("publication.studentVisibility === 'public'");
    expect(pageSource).toContain("publicationContext.visibility === 'public' ? '公开 Arena 挑战'");
    expect(pageSource).toContain("? '公开挑战'");
    expect(pageSource).toContain("publicationContext.visibility === 'public' ? '公开 Arena'");
    expect(pageSource).toContain('公开榜单只统计服务端 ArenaSubmission 官方提交');
  });

  it('renders the Arena hall as a capability training map with existing filters', () => {
    const html = renderToStaticMarkup(createElement(ArenaHall, {
      taskStats: {},
      studentPublications: [],
    }));

    expect(html).toContain('能力训练地图');
    expect(html).toContain('训练阶段');
    expect(html).toContain('本阶段');
    expect(html).toContain('个挑战');
    expect(html).toContain('训练能力');
    expect(html).toContain('时域整形');
    expect(html).toContain('隐藏场景鲁棒性');
    expect(html).toContain('预计');
    expect(html).toContain('常见失误');
    expect(html).toContain('对象来源');
    expect(html).toContain('允许方法');
  });

  it('renders active and expired publication lifecycle badges in the Arena hall', () => {
    const activeHtml = renderToStaticMarkup(createElement(ArenaHall, {
      taskStats: {},
      studentPublications: [arenaPublicationFixture({
        id: 'publication-active',
        deadline: '2099-06-01T08:00:00.000Z',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      })],
    }));
    const expiredHtml = renderToStaticMarkup(createElement(ArenaHall, {
      taskStats: {},
      studentPublications: [arenaPublicationFixture({
        id: 'publication-expired',
        deadline: '2020-06-01T08:00:00.000Z',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      })],
    }));
    const lateOnlyHtml = renderToStaticMarkup(createElement(ArenaHall, {
      taskStats: {},
      studentPublications: [arenaPublicationFixture({
        id: 'publication-late-only',
        deadline: '2020-06-01T08:00:00.000Z',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true, allowLateSubmissions: true },
      })],
    }));

    expect(activeHtml).toContain('发布进行中');
    expect(activeHtml).toContain('班级榜单：本发布官方提交');
    expect(expiredHtml).toContain('发布已截止');
    expect(expiredHtml).toContain('报告/复盘可用');
    expect(lateOnlyHtml).toContain('已截止，可迟交');
    expect(lateOnlyHtml).toContain('迟交不进入正式榜单');
  });

  it('renders challenge detail training intent, prerequisites, effort, and failure points', () => {
    const props = getChallengeDetailFixture('task-ship-roll-mpc-hidden-scenarios');
    const html = renderToStaticMarkup(createElement(ChallengeDetail, {
      ...props,
      submissions: [],
    }));

    expect(html).toContain('训练意图');
    expect(html).toContain('训练能力');
    expect(html).toContain('前置能力');
    expect(html).toContain('预计用时');
    expect(html).toContain('常见失误');
    expect(html).toContain('隐藏场景');
    expect(html).toContain('约束优化');
  });

  it('renders white-box models, Chinese rule modules, constrained leaderboards, and knowledge preview affordances', () => {
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const knowledgePreviewSource = readRepoFile('src/features/arena/challenge-knowledge-preview.tsx');
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const detailAndPreviewSource = `${detailSource}\n${knowledgePreviewSource}`;

    expect(detailSource).toContain('BlockMath');
    expect(detailSource).toContain('基础目标');
    expect(detailSource).toContain('硬约束');
    expect(detailSource).not.toContain('-right-16 -top-16 h-44 w-72');
    expect(detailAndPreviewSource).toContain('KnowledgeCardDialog');
    expect(detailAndPreviewSource).toContain('/api/knowledge/nodes/');
    expect(knowledgePreviewSource).not.toMatch(/bg-white|bg-blue-50|text-slate-|border-slate-|border-blue-/);
    expect(hallSource).toContain("'main', label: '主榜'");
    expect(hallSource).toContain("'method', label: '方法榜'");
    expect(hallSource).toContain("'metric', label: '指标榜'");
    expect(hallSource).not.toContain('Pareto 榜');
    expect(hallSource).not.toContain('赛季榜');
  });

  it('renders a challenge-detail leaderboard browser with student number and metric columns', () => {
    const props = getChallengeDetailFixture('task-second-order-lead-pid');
    const html = renderToStaticMarkup(createElement(ChallengeDetail, {
      ...props,
      submissions: [
        leaderboardSubmission({ id: 'submission-ui-a', studentLabel: '学生甲', studentNumber: '2026001' }),
        leaderboardSubmission({
          id: 'submission-ui-b',
          userId: 'student-ui-b',
          studentLabel: '学生乙',
          studentNumber: undefined,
          artifactHash: 'artifact-ui-b',
          submittedAt: '2026-05-10T10:02:00.000Z',
          evaluation: {
            ...leaderboardSubmission({}).evaluation,
            score: 76,
            metrics: { settlingTime: 4.4, overshoot: 6.2, steadyStateError: 0.03, controlEnergy: 5 },
          },
        }),
      ],
    }));

    expect(html).toContain('主榜');
    expect(html).toContain('方法榜');
    expect(html).toContain('指标榜');
    expect(html).toContain('当前榜单');
    expect(html).toContain('姓名 / 学号');
    expect(html).toContain('具体指标');
    expect(html).toContain('2026001');
    expect(html).toContain('未登记');
    const leaderboardBrowserSource = readRepoFile('src/features/arena/challenge-leaderboard-browser.tsx');
    expect(leaderboardBrowserSource).toContain('current.showMethodColumn');
    expect(leaderboardBrowserSource).toContain('whitespace-nowrap');
  });

  it('loads existing teacher publications before showing lifecycle actions', () => {
    const teacherConfigSource = readRepoFile('src/features/arena/teacher/teacher-arena-config.tsx');

    expect(teacherConfigSource).toContain("fetch('/api/teacher/arena/publications'");
    expect(teacherConfigSource).toContain('setPublishedItems(payload.publications)');
    expect(teacherConfigSource).toContain("fetch(`/api/teacher/arena/publications/${publicationId}/status`");
  });
});
