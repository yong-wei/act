import {
  POINTER_MOVE,
  type CurrentPointerRecord,
  type PointerMove,
  type PointerWriteDb,
} from './types';

export function compareCurrentPointer(
  current: CurrentPointerRecord | null,
  candidate: CurrentPointerRecord,
): PointerMove {
  if (!current) return POINTER_MOVE.create;
  if (current.calculationVersion !== candidate.calculationVersion) {
    // Watermarks are not comparable across calculation versions. Only a strictly
    // newer generation or cutover fence records an authorized rebase.
    if (candidate.generation < current.generation) return POINTER_MOVE.stale;
    if (candidate.generation > current.generation) return POINTER_MOVE.advance;
    if (candidate.cutoverFence < current.cutoverFence) return POINTER_MOVE.stale;
    if (candidate.cutoverFence > current.cutoverFence) return POINTER_MOVE.advance;
    return POINTER_MOVE.conflict;
  }
  if (candidate.generation < current.generation) return POINTER_MOVE.stale;
  if (candidate.generation > current.generation) return POINTER_MOVE.advance;
  if (candidate.stateWatermark < current.stateWatermark) return POINTER_MOVE.stale;
  if (candidate.stateWatermark > current.stateWatermark) return POINTER_MOVE.advance;
  if (candidate.cutoverFence < current.cutoverFence) return POINTER_MOVE.stale;
  if (candidate.cutoverFence > current.cutoverFence) return POINTER_MOVE.advance;
  if (candidate.inputDigest !== current.inputDigest) return POINTER_MOVE.advance;
  if (candidate.queueGeneration < current.queueGeneration) return POINTER_MOVE.stale;
  if (candidate.queueGeneration > current.queueGeneration) return POINTER_MOVE.advance;
  return POINTER_MOVE.duplicate;
}

function pointerData(candidate: CurrentPointerRecord): Record<string, unknown> {
  return {
    userId: candidate.subjectUserId,
    stateVersionId: candidate.versionId,
    calculationVersion: candidate.calculationVersion,
    generation: candidate.generation,
    queueGeneration: candidate.queueGeneration,
    stateWatermark: candidate.stateWatermark,
    cutoverFence: candidate.cutoverFence,
    taskInputDigest: candidate.inputDigest,
  };
}

export async function publishCurrentPointer(
  db: PointerWriteDb,
  candidate: CurrentPointerRecord,
): Promise<{ move: PointerMove; current: CurrentPointerRecord | null }> {
  const existing = await db.findUnique({ where: { userId: candidate.subjectUserId } });
  const move = compareCurrentPointer(existing, candidate);
  if (move === POINTER_MOVE.stale || move === POINTER_MOVE.conflict || move === POINTER_MOVE.duplicate) {
    return { move, current: existing };
  }
  const data = pointerData(candidate);
  if (move === POINTER_MOVE.create) {
    if (typeof db.create === 'function') {
      try {
        await db.create({ data });
      } catch {
        const raced = await db.findUnique({ where: { userId: candidate.subjectUserId } });
        return {
          move: compareCurrentPointer(raced, candidate) === POINTER_MOVE.create
            ? POINTER_MOVE.conflict
            : compareCurrentPointer(raced, candidate),
          current: raced,
        };
      }
    } else if (typeof db.upsert === 'function') {
      await db.upsert({
        where: { userId: candidate.subjectUserId },
        create: data,
        update: data,
      });
    }
    return { move: POINTER_MOVE.create, current: candidate };
  }

  if (typeof db.updateMany === 'function' && existing) {
    const updated = await db.updateMany({
      where: {
        userId: candidate.subjectUserId,
        generation: existing.generation,
        stateWatermark: existing.stateWatermark,
        cutoverFence: existing.cutoverFence,
        calculationVersion: existing.calculationVersion,
      },
      data,
    });
    if (updated.count !== 1) {
      const raced = await db.findUnique({ where: { userId: candidate.subjectUserId } });
      return { move: POINTER_MOVE.conflict, current: raced };
    }
    return { move: POINTER_MOVE.advance, current: candidate };
  }
  if (typeof db.upsert === 'function') {
    await db.upsert({
      where: { userId: candidate.subjectUserId },
      create: data,
      update: data,
    });
  }
  return { move: POINTER_MOVE.advance, current: candidate };
}
