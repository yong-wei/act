import { esaObjectUrl } from './keys';
import { publicationVerified } from './publish';
import { assertPortable } from './privacy';
import {
  COHORT_ID,
  GIT_SHA,
  ROUTING_SCHEMA,
  ROUTING_STATUSES,
  TOOL_VERSION,
  type BrowserDeliveryManifest,
  type PublicationReceipt,
  type ResolvedSimulationModel,
  type RoutingReceipt,
  type RoutingStatus,
  type SimulationModelId,
} from './types';

export interface RoutingInput {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly capturedAt: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly manifest: BrowserDeliveryManifest;
  readonly publication: PublicationReceipt;
  readonly esaQualified: boolean;
  readonly trafficQualified: boolean;
}

export function qualifyRouting(input: RoutingInput): RoutingReceipt {
  if (!GIT_SHA.test(input.sourceCommit) || !GIT_SHA.test(input.sourceTree)) {
    throw new Error('invalid-git-identity');
  }
  const blockingReasons: string[] = [];
  const missingEvidence: string[] = [];
  if (input.dirty) blockingReasons.push('dirty-worktree');
  if (input.mixedWorktree) blockingReasons.push('mixed-worktree');
  if (input.manifest.cohortId !== COHORT_ID) blockingReasons.push('cohort-mismatch');
  if (input.publication.manifestDigest !== input.manifest.manifestDigest) {
    blockingReasons.push('publication-manifest-mismatch');
  }
  if (!input.esaQualified) missingEvidence.push('esa-poc');
  if (!input.trafficQualified) missingEvidence.push('traffic-baseline');
  if (!publicationVerified(input.publication)) missingEvidence.push('publication');
  if (input.manifest.includedCount !== 7) missingEvidence.push('incomplete-cohort');
  let status: RoutingStatus = 'qualified';
  if (blockingReasons.length > 0) status = 'blocked';
  else if (missingEvidence.length > 0) status = 'incomplete';
  if (!ROUTING_STATUSES.includes(status)) status = 'blocked';
  const receipt: RoutingReceipt = {
    schemaVersion: ROUTING_SCHEMA,
    cohortId: COHORT_ID,
    toolVersion: TOOL_VERSION,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    capturedAt: input.capturedAt,
    status,
    manifestDigest: input.manifest.manifestDigest,
    esaFirst: status === 'qualified',
    blockingReasons: [...new Set(blockingReasons)].sort(),
    missingEvidence: [...new Set(missingEvidence)].sort(),
  };
  assertPortable(receipt, 'browser-delivery-routing');
  return receipt;
}

export function resolveSimulationModel(
  logicalId: SimulationModelId,
  manifest: BrowserDeliveryManifest,
  routing: RoutingReceipt,
): ResolvedSimulationModel {
  const entry = manifest.entries.find((item) => item.logicalId === logicalId);
  if (!entry) throw new Error(`unknown-simulation-model:${logicalId}`);
  const esaUrl = routing.esaFirst && entry.included && entry.outputSha256
    ? esaObjectUrl(entry.outputSha256, entry.basename)
    : null;
  const candidates = [
    ...(esaUrl ? [esaUrl] : []),
    entry.optimizedUrl,
    entry.originalUrl,
  ];
  return {
    logicalId,
    originalUrl: entry.originalUrl,
    optimizedUrl: entry.optimizedUrl,
    esaUrl,
    candidates,
    primary: candidates[0] ?? entry.originalUrl,
  };
}
