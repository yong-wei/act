import {
  COLD_START_COLLECTION_ACTIVITY_COPY,
  studentVisibleColdStartLimitation,
  studentVisibleCollectionImpact,
} from '@/lib/cold-start-evidence-collection-copy';

export type ColdStartEvidenceDimension =
  | 'mastery'
  | 'ability'
  | 'resource-preference'
  | 'freshness';

export type ColdStartCollectionActivityType =
  | 'short-diagnosis'
  | 'resource-trial'
  | 'short-simulation';

export type ColdStartEventKind =
  | ColdStartCollectionActivityType
  | 'page-view'
  | 'click'
  | 'chat-declaration'
  | 'incomplete'
  | 'abandoned'
  | 'conflict';

export type ColdStartConfidence = 'unknown' | 'none' | 'low' | 'medium' | 'high';
export type ColdStartQuality = 'governed' | 'rejected' | 'abandoned' | 'conflict' | 'incomplete';

export const COLD_START_DIMENSION_LIMITATION_CODES: Record<ColdStartEvidenceDimension, string> = {
  mastery: 'cold-start-mastery-insufficient',
  ability: 'cold-start-ability-insufficient',
  'resource-preference': 'cold-start-preference-insufficient',
  freshness: 'cold-start-freshness-insufficient',
};

export interface ColdStartDimensionStatus {
  dimension: ColdStartEvidenceDimension;
  status: 'insufficient' | 'available';
  confidence: ColdStartConfidence;
  limitationCode: string | null;
}

export interface ColdStartCollectionEvent {
  kind: ColdStartEventKind;
  at: string;
  goalId?: string | null;
  resourceId?: string | null;
  completed?: boolean;
  authority?: 'assessment' | 'arena' | 'simulation' | 'none';
  qualityMarker?: 'governed' | 'context-only';
}

export interface ColdStartCollectionRecord {
  activityType: ColdStartCollectionActivityType;
  dimension: ColdStartEvidenceDimension;
  source: ColdStartCollectionActivityType;
  capturedAt: string;
  goalId: string | null;
  resourceId: string | null;
  completed: true;
  quality: 'governed';
  confidence: Exclude<ColdStartConfidence, 'high'>;
  scope: ColdStartEvidenceDimension;
  affectsMastery: boolean;
}

export type ColdStartCollectionDecision =
  | { accepted: true; record: ColdStartCollectionRecord }
  | {
    accepted: false;
    kind: ColdStartEventKind;
    quality: Exclude<ColdStartQuality, 'governed'>;
    confidence: Exclude<ColdStartConfidence, 'high' | 'medium'>;
    affectsMastery: false;
  };

export interface ColdStartLearnerEvidenceInput {
  knowledgeMasteryTags?: Record<string, {
    confidence?: number;
    evidenceCount?: number;
    freshness?: string;
  }>;
  abilityEstimate?: { estimatedAt?: string | null } | null;
  capabilityTargets?: Array<{
    confidence?: number;
    evidenceCount?: number;
    freshness?: string;
  }>;
  resourcePreference?: {
    preferredModalities?: string[];
    confidence?: 'none' | 'low' | 'medium';
  };
  evidence?: {
    confidence?: {
      level?: string;
      evidenceCount?: number;
    };
    freshness?: string;
  };
  missingEvidence?: string[];
}

export interface ColdStartCollectionActivity {
  type: ColdStartCollectionActivityType;
  dimension: ColdStartEvidenceDimension;
  goalId: string | null;
  resourceId: string;
  href: string;
  title: string;
  description: string;
}

export interface ColdStartPathFacts {
  resourceMix: Record<string, number>;
  estimatedMinutes: number;
  checkpointCount: number;
}

export interface ColdStartCollectionImpact {
  kind: 'resource-type' | 'rhythm' | 'checkpoints';
  dimension: ColdStartEvidenceDimension;
  reasonCode: string;
  studentText: string;
}

export interface ColdStartCollectionProjection {
  dimensions: ColdStartDimensionStatus[];
  insufficientDimensions: ColdStartEvidenceDimension[];
  limitationCodes: string[];
  limitationTexts: string[];
  activities: ColdStartCollectionActivity[];
  records: ColdStartCollectionRecord[];
  rejected: Array<Extract<ColdStartCollectionDecision, { accepted: false }>>;
}

