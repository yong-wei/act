import { createHash } from 'node:crypto';

export const DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_SCHEMA =
  'declared-authoritative-snapshot-receipt/v1' as const;

export const DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_PATH =
  'course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

export const DECLARED_SNAPSHOT_EXPECTED = {
  captureRevision: '23b7e9420c5c0414d9240acdc0a2e166154aa6f1',
  releaseSetId:
    'actkg-authoritative-candidate-00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6',
  releaseId: 'ctr:release:control-theory-engineering-v0.8',
  releaseHash:
    'caf4cf31b54675952cb65d635a29e07fa4a5729686b9875f78db3904a6497beb',
  sourceDatasetHash:
    'cbd8839ba61026696e853d514b9b82fbc892804c00e418f7ede885204fe38f9b',
  schemaVersion: '0.2.0',
  schemaSha256:
    '3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de',
  projectionPath:
    'course-content/authoring/knowledge/issue-1117-v08-r3-chain/releases/control-theory-engineering-v0.8/act-projection.json',
  projectionContractVersion: 'ctkg-graph-projection/0.2',
  projectionSha256:
    '5297c60bf11d2fac235b957c9b575b77be419d8df6e34074f73be08dc8664a07',
  resolutionDigest:
    'f54ad32f66d980837af216a553e6f061c2cdb6c58e029f98bc6165367852d803',
  bundleId: 'ctb:control-theory-engineering-v0.8:r3',
  bundleDigest:
    '00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6',
  lockRawHash:
    '15183b4677265ac0dd70f0d35e3050d66d38a595bd424b718c72ad8c2d8fc861',
  importReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.8',
  bundleReceiptId:
    'bundle-receipt:00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6',
  worklistInputDigest:
    'd24df1f9acc26ccbb0c2a173e711b7fcc1902d88b5830ce8939eecf8ebe37e22',
} as const;

export const DECLARED_SNAPSHOT_DELTA_RECEIPT_IDS = [
  'delta-receipt:6bdec94a7eac4c0883ef2ab03a6f36504e125bd42144bcbb0b20176112707cda',
  'delta-receipt:d414e3bf92da99afeae43558cc16299909789722b4aad7a717c45e4e95aac7c1',
  'delta-receipt:855efd7242552978520fe6a080785abce1b0b00fb2fc1366e9b6643dd60e617d',
  'delta-receipt:8d401e6f9cc068d8cbf18e8aaa18fa52e380f997fec630141c19c86291f4702c',
  'delta-receipt:e68db5f48d2ce26ba91642654fb06f35308492c997b7e2f9bae864ba7a98e4ab',
  'delta-receipt:9f7a90209b46db0b5e1fd72559034d00ba27d4eb8b82b3e6df67ce8d6d2f1aa3',
] as const;

