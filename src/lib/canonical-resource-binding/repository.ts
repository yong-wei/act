import { prisma } from '@/lib/prisma';

import type {
  CanonicalResourceBindingDecision,
  EvidenceStructuralUnitCrosswalk,
  PublicationGateContext,
  ResourceBindingInventory,
} from './contracts';
import { canonicalSha256 } from './inventory';
import { applyHumanDecision, applyPublicationGates } from './pipeline';

interface ReadDelegate {
  findMany(args: unknown): Promise<unknown[]>;
}

interface InventoryRunDelegate extends ReadDelegate {
  findUnique(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
}

interface CreateManyDelegate extends ReadDelegate {
  createMany(args: unknown): Promise<unknown>;
}

interface DecisionDelegate extends CreateManyDelegate {
  update(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown>;
}

interface HumanQueueDelegate extends CreateManyDelegate {
  findUnique(args: unknown): Promise<unknown>;
}

export interface CanonicalResourceBindingTransaction {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  resourceBindingInventoryRun: InventoryRunDelegate;
  resourceBindingInventoryItem: CreateManyDelegate & {
    findUnique(args: unknown): Promise<unknown>;
  };
  actkgEvidenceSegment: { findUnique(args: unknown): Promise<unknown> };
  actkgEvidenceStructuralUnitCrosswalk: CreateManyDelegate;
  canonicalResourceBindingDecision: DecisionDelegate;
  canonicalResourceBindingHumanQueueItem: HumanQueueDelegate;
  canonicalResourceBindingHumanDecisionReceipt: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
  };
}

export interface CanonicalResourceBindingDatabase {
  $transaction<T>(
    callback: (transaction: CanonicalResourceBindingTransaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' | 'RepeatableRead' | 'ReadCommitted' },
  ): Promise<T>;
}

function inventoryMatches(
  existing: Record<string, unknown>,
  inventory: ResourceBindingInventory,
): boolean {
  return existing.captureRevision === inventory.captureRevision
    && existing.sourceHash === inventory.sourceHash
    && existing.itemCount === inventory.summary.itemCount
    && existing.includedCount === inventory.summary.includedCount
    && existing.excludedCount === inventory.summary.excludedCount
    && existing.unresolvedCount === inventory.summary.unresolvedCount
    && existing.complete === inventory.complete
    && existing.cutoverReady === inventory.cutoverReady
    && existing.authorityState === inventory.authorityState;
}

function decisionData(decision: CanonicalResourceBindingDecision) {
  return {
    id: decision.id,
    pairId: decision.pairId,
    releaseSetId: decision.releaseSetId,
    releaseId: decision.releaseId,
    canonicalId: decision.canonicalId,
    objectRevision: decision.objectRevision,
    resourceId: decision.resourceId,
    structuralUnitId: decision.structuralUnitId,
    segmentId: decision.segmentId,
    resourceSegmentHash: decision.resourceSegmentHash,
    role: decision.role,
    evidenceId: decision.evidenceId,
    evidenceDigest: decision.evidenceDigest,
    generatorPromptVersion: decision.generatorPromptVersion,
    reviewerPromptVersion: decision.reviewerPromptVersion,
    generatorCacheKey: decision.generatorCacheKey,
    reviewerCacheKey: decision.reviewerCacheKey,
    reviewerRole: decision.reviewerRole,
    reviewerInputDigest: decision.reviewerInputDigest,
    candidateDigest: decision.candidateDigest,
    reviewProvider: decision.reviewProvider,
    reviewState: decision.reviewState,
    publicationState: decision.publicationState,
    lifecycleState: decision.lifecycleState,
    attemptSequence: decision.attemptSequence,
    supersedesDecisionId: decision.supersedesDecisionId,
    crosswalkId: decision.crosswalkId,
    validationDigest: decision.validationDigest,
    highImpactPolicyVersion: decision.highImpactPolicyVersion,
    highImpactReasons: decision.highImpactReasons,
  };
}

function decisionMatches(
  actual: Record<string, unknown>,
  expected: CanonicalResourceBindingDecision,
): boolean {
  const expectedData = decisionData(expected) as Record<string, unknown>;
  return Object.entries(expectedData).every(([key, value]) => (
    JSON.stringify(actual[key]) === JSON.stringify(value)
  ));
}

export class CanonicalResourceBindingRepository {
  constructor(
    private readonly database: CanonicalResourceBindingDatabase =
      prisma as unknown as CanonicalResourceBindingDatabase,
  ) {}