const ACTIVITY_DIMENSION: Record<ColdStartCollectionActivityType, ColdStartEvidenceDimension> = {
  'short-diagnosis': 'mastery',
  'resource-trial': 'resource-preference',
  'short-simulation': 'ability',
};

const ACTIVITY_HREF: Record<ColdStartCollectionActivityType, string> = {
  'short-diagnosis': '/assessment/adaptive-practice',
  'resource-trial': '/assessment/adaptive-practice',
  'short-simulation': '/interactive-learning/control-workbench',
};

function asConfidence(value: string | number | undefined): ColdStartConfidence {
  if (typeof value === 'number') {
    if (value >= 0.75) return 'high';
    if (value >= 0.5) return 'medium';
    if (value > 0) return 'low';
    return 'none';
  }
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'none' || value === 'unknown') {
    return value;
  }
  return 'none';
}

function hasTrustedMastery(input: ColdStartLearnerEvidenceInput): boolean {
  return Object.values(input.knowledgeMasteryTags ?? {}).some((tag) => (
    (tag.evidenceCount ?? 0) > 0 && (tag.confidence ?? 0) >= 0.5 && tag.freshness !== 'missing'
  ));
}

function hasTrustedAbility(input: ColdStartLearnerEvidenceInput): boolean {
  if (input.abilityEstimate?.estimatedAt) return true;
  return (input.capabilityTargets ?? []).some((target) => (
    (target.evidenceCount ?? 0) > 0 && (target.confidence ?? 0) >= 0.5
  ));
}

function hasTrustedPreference(input: ColdStartLearnerEvidenceInput): boolean {
  const confidence = input.resourcePreference?.confidence;
  return Boolean(input.resourcePreference?.preferredModalities?.length)
    && confidence !== 'none'
    && confidence !== 'low'
    && Boolean(confidence);
}

function hasCurrentFreshness(input: ColdStartLearnerEvidenceInput): boolean {
  const freshness = input.evidence?.freshness;
  const evidenceCount = input.evidence?.confidence?.evidenceCount ?? 0;
  const level = input.evidence?.confidence?.level;
  if (freshness === 'stale' || freshness === 'partial' || freshness === 'missing' || !freshness) return false;
  if (evidenceCount <= 0) return false;
  return level !== 'none' && level !== 'low';
}

export function classifyColdStartDimensions(
  input: ColdStartLearnerEvidenceInput,
): ColdStartDimensionStatus[] {
  const masteryAvailable = hasTrustedMastery(input);
  const abilityAvailable = hasTrustedAbility(input);
  const preferenceAvailable = hasTrustedPreference(input);
  const freshnessAvailable = hasCurrentFreshness(input);
  return [
    {
      dimension: 'mastery',
      status: masteryAvailable ? 'available' : 'insufficient',
      confidence: masteryAvailable ? 'medium' : 'none',
      limitationCode: masteryAvailable ? null : COLD_START_DIMENSION_LIMITATION_CODES.mastery,
    },
    {
      dimension: 'ability',
      status: abilityAvailable ? 'available' : 'insufficient',
      confidence: abilityAvailable ? 'medium' : 'none',
      limitationCode: abilityAvailable ? null : COLD_START_DIMENSION_LIMITATION_CODES.ability,
    },
    {
      dimension: 'resource-preference',
      status: preferenceAvailable ? 'available' : 'insufficient',
      confidence: preferenceAvailable
        ? asConfidence(input.resourcePreference?.confidence)
        : 'none',
      limitationCode: preferenceAvailable ? null : COLD_START_DIMENSION_LIMITATION_CODES['resource-preference'],
    },
    {
      dimension: 'freshness',
      status: freshnessAvailable ? 'available' : 'insufficient',
      confidence: freshnessAvailable ? asConfidence(input.evidence?.confidence?.level) : 'none',
      limitationCode: freshnessAvailable ? null : COLD_START_DIMENSION_LIMITATION_CODES.freshness,
    },
  ];
}