const DECLARED_SNAPSHOT_DELTA_BINDINGS = [
  {
    candidateReleaseSetId: 'actkg-authoritative-candidate-v3-r2',
    candidateReleaseId: 'ctr:release:control-theory-engineering-v0.3',
    candidateImportReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.3',
    candidateBundleReceiptId: 'bundle-receipt:ab6c33fb06d4beefda1c23f8329619caf4e572e252ddd69ba443d2a48364acb9',
    candidateBundleId: 'ctb:control-theory-engineering-v0.3:r2',
    candidateBundleDigest: 'ab6c33fb06d4beefda1c23f8329619caf4e572e252ddd69ba443d2a48364acb9',
  },
  {
    candidateReleaseSetId: 'actkg-authoritative-candidate-1051c008525d02dcd23b851c713cc172d932f9374e7834061307abb42d3b18ee',
    candidateReleaseId: 'ctr:release:control-theory-engineering-v0.4',
    candidateImportReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.4',
    candidateBundleReceiptId: 'bundle-receipt:1051c008525d02dcd23b851c713cc172d932f9374e7834061307abb42d3b18ee',
    candidateBundleId: 'ctb:control-theory-engineering-v0.4:r3',
    candidateBundleDigest: '1051c008525d02dcd23b851c713cc172d932f9374e7834061307abb42d3b18ee',
  },
  {
    candidateReleaseSetId: 'actkg-authoritative-candidate-fd1516f178bc564c2ae63f211dd69128c2c6a99510c7a6e8bcb91df02aba3d1f',
    candidateReleaseId: 'ctr:release:control-theory-engineering-v0.5',
    candidateImportReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.5',
    candidateBundleReceiptId: 'bundle-receipt:fd1516f178bc564c2ae63f211dd69128c2c6a99510c7a6e8bcb91df02aba3d1f',
    candidateBundleId: 'ctb:control-theory-engineering-v0.5:r3',
    candidateBundleDigest: 'fd1516f178bc564c2ae63f211dd69128c2c6a99510c7a6e8bcb91df02aba3d1f',
  },
  {
    candidateReleaseSetId: 'actkg-authoritative-candidate-ba1e2b23e9c38b85c7d67fc00322ae1029082afef9658e2e46ce6334f28b19c7',
    candidateReleaseId: 'ctr:release:control-theory-engineering-v0.6',
    candidateImportReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.6',
    candidateBundleReceiptId: 'bundle-receipt:ba1e2b23e9c38b85c7d67fc00322ae1029082afef9658e2e46ce6334f28b19c7',
    candidateBundleId: 'ctb:control-theory-engineering-v0.6:r3',
    candidateBundleDigest: 'ba1e2b23e9c38b85c7d67fc00322ae1029082afef9658e2e46ce6334f28b19c7',
  },
  {
    candidateReleaseSetId: 'actkg-authoritative-candidate-b980166e0ba4cd61405b2b4c4ecd1a54e91c3d2556825b057294450d912532e5',
    candidateReleaseId: 'ctr:release:control-theory-engineering-v0.7',
    candidateImportReceiptId: 'receipt:ctr:release:control-theory-engineering-v0.7',
    candidateBundleReceiptId: 'bundle-receipt:b980166e0ba4cd61405b2b4c4ecd1a54e91c3d2556825b057294450d912532e5',
    candidateBundleId: 'ctb:control-theory-engineering-v0.7:r3',
    candidateBundleDigest: 'b980166e0ba4cd61405b2b4c4ecd1a54e91c3d2556825b057294450d912532e5',
  },
  {
    candidateReleaseSetId: DECLARED_SNAPSHOT_EXPECTED.releaseSetId,
    candidateReleaseId: DECLARED_SNAPSHOT_EXPECTED.releaseId,
    candidateImportReceiptId: DECLARED_SNAPSHOT_EXPECTED.importReceiptId,
    candidateBundleReceiptId: DECLARED_SNAPSHOT_EXPECTED.bundleReceiptId,
    candidateBundleId: DECLARED_SNAPSHOT_EXPECTED.bundleId,
    candidateBundleDigest: DECLARED_SNAPSHOT_EXPECTED.bundleDigest,
  },
] as const;

export type DeclaredSnapshotState = 'ACCEPTED_CANDIDATE';
export type BlockedState = 'BLOCKED' | 'BLOCKED_OR_LEGACY';

export interface DeclaredSnapshotDeltaReceipt {
  id: string;
  transition: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateImportReceiptId: string;
  candidateBundleReceiptId: string;
  candidateBundleId: string;
  candidateBundleDigest: string;
  bundleDigest: string;
  authorizationState: 'ACCEPTED';
  upstreamCrosscheckStatus: 'AGREED' | 'NOT_REQUIRED';
  captureRevision: string;
  identityViolations: string[];
  source: string;
}

export interface DeclaredAuthoritativeSnapshotReceipt {
  schemaVersion: typeof DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_SCHEMA;
  protocol: typeof DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_SCHEMA;
  snapshotId: string;
  state: DeclaredSnapshotState;
  authority: 'DECLARED_CANDIDATE';
  captureRevision: string;
  releaseSetId: string;
  release: {
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash: string;
  };
  bundle: {
    bundleId: string;
    bundleRevision: number;
    bundleDigest: string;
  };
  schema: {
    version: string;
    rawSha256: string;
  };
  projection: {
    path: string;
    contractVersion: string;
    sha256: string;
  };
  resolutionDigest: string;
  lock: {
    path: string;
    rawHash: string;
  };
  importReceipt: {
    id: string;
    state: DeclaredSnapshotState;
    source: string;
  };
  bundleReceipt: {
    id: string;
    bundleId: string;
    bundleRevision: number;
    bundleDigest: string;
    state: DeclaredSnapshotState;
    source: string;
  };
  deltaReceipts: DeclaredSnapshotDeltaReceipt[];
  worklist: {
    path: string;
    inputDigest: string;
    itemCount: number;
    profileOnly: number;
    deltaReceiptId: string;
    authoringRevision: string;
  };
  downstream: {
    courseCoverage: { state: 'BLOCKED'; reason: string };
    teachingProjection: { state: 'BLOCKED'; reason: string };
    roleContracts: {
      state: 'BLOCKED';
      followUpChange: string;
      blockedRoles: string[];
    };
    formalConsumers: {
      state: BlockedState;
      selectorsChanged: 0;
      graphRagSelectorsChanged: 0;
    };
    canonicalWriter: { state: 'BLOCKED'; selectorsChanged: 0 };
  };
  selectorsChanged: 0;
  violations: string[];
  receiptDigest: string;
}

