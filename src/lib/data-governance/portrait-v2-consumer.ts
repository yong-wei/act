// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy vector types are compatibility-only.
import {
  createEmptyCompetencyVector,
  type CompetencyDimension,
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: retain the legacy vector type only at the compatibility boundary.
  type CompetencyVector,
} from './competency-model';
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSIONS,
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import {
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
  readLatestPortraitV2Snapshot,
  validatePortraitV2Payload,
  PortraitV2SnapshotValidationError,
  type PortraitV2Consumer,
  type PortraitV2Payload,
  type PortraitV2PayloadShape,
  type PortraitV2ProjectedPayload,
  type PortraitV2SnapshotReadDb,
} from './portrait-v2-model';

export type { PortraitV2Consumer } from './portrait-v2-model';

/**
 * Explicit compatibility boundary for consumers that still need the legacy
 * six-dimensional snapshot while the primary contract is portrait v2.
 */
export const PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER =
  'portrait-v2-legacy-compatibility-adapter';

export interface PortraitV2ConsumerDb extends PortraitV2SnapshotReadDb {
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<any | null>;
  };
  studentEvidenceFeatureCache?: {
    findUnique?: (args: any) => Promise<any | null>;
  };
}

// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: preserve legacy provenance outside the primary portrait.
export interface PortraitV2LegacyCompatibility {
  authority: 'legacy-compatibility-only';
  source: 'StudentCompetencySnapshot' | 'StudentEvidenceFeatureCache' | 'fallback-empty';
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this vector is never the primary portrait.
  vector: CompetencyVector;
  snapshotId: string | null;
  snapshotAt: string;
}

export interface ResolvedPortraitV2Consumer {
  primaryPortrait: PortraitV2ProjectedPayload;
  legacyCompatibility: PortraitV2LegacyCompatibility;
  limitations: string[];
}

export interface PortraitV2ConsumerSummary {
  model: 'portrait-v2';
  payloadVersion: string;
  derivationKind: PortraitV2PayloadShape['derivation']['kind'];
  generatedAt: string;
  overallScore: number;
  dimensions: Array<{
    id: PortraitV2DimensionId;
    label: string;
    description: string;
    score: number;
    confidence: number;
    trend: 'up' | 'stable' | 'down';
    freshness: PortraitV2PayloadShape['dimensions'][number]['freshness'];
    evidenceCount: number;
    limitations: string[];
    calculationVersion: string;
  }>;
  strengths: PortraitV2DimensionId[];
  weaknesses: PortraitV2DimensionId[];
  limitations: string[];
}

export interface PortraitV2ClassAggregate {
  model: 'portrait-v2';
  dimensionIds: PortraitV2DimensionId[];
  dimensions: Record<PortraitV2DimensionId, {
    label: string;
    mean: number;
    stdDev: number;
    confidence: number;
    evidenceCount: number;
    freshness: 'current' | 'partial' | 'stale' | 'missing';
    derivationKinds: Array<PortraitV2PayloadShape['derivation']['kind']>;
    limitationCount: number;
  }>;
  limitations: string[];
  sourceCoverage: {
    nativeLearners: number;
    migratedLearners: number;
    compatibilityLearners: number;
    missingLearners: number;
  };
}

export function hasPortraitV2Evidence(payload: PortraitV2ProjectedPayload): boolean {
  return payload.dimensions.some((dimension) => dimension.evidenceSummary.totalCount > 0);
}

export function hasAuthoritativePortraitV2Evidence(payload: PortraitV2ProjectedPayload): boolean {
  return payload.derivation.kind !== 'compatibility-derived' && hasPortraitV2Evidence(payload);
}

/**
 * Select evidence-bearing data for aggregate/read-model consumers without
 * changing the authority of the resolved primary portrait. Empty native or
 * migrated rows remain primary truth, while their explicit legacy
 * compatibility projection can keep an existing read model populated.
 */
export function selectPortraitV2WithCompatibilityFallback(
  resolution: ResolvedPortraitV2Consumer,
  consumer: PortraitV2Consumer,
  options: { now?: Date } = {},
): PortraitV2ProjectedPayload {
  if (hasPortraitV2Evidence(resolution.primaryPortrait)
    || resolution.legacyCompatibility.source === 'fallback-empty') {
    return resolution.primaryPortrait;
  }

  const now = options.now ?? new Date();
  return buildCompatibilityResultSafely({
    userId: resolution.primaryPortrait.userId,
    vector: resolution.legacyCompatibility.vector,
    snapshotId: resolution.legacyCompatibility.snapshotId,
    snapshotAt: resolution.legacyCompatibility.snapshotAt,
    source: resolution.legacyCompatibility.source,
    consumer,
    now,
    limitations: resolution.limitations,
  }).primaryPortrait;
}