export function classifyCollectionEvent(event: ColdStartCollectionEvent): ColdStartCollectionDecision {
  if (event.kind === 'page-view' || event.kind === 'click' || event.kind === 'chat-declaration') {
    return {
      accepted: false,
      kind: event.kind,
      quality: 'rejected',
      confidence: 'none',
      affectsMastery: false,
    };
  }
  if (event.kind === 'incomplete' || event.completed === false) {
    return {
      accepted: false,
      kind: event.kind,
      quality: 'incomplete',
      confidence: 'none',
      affectsMastery: false,
    };
  }
  if (event.kind === 'abandoned') {
    return {
      accepted: false,
      kind: event.kind,
      quality: 'abandoned',
      confidence: 'unknown',
      affectsMastery: false,
    };
  }
  if (event.kind === 'conflict' || event.qualityMarker === 'context-only') {
    return {
      accepted: false,
      kind: event.kind,
      quality: event.kind === 'conflict' ? 'conflict' : 'rejected',
      confidence: event.kind === 'conflict' ? 'low' : 'none',
      affectsMastery: false,
    };
  }
  if (
    event.kind !== 'short-diagnosis'
    && event.kind !== 'resource-trial'
    && event.kind !== 'short-simulation'
  ) {
    return {
      accepted: false,
      kind: event.kind,
      quality: 'rejected',
      confidence: 'none',
      affectsMastery: false,
    };
  }
  if (event.completed !== true || event.qualityMarker !== 'governed' || !event.goalId || !event.resourceId) {
    return {
      accepted: false,
      kind: event.kind,
      quality: 'rejected',
      confidence: 'none',
      affectsMastery: false,
    };
  }

  const activityType = event.kind;
  const dimension = ACTIVITY_DIMENSION[activityType];
  const masteryAuthority = event.authority === 'assessment'
    || event.authority === 'arena'
    || event.authority === 'simulation';
  return {
    accepted: true,
    record: {
      activityType,
      dimension,
      source: activityType,
      capturedAt: event.at,
      goalId: event.goalId ?? null,
      resourceId: event.resourceId ?? null,
      completed: true,
      quality: 'governed',
      confidence: 'medium',
      scope: dimension,
      affectsMastery: activityType !== 'resource-trial' && masteryAuthority,
    },
  };
}

export function collectionMayMutatePath(mode: 'continue' | 'new'): boolean {
  return mode === 'new';
}

function resourceMixChanged(
  previous: Record<string, number>,
  next: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if ((previous[key] ?? 0) !== (next[key] ?? 0)) return true;
  }
  return false;
}

export function projectCollectionImpactsOnNewPath(input: {
  mode: 'continue' | 'new';
  previous: ColdStartPathFacts;
  next: ColdStartPathFacts;
  records: ColdStartCollectionRecord[];
}): ColdStartCollectionImpact[] {
  if (!collectionMayMutatePath(input.mode)) return [];
  const impacts: ColdStartCollectionImpact[] = [];
  for (const record of input.records) {
    if (record.dimension === 'resource-preference' && resourceMixChanged(input.previous.resourceMix, input.next.resourceMix)) {
      impacts.push({
        kind: 'resource-type',
        dimension: record.dimension,
        reasonCode: 'collection-resource-trial',
        studentText: studentVisibleCollectionImpact('collection-resource-trial')
          ?? '资源试学结果影响了后续路径的资源组合。',
      });
    }
    if (record.dimension === 'ability' && input.previous.estimatedMinutes !== input.next.estimatedMinutes) {
      impacts.push({
        kind: 'rhythm',
        dimension: record.dimension,
        reasonCode: 'collection-short-simulation',
        studentText: studentVisibleCollectionImpact('collection-short-simulation')
          ?? '短仿真结果影响了后续路径的学习节奏。',
      });
    }
    if (record.dimension === 'mastery' && input.previous.checkpointCount !== input.next.checkpointCount) {
      impacts.push({
        kind: 'checkpoints',
        dimension: record.dimension,
        reasonCode: 'collection-short-diagnosis',
        studentText: studentVisibleCollectionImpact('collection-short-diagnosis')
          ?? '短诊断结果影响了后续路径的检查点安排。',
      });
    }
  }
  return impacts.filter((impact, index) => (
    impacts.findIndex((candidate) => candidate.reasonCode === impact.reasonCode) === index
  ));
}

