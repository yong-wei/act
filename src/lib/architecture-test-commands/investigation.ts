import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { COMMAND_CONTRACTS, commandContract } from './conventions';
import { discoverTests } from './discover';
import {
  COMPACT_PACKAGE_SCHEMA_VERSION,
  INVESTIGATION_RESULT_CORE_SCHEMA_VERSION,
  INVESTIGATION_SCHEMA_VERSION,
  coordinationGateFailures,
  createToolIdentity,
  defaultMandatoryCommands,
  identityPairFailures,
  isDefaultMandatory,
  laneIdFor,
  loadSuccessorSubject,
  secondIdentityReadFailures,
  type CoordinationGate,
  type InvestigationFs,
  type InvestigationGit,
  type SubjectIdentity,
  type ToolIdentity,
} from './investigation-identity';
import {
  clusterPlannedDispositions,
  createPlannedDisposition,
  plannedDispositionBlocksDefault,
  validatePlannedDisposition,
  type PlannedDisposition,
  type PlannedDispositionRecord,
} from './planned-disposition';
import { createTestMeasurementReceipt, qualifyDiscovery } from './qualify';
import type {
  DiscoveryCore,
  GovernedCommandId,
  QualificationFailure,
  TestMeasurementReceipt,
} from './types';

export type LaneStatus = 'pass' | 'non-clean' | 'BLOCKED';
export type DefaultConclusion = 'clean' | 'non-clean';

export interface LaneExecutionInput {
  readonly command: GovernedCommandId;
  readonly exitStatus: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: readonly string[];
  readonly unhandledErrors: number;
  readonly failures: readonly LaneFailureObservation[];
  readonly capturedAt?: string;
  readonly platform?: string;
  readonly unavailable?: {
    readonly responseClass: string;
    readonly resolutionCondition: string;
    readonly owner: string;
  };
}

export interface LaneFailureObservation {
  readonly testIdentity: string;
  readonly failureStage: string;
  readonly errorClass: string;
  readonly errorSummary: string;
  readonly artifactIdentity?: string;
}

export interface InvestigationResultCore {
  readonly schemaVersion: typeof INVESTIGATION_RESULT_CORE_SCHEMA_VERSION;
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
  readonly command: GovernedCommandId;
  readonly lane: string;
  readonly scope: string;
  readonly commandDocsDigest: string;
  readonly discoveryHash: string;
  readonly exitStatus: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly unhandledErrors: number;
  readonly unresolved: number;
  readonly fingerprints: readonly string[];
  readonly qualificationStatus: LaneStatus;
}

export interface LaneDenominator {
  readonly command: GovernedCommandId;
  readonly lane: string;
  readonly defaultMandatory: boolean;
  readonly status: LaneStatus;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly unhandledErrors: number;
  readonly unresolved: number;
  readonly unclosedDispositions: number;
  readonly requiredInputs: readonly string[];
  readonly resultCoreHash: string;
  readonly measurementReceiptId: string;
}

export interface CompactPackage {
  readonly schemaVersion: typeof COMPACT_PACKAGE_SCHEMA_VERSION;
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
  readonly commandManifest: readonly {
    readonly command: GovernedCommandId;
    readonly lane: string;
    readonly scope: string;
    readonly defaultMandatory: boolean;
    readonly requiredInputs: readonly string[];
  }[];
  readonly universeClosure: DiscoveryCore['totals'] & { readonly duplicate: number };
  readonly lanes: readonly LaneDenominator[];
  readonly receiptIndex: readonly { readonly kind: string; readonly identity: string }[];
  readonly failureDispositionSummary: readonly PlannedDispositionRecord[];
  readonly defaultConclusion: DefaultConclusion;
  readonly nonDefaultConclusions: readonly { readonly lane: string; readonly status: LaneStatus }[];
  readonly artifacts: readonly {
    readonly logicalLocator: string;
    readonly byteCount: number;
    readonly sha256: string;
  }[];
  readonly packageDigest: string;
}