export async function resolvePrimaryPortraitV2(
  db: PortraitV2ConsumerDb,
  userId: string,
  consumer: PortraitV2Consumer,
  options: {
    now?: Date;
    legacySnapshot?: Record<string, unknown> | null;
    featureCache?: Record<string, unknown> | null;
  } = {},
): Promise<ResolvedPortraitV2Consumer> {
  const now = options.now ?? new Date();
  const limitations: string[] = [];
  let primaryPortrait: PortraitV2ProjectedPayload | null = null;

  try {
    const persisted = await readLatestPortraitV2Snapshot(db, userId, consumer, { now });
    if (persisted) {
      primaryPortrait = persisted;
    }
  } catch (error) {
    if (error instanceof PortraitV2SnapshotValidationError) {
      limitations.push('persisted-portrait-v2-invalid-or-incompatible');
    } else {
      throw error;
    }
  }

  const featureCache = Object.prototype.hasOwnProperty.call(options, 'featureCache')
    ? options.featureCache ?? null
    : await db.studentEvidenceFeatureCache?.findUnique?.({
        where: { userId },
      }) ?? null;
  if (!primaryPortrait) {
    const cachedPortrait = readCachedPortrait(featureCache, consumer, now);
    if (cachedPortrait.payload) {
      primaryPortrait = cachedPortrait.payload;
    }
    if (cachedPortrait.invalid) {
      limitations.push('persisted-portrait-v2-invalid-or-incompatible');
    }
  }

  const legacySnapshot = Object.prototype.hasOwnProperty.call(options, 'legacySnapshot')
    ? options.legacySnapshot ?? null
    : await db.studentCompetencySnapshot?.findFirst?.({
        where: { userId },
        orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
    }) ?? null;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: read the legacy snapshot only as a compatibility projection.
  const legacyVector = toCompetencyVector(legacySnapshot?.competencyVector);
  if (legacyVector) {
    const compatibilityInput = {
      userId,
      vector: legacyVector,
      snapshotId: readString(legacySnapshot?.id),
      snapshotAt: compatibilitySnapshotAt(legacySnapshot?.snapshotAt, now),
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: identify the legacy source for compatibility metadata.
      source: 'StudentCompetencySnapshot',
      consumer,
      now,
      limitations,
    } as const;
    if (primaryPortrait) {
      return buildPrimaryPortraitCompatibilityResult({
        primaryPortrait,
        now,
        limitations,
        buildCompatibility: () => buildCompatibilityResult(compatibilityInput),
      });
    }
    return buildCompatibilityResultSafely(compatibilityInput);
  }

  const featureSnapshot = readLegacyFeatureSnapshot(featureCache);
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: read the feature-cache vector only as a compatibility projection.
  const cachedVector = toCompetencyVector(featureSnapshot?.competencyVector);
  if (cachedVector) {
    const compatibilityInput = {
      userId,
      vector: cachedVector,
      snapshotId: null,
      snapshotAt: compatibilitySnapshotAt(featureSnapshot?.snapshotAt, now),
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: identify the cached legacy source for compatibility metadata.
      source: 'StudentEvidenceFeatureCache',
      consumer,
      now,
      limitations,
    } as const;
    if (primaryPortrait) {
      return buildPrimaryPortraitCompatibilityResult({
        primaryPortrait,
        now,
        limitations,
        buildCompatibility: () => buildCompatibilityResult(compatibilityInput),
      });
    }
    return buildCompatibilityResultSafely(compatibilityInput);
  }

  if (primaryPortrait) {
    return {
      primaryPortrait,
      legacyCompatibility: emptyLegacyCompatibility(now),
      limitations,
    };
  }

  return buildCompatibilityResult({
    userId,
    vector: createEmptyCompetencyVector(),
    snapshotId: null,
    snapshotAt: now.toISOString(),
    source: 'fallback-empty',
    consumer,
    now,
    limitations: [...limitations, 'missing-native-portrait-v2-evidence'],
  });
}

