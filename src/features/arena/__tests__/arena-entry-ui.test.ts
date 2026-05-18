import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ChallengeDetail } from '../challenge-detail';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

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

describe('arena student entry UI boundaries', () => {
  it('uses the shared Arena shell and removes public review entry links', () => {
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const shellSource = readRepoFile('src/features/arena/arena-page-shell.tsx');
    const homeSource = readRepoFile('src/app/page.tsx');
    const authLayoutSource = readRepoFile('src/app/(auth)/layout.tsx');

    expect(hallSource).toContain('ArenaPageShell');
    expect(hallSource).toContain("from './display-labels'");
    expect(hallSource).not.toContain("from '@/features/arena'");
    expect(detailSource).toContain('ArenaPageShell');
    expect(hallSource).toContain("'首页'");
    expect(hallSource).toContain("'竞技场首页'");
    expect(detailSource).toContain("'首页'");
    expect(detailSource).toContain("'竞技场首页'");
    expect(shellSource).toContain("'虚拟仿真'");
    expect(shellSource).toContain("'竞技场'");
    expect(shellSource).toContain("'知识图谱'");
    expect(shellSource).toContain("'互动学习'");
    expect(shellSource).not.toContain("'我的方案'");
    expect(shellSource).not.toContain("'通知消息'");
    expect(shellSource).not.toContain("'AI 助教'");
    expect(shellSource).not.toContain("'成绩与统计'");
    expect(shellSource).not.toContain("bg-[#061b3c]");
    expect(shellSource).not.toContain("bg-[#f6f9ff]");
    expect(shellSource).toContain('href="/profile"');
    expect(detailSource).toContain('`/arena/challenges/${task.id}`');
    expect(homeSource).not.toContain('评审入口');
    expect(homeSource).not.toContain("href: '/review'");
    expect(authLayoutSource).not.toContain('评审入口');
    expect(authLayoutSource).not.toContain('href="/review"');
  });

  it('keeps challenge detail read-only and moves official submission to workbench only', () => {
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const workbenchSource = readRepoFile('src/features/interactive/multi-representation-linkage/page-client.tsx');
    const legacyRouteSource = readRepoFile('src/app/interactive-learning/multi-representation-linkage/page.tsx');
    const controlWorkbenchRouteSource = readRepoFile('src/app/interactive-learning/control-workbench/page.tsx');
    const controlOdysseySource = readRepoFile('src/app/interactive-learning/control-odyssey/page.tsx');
    const blockDiagramSource = readRepoFile('src/app/interactive-learning/lesson-05/page.tsx');
    const predictiveControlSource = readRepoFile('src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/page.tsx');
    const cruiseSource = readRepoFile('src/app/simulations/cruise/page.tsx');
    const genericMountSource = readRepoFile('src/features/arena/workbench/arena-workbench-submission-mount.tsx');
    const submissionsApiSource = readRepoFile('src/app/api/arena/submissions/route.ts');

    expect(detailSource).not.toContain('ArenaSubmissionPanel');
    expect(detailSource).not.toContain('ArenaBlackBoxSubmissionPanel');
    expect(detailSource).toContain('getChallengeLeaderboardBrowserData');
    expect(detailSource).toContain('browser={leaderboardBrowser}');
    expect(detailSource).not.toContain('submissions={submissions}');
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
    expect(blockDiagramSource).toContain('<ArenaWorkbenchSubmissionMount workspaceMode="block-diagram-workbench"');
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

  it('renders white-box models, Chinese rule modules, constrained leaderboards, and knowledge preview affordances', () => {
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const knowledgePreviewSource = readRepoFile('src/features/arena/challenge-knowledge-preview.tsx');
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const detailAndPreviewSource = `${detailSource}\n${knowledgePreviewSource}`;

    expect(detailSource).toContain('BlockMath');
    expect(detailSource).toContain('基础目标');
    expect(detailSource).toContain('硬约束');
    expect(detailAndPreviewSource).toContain('KnowledgeCardDialog');
    expect(detailAndPreviewSource).toContain('/api/knowledge/nodes/');
    expect(hallSource).toContain("'main', label: '主榜'");
    expect(hallSource).toContain("'method', label: '方法榜'");
    expect(hallSource).toContain("'metric', label: '指标榜'");
    expect(hallSource).not.toContain('Pareto 榜');
    expect(hallSource).not.toContain('班级榜');
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
    expect(html).toContain('姓名');
    expect(html).toContain('学号');
    expect(html).toContain('具体指标');
    expect(html).toContain('2026001');
    expect(html).toContain('未登记');
  });

  it('loads existing teacher publications before showing lifecycle actions', () => {
    const teacherConfigSource = readRepoFile('src/features/arena/teacher/teacher-arena-config.tsx');

    expect(teacherConfigSource).toContain("fetch('/api/teacher/arena/publications'");
    expect(teacherConfigSource).toContain('setPublishedItems(payload.publications)');
    expect(teacherConfigSource).toContain("fetch(`/api/teacher/arena/publications/${publicationId}/status`");
  });
});