export interface InvestigationInput {
  readonly repoRoot: string;
  readonly gate: CoordinationGate | null;
  readonly tool: ToolIdentity;
  readonly discovery: DiscoveryCore;
  readonly executions: readonly LaneExecutionInput[];
  readonly firstIdentity?: { readonly subject: SubjectIdentity; readonly tool: ToolIdentity };
  readonly fs?: InvestigationFs;
  readonly git?: InvestigationGit;
}

export interface InvestigationOutput {
  readonly failures: readonly QualificationFailure[];
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
  readonly discovery: DiscoveryCore;
  readonly resultCores: readonly InvestigationResultCore[];
  readonly measurementReceipts: readonly TestMeasurementReceipt[];
  readonly dispositions: readonly PlannedDispositionRecord[];
  readonly compact: CompactPackage | null;
}

export function commandDocsDigest(): string {
  return sha256Text(serializeDeterministic(COMMAND_CONTRACTS.map((command) => ({
    id: command.id,
    npmScript: command.npmScript,
    scope: command.scope,
    layers: command.layers,
    requiredInputs: command.requiredInputs,
    excludedScopes: command.excludedScopes,
    executionGlobs: command.executionGlobs,
    executionIdentities: command.executionIdentities,
  }))));
}

export function buildInvestigationDiscovery(
  paths: readonly string[],
  subject: SubjectIdentity,
  charterSha256: string,
): DiscoveryCore {
  return discoverTests({
    paths,
    sourceCommit: subject.sourceCommit,
    sourceTree: subject.sourceTree,
    charterSha256,
  });
}

export function investigateCurrentDenominator(input: InvestigationInput): InvestigationOutput {
  const loaded = loadSuccessorSubject(input.repoRoot, { fs: input.fs });
  const failures: QualificationFailure[] = [
    ...coordinationGateFailures(input.gate),
    ...loaded.failures,
    ...identityPairFailures(loaded.subject, input.tool),
  ];
  if (input.firstIdentity) {
    failures.push(...secondIdentityReadFailures(input.firstIdentity, { subject: loaded.subject, tool: input.tool }));
  }
  if (input.discovery.sourceCommit !== loaded.subject.sourceCommit || input.discovery.sourceTree !== loaded.subject.sourceTree) {
    failures.push({ code: 'discovery-subject-drift', identity: input.discovery.sourceCommit });
  }
  const discoveryFailures = qualifyDiscovery(input.discovery, {
    charterSha256: input.discovery.charter.sha256,
    charterPresent: true,
  }).filter((item) => item.code !== 'discovery-denominator-incomplete' && item.code !== 'discovery-denominator-gap');
  failures.push(...discoveryFailures);

  const dispositions: PlannedDispositionRecord[] = [];
  const resultCores: InvestigationResultCore[] = [];
  const measurementReceipts: TestMeasurementReceipt[] = [];
  const lanes: LaneDenominator[] = [];

  for (const command of COMMAND_CONTRACTS) {
    const execution = input.executions.find((item) => item.command === command.id);
    const unresolvedForLane = unresolvedCountForLane(input.discovery, command.id);
    if (!execution) {
      const blocked = createUnavailableExecution(command.id, loaded.subject, input.tool, {
        responseClass: 'lane-not-run',
        resolutionCondition: `run-registered-scope:${command.id}`,
        owner: 'platform',
      }, unresolvedForLane);
      dispositions.push(blocked.disposition);
      resultCores.push(blocked.core);
      measurementReceipts.push(blocked.measurement);
      lanes.push(blocked.lane);
      continue;
    }
    const built = buildLane(command.id, execution, loaded.subject, input.tool, input.discovery, unresolvedForLane);
    dispositions.push(...built.dispositions);
    resultCores.push(built.core);
    measurementReceipts.push(built.measurement);
    lanes.push(built.lane);
    failures.push(...built.failures);
  }

  const clustered = clusterPlannedDispositions(dispositions);
  const dispositionFailures = clustered.flatMap((item) => validatePlannedDisposition(item));
  failures.push(...dispositionFailures);

  const defaultConclusion = computeDefaultConclusion(lanes, clustered, failures);
  const nonDefaultConclusions = lanes
    .filter((lane) => !lane.defaultMandatory)
    .map((lane) => ({ lane: lane.lane, status: lane.status }));

  const compactDraft = {
    schemaVersion: COMPACT_PACKAGE_SCHEMA_VERSION,
    subject: loaded.subject,
    tool: input.tool,
    commandManifest: COMMAND_CONTRACTS.map((command) => ({
      command: command.id,
      lane: laneIdFor(command.id),
      scope: command.scope,
      defaultMandatory: isDefaultMandatory(command.id),
      requiredInputs: command.requiredInputs,
    })),
    universeClosure: {
      discovered: input.discovery.totals.discovered,
      classified: input.discovery.totals.classified,
      excluded: input.discovery.totals.excluded,
      unresolved: input.discovery.totals.unresolved,
      duplicate: 0,
    },
    lanes,
    receiptIndex: [
      ...resultCores.map((core) => ({ kind: 'result-core', identity: sha256Text(serializeDeterministic(core)) })),
      ...measurementReceipts.map((receipt) => ({ kind: 'measurement', identity: receipt.receiptId })),
    ],
    failureDispositionSummary: clustered,
    defaultConclusion,
    nonDefaultConclusions,
    artifacts: [] as CompactPackage['artifacts'],
  };
  const compact: CompactPackage = {
    ...compactDraft,
    artifacts: [{
      logicalLocator: 'manifest.json',
      byteCount: Buffer.byteLength(serializeDeterministic({ ...compactDraft, packageDigest: '' }), 'utf8'),
      sha256: sha256Text(serializeDeterministic({ ...compactDraft, packageDigest: '' })),
    }],
    packageDigest: '',
  };
  const withDigest: CompactPackage = {
    ...compact,
    packageDigest: sha256Text(serializeDeterministic({ ...compact, packageDigest: '' })),
  };
  const privacy = privacyViolation(serializeDeterministic(withDigest));
  if (privacy) failures.push({ code: `privacy-${privacy}`, identity: 'compact-package' });

  return {
    failures: uniqueFailures(failures),
    subject: loaded.subject,
    tool: input.tool,
    discovery: input.discovery,
    resultCores,
    measurementReceipts,
    dispositions: clustered,
    compact: failures.some((item) => item.code.startsWith('a-gate-') || item.code.startsWith('successor-'))
      ? null
      : withDigest,
  };
}

