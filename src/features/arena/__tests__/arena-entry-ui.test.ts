import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('arena student entry UI boundaries', () => {
  it('uses the shared Arena shell and removes public review entry links', () => {
    const hallSource = readRepoFile('src/features/arena/arena-hall.tsx');
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const homeSource = readRepoFile('src/app/page.tsx');
    const authLayoutSource = readRepoFile('src/app/(auth)/layout.tsx');

    expect(hallSource).toContain('ArenaPageShell');
    expect(hallSource).toContain("from './display-labels'");
    expect(hallSource).not.toContain("from '@/features/arena'");
    expect(detailSource).toContain('ArenaPageShell');
    expect(hallSource).toContain('课程：自动控制原理');
    expect(detailSource).toContain('`/arena/challenges/${task.id}`');
    expect(homeSource).not.toContain('评审入口');
    expect(homeSource).not.toContain("href: '/review'");
    expect(authLayoutSource).not.toContain('评审入口');
    expect(authLayoutSource).not.toContain('href="/review"');
  });

  it('keeps challenge detail read-only and moves official submission to workbench only', () => {
    const detailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const workbenchSource = readRepoFile('src/features/interactive/multi-representation-linkage/page-client.tsx');
    const controlOdysseySource = readRepoFile('src/app/interactive-learning/control-odyssey/page.tsx');
    const blockDiagramSource = readRepoFile('src/app/interactive-learning/lesson-05/page.tsx');
    const predictiveControlSource = readRepoFile('src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/page.tsx');
    const genericMountSource = readRepoFile('src/features/arena/workbench/arena-workbench-submission-mount.tsx');
    const submissionsApiSource = readRepoFile('src/app/api/arena/submissions/route.ts');

    expect(detailSource).not.toContain('ArenaSubmissionPanel');
    expect(detailSource).not.toContain('ArenaBlackBoxSubmissionPanel');
    expect(detailSource).toContain('仿真调试与方案提交均在工作台内完成');
    expect(workbenchSource).toContain('<ArenaSubmitPanel');
    expect(controlOdysseySource).toContain('<ArenaWorkbenchSubmissionMount workspaceMode="control-odyssey"');
    expect(blockDiagramSource).toContain('<ArenaWorkbenchSubmissionMount workspaceMode="block-diagram-workbench"');
    expect(predictiveControlSource).toContain('<ArenaWorkbenchSubmissionMount workspaceMode="predictive-control"');
    expect(genericMountSource).toContain('/api/arena/submissions');
    expect(genericMountSource).toContain('<ArenaSubmissionPanel');
    expect(submissionsApiSource).toContain('prismaArenaSubmissionStore.listSubmissions({ taskId })');
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
});
