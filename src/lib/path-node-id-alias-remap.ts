export function remapPathNodeId(
  value: string,
  aliases: ReadonlyMap<string, string>,
): string;
export function remapPathNodeId(
  value: string | null | undefined,
  aliases: ReadonlyMap<string, string>,
): string | null;
export function remapPathNodeId(
  value: string | null | undefined,
  aliases: ReadonlyMap<string, string>,
): string | null {
  if (typeof value !== 'string') return null;
  return aliases.get(value) ?? value;
}

export function remapPathNodeIdArray(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
): string[] {
  if (!Array.isArray(value)) return [];
  const remapped: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const nodeId = aliases.get(item) ?? item;
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    remapped.push(nodeId);
  }
  return remapped;
}

export function remapAdaptivePathPlanNodeReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const node = asRecord(value);
  if (!node) return value;
  const remapped = { ...node };
  remapScalarFields(remapped, ['nodeId', 'resourceNodeId'], aliases);
  remapArrayFields(remapped, ['prerequisiteNodeIds'], aliases);
  if (Array.isArray(node.prerequisiteBasis)) {
    remapped.prerequisiteBasis = node.prerequisiteBasis.map((basis) => remapNodeIdRecord(basis, aliases));
  }
  const readiness = asRecord(node.readiness);
  if (readiness) {
    const remappedReadiness = { ...readiness };
    remapArrayFields(remappedReadiness, [
      'requiredCompletedNodeIds',
      'fallbackNodeIds',
      'missingCompletedNodeIds',
    ], aliases);
    remapped.readiness = remappedReadiness;
  }
  return remapped as T;
}

export function remapAdaptivePathPolicyBundleReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const bundle = asRecord(value);
  if (!bundle) return value;
  return {
    ...bundle,
    ...(Array.isArray(bundle.paths) ? {
      paths: bundle.paths.map((path) => remapPolicyPath(path, aliases)),
    } : {}),
  } as T;
}

export function remapAdaptivePathConstraintRepairReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const repair = asRecord(value);
  if (!repair) return value;
  const remapped = { ...repair };
  remapArrayFields(remapped, [
    'draftNodeIds',
    'repairedNodeIds',
    'insertedNodeIds',
    'removedNodeIds',
    'checkpointNodeIds',
    'terminalValidationNodeIds',
  ], aliases);
  if (Array.isArray(repair.infeasibleReasons)) {
    remapped.infeasibleReasons = repair.infeasibleReasons.map((reason) => {
      const record = asRecord(reason);
      if (!record) return reason;
      const remappedReason = { ...record };
      remapArrayFields(remappedReason, ['nodeIds'], aliases);
      return remappedReason;
    });
  }
  return remapped as T;
}

export function remapAdaptivePathExecutionStatusReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const status = asRecord(value);
  if (!status) return value;
  const remapped = { ...status };
  remapScalarFields(remapped, ['activeNodeId', 'currentNodeId'], aliases);
  remapArrayFields(remapped, [
    'completedNodeIds',
    'failedNodeIds',
    'skippedNodeIds',
    'nextNodeIds',
    'remainingNodeIds',
  ], aliases);
  return remapped as T;
}

export function remapAdaptivePathPayloadReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const payload = asRecord(value);
  if (!payload) return value;
  const remapped = { ...payload };
  remapScalarFields(remapped, ['currentNodeId'], aliases);
  remapArrayFields(remapped, ['mainPathNodeIds'], aliases);
  if (Array.isArray(payload.planNodes)) {
    remapped.planNodes = payload.planNodes.map((node) => remapAdaptivePathPlanNodeReferences(node, aliases));
  }
  if (Array.isArray(payload.alternatives)) {
    remapped.alternatives = payload.alternatives.map((alternative) => remapAlternative(alternative, aliases));
  }
  if (Array.isArray(payload.pathOptions)) {
    remapped.pathOptions = payload.pathOptions.map((path) => remapPolicyPath(path, aliases));
  }
  if (payload.policyBundle !== undefined) {
    remapped.policyBundle = remapAdaptivePathPolicyBundleReferences(payload.policyBundle, aliases);
  }
  if (payload.constraintRepair !== undefined) {
    remapped.constraintRepair = remapAdaptivePathConstraintRepairReferences(payload.constraintRepair, aliases);
  }
  if (payload.executionStatus !== undefined) {
    remapped.executionStatus = remapAdaptivePathExecutionStatusReferences(payload.executionStatus, aliases);
  }
  if (payload.explanations !== undefined) {
    remapped.explanations = remapExplanations(payload.explanations, aliases);
  }
  if (payload.visualization !== undefined) {
    remapped.visualization = remapVisualization(payload.visualization, aliases);
  }
  if (Array.isArray(payload.deviations)) {
    remapped.deviations = payload.deviations.map((item) => remapAdaptivePathDeviationReferences(item, aliases));
  }
  if (Array.isArray(payload.corrections)) {
    remapped.corrections = payload.corrections.map((item) => remapNodeIdArrayRecord(item, aliases));
  }
  if (Array.isArray(payload.feedbackEvents)) {
    remapped.feedbackEvents = payload.feedbackEvents.map((item) => remapNodeIdRecord(item, aliases));
  }
  if (Array.isArray(payload.activity)) {
    remapped.activity = payload.activity.map((item) => remapActivityRecord(item, aliases));
  }
  if (Array.isArray(payload.selectionHistory)) {
    remapped.selectionHistory = payload.selectionHistory.map((item) => remapNodeIdRecord(item, aliases));
  }
  return remapped as T;
}

