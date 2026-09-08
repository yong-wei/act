import { isLearningFactEligibleForPersonalization } from './data-governance/learning-fact-quality-weight';
import { isTrustedLearningFact } from './data-governance/trusted-learning-fact-filter';
import { calibrateResourceFeatures, collaborativeResourceAffinity, type ResourceInteractionSample } from './resource-interaction-features';
import { isPublishedResourceIdentity, type PublishedResourceFeatureIndex, type ResourceFeatureReference } from './published-resource-reference';
import type { ResourceNodeRegistry } from './resource-node-registry';

interface Delegate {
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  aggregate?(args: Record<string, unknown>): Promise<unknown>;
}
interface Database { interactionLog?: Delegate; learningPathExecution?: Delegate; learningFact?: Delegate }
const historyCache = new WeakMap<object, { key: string; expiresAt: number; promise: Promise<ResourceInteractionSample[]> }>();
const FEEDBACK_EVENT = 'resource_difficulty_feedback';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function timestamp(value: unknown): string | null {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' ? value : NaN);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function reference(value: unknown): ResourceFeatureReference | null {
  const candidate = record(value);
  return isPublishedResourceIdentity(candidate) && typeof candidate.resourceVersion === 'string'
    && /^[a-f0-9]{64}$/.test(candidate.resourceVersion) && typeof candidate.indexId === 'string'
    && /^[a-f0-9]{64}$/.test(candidate.indexId) ? candidate as unknown as ResourceFeatureReference : null;
}

export async function loadResourceInteractionSamples(database: unknown, index: PublishedResourceFeatureIndex): Promise<ResourceInteractionSample[]> {
  if (!database || typeof database !== 'object') return [];
  const db = database as Database;
  const executionWhere = { liftMetadata: { path: ['resourceFeatureRef', 'resourceId'], string_starts_with: 'act:' } };
  const directFactClauses = [
    { contextJson: { path: ['resourceFeatureRef', 'resourceId'], string_starts_with: 'act:' } },
    { contextJson: { path: ['liftMetadata', 'resourceFeatureRef', 'resourceId'], string_starts_with: 'act:' } },
  ];
  const feedbackWhere = { eventType: FEEDBACK_EVENT, actorRole: 'STUDENT' };
  const delegates = [db.learningPathExecution, db.learningFact, db.interactionLog];
  // Result facts can arrive after their path execution and need not carry a resource ref.
  const wheres = [executionWhere, { factType: { in: ['question', 'simulation'] } }, feedbackWhere];
  const stamps = await Promise.all(delegates.map((delegate, position) => delegate?.aggregate
    ? delegate.aggregate({ where: wheres[position], _count: { _all: true }, _max: { createdAt: true } })
    : null));
  const key = JSON.stringify([index.indexId, stamps]);
  const cached = historyCache.get(database);
  if (stamps.some(Boolean) && cached?.key === key && cached.expiresAt > Date.now()) return cached.promise;
  const promise = (async () => {
    const [executions, feedback] = await Promise.all([
      db.learningPathExecution?.findMany({ where: executionWhere, select: {
        id: true, userId: true, status: true, liftMetadata: true, simulationRef: true, createdAt: true, completedAt: true,
      } }) ?? [],
      db.interactionLog?.findMany({ where: feedbackWhere, select: {
        id: true, userId: true, resourceKey: true, eventData: true, createdAt: true,
      } }) ?? [],
    ]);
    const versions = new Map(index.resources.map((resource) => [resource.identity.resourceId, resource.version]));
    const outcomeResources = new Map<string, ResourceFeatureReference | null>();
    const linkedFactClauses: Record<string, unknown>[] = [];
    const outcomeKey = (userId: string, kind: string, id: string) => JSON.stringify([userId, kind, id]);
    for (const raw of executions) {
      const row = record(raw); const metadata = record(row.liftMetadata);
      const ref = reference(metadata.resourceFeatureRef);
      if (!ref || versions.get(ref.resourceId) !== ref.resourceVersion || typeof row.userId !== 'string'
        || !['completed', 'failed'].includes(String(row.status))) continue;
      const assessment = record(metadata.adaptiveAssessmentRef);
      const simulation = record(row.simulationRef);
      const anchors = [
        ...(assessment.kind === 'AdaptiveAssessmentAnswer' && assessment.provenance === 'official'
          && assessment.pathCompletionEligible === true && assessment.reviewState === 'reviewed'
          && typeof assessment.id === 'string' ? [{ kind: 'question', id: assessment.id, path: ['adaptiveAssessment', 'answerId'] }] : []),
        ...(simulation.kind === 'SimulationRun' && simulation.provenance === 'official' && simulation.status === 'completed'
          && typeof simulation.id === 'string' ? [{ kind: 'simulation', id: simulation.id, path: ['simulation', 'runId'] }] : []),
      ];
      for (const anchor of anchors) {
        const key = outcomeKey(row.userId, anchor.kind, anchor.id);
        const previous = outcomeResources.get(key);
        if (previous === undefined) {
          linkedFactClauses.push({ userId: row.userId, factType: anchor.kind, contextJson: { path: anchor.path, equals: anchor.id } });
          outcomeResources.set(key, ref);
        } else if (!previous || previous.resourceId !== ref.resourceId || previous.resourceVersion !== ref.resourceVersion) {
          outcomeResources.set(key, null);
        }
      }
    }
    const factsById = new Map<string, unknown>();
    const clauses = [...directFactClauses, ...linkedFactClauses];
    for (let offset = 0; offset < clauses.length; offset += 200) {
      const rows = await db.learningFact?.findMany({ where: { OR: clauses.slice(offset, offset + 200) }, select: {
        id: true, userId: true, factType: true, outcome: true, timeSpent: true, contextJson: true,
        sourceEventId: true, sourceLogId: true, finishedAt: true, createdAt: true,
      } }) ?? [];
      for (const row of rows) if (typeof record(row).id === 'string') factsById.set(record(row).id as string, row);
    }
    const samples: ResourceInteractionSample[] = [];
    const add = (raw: unknown, refValue: unknown, values: Partial<ResourceInteractionSample>) => {
      const row = record(raw);
      const ref = reference(refValue);
      const occurredAt = timestamp(row.finishedAt ?? row.completedAt ?? row.createdAt);
      if (!ref || versions.get(ref.resourceId) !== ref.resourceVersion || !occurredAt
        || typeof row.userId !== 'string' || typeof row.id !== 'string' || !values.kind || !values.authority) return;
      samples.push({ eventId: values.eventId ?? values.authority + ':' + row.id,
        learnerId: row.userId, resourceId: ref.resourceId, resourceVersion: ref.resourceVersion, occurredAt,
        learnerPreparedness: ref.learnerPreparedness, ...values,
      } as ResourceInteractionSample);
    };
    for (const raw of executions) {
      const row = record(raw); const meta = record(row.liftMetadata);
      if (['continued-interaction', 'review', 'external-resource-reference', 'konling-support'].includes(String(meta.pathActivityKind))) continue;
      if (row.status === 'started' || row.status === 'completed') add(raw, meta.resourceFeatureRef, {
        kind: row.status === 'started' ? 'selected' : 'completed', authority: 'path-execution',
      });
    }
    for (const raw of factsById.values()) {
      const row = record(raw); const context = record(row.contextJson);
      if (!['question', 'simulation'].includes(String(row.factType)) || !isLearningFactEligibleForPersonalization(context)
        || !isTrustedLearningFact({ sourceEventId: typeof row.sourceEventId === 'string' ? row.sourceEventId : null,
          sourceLogId: typeof row.sourceLogId === 'string' ? row.sourceLogId : null })
        || !['success', 'failure'].includes(String(row.outcome))) continue;
      const outcomeId = row.factType === 'question' ? record(context.adaptiveAssessment).answerId : record(context.simulation).runId;
      const linkedKey = typeof outcomeId === 'string' && typeof row.userId === 'string'
        ? outcomeKey(row.userId, String(row.factType), outcomeId) : null;
      const linked = linkedKey ? outcomeResources.get(linkedKey) : undefined;
      if (linked === null) continue;
      add(raw, linked ?? context.resourceFeatureRef ?? record(context.liftMetadata).resourceFeatureRef, {
        kind: 'outcome', authority: 'governed-fact', success: row.outcome === 'success',
        durationSeconds: typeof row.timeSpent === 'number' ? row.timeSpent : null,
        eventId: 'governed-fact:' + String(row.sourceEventId ?? row.sourceLogId ?? row.id),
      });
    }
    const ratings: Record<string, number> = { easy: 0.2, appropriate: 0.5, hard: 0.8 };
    for (const raw of feedback) {
      const row = record(raw); const data = record(row.eventData); const ref = reference(data.resourceFeatureRef);
      if (data.schemaVersion !== 'resource-feedback/v1' || typeof data.rating !== 'string'
        || !(data.rating in ratings) || !ref || row.resourceKey !== ref.resourceId) continue;
      add(raw, ref, { kind: 'feedback', authority: 'self-report', perceivedDifficulty: ratings[data.rating] });
    }
    return samples;
  })();
  // Re-read corrections to existing facts even when count/createdAt do not change.
  historyCache.set(database, { key, expiresAt: Date.now() + 30000, promise });
  try { return await promise; } catch (error) { historyCache.delete(database); throw error; }
}