export function projectCompactPackage(pack: CompactPackage): string {
  return serializeDeterministic({ ...pack, packageDigest: '' }).replace(/\n+$/u, '\n');
}

export function compactPackageDigest(pack: CompactPackage): string {
  return sha256Text(serializeDeterministic({ ...pack, packageDigest: '' }));
}

export function reprojectCompactPackage(pack: CompactPackage): CompactPackage {
  return {
    ...pack,
    packageDigest: compactPackageDigest(pack),
  };
}

function buildLane(
  commandId: GovernedCommandId,
  execution: LaneExecutionInput,
  subject: SubjectIdentity,
  tool: ToolIdentity,
  discovery: DiscoveryCore,
  unresolved: number,
): {
  readonly core: InvestigationResultCore;
  readonly measurement: TestMeasurementReceipt;
  readonly lane: LaneDenominator;
  readonly dispositions: readonly PlannedDispositionRecord[];
  readonly failures: readonly QualificationFailure[];
} {
  const command = commandContract(commandId);
  const dispositions: PlannedDispositionRecord[] = [];
  const failures: QualificationFailure[] = [];

  if (execution.unavailable) {
    const blocked = createUnavailableExecution(commandId, subject, tool, execution.unavailable, unresolved);
    return { ...blocked, failures };
  }

  for (const skipped of execution.skipped) {
    dispositions.push(createPlannedDisposition({
      command: commandId,
      testIdentity: skipped,
      failureStage: 'skip',
      errorClass: 'unregistered-skip',
      errorSummary: 'unregistered skip in governed scope',
      artifactIdentity: `${commandId}:${skipped}`,
      subject,
      tool,
      disposition: 'FIX',
      rootCauseEvidenceLocator: `skip:${skipped}`,
      closureCondition: 'register-an-explicit-revision-bound-scope-exclusion-or-run-the-test',
    }));
  }

  for (const observation of execution.failures) {
    dispositions.push(assignObservation(commandId, observation, subject, tool));
  }

  if (execution.unhandledErrors > 0) {
    dispositions.push(createPlannedDisposition({
      command: commandId,
      testIdentity: `${commandId}::unhandled`,
      failureStage: 'unhandled',
      errorClass: 'unhandled-error',
      errorSummary: `${execution.unhandledErrors} unhandled error(s)`,
      artifactIdentity: `${commandId}:unhandled`,
      subject,
      tool,
      disposition: 'FIX',
      rootCauseEvidenceLocator: `unhandled:${commandId}`,
      closureCondition: 'the command completes with zero unhandled errors',
    }));
  }

  if (execution.failed > 0 && execution.failures.length === 0 && !command.requiredInputs.includes('qualification-manifest')) {
    dispositions.push(createPlannedDisposition({
      command: commandId,
      testIdentity: `${commandId}::unparsed-failures`,
      failureStage: 'execution',
      errorClass: 'assertion-failure',
      errorSummary: `${execution.failed} failure(s) without a parsed test identity`,
      artifactIdentity: `${commandId}:unparsed-failures`,
      subject,
      tool,
      disposition: 'FIX',
      rootCauseEvidenceLocator: `failure:${commandId}:unparsed`,
      closureCondition: 'the focused command passes without this fingerprint',
    }));
  }

  if (command.requiredInputs.includes('qualification-manifest') && execution.failed > 0 && execution.failures.length === 0) {
    dispositions.push(createPlannedDisposition({
      command: commandId,
      testIdentity: 'qualification-manifest',
      failureStage: 'input',
      errorClass: 'release-input-missing',
      errorSummary: 'release qualification manifest is missing or invalid',
      artifactIdentity: `${commandId}:qualification-manifest`,
      subject,
      tool,
      disposition: 'QUARANTINE',
      subtype: 'release-input',
      namedLane: 'release',
      expiry: 'until-release-manifest-is-supplied',
      migrationCondition: 'move-and-qualify-the-evidence-in-the-named-release-lane',
      rootCauseEvidenceLocator: 'release:qualification-manifest',
      closureCondition: 'test:release validates a current qualification manifest',
    }));
  }

  const fingerprints = dispositions.map((item) => item.fingerprint).sort();
  const unclosed = dispositions.filter((item) => validatePlannedDisposition(item).length === 0).length;
  const status = laneStatus(execution, unresolved, dispositions);
  const core: InvestigationResultCore = {
    schemaVersion: INVESTIGATION_RESULT_CORE_SCHEMA_VERSION,
    subject,
    tool,
    command: commandId,
    lane: laneIdFor(commandId),
    scope: command.scope,
    commandDocsDigest: commandDocsDigest(),
    discoveryHash: sha256Text(serializeDeterministic({
      schemaVersion: discovery.schemaVersion,
      sourceCommit: discovery.sourceCommit,
      sourceTree: discovery.sourceTree,
      totals: discovery.totals,
    })),
    exitStatus: execution.exitStatus,
    passed: execution.passed,
    failed: execution.failed,
    skipped: execution.skipped.length,
    unhandledErrors: execution.unhandledErrors,
    unresolved,
    fingerprints,
    qualificationStatus: status,
  };
  const measurement = createTestMeasurementReceipt({
    sourceCommit: subject.sourceCommit,
    sourceTree: subject.sourceTree,
    command: commandId,
    scope: command.scope,
    platform: execution.platform ?? 'investigation',
    toolVersions: { schema: INVESTIGATION_SCHEMA_VERSION },
    cacheMode: 'no-cache',
    capturedAt: execution.capturedAt ?? '0000-01-01T00:00:00.000Z',
    exitStatus: execution.exitStatus,
    aggregate: {
      passed: execution.passed,
      failed: execution.failed,
      skipped: execution.skipped.length,
      unhandledErrors: execution.unhandledErrors,
      unresolved,
    },
    fingerprints,
  });
  return {
    core,
    measurement,
    lane: {
      command: commandId,
      lane: laneIdFor(commandId),
      defaultMandatory: isDefaultMandatory(commandId),
      status,
      passed: execution.passed,
      failed: execution.failed,
      skipped: execution.skipped.length,
      unhandledErrors: execution.unhandledErrors,
      unresolved,
      unclosedDispositions: unclosed,
      requiredInputs: command.requiredInputs,
      resultCoreHash: sha256Text(serializeDeterministic(core)),
      measurementReceiptId: measurement.receiptId,
    },
    dispositions,
    failures,
  };
}

