import type { PortraitLearningFactDelta } from './portrait-v2-incremental-update';

export type LearnerFactTransitionOperation = 'UPSERT' | 'CORRECT' | 'REVOKE';

export interface LearnerFactTransitionRow {
  id: string;
  userId: string;
  sequence: bigint;
  factId: string;
  operation: LearnerFactTransitionOperation;
  occurredAt: Date;
  transitionPayload: unknown;
  sourceReference: string | null;
  correctionOfSequence: bigint | null;
  createdAt: Date;
}

export interface LearnerFactTransitionDraft {
  userId: string;
  factId: string;
  operation: LearnerFactTransitionOperation;
  occurredAt: Date;
  transitionPayload: Record<string, unknown> | null;
  sourceReference: string | null;
  correctionOfSequence: bigint | null;
}

export interface LearnerFactTransitionDb {
  learnerFactTransition: {
    findMany: (args: Record<string, unknown>) => Promise<LearnerFactTransitionRow[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<LearnerFactTransitionRow>;
  };
  learnerFactTransitionSequence: {
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<{ lastSequence: bigint }>;
  };
}

export interface CumulativeLearnerReduction {
  activeFacts: PortraitLearningFactDelta[];
  stateWatermark: bigint;
  latestOccurredAt: Date | null;
  latestFactId: string | null;
  transitionCount: number;
}

interface SerializedFact {
  startedAt: string;
  outcome: string;
  score: number | null;
  competencyContribution: unknown;
  contextJson: unknown;
  createdAt: string;
  sourceEventId: string | null;
  sourceLogId: string | null;
  knowledgeRevisionRef: string | null;
}

export function buildLearnerFactTransitionDraft(input: {
  userId: string;
  fact: PortraitLearningFactDelta;
  operation: LearnerFactTransitionOperation;
  correctionOfSequence?: bigint;
  correctedFact?: PortraitLearningFactDelta;
  sourceReference?: string;
  occurredAt?: Date;
}): LearnerFactTransitionDraft {
  if (input.operation === 'UPSERT' && input.correctionOfSequence !== undefined) {
    throw new Error('UPSERT transitions cannot reference a corrected sequence.');
  }
  if (input.operation !== 'UPSERT' && input.correctionOfSequence === undefined) {
    throw new Error(`${input.operation} transitions require correctionOfSequence.`);
  }
  if (input.operation === 'CORRECT' && !input.correctedFact) {
    throw new Error('CORRECT transitions require a complete corrected fact payload.');
  }
  if (input.correctedFact && input.correctedFact.id !== input.fact.id) {
    throw new Error('A corrected fact payload must retain the immutable LearningFact identity.');
  }

  return {
    userId: input.userId,
    factId: input.fact.id,
    operation: input.operation,
    occurredAt: input.occurredAt ?? input.correctedFact?.startedAt ?? input.fact.startedAt,
    transitionPayload: input.operation === 'CORRECT'
      ? { fact: serializeFact(input.correctedFact!) }
      : null,
    sourceReference: input.sourceReference ?? null,
    correctionOfSequence: input.correctionOfSequence ?? null,
  };
}

export function planMissingLearningFactUpserts(input: {
  userId: string;
  facts: PortraitLearningFactDelta[];
  transitions: LearnerFactTransitionRow[];
}): LearnerFactTransitionDraft[] {
  const alreadyJournaled = new Set(input.transitions.map((transition) => transition.factId));
  return orderFacts(input.facts)
    .filter((fact) => !alreadyJournaled.has(fact.id))
    .map((fact) => buildLearnerFactTransitionDraft({
      userId: input.userId,
      fact,
      operation: 'UPSERT',
    }));
}

export async function appendLearnerFactTransition(
  db: LearnerFactTransitionDb,
  draft: LearnerFactTransitionDraft,
): Promise<LearnerFactTransitionRow> {
  await db.learnerFactTransitionSequence.upsert({
    where: { userId: draft.userId },
    create: { userId: draft.userId, lastSequence: BigInt(0) },
    update: {},
  });
  const allocated = await db.learnerFactTransitionSequence.update({
    where: { userId: draft.userId },
    data: { lastSequence: { increment: BigInt(1) } },
    select: { lastSequence: true },
  });
  return db.learnerFactTransition.create({
    data: {
      ...draft,
      sequence: allocated.lastSequence,
    },
  });
}

export function reduceLearnerFactTransitions(input: {
  facts: PortraitLearningFactDelta[];
  transitions: LearnerFactTransitionRow[];
}): CumulativeLearnerReduction {
  const factsById = new Map(input.facts.map((fact) => [fact.id, cloneFact(fact)]));
  const activeFacts = new Map<string, PortraitLearningFactDelta>();
  const transitions = orderTransitions(input.transitions);

  for (const transition of transitions) {
    const source = factsById.get(transition.factId);
    if (!source) continue;
    if (transition.operation === 'REVOKE') {
      activeFacts.delete(transition.factId);
      continue;
    }
    if (transition.operation === 'CORRECT') {
      activeFacts.set(transition.factId, correctedFact(source, transition.transitionPayload));
      continue;
    }
    activeFacts.set(transition.factId, cloneFact(source));
  }

  const orderedActiveFacts = orderFacts([...activeFacts.values()]);
  const lastFact = orderedActiveFacts.at(-1) ?? null;
  return {
    activeFacts: orderedActiveFacts,
    stateWatermark: transitions.at(-1)?.sequence ?? BigInt(0),
    latestOccurredAt: lastFact?.startedAt ?? null,
    latestFactId: lastFact?.id ?? null,
    transitionCount: transitions.length,
  };
}

export function requiresFullLearnerRebuild(input: {
  transitions: LearnerFactTransitionRow[];
  currentWatermark: bigint;
  currentCalculationVersion: string | null;
  targetCalculationVersion: string;
  currentLatestOccurredAt?: Date | null;
  currentLatestFactId?: string | null;
}): boolean {
  if (input.currentCalculationVersion !== input.targetCalculationVersion) return true;
  const appended = orderTransitions(input.transitions)
    .filter((transition) => transition.sequence > input.currentWatermark);
  if (appended.some((transition) =>
    transition.operation === 'CORRECT' || transition.operation === 'REVOKE')) {
    return true;
  }
  if (!input.currentLatestOccurredAt || !input.currentLatestFactId) return false;
  return appended.some((transition) =>
    compareOccurrence(
      transition.occurredAt,
      transition.factId,
      input.currentLatestOccurredAt!,
      input.currentLatestFactId!,
    ) <= 0);
}

function orderTransitions(transitions: LearnerFactTransitionRow[]): LearnerFactTransitionRow[] {
  const byId = new Map<string, LearnerFactTransitionRow>();
  for (const transition of transitions) byId.set(transition.id, transition);
  return [...byId.values()].sort((left, right) =>
    left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : left.id.localeCompare(right.id));
}

function orderFacts(facts: PortraitLearningFactDelta[]): PortraitLearningFactDelta[] {
  const byId = new Map<string, PortraitLearningFactDelta>();
  for (const fact of facts) byId.set(fact.id, fact);
  return [...byId.values()].sort((left, right) =>
    compareOccurrence(left.startedAt, left.id, right.startedAt, right.id));
}

function compareOccurrence(
  leftAt: Date,
  leftId: string,
  rightAt: Date,
  rightId: string,
): number {
  const difference = leftAt.getTime() - rightAt.getTime();
  return difference !== 0 ? difference : leftId.localeCompare(rightId);
}

function correctedFact(source: PortraitLearningFactDelta, payload: unknown): PortraitLearningFactDelta {
  if (!isRecord(payload) || !isRecord(payload.fact)) {
    throw new Error(`CORRECT transition for ${source.id} has no complete corrected fact payload.`);
  }
  const fact = payload.fact;
  if (
    typeof fact.startedAt !== 'string' ||
    typeof fact.outcome !== 'string' ||
    !(fact.score === null || typeof fact.score === 'number') ||
    typeof fact.createdAt !== 'string'
  ) {
    throw new Error(`CORRECT transition for ${source.id} has an invalid corrected fact payload.`);
  }
  const startedAt = new Date(fact.startedAt);
  const createdAt = new Date(fact.createdAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(createdAt.getTime())) {
    throw new Error(`CORRECT transition for ${source.id} has invalid timestamps.`);
  }
  return {
    id: source.id,
    startedAt,
    outcome: fact.outcome,
    score: fact.score,
    competencyContribution: structuredClone(fact.competencyContribution),
    contextJson: structuredClone(fact.contextJson),
    createdAt,
    sourceEventId: readNullableString(fact.sourceEventId),
    sourceLogId: readNullableString(fact.sourceLogId),
    knowledgeRevisionRef: readNullableString(fact.knowledgeRevisionRef),
  };
}

function serializeFact(fact: PortraitLearningFactDelta): SerializedFact {
  return {
    startedAt: fact.startedAt.toISOString(),
    outcome: fact.outcome,
    score: fact.score,
    competencyContribution: structuredClone(fact.competencyContribution),
    contextJson: structuredClone(fact.contextJson),
    createdAt: fact.createdAt.toISOString(),
    sourceEventId: fact.sourceEventId ?? null,
    sourceLogId: fact.sourceLogId ?? null,
    knowledgeRevisionRef: fact.knowledgeRevisionRef ?? null,
  };
}

function cloneFact(fact: PortraitLearningFactDelta): PortraitLearningFactDelta {
  return {
    ...fact,
    startedAt: new Date(fact.startedAt),
    createdAt: new Date(fact.createdAt),
    competencyContribution: structuredClone(fact.competencyContribution),
    contextJson: structuredClone(fact.contextJson),
    sourceEventId: fact.sourceEventId ?? null,
    sourceLogId: fact.sourceLogId ?? null,
    knowledgeRevisionRef: fact.knowledgeRevisionRef ?? null,
  };
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