export function summarizePortraitV2(payload: PortraitV2PayloadShape): PortraitV2ConsumerSummary {
  const dimensions = PORTRAIT_V2_DIMENSION_IDS.map((id) => {
    const source = payload.dimensions.find((dimension) => dimension.id === id);
    const definition = PORTRAIT_V2_DIMENSIONS.find((item) => item.id === id);
    return {
      id,
      label: source?.label ?? definition?.label ?? id,
      description: definition?.description ?? '',
      score: round(source?.score ?? 0),
      confidence: round(source?.confidence ?? 0, 2),
      trend: source?.trend ?? 'stable',
      freshness: source?.freshness ?? { state: 'missing', asOf: null, evidenceAgeDays: null },
      evidenceCount: source?.evidenceSummary.totalCount ?? 0,
      limitations: [...(source?.limitations ?? [])],
      calculationVersion: source?.calculationVersion ?? 'unknown',
    };
  });
  const ranked = [...dimensions].sort((left, right) => right.score - left.score);
  const covered = ranked.filter((dimension) => dimension.evidenceCount > 0);
  const strengthCount = Math.min(2, Math.ceil(covered.length / 2));
  const weaknessCount = Math.min(2, Math.floor(covered.length / 2));
  const limitations = uniqueStrings([
    ...payload.derivation.limitations,
    ...dimensions.flatMap((dimension) => dimension.limitations),
  ]);

  return {
    model: 'portrait-v2',
    payloadVersion: payload.payloadVersion,
    derivationKind: payload.derivation.kind,
    generatedAt: payload.generatedAt,
    overallScore: round(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length),
    dimensions,
    strengths: covered.slice(0, strengthCount).map((dimension) => dimension.id),
    weaknesses: weaknessCount > 0
      ? covered.slice(-weaknessCount).map((dimension) => dimension.id)
      : [],
    limitations,
  };
}

export function portraitV2DimensionScoresForLegacyDimension(
  payload: PortraitV2PayloadShape,
  dimension: CompetencyDimension,
): Array<{ id: PortraitV2DimensionId; score: number; confidence: number; evidenceCount: number }> {
  const mapping = mapLegacyCompetencyDimensionToPortraitV2(dimension);
  return mapping.targetDimensions.map((id) => {
    const entry = payload.dimensions.find((item) => item.id === id);
    return {
      id,
      score: entry?.score ?? 0,
      confidence: entry?.confidence ?? 0,
      evidenceCount: entry?.evidenceSummary.totalCount ?? 0,
    };
  });
}

export function aggregatePortraitV2(
  payloads: PortraitV2PayloadShape[],
): PortraitV2ClassAggregate {
  const dimensions = Object.fromEntries(PORTRAIT_V2_DIMENSION_IDS.map((id) => {
    const definition = PORTRAIT_V2_DIMENSIONS.find((item) => item.id === id);
    const entries = payloads
      .map((payload) => ({
        payload,
        dimension: payload.dimensions.find((item) => item.id === id),
      }))
      .filter((item): item is { payload: PortraitV2PayloadShape; dimension: NonNullable<typeof item.dimension> } => Boolean(item.dimension))
      .filter((item) => item.dimension.evidenceSummary.totalCount > 0);
    const scores = entries.map((item) => item.dimension.score);
    const mean = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const variance = scores.length > 0
      ? scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length
      : 0;
    const freshness = entries.some((item) => item.dimension.freshness.state === 'current')
      ? 'current'
      : entries.some((item) => item.dimension.freshness.state === 'partial')
        ? 'partial'
        : entries.some((item) => item.dimension.freshness.state === 'stale')
          ? 'stale'
          : 'missing';
    return [id, {
      label: definition?.label ?? id,
      mean: round(mean),
      stdDev: round(Math.sqrt(variance)),
      confidence: round(entries.length > 0 ? entries.reduce((sum, item) => sum + item.dimension.confidence, 0) / entries.length : 0, 2),
      evidenceCount: entries.reduce((sum, item) => sum + item.dimension.evidenceSummary.totalCount, 0),
      freshness,
      derivationKinds: [...new Set(entries.map((item) => item.payload.derivation.kind))],
      limitationCount: entries.reduce((sum, item) => sum + item.dimension.limitations.length, 0),
    }];
  })) as PortraitV2ClassAggregate['dimensions'];
  const sourceCoverage = {
    nativeLearners: payloads.filter((payload) => payload.derivation.kind === 'native').length,
    migratedLearners: payloads.filter((payload) => payload.derivation.kind === 'migrated').length,
    compatibilityLearners: payloads.filter((payload) => payload.derivation.kind === 'compatibility-derived').length,
    missingLearners: payloads.filter((payload) => payload.derivation.limitations.includes('missing-native-portrait-v2-evidence')).length,
  };
  return {
    model: 'portrait-v2',
    dimensionIds: [...PORTRAIT_V2_DIMENSION_IDS],
    dimensions,
    limitations: uniqueStrings(payloads.flatMap((payload) => payload.derivation.limitations)),
    sourceCoverage,
  };
}

