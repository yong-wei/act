import type { AdaptivePathCorrectionProposal } from '@/features/adaptive/adaptive-path-journey-contracts';
import type {
  EvidenceTimelineLearnerRecordSourceScope,
  StudentSafeEvidenceEventReference,
} from '@/lib/data-governance/evidence-timeline';

export interface AdaptivePathNodeSelectionBasis {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  supportingFacts: string[];
  limitations: string[];
  eventReferences?: StudentSafeEvidenceEventReference[];
}

export interface AdaptivePathNodeLatestAdjustment {
  kind: 'advanced' | 'delayed' | 'retained' | 'replaced' | 'removed';
  summary: string;
  supportingFacts: string[];
}

export interface AdaptivePathNodeDecisionExplanation {
  selectionBasis?: AdaptivePathNodeSelectionBasis;
  latestAdjustment?: AdaptivePathNodeLatestAdjustment;
}

export function projectSelectionBasisOntoPlanNodes(
  planNodes: Array<Record<string, unknown>>,
  recommendationProvenance: unknown,
): Array<Record<string, unknown>> {
  const provenance = readRecord(recommendationProvenance);
  const summary = readString(provenance.summary);
  const confidence = readConfidence(provenance.confidence);
  if (!summary || !confidence) return planNodes;

  const entries = readRecordArray(provenance.entries);
  const limitations = readStringArray(provenance.limitations);
  return planNodes.map((node) => {
    const nodeId = readString(node.nodeId);
    if (!nodeId) return node;
    const supportingFacts = uniqueStrings(entries
      .filter((entry) => readStringArray(entry.affectedNodeIds).includes(nodeId))
      .flatMap((entry) => [readString(entry.evidenceSummary), readString(entry.judgment)])
      .filter((value): value is string => Boolean(value)));
    const eventReferences = uniqueEventReferences(entries
      .filter((entry) => readStringArray(entry.affectedNodeIds).includes(nodeId))
      .flatMap((entry) => readEventReferences(entry.eventReferences)));
    const existing = readDecisionExplanation(node.decisionExplanation);
    return {
      ...node,
      decisionExplanation: {
        ...existing,
        selectionBasis: {
          summary,
          confidence,
          supportingFacts,
          limitations,
          eventReferences,
        },
      } satisfies AdaptivePathNodeDecisionExplanation,
    };
  });
}

