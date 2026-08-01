/**
 * Stop unfinished Legacy learning paths as immutable historical records (#1115).
 *
 * Does not map Legacy node sequences. Preserves goal/intent independently.
 * Does not rewrite completed paths, Canonical paths, or historical goalId.
 */

import {
  isCompletedPathStatus,
  isLegacyStoppedPathStatus,
  isUnfinishedLegacyPathStatus,
  LEGACY_STOPPED_PATH_STATUS,
  PRESERVED_LEARNING_INTENT_VERSION,
  type PreservedLearningIntent,
  type StopLegacyPathsAtCutoverResult,
} from './contracts';
import {
  conditionalStopLegacyPathRow,
  runInLearningPathCutoverTransaction,
  type LearningPathFenceClient,
} from './write-fence';

export interface StopLegacyPathsDb extends LearningPathFenceClient {
  learningPath: LearningPathFenceClient['learningPath'] & {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    }) => Promise<Array<LegacyPathStopCandidate>>;
  };
}

export interface LegacyPathStopCandidate {
  id: string;
  userId: string;
  goalId: string | null;
  title: string;
  pathStatus: string | null;
  nodeIds: unknown;
  plannerVersion: string | null;
  pathPayload: unknown;
  inputSnapshot: unknown;
  explanationPayload: unknown;
}

export interface StopLegacyPathsAtCutoverInput {
  /** Optional scope: stop only paths for this learner. */
  userId?: string;
  now?: Date;
}

export function isCanonicalKnowledgePath(path: {
  pathStatus?: string | null;
  pathPayload?: unknown;
  plannerVersion?: string | null;
}): boolean {
  const payload = asRecord(path.pathPayload);
  if (payload.knowledgeAuthority === 'CANONICAL') return true;
  const versionClosure = asRecord(payload.versionClosure);
  if (versionClosure.knowledgeAuthority === 'CANONICAL') return true;
  if (
    typeof path.plannerVersion === 'string'
    && path.plannerVersion.startsWith('canonical-teaching-projection-replan')
  ) {
    return true;
  }
  return false;
}

/**
 * Extract declared goal / intent without carrying Legacy node sequence.
 * Prefer the historical row goalId; do not invent a different column identity.
 */
export function extractPreservedLearningIntent(
  path: LegacyPathStopCandidate,
  now: Date = new Date(),
): PreservedLearningIntent {
  const payload = asRecord(path.pathPayload);
  const explanation = asRecord(path.explanationPayload);
  const inputSnapshot = asRecord(path.inputSnapshot);
  const learningGoal = asRecord(payload.learningGoal);
  const existing = asRecord(payload.preservedLearningIntent);

  // Historical goal identity: row goalId wins; payload is only fallback metadata.
  const goalId = firstString(path.goalId, existing.goalId, learningGoal.id, payload.goalId);
  const goalTitle = firstString(
    existing.goalTitle,
    learningGoal.title,
    path.title,
    payload.goalTitle,
  );
  const userIntent = firstString(
    existing.userIntent,
    inputSnapshot.userIntent,
    payload.userIntent,
    explanation.userIntent,
  );
  const intentType = firstString(
    existing.intentType,
    learningGoal.intentType,
    payload.intentType,
    inputSnapshot.intentType,
  );
  const learningGoalVersion = firstString(
    existing.learningGoalVersion,
    learningGoal.version,
    payload.learningGoalVersion,
  );

  return {
    schemaVersion: PRESERVED_LEARNING_INTENT_VERSION,
    sourcePathId: path.id,
    goalId,
    goalTitle,
    userIntent,
    intentType,
    learningGoalVersion,
    preservedAt: now.toISOString(),
    legacyNodeSequenceConstraint: false,
    legacyNodeIds: null,
  };
}

/**
 * Authority cutover helper: mark unfinished Legacy paths stopped/archive.
 * Idempotent. Completed and Canonical paths are left untouched.
 *
 * Mutates only pathStatus + additive archive/intent markers. Never rewrites
 * nodeIds, planNodes, goalId, plannerVersion, executions, deviations, or interventions.
 */
export async function stopUnfinishedLegacyLearningPathsAtCutover(
  db: StopLegacyPathsDb,
  input: StopLegacyPathsAtCutoverInput = {},
): Promise<StopLegacyPathsAtCutoverResult> {
  return runInLearningPathCutoverTransaction(db, (tx) => stopUnfinishedLegacyPathsInClient(
    tx as StopLegacyPathsDb,
    input,
  ));
}