export async function applyResourceInteractionFeatures(
  registry: ResourceNodeRegistry, database: unknown, learnerId: string,
): Promise<ResourceNodeRegistry> {
  const index = registry.featureIndex;
  if (!index) return registry;
  const samples = await loadResourceInteractionSamples(database, index);
  const affinities = collaborativeResourceAffinity(index.resources, samples, learnerId);
  const byResource = new Map<string, ResourceInteractionSample[]>();
  for (const sample of samples) {
    const list = byResource.get(sample.resourceId) ?? [];
    list.push(sample); byResource.set(sample.resourceId, list);
  }
  return { ...registry, nodes: registry.nodes.map((node) => {
    const resource = node.publishedResource;
    if (!resource) return node;
    const observations = byResource.get(resource.identity.resourceId) ?? [];
    const personal = calibrateResourceFeatures(resource, observations, { learnerId });
    const observed = personal.observedDifficulty !== null || personal.observedMinutes !== null
      ? personal : calibrateResourceFeatures(resource, observations);
    const baseline = node.planningMetadata.estimatedTimeMinutes ?? resource.estimatedMinutes;
    const estimatedTimeMinutes = observed.observedMinutes !== null && observed.confidence > 0
      ? Math.max(1, Math.round(baseline * (1 - observed.confidence) + observed.observedMinutes * observed.confidence))
      : baseline;
    return { ...node, observedFeatures: observed,
      collaborativeAffinity: affinities.get(resource.identity.resourceId) ?? 0,
      planningMetadata: { ...node.planningMetadata, estimatedTimeMinutes },
    };
  }) };
}
