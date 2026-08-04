/**
 * Fallback hit export and evidence-window verification (#1277 task 1.3).
 */

import { CONSUMER_ACTIVATION_IDS } from '@/lib/versioned-knowledge-activation/contracts';
import type { LegacyCardFallbackHit } from '@/lib/teaching-projection/cards/contracts';

import {
  LEGACY_RETIREMENT_BUILDER_VERSION,
  LEGACY_RETIREMENT_FALLBACK_EXPORT_CONTRACT,
  LegacyRetirementGateError,
  type FallbackHitCount,
  type FallbackTelemetryExport,
} from './contracts';
import { retirementDigest } from './hash';

export interface FallbackHitInput {
  consumerId: string;
  hitId?: string | null;
  legacyId?: string | null;
  recordedAt?: string | null;
}

function withinWindow(
  recordedAt: string | null | undefined,
  startAt: string,
  endAt: string,
): boolean {
  if (!recordedAt) return true;
  return recordedAt >= startAt && recordedAt <= endAt;
}

/**
 * Export fallback hit counts for migrated consumers over an evidence window.
 * Unknown consumers must appear with zero hits (fail closed on omission).
 */
export function exportFallbackTelemetry(input: {
  hits: readonly FallbackHitInput[];
  evidenceWindow: { startAt: string; endAt: string };
  /** Required consumer set; defaults to activation consumer ids. */
  requiredConsumerIds?: readonly string[];
}): FallbackTelemetryExport {
  const required = [
    ...(input.requiredConsumerIds ?? CONSUMER_ACTIVATION_IDS),
  ].sort();
  const byConsumer = new Map<string, FallbackHitCount>();

  for (const consumerId of required) {
    byConsumer.set(consumerId, {
      consumerId,
      hitCount: 0,
      samples: [],
    });
  }

  for (const hit of input.hits) {
    if (
      !withinWindow(
        hit.recordedAt,
        input.evidenceWindow.startAt,
        input.evidenceWindow.endAt,
      )
    ) {
      continue;
    }
    let row = byConsumer.get(hit.consumerId);
    if (!row) {
      // Unknown consumer still counted so the gate can fail closed.
      row = { consumerId: hit.consumerId, hitCount: 0, samples: [] };
      byConsumer.set(hit.consumerId, row);
    }
    row.hitCount += 1;
    if (row.samples.length < 8) {
      row.samples.push({
        hitId: hit.hitId ?? null,
        legacyId: hit.legacyId ?? null,
        recordedAt: hit.recordedAt ?? null,
      });
    }
  }

  const consumers = [...byConsumer.values()].sort((a, b) =>
    a.consumerId < b.consumerId ? -1 : a.consumerId > b.consumerId ? 1 : 0,
  );
  const totalHits = consumers.reduce((sum, c) => sum + c.hitCount, 0);

  const body = {
    contract: LEGACY_RETIREMENT_FALLBACK_EXPORT_CONTRACT,
    builderVersion: LEGACY_RETIREMENT_BUILDER_VERSION,
    evidenceWindow: {
      startAt: input.evidenceWindow.startAt,
      endAt: input.evidenceWindow.endAt,
    },
    consumers,
    totalHits,
    zeroHits: totalHits === 0,
  };

  return {
    ...body,
    exportDigest: retirementDigest(body),
  };
}

/** Map card telemetry hits into the retirement export shape. */
export function cardHitsToFallbackInputs(
  hits: readonly LegacyCardFallbackHit[],
): FallbackHitInput[] {
  return hits.map((hit) => ({
    consumerId: hit.consumer,
    hitId: hit.hitId,
    legacyId: hit.legacyId,
    recordedAt: hit.recordedAt,
  }));
}

/** Fail closed when any migrated consumer has nonzero fallback hits. */
export function assertZeroFallbackHits(exportDoc: FallbackTelemetryExport): void {
  if (!exportDoc.zeroHits || exportDoc.totalHits > 0) {
    const offenders = exportDoc.consumers
      .filter((c) => c.hitCount > 0)
      .map((c) => `${c.consumerId}=${c.hitCount}`)
      .join(', ');
    throw new LegacyRetirementGateError(
      'fallback-hits-nonzero',
      `fallback telemetry nonzero over evidence window: ${offenders}`,
      exportDoc.consumers
        .filter((c) => c.hitCount > 0)
        .map((c) => `fallback-hit:${c.consumerId}:${c.hitCount}`),
    );
  }
}