function createUnavailableExecution(
  commandId: GovernedCommandId,
  subject: SubjectIdentity,
  tool: ToolIdentity,
  unavailable: { readonly responseClass: string; readonly resolutionCondition: string; readonly owner: string },
  unresolved: number,
): {
  readonly core: InvestigationResultCore;
  readonly measurement: TestMeasurementReceipt;
  readonly lane: LaneDenominator;
  readonly dispositions: readonly PlannedDispositionRecord[];
} {
  const command = commandContract(commandId);
  const disposition = createPlannedDisposition({
    command: commandId,
    testIdentity: `${commandId}::unavailable`,
    failureStage: 'execution',
    errorClass: 'external-blocker',
    errorSummary: unavailable.responseClass,
    artifactIdentity: `${commandId}:unavailable`,
    subject,
    tool,
    disposition: 'BLOCKED',
    blockedReason: 'external-blocker',
    responseClass: unavailable.responseClass,
    resolutionCondition: unavailable.resolutionCondition,
    owner: unavailable.owner,
    rootCauseEvidenceLocator: `blocker:${commandId}:${unavailable.responseClass}`,
    closureCondition: unavailable.resolutionCondition,
  });
  const core: InvestigationResultCore = {
    schemaVersion: INVESTIGATION_RESULT_CORE_SCHEMA_VERSION,
    subject,
    tool,
    command: commandId,
    lane: laneIdFor(commandId),
    scope: command.scope,
    commandDocsDigest: commandDocsDigest(),
    discoveryHash: '',
    exitStatus: 1,
    passed: 0,
    failed: 0,
    skipped: 0,
    unhandledErrors: 0,
    unresolved,
    fingerprints: [disposition.fingerprint],
    qualificationStatus: 'BLOCKED',
  };
  const measurement = createTestMeasurementReceipt({
    sourceCommit: subject.sourceCommit,
    sourceTree: subject.sourceTree,
    command: commandId,
    scope: command.scope,
    platform: 'investigation',
    toolVersions: { schema: INVESTIGATION_SCHEMA_VERSION },
    cacheMode: 'no-cache',
    capturedAt: '0000-01-01T00:00:00.000Z',
    exitStatus: 1,
    aggregate: { unresolved, blocked: 1 },
    fingerprints: [disposition.fingerprint],
  });
  return {
    core,
    measurement,
    lane: {
      command: commandId,
      lane: laneIdFor(commandId),
      defaultMandatory: isDefaultMandatory(commandId),
      status: 'BLOCKED',
      passed: 0,
      failed: 0,
      skipped: 0,
      unhandledErrors: 0,
      unresolved,
      unclosedDispositions: 1,
      requiredInputs: command.requiredInputs,
      resultCoreHash: sha256Text(serializeDeterministic(core)),
      measurementReceiptId: measurement.receiptId,
    },
    dispositions: [disposition],
  };
}

