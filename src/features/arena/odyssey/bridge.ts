import type { ControllerId, LevelTier } from '@/resources/interactive-learning/control-odyssey/level-data';

import type { CreatePersistedArenaSubmissionInput } from '../submissions/persistence';
import { createPersistedArenaSubmission } from '../submissions/persistence';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ControllerArtifact } from '../types';
import { getArenaTaskForOdysseyLevel } from './assignment';
import { normalizeOdysseyOfficialTelemetry } from './telemetry';

export { getArenaTaskForOdysseyLevel } from './assignment';

export interface BuildOdysseyArenaArtifactInput {
  runId: string;
  levelId: string;
  tier: LevelTier | string;
  controllerId?: ControllerId;
  pidParams?: { kp: number; ki: number; kd: number };
  metrics?: Record<string, unknown>;
}

export interface OdysseyArenaBridgeMarkerStore {
  findByOdysseyRun(input: { runId: string; taskId: string; publicationId?: string }): Promise<ArenaSubmissionRecord | null>;
  markOdysseyRunSubmitted(input: {
    runId: string;
    taskId: string;
    publicationId?: string;
    submission: ArenaSubmissionRecord;
  }): Promise<void>;
}

export interface BridgeOdysseyRunInput extends BuildOdysseyArenaArtifactInput {
  userId: string;
  studentLabel: string;
  publicationId?: string;
  classId?: string;
  seasonId?: string;
  isLate?: boolean;
  submittedAt: string;
  store?: OdysseyArenaBridgeMarkerStore;
  createSubmission?: (input: CreatePersistedArenaSubmissionInput) => Promise<ArenaSubmissionRecord>;
  submissionStore?: CreatePersistedArenaSubmissionInput['store'];
}

export type BridgeOdysseyRunResult =
  | { ok: true; submission: ArenaSubmissionRecord; duplicate: boolean; gameScorePreserved: true }
  | { ok: false; reason: string; gameScorePreserved: true };

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function isEligibleOdysseyArenaLevel(levelId: string, tier: string): boolean {
  return Boolean(getArenaTaskForOdysseyLevel(levelId)) && (tier === 'bronze' || tier === 'silver' || tier === 'gold');
}

export function buildOdysseyArenaArtifact(input: BuildOdysseyArenaArtifactInput): ControllerArtifact {
  const taskId = getArenaTaskForOdysseyLevel(input.levelId);
  if (!taskId || !isEligibleOdysseyArenaLevel(input.levelId, String(input.tier))) {
    throw new Error(`Odyssey level ${input.levelId} is not eligible for Arena bridge submission.`);
  }
  const metrics = input.metrics ?? {};
  const telemetry = normalizeOdysseyOfficialTelemetry(metrics);
  if (!telemetry.ok) {
    throw new Error(telemetry.reason);
  }
  const pidParams = input.pidParams ?? {
    kp: finiteNumber((metrics as Record<string, unknown>).kp, 1),
    ki: finiteNumber((metrics as Record<string, unknown>).ki, 0),
    kd: finiteNumber((metrics as Record<string, unknown>).kd, 0),
  };

  return {
    id: `odyssey-arena-${input.runId}`,
    taskId,
    method: 'pid',
    params: {
      ...pidParams,
      odysseyRunId: input.runId,
      odysseyLevelId: input.levelId,
      odysseyTier: input.tier,
      odysseyControllerId: input.controllerId ?? 'PID',
      odysseyMetricsJson: JSON.stringify(metrics),
      odysseyOfficialMetricsJson: JSON.stringify(telemetry.metrics),
      odysseyTelemetryComplete: true,
    },
    createdAt: new Date(0).toISOString(),
  };
}

export async function bridgeOdysseyRunToArenaSubmission(input: BridgeOdysseyRunInput): Promise<BridgeOdysseyRunResult> {
  const taskId = getArenaTaskForOdysseyLevel(input.levelId);
  if (!taskId || !isEligibleOdysseyArenaLevel(input.levelId, String(input.tier))) {
    return { ok: false, reason: 'Odyssey level is not eligible for Arena bridge submission.', gameScorePreserved: true };
  }

  const existing = await input.store?.findByOdysseyRun({
    runId: input.runId,
    taskId,
    publicationId: input.publicationId,
  });
  if (existing) {
    return { ok: true, submission: existing, duplicate: true, gameScorePreserved: true };
  }

  const createSubmission = input.createSubmission ?? createPersistedArenaSubmission;
  if (!input.submissionStore && !input.createSubmission) {
    return { ok: false, reason: 'Arena submission store is required.', gameScorePreserved: true };
  }
  const telemetry = normalizeOdysseyOfficialTelemetry(input.metrics);
  if (!telemetry.ok) {
    return { ok: false, reason: telemetry.reason, gameScorePreserved: true };
  }

  try {
    const submission = await createSubmission({
      taskId,
      artifact: buildOdysseyArenaArtifact(input),
      userId: input.userId,
      publicationId: input.publicationId,
      classId: input.classId,
      seasonId: input.seasonId,
      isLate: input.isLate,
      studentLabel: input.studentLabel,
      submittedAt: input.submittedAt,
      store: input.submissionStore as CreatePersistedArenaSubmissionInput['store'],
      source: 'odyssey-bridge',
    });
    await input.store?.markOdysseyRunSubmitted({
      runId: input.runId,
      taskId,
      publicationId: input.publicationId,
      submission,
    });
    return { ok: true, submission, duplicate: false, gameScorePreserved: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Arena bridge submission failed.',
      gameScorePreserved: true,
    };
  }
}