export function remapPersistedLearningPathReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const path = asRecord(value);
  if (!path) return value;
  const remapped = { ...path };
  remapScalarFields(remapped, ['currentNodeId', 'entryNodeId'], aliases);
  remapArrayFields(remapped, ['nodeIds'], aliases);
  if (path.pathPayload !== undefined) {
    remapped.pathPayload = remapAdaptivePathPayloadReferences(path.pathPayload, aliases);
  }
  if (path.terminalValidation !== undefined) {
    remapped.terminalValidation = remapNodeIdRecord(path.terminalValidation, aliases);
  }
  if (path.lastExecutionMetadata !== undefined) {
    remapped.lastExecutionMetadata = remapExecutionMetadata(path.lastExecutionMetadata, aliases);
  }
  if (Array.isArray(path.deviations)) {
    remapped.deviations = path.deviations.map((deviation) => remapAdaptivePathDeviationReferences(deviation, aliases));
  }
  return remapped as T;
}

export function remapAdaptivePathDeviationReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  const deviation = asRecord(value);
  if (!deviation) return value;
  const remapped = { ...deviation };
  remapScalarFields(remapped, ['nodeId', 'priorNodeId', 'targetNodeId'], aliases);
  return remapped as T;
}

function remapPolicyPath(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const path = asRecord(value);
  if (!path) return value;
  const remapped = { ...path };
  remapArrayFields(remapped, [
    'nodeIds',
    'activeNodeIds',
    'lockedNodeIds',
    'terminalValidationNodeIds',
    'checkpointNodeIds',
  ], aliases);
  if (Array.isArray(path.readinessSummary)) {
    remapped.readinessSummary = path.readinessSummary.map((item) => remapNodeIdRecord(item, aliases));
  }
  if (Array.isArray(path.unlockMessages)) {
    remapped.unlockMessages = path.unlockMessages.map((item) => remapNodeIdRecord(item, aliases));
  }
  if (Array.isArray(path.planNodes)) {
    remapped.planNodes = path.planNodes.map((node) => remapAdaptivePathPlanNodeReferences(node, aliases));
  }
  if (Array.isArray(path.nodeSummaries)) {
    remapped.nodeSummaries = path.nodeSummaries.map((item) => remapNodeIdRecord(item, aliases));
  }
  const terminalStrategy = asRecord(path.terminalValidationStrategy);
  if (terminalStrategy) {
    const remappedStrategy = { ...terminalStrategy };
    remapArrayFields(remappedStrategy, ['nodeIds'], aliases);
    remapped.terminalValidationStrategy = remappedStrategy;
  }
  return remapped;
}

function remapExplanations(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const explanations = asRecord(value);
  if (!explanations) return value;
  const remapped = { ...explanations };
  if (Array.isArray(explanations.rejectedAlternatives)) {
    remapped.rejectedAlternatives = explanations.rejectedAlternatives
      .map((alternative) => remapAlternative(alternative, aliases));
  }
  const retrieval = asRecord(explanations.associativeRetrieval);
  if (retrieval) {
    remapped.associativeRetrieval = remapAssociativeRetrieval(retrieval, aliases);
  }
  return remapped;
}