export function projectConfirmedAdjustmentsOntoPlanNodes(input: {
  planNodes: Array<Record<string, unknown>>;
  previousNodeIds: string[];
  nextNodeIds: string[];
  completedNodeIds: ReadonlySet<string>;
  skippedNodeIds: ReadonlySet<string>;
  proposal: AdaptivePathCorrectionProposal;
}): Array<Record<string, unknown>> {
  const nodeById = new Map(input.planNodes
    .map((node) => [readString(node.nodeId), node] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const previousDisplayNodeIds = input.planNodes
    .map((node) => readString(node.nodeId))
    .filter((nodeId): nodeId is string => Boolean(nodeId));
  const retainedHistoryNodeIds = previousDisplayNodeIds.filter((nodeId) => (
    !input.nextNodeIds.includes(nodeId) &&
    (input.completedNodeIds.has(nodeId) || input.skippedNodeIds.has(nodeId))
  ));
  const displayNodeIds = insertHistoricalNodes(
    input.nextNodeIds,
    previousDisplayNodeIds,
    retainedHistoryNodeIds,
  );
  const latestAdjustmentByNodeId = buildLatestAdjustmentByNodeId(input);

  return displayNodeIds.map((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const latestAdjustment = latestAdjustmentByNodeId.get(nodeId);
    if (!latestAdjustment) return node;
    const existing = readDecisionExplanation(node.decisionExplanation);
    return {
      ...node,
      decisionExplanation: {
        ...existing,
        latestAdjustment,
      } satisfies AdaptivePathNodeDecisionExplanation,
    };
  }).filter((node): node is Record<string, unknown> => Boolean(node));
}

function buildLatestAdjustmentByNodeId(input: {
  previousNodeIds: string[];
  nextNodeIds: string[];
  completedNodeIds: ReadonlySet<string>;
  skippedNodeIds: ReadonlySet<string>;
  proposal: AdaptivePathCorrectionProposal;
}): Map<string, AdaptivePathNodeLatestAdjustment> {
  const result = new Map<string, AdaptivePathNodeLatestAdjustment>();
  const previousIndex = new Map(input.previousNodeIds.map((nodeId, index) => [nodeId, index]));
  const nextIndex = new Map(input.nextNodeIds.map((nodeId, index) => [nodeId, index]));
  const supportingFacts = uniqueStrings(input.proposal.supportingFacts);

  for (const nodeId of input.nextNodeIds) {
    const before = previousIndex.get(nodeId);
    const after = nextIndex.get(nodeId);
    if (before === undefined || after === undefined || before === after) continue;
    const advanced = after < before;
    result.set(nodeId, {
      kind: advanced ? 'advanced' : 'delayed',
      summary: `本次确认纠偏后，该节点相对上一版活动路径${advanced ? '提前' : '延后'} ${Math.abs(after - before)} 位。`,
      supportingFacts,
    });
  }

  for (const change of input.proposal.changes) {
    if (change.kind === 'replaced') {
      if (nextIndex.has(change.replacementNodeId)) {
        result.set(change.replacementNodeId, {
          kind: 'replaced',
          summary: `本次确认纠偏用“${change.replacementTitle}”替换了“${change.title}”。`,
          supportingFacts,
        });
      }
      if (shouldRetainHistory(change.nodeId, input)) {
        result.set(change.nodeId, {
          kind: 'removed',
          summary: `本次确认纠偏将“${change.title}”移出后续执行，并改用“${change.replacementTitle}”。`,
          supportingFacts,
        });
      }
      continue;
    }
    if (change.kind === 'removed') {
      if (shouldRetainHistory(change.nodeId, input)) {
        result.set(change.nodeId, {
          kind: 'removed',
          summary: `本次确认纠偏将“${change.title}”移出后续执行：${change.reason}`,
          supportingFacts,
        });
      }
      continue;
    }
    if (!result.has(change.nodeId) && nextIndex.has(change.nodeId)) {
      result.set(change.nodeId, {
        kind: 'retained',
        summary: `本次确认纠偏保留了“${change.title}”在活动路径中的位置。`,
        supportingFacts,
      });
    }
  }

  return result;
}

function shouldRetainHistory(nodeId: string, input: {
  completedNodeIds: ReadonlySet<string>;
  skippedNodeIds: ReadonlySet<string>;
}): boolean {
  return input.completedNodeIds.has(nodeId) || input.skippedNodeIds.has(nodeId);
}

function insertHistoricalNodes(
  nextNodeIds: string[],
  previousNodeIds: string[],
  retainedHistoryNodeIds: string[],
): string[] {
  const result = [...nextNodeIds];
  for (const historicalNodeId of retainedHistoryNodeIds) {
    const previousPosition = previousNodeIds.indexOf(historicalNodeId);
    const followingNodeId = previousNodeIds
      .slice(previousPosition + 1)
      .find((nodeId) => result.includes(nodeId));
    const insertionIndex = followingNodeId ? result.indexOf(followingNodeId) : result.length;
    result.splice(insertionIndex, 0, historicalNodeId);
  }
  return uniqueStrings(result);
}

function readDecisionExplanation(value: unknown): AdaptivePathNodeDecisionExplanation {
  const record = readRecord(value);
  const selectionBasis = readRecord(record.selectionBasis);
  const latestAdjustment = readRecord(record.latestAdjustment);
  return {
    ...(readString(selectionBasis.summary) ? { selectionBasis: selectionBasis as unknown as AdaptivePathNodeSelectionBasis } : {}),
    ...(readString(latestAdjustment.summary) ? { latestAdjustment: latestAdjustment as unknown as AdaptivePathNodeLatestAdjustment } : {}),
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function readConfidence(value: unknown): AdaptivePathNodeSelectionBasis['confidence'] | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function readEventReferences(value: unknown): StudentSafeEvidenceEventReference[] {
  return readRecordArray(value).flatMap((entry) => {
    const sourceScope = readEvidenceSourceScope(entry.sourceScope);
    const occurredAt = readString(entry.occurredAt);
    const summary = readString(entry.summary);
    const nextAction = readRecord(entry.nextAction);
    const href = readString(nextAction.href);
    const label = readString(nextAction.label);
    return sourceScope && occurredAt && summary && href && label
      ? [{ sourceScope, occurredAt, summary, nextAction: { href, label } }]
      : [];
  });
}

function readEvidenceSourceScope(value: unknown): EvidenceTimelineLearnerRecordSourceScope | null {
  return value === 'interactive-lesson-submission' ||
    value === 'arena-official-result' ||
    value === 'arena-preview-result' ||
    value === 'simulation-workbench-completion' ||
    value === 'adaptive-practice-submission'
    ? value
    : null;
}

function uniqueEventReferences(value: StudentSafeEvidenceEventReference[]): StudentSafeEvidenceEventReference[] {
  const seen = new Set<string>();
  return value.filter((reference) => {
    const key = `${reference.sourceScope}|${reference.occurredAt}|${reference.nextAction.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value)];
}