async function stopUnfinishedLegacyPathsInClient(
  db: StopLegacyPathsDb,
  input: StopLegacyPathsAtCutoverInput,
): Promise<StopLegacyPathsAtCutoverResult> {
  const now = input.now ?? new Date();
  const where: Record<string, unknown> = {};
  if (input.userId) where.userId = input.userId;

  const rows = await db.learningPath.findMany({
    where,
    select: {
      id: true,
      userId: true,
      goalId: true,
      title: true,
      pathStatus: true,
      nodeIds: true,
      plannerVersion: true,
      pathPayload: true,
      inputSnapshot: true,
      explanationPayload: true,
    },
  });

  const result: StopLegacyPathsAtCutoverResult = {
    stoppedPathIds: [],
    alreadyStoppedPathIds: [],
    skippedCompletedPathIds: [],
    skippedCanonicalPathIds: [],
  };

  for (const path of rows) {
    if (isCanonicalKnowledgePath(path)) {
      result.skippedCanonicalPathIds.push(path.id);
      continue;
    }
    if (isCompletedPathStatus(path.pathStatus)) {
      result.skippedCompletedPathIds.push(path.id);
      continue;
    }
    if (isLegacyStoppedPathStatus(path.pathStatus)) {
      result.alreadyStoppedPathIds.push(path.id);
      continue;
    }
    if (
      path.pathStatus !== null
      && path.pathStatus !== undefined
      && !isUnfinishedLegacyPathStatus(path.pathStatus)
    ) {
      // leave non-matching statuses alone (e.g. diagnostic-fixture)
      continue;
    }

    const shouldStop = path.pathStatus == null
      || isUnfinishedLegacyPathStatus(path.pathStatus);
    if (!shouldStop) continue;

    const preservedLearningIntent = extractPreservedLearningIntent(path, now);
    const existingPayload = asRecord(path.pathPayload);
    // Additive-only payload: never rewrite pre-existing field values.
    const nextPayload: Record<string, unknown> = { ...existingPayload };
    if (!('preservedLearningIntent' in existingPayload)) {
      nextPayload.preservedLearningIntent = preservedLearningIntent;
    }
    if (!('legacyArchiveState' in existingPayload)) {
      nextPayload.legacyArchiveState = LEGACY_STOPPED_PATH_STATUS;
    }
    if (!('readOnlyStopped' in existingPayload)) {
      nextPayload.readOnlyStopped = true;
    }
    if (!('knowledgeAuthority' in existingPayload)) {
      nextPayload.knowledgeAuthority = 'LEGACY';
    }
    if (!('stoppedAtCutoverAt' in existingPayload)) {
      nextPayload.stoppedAtCutoverAt = now.toISOString();
    }
    if (!('legacyNodeSequenceConstraint' in existingPayload)) {
      nextPayload.legacyNodeSequenceConstraint = false;
    }
    if (!('originalLegacyRevision' in existingPayload)) {
      nextPayload.originalLegacyRevision = {
        pathStatus: path.pathStatus ?? 'legacy',
        plannerVersion: path.plannerVersion ?? null,
        goalId: path.goalId,
        nodeIds: Array.isArray(path.nodeIds) ? path.nodeIds : [],
        capturedAt: now.toISOString(),
      };
    }

    const stopped = await conditionalStopLegacyPathRow(db, {
      pathId: path.id,
      pathPayload: nextPayload,
    });
    if (stopped) {
      result.stoppedPathIds.push(path.id);
    } else {
      // Concurrent stop or status race — treat as already stopped when status matches.
      const latest = await db.learningPath.findFirst({
        where: { id: path.id },
        select: { pathStatus: true },
      });
      if (isLegacyStoppedPathStatus(latest?.pathStatus)) {
        result.alreadyStoppedPathIds.push(path.id);
      }
    }
  }

  return result;
}

/**
 * Read preserved intent from a stopped path without exposing node sequence
 * as a planning constraint.
 */
export function readPreservedLearningIntent(
  path: { id?: string; goalId?: string | null; pathPayload?: unknown },
): PreservedLearningIntent | null {
  const payload = asRecord(path.pathPayload);
  const preserved = asRecord(payload.preservedLearningIntent);
  if (
    preserved.schemaVersion === PRESERVED_LEARNING_INTENT_VERSION
    || preserved.goalId
    || path.goalId
  ) {
    return {
      schemaVersion: PRESERVED_LEARNING_INTENT_VERSION,
      sourcePathId: firstString(preserved.sourcePathId, path.id) ?? 'unknown',
      // Prefer historical row goalId over payload when both exist.
      goalId: firstString(path.goalId, preserved.goalId),
      goalTitle: firstString(preserved.goalTitle),
      userIntent: firstString(preserved.userIntent),
      intentType: firstString(preserved.intentType),
      learningGoalVersion: firstString(preserved.learningGoalVersion),
      preservedAt: firstString(preserved.preservedAt) ?? new Date(0).toISOString(),
      legacyNodeSequenceConstraint: false,
      legacyNodeIds: null,
    };
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}
