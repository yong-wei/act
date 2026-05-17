import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildArtifactBridgeFailure,
  buildWorkbenchPlantTargetFromArenaObject,
  createDefaultWorkbenchSubmissionPolicy,
  isArtifactBridgeSuccess,
  type ArtifactBridgeResult,
  type ControllerDraft,
  type WorkbenchLayoutPreset,
  type WorkbenchSessionContext,
  type WorkbenchSignal,
} from '../contracts';
import { ARENA_CHALLENGE_OBJECTS, ARENA_CHALLENGE_TASKS } from '@/features/arena/data/seed-challenges';
import type { ChallengeObject, ControllerArtifact, LeaderboardPolicy, MetricProfile } from '@/features/arena/types';

function getObject(id: string) {
  const object = ARENA_CHALLENGE_OBJECTS.find((item) => item.id === id);
  expect(object).toBeTruthy();
  return object!;
}

function getTask(id: string) {
  const task = ARENA_CHALLENGE_TASKS.find((item) => item.id === id);
  expect(task).toBeTruthy();
  return task!;
}

describe('control workbench shared contracts', () => {
  it('represents a white-box Arena object with transfer-function data and LaTeX text', () => {
    const target = buildWorkbenchPlantTargetFromArenaObject(getObject('plant-second-order-underdamped'));

    expect(target.visibility).toBe('white-box');
    expect(target.hiddenTarget).toBe(false);
    expect(target.transferFunction).toEqual({
      display: 'G(s)=16/(s^2+2.4s+16)',
      latex: 'G(s)=\\frac{16}{s^2+2.4s+16}',
      numerator: [16],
      denominator: [1, 2.4, 16],
    });
  });

  it('represents a black-box Arena object without leaking transfer-function coefficients', () => {
    const blackBoxWithHiddenModel: ChallengeObject = {
      ...getObject('plant-cruise-roll-blackbox'),
      model: {
        display: 'hidden',
        latex: 'G_{hidden}(s)',
        numerator: [1],
        denominator: [1, 1],
      },
    };

    const target = buildWorkbenchPlantTargetFromArenaObject(blackBoxWithHiddenModel);

    expect(target.visibility).toBe('black-box');
    expect(target.hiddenTarget).toBe(true);
    expect(target.publicInterface).toContain('横摇角');
    expect('transferFunction' in target).toBe(false);
    expect(JSON.stringify(target)).not.toContain('G_{hidden}');
  });

  it('keeps explore sessions free of official targets and official leaderboard submission', () => {
    const policy = createDefaultWorkbenchSubmissionPolicy('explore');
    const session: WorkbenchSessionContext = {
      mode: 'explore',
      title: '自由探索',
      object: getObject('plant-second-order-underdamped'),
      selectedObjectId: 'plant-second-order-underdamped',
      officialTarget: null,
      workingModel: null,
      allowedMethods: ['pid', 'serial-compensator'],
      allowedViews: ['time-domain', 'bode', 'root-locus'],
      defaultPreset: 'free-explore',
      experimentPolicy: {
        enabled: true,
        signalTypes: ['step', 'impulse'],
        requiresPersistedDataset: false,
      },
      submissionPolicy: policy,
    };

    expect(session.officialTarget).toBeNull();
    expect(session.submissionPolicy.officialEvaluationEnabled).toBe(false);
    expect(session.submissionPolicy.leaderboardEnabled).toBe(false);
    expect(session.submissionPolicy.disabledReason).toContain('自由探索');
  });

  it('can describe source-aware signals and layout presets without React components', () => {
    const signal: WorkbenchSignal = {
      id: 'experiment-output-1',
      kind: 'output',
      source: 'experiment',
      label: '实验输出',
      unit: 'deg',
      samples: [
        { x: 0, y: 0 },
        { x: 1, y: 0.8 },
      ],
    };
    const preset: WorkbenchLayoutPreset = {
      id: 'classic-whitebox',
      label: '经典白箱四视图',
      viewConfigs: [
        { id: 'time-domain', title: '时域响应', enabled: true },
        { id: 'bode', title: 'Bode 图', enabled: true },
        { id: 'root-locus', title: '根轨迹', enabled: true },
        { id: 'nyquist', title: 'Nyquist 图', enabled: true },
      ],
      methodPanelIds: ['serial-compensator', 'pid'],
    };

    expect(signal.source).toBe('experiment');
    expect(preset.viewConfigs.map((view) => view.id)).toEqual(['time-domain', 'bode', 'root-locus', 'nyquist']);
  });

  it('requires official artifacts to travel through an artifact bridge result', () => {
    const task = getTask('task-second-order-lead-pid');
    const draft: ControllerDraft = {
      draftId: 'draft-1',
      method: 'pid',
      source: 'manual',
      params: { kp: 20, ki: 0, kd: 1 },
      dirty: true,
      partial: false,
      validation: { status: 'valid', issues: [] },
      updatedAt: '2026-05-16T00:00:00.000Z',
    };
    const artifact: ControllerArtifact = {
      id: 'artifact-1',
      taskId: task.id,
      method: draft.method,
      params: { kp: 20, ki: 0, kd: 1 },
      createdAt: '2026-05-16T00:00:00.000Z',
    };
    const success: ArtifactBridgeResult = { ok: true, draft, artifact };
    const failure = buildArtifactBridgeFailure(draft, '参数尚未通过闭环稳定性校验', 'draft-invalid');

    expect(isArtifactBridgeSuccess(success)).toBe(true);
    expect(success.artifact.taskId).toBe(task.id);
    expect(isArtifactBridgeSuccess(failure)).toBe(false);
    expect(failure.reason).toBe('参数尚未通过闭环稳定性校验');
  });

  it('can carry challenge and assignment context without pulling in UI implementation', () => {
    const task = getTask('task-second-order-lead-pid');
    const object = getObject(task.objectId);
    const target = buildWorkbenchPlantTargetFromArenaObject(object);
    const metricProfile: MetricProfile = {
      id: task.metricProfileId,
      name: '测试指标',
      hardConstraints: ['闭环稳定'],
      rankingMetrics: [],
      diagnosticMetrics: [],
    };
    const leaderboardPolicy: LeaderboardPolicy = {
      id: task.leaderboardPolicyId,
      name: '测试榜单',
      types: ['main', 'method', 'metric'],
      tieBreakers: ['score'],
      visibility: 'course',
    };
    const session: WorkbenchSessionContext = {
      mode: 'assignment',
      publicationId: 'publication-1',
      classId: 'class-1',
      seasonId: 'season-1',
      taskId: task.id,
      task,
      object,
      metricProfile,
      leaderboardPolicy,
      officialTarget: target,
      workingModel: null,
      allowedMethods: task.allowedMethods,
      allowedViews: ['time-domain', 'metric-summary'],
      defaultPreset: 'assignment-guided',
      recommendedWorkspaceMode: task.workspaceMode,
      experimentPolicy: {
        enabled: false,
        signalTypes: [],
        requiresPersistedDataset: false,
      },
      submissionPolicy: createDefaultWorkbenchSubmissionPolicy('assignment', {
        leaderboardTypes: task.leaderboardTypes,
      }),
    };

    expect(session.publicationId).toBe('publication-1');
    expect(session.officialTarget).toBe(target);
    expect(session.submissionPolicy.leaderboardTypes).toEqual(['main', 'method', 'metric']);
  });
});

describe('control workbench contract dependency boundary', () => {
  it('keeps every contract file free of UI, persistence, route, worker, and chart imports', () => {
    const contractsDir = join(process.cwd(), 'src/features/control-workbench/contracts');
    expect(existsSync(contractsDir)).toBe(true);

    const forbiddenPatterns = [
      /from ['"]react['"]/,
      /from ['"]@prisma\/client['"]/,
      /\/api\//,
      /prisma/i,
      /submissions\/prisma-store/,
      /resources\/control-system\/charts/,
      /worker/i,
      /\.tsx['"]/,
    ];
    const files = readdirSync(contractsDir).filter((name) => name.endsWith('.ts'));

    expect(files).toContain('index.ts');
    for (const file of files) {
      const source = readFileSync(join(contractsDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