type JsonRecord = Record<string, unknown>;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('receipt contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  throw new Error('receipt contains an unsupported value');
}

function withoutDigest(receipt: unknown): unknown {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return receipt;
  const copy = { ...(receipt as JsonRecord) };
  delete copy.receiptDigest;
  return copy;
}

/** Recompute the digest over every receipt field except receiptDigest itself. */
export function computeDeclaredAuthoritativeSnapshotReceiptDigest(
  receipt: unknown,
): string {
  return createHash('sha256').update(canonicalJson(withoutDigest(receipt))).digest('hex');
}

/** Alias kept explicit for callers that use the shorter receipt terminology. */
export const computeSnapshotReceiptDigest =
  computeDeclaredAuthoritativeSnapshotReceiptDigest;

function record(value: unknown, field: string, errors: string[]): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  return value as JsonRecord;
}

function text(value: unknown, field: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return null;
  }
  return value;
}

function equal(value: unknown, expected: unknown, field: string, errors: string[]): void {
  if (value !== expected) errors.push(`${field} must equal ${String(expected)}`);
}

function hash(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'string' || !SHA256.test(value)) errors.push(`${field} must be a SHA-256 hex digest`);
}

function commit(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'string' || !COMMIT.test(value)) errors.push(`${field} must be a 40-character commit`);
}

function array(value: unknown, field: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  return value;
}

function validateDeltaReceipts(value: unknown, errors: string[]): void {
  const deltas = array(value, 'deltaReceipts', errors);
  equal(deltas.length, DECLARED_SNAPSHOT_DELTA_RECEIPT_IDS.length, 'deltaReceipts.length', errors);
  const ids = new Set<string>();
  deltas.forEach((raw, index) => {
    const field = `deltaReceipts[${index}]`;
    const delta = record(raw, field, errors);
    if (!delta) return;
    const id = text(delta.id, `${field}.id`, errors);
    if (id) {
      if (ids.has(id)) errors.push(`${field}.id is duplicated`);
      ids.add(id);
      equal(id, DECLARED_SNAPSHOT_DELTA_RECEIPT_IDS[index], `${field}.id`, errors);
    }
    const binding = DECLARED_SNAPSHOT_DELTA_BINDINGS[index];
    if (binding) {
      equal(delta.candidateReleaseSetId, binding.candidateReleaseSetId, `${field}.candidateReleaseSetId`, errors);
      equal(delta.candidateReleaseId, binding.candidateReleaseId, `${field}.candidateReleaseId`, errors);
      equal(delta.candidateImportReceiptId, binding.candidateImportReceiptId, `${field}.candidateImportReceiptId`, errors);
      equal(delta.candidateBundleReceiptId, binding.candidateBundleReceiptId, `${field}.candidateBundleReceiptId`, errors);
      equal(delta.candidateBundleId, binding.candidateBundleId, `${field}.candidateBundleId`, errors);
      equal(delta.candidateBundleDigest, binding.candidateBundleDigest, `${field}.candidateBundleDigest`, errors);
    }
    equal(delta.authorizationState, 'ACCEPTED', `${field}.authorizationState`, errors);
    if (delta.upstreamCrosscheckStatus !== 'AGREED' && delta.upstreamCrosscheckStatus !== 'NOT_REQUIRED') {
      errors.push(`${field}.upstreamCrosscheckStatus is invalid`);
    }
    equal(delta.captureRevision, DECLARED_SNAPSHOT_EXPECTED.captureRevision, `${field}.captureRevision`, errors);
    hash(delta.bundleDigest, `${field}.bundleDigest`, errors);
    equal(delta.bundleDigest, delta.candidateBundleDigest, `${field}.bundleDigest`, errors);
    const violations = array(delta.identityViolations, `${field}.identityViolations`, errors);
    equal(violations.length, 0, `${field}.identityViolations.length`, errors);
    text(delta.transition, `${field}.transition`, errors);
    text(delta.source, `${field}.source`, errors);
  });
}

export interface DeclaredSnapshotValidationResult {
  valid: boolean;
  errors: string[];
  receiptDigest: string | null;
}