function assignObservation(
  commandId: GovernedCommandId,
  observation: LaneFailureObservation,
  subject: SubjectIdentity,
  tool: ToolIdentity,
): PlannedDispositionRecord {
  const artifactIdentity = observation.artifactIdentity ?? `${commandId}:${observation.testIdentity}`;
  let disposition: PlannedDisposition = 'FIX';
  let extra: Partial<Parameters<typeof createPlannedDisposition>[0]> = {};
  if (commandId === 'test:release' || observation.errorClass.includes('release-input')) {
    disposition = 'QUARANTINE';
    extra = {
      subtype: 'release-input',
      namedLane: 'release',
      expiry: 'until-release-qualification-passes',
      migrationCondition: 'qualify-the-capture-bound-evidence-in-the-named-release-lane',
    };
  } else if (observation.errorClass === 'external-blocker' || observation.failureStage === 'external') {
    disposition = 'BLOCKED';
    extra = {
      blockedReason: 'external-blocker',
      responseClass: observation.errorClass,
      resolutionCondition: 'restore-the-required-external-capability-and-rerun-the-lane',
    };
  } else if (observation.errorClass === 'invalid-test-removal' || observation.errorClass === 'retired-capability') {
    disposition = 'DELETE';
    extra = {
      rootCauseEvidenceLocator: `retirement:${observation.testIdentity}`,
    };
  }
  return createPlannedDisposition({
    command: commandId,
    testIdentity: observation.testIdentity,
    failureStage: observation.failureStage,
    errorClass: observation.errorClass,
    errorSummary: observation.errorSummary,
    artifactIdentity,
    subject,
    tool,
    disposition,
    rootCauseEvidenceLocator: extra.rootCauseEvidenceLocator ?? `failure:${artifactIdentity}`,
    closureCondition: disposition === 'FIX'
      ? 'the focused command passes without this fingerprint'
      : disposition === 'DELETE'
        ? 'remove the retired test after replacement/retirement evidence is recorded'
        : disposition === 'QUARANTINE'
          ? 'migrate and qualify the evidence in the named non-default release lane'
          : 'resolve the external blocker and rerun the lane',
    ...extra,
  });
}