export function listCollectionActivities(input: {
  dimensions: ColdStartDimensionStatus[];
  goalId?: string | null;
}): ColdStartCollectionActivity[] {
  const goalId = input.goalId ?? null;
  return input.dimensions
    .filter((dimension) => dimension.status === 'insufficient')
    .flatMap((dimension) => {
      const type = (Object.entries(ACTIVITY_DIMENSION) as Array<[
        ColdStartCollectionActivityType,
        ColdStartEvidenceDimension,
      ]>).find(([, mapped]) => mapped === dimension.dimension)?.[0];
      if (!type) return [];
      const copy = COLD_START_COLLECTION_ACTIVITY_COPY[type];
      return [{
        type,
        dimension: dimension.dimension,
        goalId,
        resourceId: `${goalId ?? 'goal'}:${type}`,
        href: ACTIVITY_HREF[type],
        title: copy.title,
        description: copy.description,
      }];
    });
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readCapabilityTargets(goalSlices: unknown): ColdStartLearnerEvidenceInput['capabilityTargets'] {
  return Object.values(readRecord(goalSlices)).flatMap((slice) => {
    const capabilityTargets = readRecord(slice).capabilityTargets;
    if (!Array.isArray(capabilityTargets)) return [];
    return capabilityTargets.map((target) => {
      const record = readRecord(target);
      const observed = readRecord(record.observedEvidence);
      const confidence = readRecord(record.confidence);
      return {
        confidence: typeof observed.confidence === 'number'
          ? observed.confidence
          : typeof confidence.score === 'number' ? confidence.score : undefined,
        evidenceCount: typeof observed.directEvidenceCount === 'number'
          ? observed.directEvidenceCount
          : typeof confidence.evidenceCount === 'number' ? confidence.evidenceCount : undefined,
        freshness: typeof observed.freshness === 'string' ? observed.freshness : undefined,
      };
    });
  });
}

export function learnerEvidenceInputFromAdaptiveState(state: unknown): ColdStartLearnerEvidenceInput {
  if (!state || typeof state !== 'object') return {};
  const record = readRecord(state);
  const knowledgeMastery = readRecord(record.knowledgeMastery);
  const assessmentState = readRecord(record.assessmentState);
  const resourcePreference = readRecord(record.resourcePreference);
  const evidence = readRecord(record.evidence);
  const confidence = readRecord(evidence.confidence);
  const statusMarkers = Array.isArray(evidence.statusMarkers)
    ? evidence.statusMarkers.filter((marker): marker is string => typeof marker === 'string')
    : [];
  const freshness = statusMarkers.includes('stale')
    ? 'stale'
    : statusMarkers.includes('partial')
      ? 'partial'
      : (typeof confidence.evidenceCount === 'number' && confidence.evidenceCount > 0)
        ? 'current'
        : 'missing';
  const preferredModalities = Array.isArray(resourcePreference.preferredModalities)
    ? resourcePreference.preferredModalities.filter((item): item is string => typeof item === 'string')
    : undefined;
  const preferenceConfidence = resourcePreference.confidence === 'none'
    || resourcePreference.confidence === 'low'
    || resourcePreference.confidence === 'medium'
    ? resourcePreference.confidence
    : undefined;
  return {
    knowledgeMasteryTags: knowledgeMastery.tags && typeof knowledgeMastery.tags === 'object'
      ? Object.fromEntries(Object.entries(readRecord(knowledgeMastery.tags)).map(([key, tag]) => {
        const tagRecord = readRecord(tag);
        return [key, {
          confidence: typeof tagRecord.confidence === 'number' ? tagRecord.confidence : undefined,
          evidenceCount: typeof tagRecord.evidenceCount === 'number' ? tagRecord.evidenceCount : undefined,
          freshness: typeof tagRecord.freshness === 'string' ? tagRecord.freshness : undefined,
        }];
      }))
      : undefined,
    abilityEstimate: assessmentState.latestAbilityEstimate
      ? { estimatedAt: typeof readRecord(assessmentState.latestAbilityEstimate).estimatedAt === 'string'
        ? readRecord(assessmentState.latestAbilityEstimate).estimatedAt as string
        : null }
      : null,
    capabilityTargets: readCapabilityTargets(record.goalSlices),
    resourcePreference: preferredModalities || preferenceConfidence
      ? { preferredModalities, confidence: preferenceConfidence }
      : undefined,
    evidence: {
      confidence: {
        level: typeof confidence.level === 'string' ? confidence.level : undefined,
        evidenceCount: typeof confidence.evidenceCount === 'number' ? confidence.evidenceCount : undefined,
      },
      freshness,
    },
    missingEvidence: Array.isArray(record.missingEvidence)
      ? record.missingEvidence.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

export interface ColdStartGovernedFactInput {
  id?: string;
  factType?: string | null;
  moduleId?: string | null;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  outcome?: string | null;
  contextJson?: unknown;
}

function factActivityType(factType: string | null | undefined): ColdStartCollectionActivityType | null {
  if (!factType) return null;
  if (factType === 'page_view' || factType === 'view' || factType === 'click' || factType === 'chat') return null;
  if (factType === 'question' || factType === 'assessment') return 'short-diagnosis';
  if (factType === 'simulation' || factType === 'design' || factType === 'arena') return 'short-simulation';
  if (factType === 'media' || factType === 'video' || factType === 'audio' || factType === 'resource') {
    return 'resource-trial';
  }
  return null;
}

function factAuthority(activityType: ColdStartCollectionActivityType, factType: string): ColdStartCollectionEvent['authority'] {
  if (activityType === 'short-diagnosis') return 'assessment';
  if (factType === 'arena') return 'arena';
  if (activityType === 'short-simulation') return 'simulation';
  return 'none';
}

function factIsGoverned(contextJson: unknown): boolean {
  const governance = readRecord(readRecord(contextJson).evidenceGovernance);
  if (governance.skipProfileContribution === true) return false;
  if (governance.evidenceQuality === 'context-only') return false;
  const profileWeight = typeof governance.profileWeight === 'number' ? governance.profileWeight : 0;
  return profileWeight > 0 && typeof governance.evidenceQuality === 'string';
}

function isoTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function collectionEventsFromGovernedFacts(input: {
  facts: ColdStartGovernedFactInput[];
  goalId: string;
}): ColdStartCollectionEvent[] {
  return input.facts.flatMap((fact) => {
    const activityType = factActivityType(fact.factType);
    const finishedAt = isoTimestamp(fact.finishedAt);
    const resourceId = typeof fact.moduleId === 'string' && fact.moduleId.trim() ? fact.moduleId : null;
    if (!activityType || !finishedAt || !resourceId || fact.outcome === 'abandoned') return [];
    if (!factIsGoverned(fact.contextJson)) return [];
    return [{
      kind: activityType,
      at: finishedAt,
      goalId: input.goalId,
      resourceId,
      completed: true,
      authority: factAuthority(activityType, fact.factType ?? ''),
      qualityMarker: 'governed' as const,
    }];
  });
}

export function previousPathFactsFromPlanOptions(options: Array<{
  resourceMix?: Record<string, number>;
  effort?: { estimatedMinutes?: number };
  terminalValidationNodeIds?: string[];
}> | null | undefined): ColdStartPathFacts | undefined {
  const option = options?.[0];
  if (!option) return undefined;
  return {
    resourceMix: option.resourceMix ?? {},
    estimatedMinutes: option.effort?.estimatedMinutes ?? 0,
    checkpointCount: option.terminalValidationNodeIds?.length ?? 0,
  };
}

export function projectColdStartCollection(input: {
  learnerState?: ColdStartLearnerEvidenceInput | null;
  events?: ColdStartCollectionEvent[];
  goalId?: string | null;
  mode?: 'continue' | 'new';
}): ColdStartCollectionProjection {
  const dimensions = classifyColdStartDimensions(input.learnerState ?? {});
  const decisions = (input.events ?? []).map(classifyCollectionEvent);
  const records = input.mode === 'continue'
    ? []
    : decisions.flatMap((decision) => (decision.accepted ? [decision.record] : []));
  const rejected = decisions.flatMap((decision) => (decision.accepted ? [] : [decision]));
  const limitationCodes = dimensions.flatMap((dimension) => (
    dimension.limitationCode ? [dimension.limitationCode] : []
  ));
  return {
    dimensions,
    insufficientDimensions: dimensions
      .filter((dimension) => dimension.status === 'insufficient')
      .map((dimension) => dimension.dimension),
    limitationCodes,
    limitationTexts: limitationCodes.map((code) => (
      studentVisibleColdStartLimitation(code) ?? code
    )),
    activities: listCollectionActivities({ dimensions, goalId: input.goalId }),
    records,
    rejected,
  };
}
