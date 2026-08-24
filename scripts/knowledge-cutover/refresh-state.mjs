#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/u;
const OCI_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const CONSUMERS = [
  'engineering-graph',
  'engineering-rag',
  'course-runtime',
  'konling',
  'teaching-resource-rag',
  'learning-path',
];

function fail(message) {
  throw new Error(`cutover refresh control plane: ${message}`);
}

function requireRegular(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(`${label} missing`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`);
  return filePath;
}

function readJson(filePath, label) {
  requireRegular(filePath, label);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

function assertString(value, label, pattern = TOKEN) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(`${label} is invalid`);
  return value;
}

function assertHash(value, label) {
  return assertString(value, label, SHA256);
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function protectedDigest(files) {
  const body = Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}=${digest}\n`)
    .join('');
  return createHash('sha256').update(body).digest('hex');
}

function assertContract(value, expected, label) {
  if (value?.contract !== expected) fail(`${label} contract mismatch`);
}

function validate(root) {
  const authorityRoot = path.join(root, 'course-content/authoring/knowledge/authority');
  const knowledgeRoot = path.join(root, 'course-content/runtime/knowledge');
  const projectionRoot = path.join(knowledgeRoot, 'projection');
  const prerequisiteRoot = path.join(knowledgeRoot, 'prerequisites');
  const consumerRoot = path.join(knowledgeRoot, 'consumer-activation');
  const transactionRoot = path.join(knowledgeRoot, 'production-cutover-transactions');

  const markerPath = path.join(transactionRoot, 'current.json');
  const marker = readJson(markerPath, 'production marker');
  assertContract(marker, 'act-production-knowledge-cutover-current/v1', 'production marker');
  if (marker.status !== 'COMMITTED') fail('production marker is not committed');
  const transactionId = assertString(marker.transactionId, 'transaction id');
  const planHash = assertHash(marker.planHash, 'production plan hash');
  const markerImageRevision = assertString(
    marker.applicationSourceRevision ?? marker.imageRevision,
    'marker application source revision',
    COMMIT,
  );
  const markerImageConfigDigest = assertString(marker.imageConfigDigest, 'marker image config digest', OCI_DIGEST);
  const markerImageTarSha256 = assertHash(marker.imageTarSha256, 'marker image tar hash');
  const markerImageProvenanceSha256 = marker.imageProvenanceSha256 === undefined
    ? null
    : assertHash(marker.imageProvenanceSha256, 'marker image provenance hash');
  const markerOperatorSourceRevision = marker.operatorSourceRevision === undefined
    ? null
    : assertString(marker.operatorSourceRevision, 'marker operator source revision', COMMIT);
  const markerOperatorSourceTree = marker.operatorSourceTree === undefined
    ? null
    : assertString(marker.operatorSourceTree, 'marker operator source tree', COMMIT);
  const markerCaptureRevision = assertString(marker.captureRevision, 'marker capture revision', COMMIT);

  const receiptPath = path.join(transactionRoot, `${transactionId}.json`);
  const firstReceipt = readJson(receiptPath, 'first activation receipt');
  assertContract(firstReceipt, 'act-production-knowledge-cutover-receipt/v1', 'first activation receipt');
  if (
    firstReceipt.status !== 'COMMITTED'
    || firstReceipt.transactionId !== transactionId
    || firstReceipt.planHash !== planHash
    || (firstReceipt.applicationSourceRevision ?? firstReceipt.imageRevision) !== markerImageRevision
    || firstReceipt.imageConfigDigest !== markerImageConfigDigest
    || firstReceipt.imageTarSha256 !== markerImageTarSha256
    || (markerImageProvenanceSha256 !== null && firstReceipt.imageProvenanceSha256 !== markerImageProvenanceSha256)
    || (markerOperatorSourceRevision !== null && firstReceipt.operatorSourceRevision !== markerOperatorSourceRevision)
    || (markerOperatorSourceTree !== null && firstReceipt.operatorSourceTree !== markerOperatorSourceTree)
    || firstReceipt.captureRevision !== markerCaptureRevision
  ) {
    fail('first activation receipt does not match the committed marker');
  }

  const journalPath = path.join(
    consumerRoot,
    'first-activation-transactions',
    `${transactionId}.json`,
  );
  const journal = readJson(journalPath, 'first activation journal');
  assertContract(journal, 'actkg-to-act-first-activation-journal/v2', 'first activation journal');
  if (journal.status !== 'COMMITTED' || journal.transactionId !== transactionId) {
    fail('first activation journal is not committed for the marker transaction');
  }

  const selectorPaths = {
    authority: path.join(authorityRoot, 'current.json'),
    projection: path.join(projectionRoot, 'current.json'),
    prerequisite: path.join(prerequisiteRoot, 'current.json'),
    consumer: path.join(consumerRoot, 'current.json'),
  };
  const authority = readJson(selectorPaths.authority, 'Authority selector');
  const projection = readJson(selectorPaths.projection, 'Projection selector');
  const prerequisite = readJson(selectorPaths.prerequisite, 'prerequisite selector');
  const consumer = readJson(selectorPaths.consumer, 'consumer selector');
  assertContract(authority, 'actkg-engineering-authority-current/v1', 'Authority selector');
  assertContract(projection, 'act-teaching-projection-current/v1', 'Projection selector');
  assertContract(prerequisite, 'act-teaching-prerequisite-current/v1', 'prerequisite selector');
  assertContract(consumer, 'act-versioned-knowledge-consumer-activation-current/v1', 'consumer selector');

  const authoritySnapshotId = assertString(authority.snapshotId, 'Authority snapshot id');
  const authoritySnapshotHash = assertHash(authority.snapshotHash, 'Authority snapshot hash');
  const authorityReleaseId = assertString(authority.releaseId, 'Authority release id');
  const authorityReleaseSetId = assertString(authority.releaseSetId, 'Authority release set id');
  const projectionId = assertString(projection.projectionId, 'Projection id');
  const projectionHash = assertHash(projection.projectionHash, 'Projection hash');
  const prerequisiteId = assertString(prerequisite.publicationId, 'prerequisite id');
  const prerequisiteHash = assertHash(prerequisite.publicationHash, 'prerequisite hash');
  const activationId = assertString(consumer.activationId, 'consumer activation id');
  const activationHash = assertHash(consumer.activationHash, 'consumer activation hash');

  if (projection.authorityReleaseId !== authorityReleaseId) fail('Projection authority release drift');
  if (prerequisite.authorityReleaseId !== authorityReleaseId) fail('prerequisite authority release drift');

  const authorityManifestPath = path.join(authorityRoot, 'releases', authoritySnapshotId, 'manifest.json');
  const projectionManifestPath = path.join(projectionRoot, 'releases', projectionId, 'projection-manifest.json');
  const prerequisiteManifestPath = path.join(prerequisiteRoot, 'releases', prerequisiteId, 'publication-manifest.json');
  const activationPath = path.join(consumerRoot, 'releases', activationId, 'activation.json');
  const authorityManifest = readJson(authorityManifestPath, 'Authority release manifest');
  const projectionManifest = readJson(projectionManifestPath, 'Projection release manifest');
  const prerequisiteManifest = readJson(prerequisiteManifestPath, 'prerequisite release manifest');
  const activation = readJson(activationPath, 'consumer activation release');
  assertContract(authorityManifest, 'actkg-engineering-authority-snapshot/v1', 'Authority release manifest');
  assertContract(projectionManifest, 'act-teaching-projection-manifest/v1', 'Projection release manifest');
  assertContract(prerequisiteManifest, 'act-teaching-prerequisite-publication/v1', 'prerequisite release manifest');
  assertContract(activation, 'act-versioned-knowledge-consumer-activation/v1', 'consumer activation release');
  if (
    authorityManifest.snapshotId !== authoritySnapshotId
    || authorityManifest.snapshotHash !== authoritySnapshotHash
    || authorityManifest.releaseId !== authorityReleaseId
    || authorityManifest.releaseSetId !== authorityReleaseSetId
  ) fail('Authority selector does not match its release manifest');
  if (
    projectionManifest.projectionId !== projectionId
    || projectionManifest.projectionHash !== projectionHash
    || projectionManifest.authorityReleaseId !== authorityReleaseId
    || projectionManifest.authoritySnapshotId !== authoritySnapshotId
    || projectionManifest.authoritySnapshotHash !== authoritySnapshotHash
  ) fail('Projection selector does not match its release manifest');
  if (
    prerequisiteManifest.publicationId !== prerequisiteId
    || prerequisiteManifest.publicationHash !== prerequisiteHash
    || prerequisiteManifest.authorityReleaseId !== authorityReleaseId
    || prerequisiteManifest.projectionCaptureId !== authoritySnapshotId
  ) fail('prerequisite selector does not match its release manifest');
  if (activation.activationId !== activationId || activation.activationHash !== activationHash) {
    fail('consumer selector does not match its release activation');
  }

  if (!Array.isArray(activation.consumers) || activation.consumers.length !== CONSUMERS.length) {
    fail('consumer activation must contain six consumers');
  }
  const readyIds = activation.consumers.map((entry) => {
    if (entry?.status !== 'READY') fail('consumer activation contains a non-READY consumer');
    const consumerId = assertString(entry.consumerId, 'consumer id');
    const combination = entry.combination;
    if (
      combination?.authoritySnapshotId !== authoritySnapshotId
      || combination?.authoritySnapshotHash !== authoritySnapshotHash
      || combination?.authorityReleaseId !== authorityReleaseId
    ) fail(`consumer ${consumerId} Authority identity drift`);
    if (consumerId === 'engineering-graph' || consumerId === 'engineering-rag') {
      if (combination.projectionId !== null || combination.projectionHash !== null) {
        fail(`consumer ${consumerId} must not require a projection`);
      }
    } else if (
      combination.projectionId !== projectionId
      || combination.projectionHash !== projectionHash
    ) {
      fail(`consumer ${consumerId} Projection identity drift`);
    }
    return consumerId;
  }).sort();
  if (JSON.stringify(readyIds) !== JSON.stringify([...CONSUMERS].sort())) {
    fail('consumer activation READY set is not the required six-consumer set');
  }

  const protectedFiles = {
    marker: sha256(markerPath),
    firstReceipt: sha256(receiptPath),
    journal: sha256(journalPath),
    authoritySelector: sha256(selectorPaths.authority),
    projectionSelector: sha256(selectorPaths.projection),
    prerequisiteSelector: sha256(selectorPaths.prerequisite),
    consumerSelector: sha256(selectorPaths.consumer),
  };

  const result = {
    transactionId,
    planHash,
    applicationSourceRevision: markerImageRevision,
    imageRevision: markerImageRevision,
    markerImageConfigDigest,
    markerImageRevision,
    markerImageProvenanceSha256,
    markerOperatorSourceRevision,
    markerOperatorSourceTree,
    protected: protectedFiles,
    protectedDigest: protectedDigest(protectedFiles),
    identities: {
      authority: {
        snapshotId: authoritySnapshotId,
        snapshotHash: authoritySnapshotHash,
        releaseId: authorityReleaseId,
        releaseSetId: authorityReleaseSetId,
      },
      projection: { projectionId, projectionHash },
      prerequisite: { publicationId: prerequisiteId, publicationHash: prerequisiteHash },
      consumer: { activationId, activationHash },
    },
    readyConsumerIds: readyIds,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  const [command, root] = process.argv.slice(2);
  if (command !== 'validate' || !root) fail('usage: refresh-state.mjs validate <project-root>');
  validate(path.resolve(root));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
