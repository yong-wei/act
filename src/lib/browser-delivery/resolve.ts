import { esaObjectUrl } from './keys';
import { publicationVerified } from './publish';
import { assertPortable } from './privacy';
import {
  COHORT_ID,
  DELIVERY_BUCKET,
  GIT_SHA,
  ROUTING_SCHEMA,
  ROUTING_STATUSES,
  SHA256,
  STATIC_HOSTNAME,
  TOOL_VERSION,
  type BrowserDeliveryManifest,
  type PublicationReceipt,
  type ResolvedSimulationModel,
  type RoutingReceipt,
  type RoutingStatus,
  type SimulationModelId,
} from './types';

const ESA_QUALIFICATION_SCHEMA = 'act-esa-delivery-qualification/v1';
const TRAFFIC_OBSERVATION_SCHEMA = 'act-runtime-traffic-observation/v1';

export interface RoutingInput {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly capturedAt: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly manifest: BrowserDeliveryManifest;
  readonly publication: PublicationReceipt;
  readonly esaReceipt?: unknown;
  readonly trafficReceipt?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasCleanGitIdentity(raw: Record<string, unknown>): boolean {
  return GIT_SHA.test(String(raw.sourceCommit ?? ''))
    && GIT_SHA.test(String(raw.sourceTree ?? ''))
    && raw.dirty === false
    && raw.mixedWorktree === false;
}

function esaReceiptQualified(raw: unknown): 'missing' | 'invalid' | 'qualified' {
  if (raw === undefined) return 'missing';
  if (!isRecord(raw)) return 'invalid';
  if (raw.schemaVersion !== ESA_QUALIFICATION_SCHEMA) return 'invalid';
  if (raw.hostname !== STATIC_HOSTNAME || raw.deliveryBucket !== DELIVERY_BUCKET) return 'invalid';
  if (typeof raw.evidenceFingerprint !== 'string' || !SHA256.test(raw.evidenceFingerprint)) return 'invalid';
  if (typeof raw.qualificationId !== 'string' || !SHA256.test(raw.qualificationId)) return 'invalid';
  if (!hasCleanGitIdentity(raw)) return 'invalid';
  if (raw.dnsApplied !== true) return 'missing';
  return raw.status === 'qualified' ? 'qualified' : 'missing';
}

function trafficReceiptQualified(raw: unknown): 'missing' | 'invalid' | 'qualified' {
  if (raw === undefined) return 'missing';
  if (!isRecord(raw)) return 'invalid';
  if (raw.schemaVersion !== TRAFFIC_OBSERVATION_SCHEMA) return 'invalid';
  if (typeof raw.observationId !== 'string' || !SHA256.test(raw.observationId)) return 'invalid';
  if (!hasCleanGitIdentity(raw)) return 'invalid';
  return raw.status === 'qualified' ? 'qualified' : 'missing';
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
  const esa = esaReceiptQualified(input.esaReceipt);
  if (esa === 'invalid') blockingReasons.push('esa-receipt-invalid');
  else if (esa !== 'qualified') missingEvidence.push('esa-poc');
  const traffic = trafficReceiptQualified(input.trafficReceipt);
  if (traffic === 'invalid') blockingReasons.push('traffic-receipt-invalid');
  else if (traffic !== 'qualified') missingEvidence.push('traffic-baseline');
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