  async persistInventory(inventory: ResourceBindingInventory): Promise<{
    runId: string;
    itemCount: number;
    reused: boolean;
  }> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRawUnsafe(
        'SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended($1, 0))) AS acquired',
        inventory.runId,
      );
      const existing = await transaction.resourceBindingInventoryRun.findUnique({
        where: { id: inventory.runId },
        include: { items: { orderBy: { atomicResourceId: 'asc' } } },
      }) as (Record<string, unknown> & { items: Array<Record<string, unknown>> }) | null;
      if (existing) {
        const expectedItems = new Map(
          inventory.items.map((item) => [item.atomicResourceId, item]),
        );
        const itemsMatch = existing.items.length === inventory.items.length
          && existing.items.every((row) => {
            const expected = expectedItems.get(String(row.atomicResourceId));
            if (!expected) return false;
            return row.atomicResourceId === expected.atomicResourceId
              && row.resourceId === expected.resourceId
              && row.structuralUnitId === expected.structuralUnitId
              && row.segmentId === expected.segmentId
              && row.resourceSegmentHash === expected.resourceSegmentHash
              && row.disposition === expected.disposition
              && canonicalSha256(row.reasonCodes) === canonicalSha256(expected.reasonCodes)
              && canonicalSha256(row.sourceObservations)
                === canonicalSha256(expected.sourceObservations)
              && row.observationDigest === expected.observationDigest;
          });
        if (!inventoryMatches(existing, inventory) || !itemsMatch) {
          throw new Error(`inventory identity ${inventory.runId} has conflicting content`);
        }
        return { runId: inventory.runId, itemCount: inventory.items.length, reused: true };
      }
      await transaction.resourceBindingInventoryRun.create({
        data: {
          id: inventory.runId,
          captureRevision: inventory.captureRevision,
          capturedAt: new Date(inventory.capturedAt),
          dbWatermark: inventory.dbWatermark,
          sourceHash: inventory.sourceHash,
          itemCount: inventory.summary.itemCount,
          includedCount: inventory.summary.includedCount,
          excludedCount: inventory.summary.excludedCount,
          unresolvedCount: inventory.summary.unresolvedCount,
          complete: inventory.complete,
          cutoverReady: inventory.cutoverReady,
          authorityState: inventory.authorityState,
        },
      });
      await transaction.resourceBindingInventoryItem.createMany({
        data: inventory.items.map((item) => ({ runId: inventory.runId, ...item })),
      });
      return { runId: inventory.runId, itemCount: inventory.items.length, reused: false };
    }, { isolationLevel: 'ReadCommitted' });
  }

  async readEvidenceCrosswalks(releaseId: string): Promise<EvidenceStructuralUnitCrosswalk[]> {
    return this.database.$transaction(async (transaction) => (
      transaction.actkgEvidenceStructuralUnitCrosswalk.findMany({
        where: { releaseId },
        orderBy: [{ evidenceId: 'asc' }, { structuralUnitId: 'asc' }, { segmentId: 'asc' }],
      }) as Promise<EvidenceStructuralUnitCrosswalk[]>
    ), { isolationLevel: 'RepeatableRead' });
  }

  async persistEvidenceCrosswalks(
    rows: readonly EvidenceStructuralUnitCrosswalk[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    return this.database.$transaction(async (transaction) => {
      for (const row of rows) {
        const [evidence, inventory] = await Promise.all([
          transaction.actkgEvidenceSegment.findUnique({
            where: {
              releaseId_evidenceId: {
                releaseId: row.releaseId,
                evidenceId: row.evidenceId,
              },
            },
            select: { sourceEditionId: true, contentHash: true },
          }),
          transaction.resourceBindingInventoryItem.findUnique({
            where: {
              runId_atomicResourceId: {
                runId: row.inventoryRunId,
                atomicResourceId: row.atomicResourceId,
              },
            },
            include: { run: true },
          }),
        ]) as [
          { sourceEditionId: string; contentHash: string } | null,
          {
            resourceId: string;
            structuralUnitId: string;
            segmentId: string;
            resourceSegmentHash: string;
            disposition: string;
            run: { captureRevision: string; complete: boolean };
          } | null,
        ];
        if (
          !evidence
          || evidence.sourceEditionId !== row.sourceEditionId
          || evidence.contentHash !== row.evidenceContentHash
        ) throw new Error(`crosswalk evidence identity drift for ${row.id}`);
        if (
          !inventory
          || !inventory.run.complete
          || inventory.disposition !== 'INCLUDED'
          || inventory.run.captureRevision !== row.captureRevision
          || inventory.resourceId !== row.resourceId
          || inventory.structuralUnitId !== row.structuralUnitId
          || inventory.segmentId !== row.segmentId
          || inventory.resourceSegmentHash !== row.resourceSegmentHash
          || row.structuralUnitVersion !== inventory.run.captureRevision
          || row.structuralUnitHash !== inventory.resourceSegmentHash
        ) throw new Error(`crosswalk ACT endpoint drift for ${row.id}`);
        if (row.validationDigest !== canonicalSha256({
          releaseId: row.releaseId,
          evidenceId: row.evidenceId,
          evidenceContentHash: row.evidenceContentHash,
          inventoryRunId: row.inventoryRunId,
          atomicResourceId: row.atomicResourceId,
          resourceId: row.resourceId,
          structuralUnitId: row.structuralUnitId,
          segmentId: row.segmentId,
          resourceSegmentHash: row.resourceSegmentHash,
          captureRevision: row.captureRevision,
          canonicalId: row.canonicalId,
        })) throw new Error(`crosswalk validation digest mismatch for ${row.id}`);
      }
      await transaction.actkgEvidenceStructuralUnitCrosswalk.createMany({
        data: rows,
        skipDuplicates: true,
      });
      const persisted = await transaction.actkgEvidenceStructuralUnitCrosswalk.findMany({
        where: { OR: rows.map((row) => ({ releaseId: row.releaseId, id: row.id })) },
      }) as Array<Record<string, unknown>>;
      if (
        persisted.length !== rows.length
        || rows.some((row) => !persisted.some((actual) => (
          Object.entries(row).every(([key, value]) => actual[key] === value)
        )))
      ) throw new Error('crosswalk idempotency conflict');
      return rows.length;
    }, { isolationLevel: 'Serializable' });
  }

  async readShadowRoleBindings(releaseId: string): Promise<CanonicalResourceBindingDecision[]> {
    return this.database.$transaction(async (transaction) => (
      transaction.canonicalResourceBindingDecision.findMany({
        where: { releaseId },
        orderBy: [{ resourceId: 'asc' }, { structuralUnitId: 'asc' }, { id: 'asc' }],
      }) as Promise<CanonicalResourceBindingDecision[]>
    ), { isolationLevel: 'RepeatableRead' });
  }

  async persistDecisions(
    decisions: readonly CanonicalResourceBindingDecision[],
    context: PublicationGateContext,
  ): Promise<number> {
    if (decisions.length === 0) return 0;
    for (const decision of decisions) {
      const gated = applyPublicationGates(decision, context, {
        humanApproved: decision.reviewProvider === 'HUMAN',
      });
      if (
        decision.publicationState === 'SHADOW_PUBLISHED'
        && (
          gated.publicationState !== 'SHADOW_PUBLISHED'
          || gated.crosswalkId !== decision.crosswalkId
          || gated.validationDigest !== decision.validationDigest
        )
      ) throw new Error(`binding decision ${decision.id} bypasses publication gates`);
    }
    return this.database.$transaction(async (transaction) => {
      for (const decision of decisions) {
        const existing = await transaction.canonicalResourceBindingDecision.findUnique({
          where: { id: decision.id },
        }) as Record<string, unknown> | null;
        if (existing) {
          if (!decisionMatches(existing, decision)) {
            throw new Error(`binding decision idempotency conflict for ${decision.id}`);
          }
          continue;
        }
        const predecessor = decision.supersedesDecisionId
          ? await transaction.canonicalResourceBindingDecision.findUnique({
              where: { id: decision.supersedesDecisionId },
            }) as Record<string, unknown> | null
          : null;
        const stagedPublishedReplacement = (
          decision.publicationState === 'SHADOW_PUBLISHED'
          && predecessor?.publicationState === 'SHADOW_PUBLISHED'
        );
        await transaction.canonicalResourceBindingDecision.createMany({
          data: [{
            ...decisionData(decision),
            publicationState: stagedPublishedReplacement
              ? 'CANDIDATE'
              : decision.publicationState,
          }],
        });
        if (decision.supersedesDecisionId) {
          await transaction.canonicalResourceBindingDecision.update({
            where: { id: decision.supersedesDecisionId },
            data: { lifecycleState: 'SUPERSEDED' },
          });
        }
        if (stagedPublishedReplacement) {
          await transaction.canonicalResourceBindingDecision.update({
            where: { id: decision.id },
            data: { publicationState: 'SHADOW_PUBLISHED' },
          });
        }
        if (decision.publicationState === 'HUMAN_REQUIRED') {
          await transaction.canonicalResourceBindingHumanQueueItem.createMany({
            data: [{
              id: `${decision.id}:human`,
              bindingDecisionId: decision.id,
              reasonCodes: decision.highImpactReasons,
              contextDigest: canonicalSha256(context),
              inputDigest: decision.reviewerInputDigest,
            }],
          });
        }
      }
      return decisions.length;
    }, { isolationLevel: 'Serializable' });
  }

  async adjudicateHumanQueue(input: {
    queueId: string;
    actorId: string;
    decidedAt: string;
    outcome: 'ACCEPT' | 'REJECT';
    rationale: string;
    context: PublicationGateContext;
  }): Promise<CanonicalResourceBindingDecision> {
    if (!input.actorId.trim() || !input.rationale.trim()) {
      throw new Error('human actor and rationale are required');
    }
    return this.database.$transaction(async (transaction) => {
      const queued = await transaction.canonicalResourceBindingHumanQueueItem.findUnique({
        where: { id: input.queueId },
        include: { bindingDecision: true, receipt: true },
      }) as {
        contextDigest: string;
        inputDigest: string;
        receipt: unknown;
        bindingDecision: CanonicalResourceBindingDecision;
      } | null;
      if (!queued || queued.receipt) {
        throw new Error('human queue item is missing or already adjudicated');
      }
      if (queued.contextDigest !== canonicalSha256(input.context)) {
        throw new Error('human adjudication context has drifted');
      }
      const decision = applyHumanDecision({
        decision: queued.bindingDecision,
        outcome: input.outcome,
        context: input.context,
      });
      await transaction.canonicalResourceBindingDecision.createMany({
        data: [decisionData(decision)],
      });
      await transaction.canonicalResourceBindingDecision.update({
        where: { id: queued.bindingDecision.id },
        data: { lifecycleState: 'SUPERSEDED' },
      });
      await transaction.canonicalResourceBindingHumanDecisionReceipt.create({
        data: {
          id: `${input.queueId}:receipt`,
          queueId: input.queueId,
          actorId: input.actorId,
          decidedAt: new Date(input.decidedAt),
          outcome: input.outcome,
          rationale: input.rationale,
          contextDigest: queued.contextDigest,
          inputDigest: queued.inputDigest,
          decisionId: decision.id,
        },
      });
      return decision;
    }, { isolationLevel: 'Serializable' });
  }
}