function remapVisualization(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const visualization = asRecord(value);
  if (!visualization) return value;
  const remapped = { ...visualization };
  const map = asRecord(visualization.map);
  if (map) {
    const remappedMap = { ...map };
    remapScalarFields(remappedMap, ['currentNodeId'], aliases);
    remapArrayFields(remappedMap, ['mainPathNodeIds', 'completedNodeIds', 'riskNodeIds'], aliases);
    if (Array.isArray(map.branchPaths)) {
      remappedMap.branchPaths = map.branchPaths.map((branch) => {
        const record = asRecord(branch);
        if (!record) return branch;
        const remappedBranch = { ...record };
        remapScalarFields(remappedBranch, ['fromNodeId'], aliases);
        remapArrayFields(remappedBranch, ['nodeIds'], aliases);
        return remappedBranch;
      });
    }
    if (Array.isArray(map.blockedNodes)) {
      remappedMap.blockedNodes = map.blockedNodes.map((item) => remapAlternative(item, aliases));
    }
    if (Array.isArray(map.alternatives)) {
      remappedMap.alternatives = map.alternatives.map((item) => remapAlternative(item, aliases));
    }
    remapped.map = remappedMap;
  }
  const timeline = asRecord(visualization.timeline);
  if (timeline && Array.isArray(timeline.windows)) {
    remapped.timeline = {
      ...timeline,
      windows: timeline.windows.map((window) => remapNodeIdArrayRecord(window, aliases)),
    };
  }
  const evidence = asRecord(visualization.evidence);
  if (evidence) {
    const remappedEvidence = { ...evidence };
    if (Array.isArray(evidence.prerequisiteReasons)) {
      remappedEvidence.prerequisiteReasons = evidence.prerequisiteReasons.map((item) => {
        const record = remapNodeIdRecord(item, aliases);
        const remappedRecord = asRecord(record);
        if (remappedRecord) remapArrayFields(remappedRecord, ['prerequisiteNodeIds'], aliases);
        return remappedRecord ?? record;
      });
    }
    if (Array.isArray(evidence.teacherPolicy)) {
      remappedEvidence.teacherPolicy = evidence.teacherPolicy.map((item) => remapNodeIdRecord(item, aliases));
    }
    if (Array.isArray(evidence.alternatives)) {
      remappedEvidence.alternatives = evidence.alternatives.map((item) => remapAlternative(item, aliases));
    }
    const retrieval = asRecord(evidence.associativeRetrieval);
    if (retrieval) {
      remappedEvidence.associativeRetrieval = remapAssociativeRetrieval(retrieval, aliases);
    }
    remapped.evidence = remappedEvidence;
  }
  return remapped;
}

function remapAssociativeRetrieval(
  retrieval: Record<string, unknown>,
  aliases: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const remapped = { ...retrieval };
  remapArrayFields(remapped, ['candidateResourceNodeIds', 'selectedCandidateNodeIds'], aliases);
  if (Array.isArray(retrieval.rejectedCandidates)) {
    remapped.rejectedCandidates = retrieval.rejectedCandidates
      .map((candidate) => remapResourceNodeIdRecord(candidate, aliases));
  }
  return remapped;
}

function remapExecutionMetadata(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const metadata = asRecord(value);
  if (!metadata) return value;
  const remapped = { ...metadata };
  remapScalarFields(remapped, ['activeNodeId'], aliases);
  remapArrayFields(remapped, ['completedNodeIds', 'failedNodeIds', 'skippedNodeIds'], aliases);
  if (metadata.lastExecution !== undefined) {
    remapped.lastExecution = remapNodeIdRecord(metadata.lastExecution, aliases);
  }
  return remapped;
}

function remapAlternative(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const alternative = asRecord(value);
  if (!alternative) return value;
  const remapped = { ...alternative };
  remapScalarFields(remapped, ['nodeId'], aliases);
  remapArrayFields(remapped, ['nodeIds'], aliases);
  return remapped;
}

function remapActivityRecord(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const activity = asRecord(value);
  if (!activity) return value;
  const remapped = { ...activity };
  remapScalarFields(remapped, ['nodeId'], aliases);
  remapArrayFields(remapped, ['nodeIds'], aliases);
  return remapped;
}

function remapNodeIdRecord(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const record = asRecord(value);
  if (!record) return value;
  const remapped = { ...record };
  remapScalarFields(remapped, ['nodeId'], aliases);
  return remapped;
}

function remapResourceNodeIdRecord(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const record = asRecord(value);
  if (!record) return value;
  const remapped = { ...record };
  remapScalarFields(remapped, ['resourceNodeId'], aliases);
  return remapped;
}

function remapNodeIdArrayRecord(value: unknown, aliases: ReadonlyMap<string, string>): unknown {
  const record = asRecord(value);
  if (!record) return value;
  const remapped = { ...record };
  remapArrayFields(remapped, ['nodeIds'], aliases);
  return remapped;
}

function remapScalarFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  aliases: ReadonlyMap<string, string>,
) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string') record[field] = aliases.get(value) ?? value;
  }
}

function remapArrayFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  aliases: ReadonlyMap<string, string>,
) {
  for (const field of fields) {
    if (Array.isArray(record[field])) record[field] = remapPathNodeIdArray(record[field], aliases);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value as Record<string, unknown>
    : null;
}
