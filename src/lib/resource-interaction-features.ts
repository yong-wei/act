import type { PublishedResourceFeature } from './published-resource-reference';

export const RESOURCE_CALIBRATION_VERSION = 'resource-interactions/v1' as const;
export const RESOURCE_COHORT_MINIMUM_LEARNERS = 5;

export interface ResourceInteractionSample {
  eventId: string;
  learnerId: string;
  resourceId: string;
  resourceVersion: string;
  occurredAt: string;
  kind: 'opened' | 'selected' | 'completed' | 'outcome' | 'feedback';
  authority: 'usage' | 'path-execution' | 'governed-fact' | 'self-report';
  perceivedDifficulty?: number | null;
  success?: boolean | null;
  durationSeconds?: number | null;
  retryCount?: number | null;
  learnerPreparedness?: number | null;
}

export interface ResourceObservedFeatures {
  resourceId: string;
  resourceVersion: string;
  scope: 'personal' | 'cohort';
  sampleSize: number | null;
  distinctLearnerCount: number | null;
  selectionCount: number | null;
  completionCount: number | null;
  observedDifficulty: number | null;
  observedMinutes: number | null;
  retryCount: number | null;
  confidence: number;
  evidenceWatermark: string | null;
  calculationVersion: typeof RESOURCE_CALIBRATION_VERSION;
  limitations: string[];
}

function finiteUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function authorityWeight(sample: ResourceInteractionSample): number {
  return sample.authority === 'governed-fact' ? 3 : sample.authority === 'path-execution' ? 2 : 1;
}

export function uniqueResourceInteractions(
  samples: readonly ResourceInteractionSample[],
): ResourceInteractionSample[] {
  const byEvent = new Map<string, ResourceInteractionSample>();
  const conflicts = new Set<string>();
  for (const sample of samples) {
    if (!sample.eventId || !sample.learnerId || !sample.resourceId || !sample.resourceVersion
      || !Number.isFinite(Date.parse(sample.occurredAt))) continue;
    if (conflicts.has(sample.eventId)) continue;
    const previous = byEvent.get(sample.eventId);
    if (previous && (previous.resourceId !== sample.resourceId
      || previous.resourceVersion !== sample.resourceVersion || previous.learnerId !== sample.learnerId)) {
      byEvent.delete(sample.eventId);
      conflicts.add(sample.eventId);
      continue;
    }
    if (!previous || authorityWeight(sample) > authorityWeight(previous)) byEvent.set(sample.eventId, sample);
  }
  return [...byEvent.values()].sort((a, b) => (
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.eventId.localeCompare(b.eventId)
  ));
}