function buildCompatibilityResult(input: {
  userId: string;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this vector is not primary portrait truth.
  vector: CompetencyVector;
  snapshotId: string | null;
  snapshotAt: string;
  source: PortraitV2LegacyCompatibility['source'];
  consumer: PortraitV2Consumer;
  now: Date;
  limitations: string[];
}): ResolvedPortraitV2Consumer {
  const payload = derivePortraitV2Compatibility({
    userId: input.userId,
    snapshotId: input.snapshotId,
    snapshotAt: input.snapshotAt,
    sourceFamily: input.source === 'fallback-empty' ? null : input.source,
    vector: input.vector,
    limitations: input.limitations,
    now: input.now,
  });
  return {
    primaryPortrait: projectPortraitV2ForConsumer(payload, input.consumer, { now: input.now }),
    legacyCompatibility: {
      authority: 'legacy-compatibility-only',
      source: input.source,
      vector: input.vector,
      snapshotId: input.snapshotId,
      snapshotAt: input.snapshotAt,
    },
    limitations: [...input.limitations],
  };
}

function buildCompatibilityResultSafely(
  input: Parameters<typeof buildCompatibilityResult>[0],
): ResolvedPortraitV2Consumer {
  try {
    return buildCompatibilityResult(input);
  } catch {
    const fallback = buildCompatibilityResult({
      ...input,
      vector: createEmptyCompetencyVector(),
      snapshotId: null,
      snapshotAt: input.now.toISOString(),
      source: 'fallback-empty',
      limitations: input.limitations,
    });
    return {
      ...fallback,
      limitations: uniqueStrings([...fallback.limitations, 'legacy-compatibility-projection-failed']),
    };
  }
}

function buildPrimaryPortraitCompatibilityResult(input: {
  primaryPortrait: PortraitV2ProjectedPayload;
  now: Date;
  limitations: string[];
  buildCompatibility: () => ResolvedPortraitV2Consumer;
}): ResolvedPortraitV2Consumer {
  try {
    const compatibilityResult = input.buildCompatibility();
    return {
      primaryPortrait: input.primaryPortrait,
      legacyCompatibility: compatibilityResult.legacyCompatibility,
      limitations: compatibilityResult.limitations,
    };
  } catch {
    return {
      primaryPortrait: input.primaryPortrait,
      legacyCompatibility: emptyLegacyCompatibility(input.now),
      limitations: uniqueStrings([
        ...input.limitations,
        'legacy-compatibility-projection-failed',
      ]),
    };
  }
}

function readCachedPortrait(
  cache: Record<string, unknown> | null | undefined,
  consumer: PortraitV2Consumer,
  now: Date,
): { payload: PortraitV2ProjectedPayload | null; invalid: boolean } {
  const features = asRecord(cache?.features);
  const approvedAggregates = asRecord(features.approvedAggregates);
  const feature = asRecord(approvedAggregates.primaryPortrait ?? features.primaryPortrait);
  const payload = 'payload' in feature ? feature.payload : approvedAggregates.primaryPortrait ?? features.primaryPortrait;
  if (!payload) return { payload: null, invalid: false };
  try {
    validatePortraitV2Payload(payload, { now });
    return { payload: projectPortraitV2ForConsumer(payload as PortraitV2Payload, consumer, { now }), invalid: false };
  } catch {
    return { payload: null, invalid: true };
  }
}

function readLegacyFeatureSnapshot(cache: Record<string, unknown> | null | undefined) {
  return asRecord(asRecord(asRecord(cache?.features).approvedAggregates).latestSnapshot);
}

// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: validate the legacy six-dimensional compatibility shape.
function toCompetencyVector(value: unknown): CompetencyVector | null {
  const record = asRecord(value);
  if (!COMPETENCY_DIMENSIONS.every((dimension) => {
    const entry = asRecord(record[dimension]);
    return Number.isFinite(entry.score);
  })) {
    return null;
  }
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: return only the validated compatibility vector.
  return record as unknown as CompetencyVector;
}

// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy dimensions are accepted only for compatibility reads.
const COMPETENCY_DIMENSIONS: CompetencyDimension[] = [
  'controlModeling',
  'parameterDesign',
  'crossDomainTransfer',
  'engineeringDecision',
  'inquiryReflection',
  'selfDirectedLearning',
];

function emptyLegacyCompatibility(now: Date): PortraitV2LegacyCompatibility {
  return {
    authority: 'legacy-compatibility-only',
    source: 'fallback-empty',
    vector: createEmptyCompetencyVector(),
    snapshotId: null,
    snapshotAt: now.toISOString(),
  };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  return null;
}

function compatibilitySnapshotAt(value: unknown, now: Date): string {
  if (value === null || value === undefined) return now.toISOString();
  return dateToIso(value) ?? 'invalid-legacy-compatibility-snapshot-at';
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
