import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';
import { getControlWorkbenchReturnHref } from '../shell/control-workbench-shell';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('control workbench session resolver', () => {
  it('resolves a challenge-bound session from an Arena task id', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.mode).toBe('challenge');
    expect(result.session.task.id).toBe('task-second-order-lead-pid');
    expect(result.session.object.id).toBe('plant-second-order-underdamped');
    expect(result.session.metricProfile.id).toBe('metric-whitebox-time-domain-balanced');
    expect(result.session.leaderboardPolicy.id).toBe('leaderboard-whitebox-default');
    expect(result.session.allowedMethods).toEqual(['serial-compensator', 'pid']);
    expect(result.session.recommendedWorkspaceMode).toBe('multi-representation-linkage');
    expect(result.session.defaultPreset).toBe('classic-whitebox');
    expect(result.session.officialTarget.hiddenTarget).toBe(false);
    expect(result.session.workingModel?.sourceObjectId).toBe('plant-second-order-underdamped');
    expect(result.session.submissionPolicy.officialEvaluationEnabled).toBe(true);
  });

  it('resolves free-explore mode without official submission eligibility', () => {
    const result = resolveControlWorkbenchSession({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.mode).toBe('explore');
    expect(result.session.object.id).toBe('plant-second-order-underdamped');
    expect(result.session.officialTarget).toBeNull();
    expect(result.session.workingModel?.sourceObjectId).toBe('plant-second-order-underdamped');
    expect(result.session.workingModel?.representation.kind).toBe('transfer-function');
    expect(result.session.submissionPolicy.officialEvaluationEnabled).toBe(false);
    expect(result.session.submissionPolicy.leaderboardEnabled).toBe(false);
    expect(result.session.submissionPolicy.disabledReason).toContain('自由探索');
  });

  it('selects a configured free-explore object from objectId and falls back safely', () => {
    const selected = resolveControlWorkbenchSession({
      mode: 'explore',
      preset: 'classic-four-view',
      objectId: 'plant-first-order-lag',
    });
    const fallback = resolveControlWorkbenchSession({
      mode: 'explore',
      preset: 'classic-four-view',
      objectId: 'missing-object',
    });

    expect(selected.ok).toBe(true);
    expect(fallback.ok).toBe(true);
    if (!selected.ok || !fallback.ok) return;

    expect(selected.session.mode).toBe('explore');
    expect(selected.session.object.id).toBe('plant-first-order-lag');
    expect(selected.session.workingModel?.sourceObjectId).toBe('plant-first-order-lag');
    expect(fallback.session.object.id).toBe('plant-second-order-underdamped');
    expect('taskId' in selected.session).toBe(false);
    expect(selected.session.officialTarget).toBeNull();
  });

  it('preserves publication id as assignment context', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      publicationId: 'pub-1',
      classId: 'class-1',
      seasonId: 'season-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.mode).toBe('assignment');
    expect(result.session.publicationId).toBe('pub-1');
    expect(result.session.classId).toBe('class-1');
    expect(result.session.seasonId).toBe('season-1');
    expect(result.session.submissionPolicy.leaderboardTypes).toContain('class');
  });

  it('fails closed for unknown Arena task ids', () => {
    const result = resolveControlWorkbenchSession({ arenaTask: 'missing-task' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('invalid-arena-task');
    expect(result.error.message).toContain('无法解析竞技场挑战');
  });

  it('fails closed when explore mode is paired with an unknown Arena task id', () => {
    const result = resolveControlWorkbenchSession({ arenaTask: 'missing-task', mode: 'explore' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('invalid-arena-task');
  });

  it('hides the official transfer function for black-box challenge targets', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-cruise-roll-blackbox-identification',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.mode).toBe('challenge');
    expect(result.session.officialTarget.hiddenTarget).toBe(true);
    expect('transferFunction' in result.session.officialTarget).toBe(false);
    expect(result.session.workingModel).toBeNull();
  });
});

describe('control workbench route boundary', () => {
  it('adds the unified route while keeping existing workbench routes available', () => {
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/control-workbench/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/multi-representation-linkage/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/control-odyssey/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/lesson-05/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/simulations/cruise/page.tsx'))).toBe(true);
  });

  it('parses supported route parameters and renders fail-closed error state from the route', () => {
    const routeSource = readRepoFile('src/app/interactive-learning/control-workbench/page.tsx');
    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');

    expect(routeSource).toContain('arenaTask');
    expect(routeSource).toContain('publicationId');
    expect(routeSource).toContain('preset');
    expect(routeSource).toContain('mode');
    expect(routeSource).toContain('resolveControlWorkbenchSession');
    expect(shellSource).toContain('无法解析竞技场挑战');
    expect(shellSource).toContain('自由探索模式');
    expect(shellSource).toContain('视图配置');
    expect(shellSource).toContain('重置默认');
    expect(shellSource).toContain('ArenaWorkbenchSubmissionMount');
    expect(shellSource).toContain('showArenaSubmissionMount');
    expect(shellSource).toContain("session.defaultPreset !== 'classic-whitebox'");
    expect(shellSource).toContain('workspaceMode={session.recommendedWorkspaceMode}');
  });

  it('preserves assignment publication id in the challenge return link', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      publicationId: 'pub 1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getControlWorkbenchReturnHref(result.session)).toBe(
      '/arena/challenges/task-second-order-lead-pid?publicationId=pub+1',
    );
  });

  it('returns free exploration to the cross-domain catalog', () => {
    const result = resolveControlWorkbenchSession({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getControlWorkbenchReturnHref(result.session)).toBe('/interactive-learning/cross-domain-exploration');
  });
});