export function calibrateResourceFeatures(
  resource: Pick<PublishedResourceFeature, 'identity' | 'version' | 'baselineDifficulty' | 'estimatedMinutes'>,
  samples: readonly ResourceInteractionSample[],
  options: { learnerId?: string; minimumLearners?: number } = {},
): ResourceObservedFeatures {
  const events = uniqueResourceInteractions(samples).filter((sample) => (
    sample.resourceId === resource.identity.resourceId
    && sample.resourceVersion === resource.version
    && (!options.learnerId || sample.learnerId === options.learnerId)
  ));
  const participants = new Set(events.map((event) => event.learnerId));
  const personal = Boolean(options.learnerId);
  const minimum = personal ? 1 : options.minimumLearners ?? RESOURCE_COHORT_MINIMUM_LEARNERS;
  const sufficientUsage = participants.size >= minimum;
  const eligible = events.filter((event) => (
    event.authority !== 'usage' && (event.kind === 'completed' || event.kind === 'outcome' || event.kind === 'feedback')
  ));
  // One learner contributes at most one latest observation to each estimate.
  const difficultyByLearner = new Map<string, number>();
  const durationByLearner = new Map<string, number>();
  const retriesByLearner = new Map<string, number>();
  for (const event of eligible) {
    if (event.kind === 'feedback' && event.authority === 'self-report' && finiteUnit(event.perceivedDifficulty)
      && (personal || finiteUnit(event.learnerPreparedness))) {
      difficultyByLearner.set(event.learnerId, personal ? event.perceivedDifficulty
        : Math.max(0, Math.min(1, event.perceivedDifficulty + ((event.learnerPreparedness ?? 0.5) - 0.5) / 2)));
    }
    if (event.kind === 'outcome' && event.authority === 'governed-fact' && typeof event.success === 'boolean') {
      if (personal || finiteUnit(event.learnerPreparedness)) {
        const score = event.success ? 1 : 0;
        const observation = finiteUnit(event.learnerPreparedness)
          ? Math.max(0, Math.min(1, 0.5 + (event.learnerPreparedness - score) / 2))
          : 1 - score;
        difficultyByLearner.set(event.learnerId, observation);
      }
    }
    if (event.authority === 'governed-fact' && (event.success === true || event.kind === 'completed')
      && typeof event.durationSeconds === 'number'
      && Number.isFinite(event.durationSeconds) && event.durationSeconds > 0 && event.durationSeconds <= 86400) {
      durationByLearner.set(event.learnerId, event.durationSeconds / 60);
    }
    if (event.authority === 'governed-fact' && Number.isInteger(event.retryCount)
      && (event.retryCount as number) >= 0) {
      retriesByLearner.set(event.learnerId, event.retryCount as number);
    }
  }
  const difficultySupported = difficultyByLearner.size >= minimum;
  const durationSupported = durationByLearner.size >= minimum;
  const priorWeight = personal ? 3 : 8;
  const supportedCounts = [
    ...(difficultySupported ? [difficultyByLearner.size] : []),
    ...(durationSupported ? [durationByLearner.size] : []),
  ];
  const confidenceCount = supportedCounts.length ? Math.min(...supportedCounts) : 0;
  const confidence = confidenceCount / (confidenceCount + priorWeight);
  const prior = finiteUnit(resource.baselineDifficulty) ? resource.baselineDifficulty : 0.5;
  const difficulty = difficultySupported
    ? (prior * priorWeight + [...difficultyByLearner.values()].reduce((sum, value) => sum + value, 0))
      / (priorWeight + difficultyByLearner.size)
    : null;
  return {
    resourceId: resource.identity.resourceId,
    resourceVersion: resource.version,
    scope: personal ? 'personal' : 'cohort',
    sampleSize: personal || sufficientUsage ? eligible.length : null,
    distinctLearnerCount: personal || sufficientUsage ? participants.size : null,
    selectionCount: sufficientUsage ? events.filter((event) => event.kind === 'selected').length : null,
    completionCount: sufficientUsage ? eligible.filter((event) => event.kind === 'completed').length : null,
    observedDifficulty: difficulty,
    observedMinutes: durationSupported ? median([...durationByLearner.values()]) : null,
    retryCount: retriesByLearner.size >= minimum
      ? [...retriesByLearner.values()].reduce((sum, count) => sum + count, 0) : null,
    confidence,
    evidenceWatermark: personal || sufficientUsage ? events.at(-1)?.occurredAt ?? null : null,
    calculationVersion: RESOURCE_CALIBRATION_VERSION,
    limitations: [
      ...(!sufficientUsage ? ['insufficient-independent-learners'] : []),
      ...(!difficultySupported ? ['difficulty-evidence-insufficient'] : []),
      ...(!durationSupported ? ['duration-evidence-insufficient'] : []),
    ],
  };
}

/** Item co-use cosine affinity; opening alone never enters this implicit-feedback signal. */
export function collaborativeResourceAffinity(
  resources: readonly Pick<PublishedResourceFeature, 'identity' | 'version'>[],
  samples: readonly ResourceInteractionSample[],
  learnerId: string,
  minimumLearners = RESOURCE_COHORT_MINIMUM_LEARNERS,
): Map<string, number> {
  const versions = new Map(resources.map((resource) => [resource.identity.resourceId, resource.version]));
  const usersByResource = new Map<string, Set<string>>();
  const mine = new Set<string>();
  for (const sample of uniqueResourceInteractions(samples)) {
    if (versions.get(sample.resourceId) !== sample.resourceVersion
      || !['selected', 'completed', 'outcome'].includes(sample.kind)
      || (sample.authority === 'usage' && sample.kind !== 'selected')
      || (sample.kind === 'outcome' && sample.success !== true)) continue;
    const users = usersByResource.get(sample.resourceId) ?? new Set<string>();
    users.add(sample.learnerId);
    usersByResource.set(sample.resourceId, users);
    if (sample.learnerId === learnerId) mine.add(sample.resourceId);
  }
  const scores = new Map<string, number>();
  for (const [resourceId, users] of usersByResource) {
    if (mine.has(resourceId) || users.size < minimumLearners) continue;
    let affinity = 0;
    for (const anchorId of mine) {
      const anchorUsers = usersByResource.get(anchorId);
      if (!anchorUsers || anchorUsers.size < minimumLearners) continue;
      const shared = [...users].filter((id) => id !== learnerId && anchorUsers.has(id)).length;
      if (shared < minimumLearners) continue;
      affinity = Math.max(affinity, shared / Math.sqrt(users.size * anchorUsers.size));
    }
    if (affinity > 0) scores.set(resourceId, affinity);
  }
  return scores;
}