/**
 * Validate the immutable #1117 candidate snapshot. This is deliberately pure:
 * callers supply parsed JSON and no database, filesystem, or current-release
 * lookup is consulted.
 */
export function validateDeclaredAuthoritativeSnapshotReceipt(
  input: unknown,
): DeclaredSnapshotValidationResult {
  const errors: string[] = [];
  const receipt = record(input, 'receipt', errors);
  if (!receipt) return { valid: false, errors, receiptDigest: null };

  equal(receipt.schemaVersion, DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_SCHEMA, 'schemaVersion', errors);
  equal(receipt.protocol, DECLARED_AUTHORITATIVE_SNAPSHOT_RECEIPT_SCHEMA, 'protocol', errors);
  equal(
    receipt.snapshotId,
    'declared-authoritative-snapshot:issue-1117:control-theory-engineering-v0.8:r3',
    'snapshotId',
    errors,
  );
  equal(receipt.state, 'ACCEPTED_CANDIDATE', 'state', errors);
  equal(receipt.authority, 'DECLARED_CANDIDATE', 'authority', errors);
  equal(receipt.selectorsChanged, 0, 'selectorsChanged', errors);
  commit(receipt.captureRevision, 'captureRevision', errors);
  equal(receipt.captureRevision, DECLARED_SNAPSHOT_EXPECTED.captureRevision, 'captureRevision', errors);
  equal(receipt.releaseSetId, DECLARED_SNAPSHOT_EXPECTED.releaseSetId, 'releaseSetId', errors);

  const release = record(receipt.release, 'release', errors);
  if (release) {
    equal(release.releaseId, DECLARED_SNAPSHOT_EXPECTED.releaseId, 'release.releaseId', errors);
    equal(release.releaseHash, DECLARED_SNAPSHOT_EXPECTED.releaseHash, 'release.releaseHash', errors);
    equal(
      release.sourceDatasetHash,
      DECLARED_SNAPSHOT_EXPECTED.sourceDatasetHash,
      'release.sourceDatasetHash',
      errors,
    );
  }
  const bundle = record(receipt.bundle, 'bundle', errors);
  if (bundle) {
    equal(bundle.bundleId, DECLARED_SNAPSHOT_EXPECTED.bundleId, 'bundle.bundleId', errors);
    equal(bundle.bundleRevision, 3, 'bundle.bundleRevision', errors);
    equal(bundle.bundleDigest, DECLARED_SNAPSHOT_EXPECTED.bundleDigest, 'bundle.bundleDigest', errors);
  }
  const schema = record(receipt.schema, 'schema', errors);
  if (schema) {
    equal(schema.version, DECLARED_SNAPSHOT_EXPECTED.schemaVersion, 'schema.version', errors);
    equal(schema.rawSha256, DECLARED_SNAPSHOT_EXPECTED.schemaSha256, 'schema.rawSha256', errors);
  }
  const projection = record(receipt.projection, 'projection', errors);
  if (projection) {
    equal(projection.path, DECLARED_SNAPSHOT_EXPECTED.projectionPath, 'projection.path', errors);
    equal(
      projection.contractVersion,
      DECLARED_SNAPSHOT_EXPECTED.projectionContractVersion,
      'projection.contractVersion',
      errors,
    );
    equal(projection.sha256, DECLARED_SNAPSHOT_EXPECTED.projectionSha256, 'projection.sha256', errors);
  }
  equal(
    receipt.resolutionDigest,
    DECLARED_SNAPSHOT_EXPECTED.resolutionDigest,
    'resolutionDigest',
    errors,
  );
  const lock = record(receipt.lock, 'lock', errors);
  if (lock) {
    equal(
      lock.path,
      'course-content/authoring/knowledge/issue-1117-v08-r3-chain/release-set.lock.v3.control-theory-engineering-v0.8-r3.json',
      'lock.path',
      errors,
    );
    equal(lock.rawHash, DECLARED_SNAPSHOT_EXPECTED.lockRawHash, 'lock.rawHash', errors);
    hash(lock.rawHash, 'lock.rawHash', errors);
  }
  const importReceipt = record(receipt.importReceipt, 'importReceipt', errors);
  if (importReceipt) {
    equal(importReceipt.id, DECLARED_SNAPSHOT_EXPECTED.importReceiptId, 'importReceipt.id', errors);
    equal(importReceipt.state, 'ACCEPTED_CANDIDATE', 'importReceipt.state', errors);
    text(importReceipt.source, 'importReceipt.source', errors);
  }
  const bundleReceipt = record(receipt.bundleReceipt, 'bundleReceipt', errors);
  if (bundleReceipt) {
    equal(bundleReceipt.id, DECLARED_SNAPSHOT_EXPECTED.bundleReceiptId, 'bundleReceipt.id', errors);
    equal(bundleReceipt.bundleId, DECLARED_SNAPSHOT_EXPECTED.bundleId, 'bundleReceipt.bundleId', errors);
    equal(bundleReceipt.bundleRevision, 3, 'bundleReceipt.bundleRevision', errors);
    equal(bundleReceipt.bundleDigest, DECLARED_SNAPSHOT_EXPECTED.bundleDigest, 'bundleReceipt.bundleDigest', errors);
    equal(bundleReceipt.state, 'ACCEPTED_CANDIDATE', 'bundleReceipt.state', errors);
    text(bundleReceipt.source, 'bundleReceipt.source', errors);
  }

  validateDeltaReceipts(receipt.deltaReceipts, errors);

  const worklist = record(receipt.worklist, 'worklist', errors);
  if (worklist) {
    equal(worklist.inputDigest, DECLARED_SNAPSHOT_EXPECTED.worklistInputDigest, 'worklist.inputDigest', errors);
    equal(worklist.itemCount, 3609, 'worklist.itemCount', errors);
    equal(worklist.profileOnly, 1772, 'worklist.profileOnly', errors);
    equal(worklist.deltaReceiptId, DECLARED_SNAPSHOT_DELTA_RECEIPT_IDS[5], 'worklist.deltaReceiptId', errors);
    equal(worklist.authoringRevision, DECLARED_SNAPSHOT_EXPECTED.captureRevision, 'worklist.authoringRevision', errors);
    equal(
      worklist.path,
      'course-content/authoring/knowledge/issue-1117-v08-r3-chain/coverage-iteration-2/course-coverage-worklist.json',
      'worklist.path',
      errors,
    );
  }

  const downstream = record(receipt.downstream, 'downstream', errors);
  if (downstream) {
    for (const field of ['courseCoverage', 'teachingProjection', 'roleContracts'] as const) {
      const item = record(downstream[field], `downstream.${field}`, errors);
      if (item) equal(item.state, 'BLOCKED', `downstream.${field}.state`, errors);
    }
    const roles = record(downstream.roleContracts, 'downstream.roleContracts', errors);
    if (roles) {
      equal(roles.followUpChange, 'complete-course-teaching-projection-and-final-knowledge-cutover', 'downstream.roleContracts.followUpChange', errors);
      const blockedRoles = array(roles.blockedRoles, 'downstream.roleContracts.blockedRoles', errors);
      equal(blockedRoles.length, 2, 'downstream.roleContracts.blockedRoles.length', errors);
    }
    const consumers = record(downstream.formalConsumers, 'downstream.formalConsumers', errors);
    if (consumers) {
      if (consumers.state !== 'BLOCKED' && consumers.state !== 'BLOCKED_OR_LEGACY') {
        errors.push('downstream.formalConsumers.state must remain blocked or Legacy');
      }
      equal(consumers.selectorsChanged, 0, 'downstream.formalConsumers.selectorsChanged', errors);
      equal(consumers.graphRagSelectorsChanged, 0, 'downstream.formalConsumers.graphRagSelectorsChanged', errors);
    }
    const writer = record(downstream.canonicalWriter, 'downstream.canonicalWriter', errors);
    if (writer) {
      equal(writer.state, 'BLOCKED', 'downstream.canonicalWriter.state', errors);
      equal(writer.selectorsChanged, 0, 'downstream.canonicalWriter.selectorsChanged', errors);
    }
  }

  const violations = array(receipt.violations, 'violations', errors);
  equal(violations.length, 0, 'violations.length', errors);

  let receiptDigest: string | null = null;
  try {
    receiptDigest = computeDeclaredAuthoritativeSnapshotReceiptDigest(receipt);
    equal(receipt.receiptDigest, receiptDigest, 'receiptDigest', errors);
    hash(receipt.receiptDigest, 'receiptDigest', errors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'receiptDigest cannot be computed');
  }

  return { valid: errors.length === 0, errors, receiptDigest };
}

export function assertDeclaredAuthoritativeSnapshotReceipt(
  input: unknown,
): asserts input is DeclaredAuthoritativeSnapshotReceipt {
  const result = validateDeclaredAuthoritativeSnapshotReceipt(input);
  if (!result.valid) {
    throw new Error(`Declared authoritative snapshot rejected: ${result.errors.join('; ')}`);
  }
}