function laneStatus(
  execution: LaneExecutionInput,
  unresolved: number,
  dispositions: readonly PlannedDispositionRecord[],
): LaneStatus {
  if (execution.unavailable) return 'BLOCKED';
  if (dispositions.some((item) => item.disposition === 'BLOCKED')) return 'BLOCKED';
  if (execution.failed > 0 || execution.unhandledErrors > 0 || execution.skipped.length > 0 || unresolved > 0) return 'non-clean';
  if (dispositions.length > 0) return 'non-clean';
  if (execution.exitStatus !== 0) return 'non-clean';
  return 'pass';
}

function unresolvedCountForLane(discovery: DiscoveryCore, commandId: GovernedCommandId): number {
  if (commandId === 'test') {
    return discovery.unresolved.filter((item) => item.code === 'missing-root' || item.code === 'missing-classification').length;
  }
  const command = commandContract(commandId);
  return discovery.unresolved.filter((item) => {
    if (item.code === 'execution-gap') return item.detail.includes(commandId);
    if (item.code === 'unmatched-root') {
      return command.layers.length > 0 && discovery.roots.some((root) => item.identity.startsWith(root.prefix));
    }
    return false;
  }).length;
}

function computeDefaultConclusion(
  lanes: readonly LaneDenominator[],
  dispositions: readonly PlannedDispositionRecord[],
  failures: readonly QualificationFailure[],
): DefaultConclusion {
  if (failures.some((item) => item.code.startsWith('a-gate-') || item.code.includes('drift') || item.code.startsWith('successor-'))) {
    return 'non-clean';
  }
  const defaultLanes = lanes.filter((lane) => lane.defaultMandatory);
  if (defaultLanes.length !== defaultMandatoryCommands().length) return 'non-clean';
  for (const lane of defaultLanes) {
    if (lane.status !== 'pass') return 'non-clean';
    if (lane.failed > 0 || lane.unhandledErrors > 0 || lane.skipped > 0 || lane.unresolved > 0) return 'non-clean';
  }
  if (dispositions.some(plannedDispositionBlocksDefault)) return 'non-clean';
  return 'clean';
}

function uniqueFailures(failures: readonly QualificationFailure[]): QualificationFailure[] {
  const seen = new Set<string>();
  return failures.filter((item) => {
    const key = `${item.code}:${item.identity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { createToolIdentity };
