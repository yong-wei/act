import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildRuntimeBlobReleaseManifest,
  buildRuntimeBlobReleaseReceipt,
  buildRuntimeReleaseManifest,
  deriveRuntimeReleaseId,
  parseRuntimeBlobReleaseManifest,
  parseRuntimeBlobReleaseReceipt,
  serializeRuntimeBlobReleaseManifest,
  serializeRuntimeBlobReleaseReceipt,
  serializeRuntimeReleaseManifest,
  runtimeBlobReleaseManifestWireSha256,
} from '@/lib/runtime-release';
import { inspectPublishedRuntimeBlobRelease, inspectPublishedRuntimeRelease } from '@/lib/runtime-release-store';
import {
  createSshRuntimeReleaseObjectStore,
  importV1RuntimeBlobReleaseViaSsh,
  publishRuntimeBlobReleaseLocallyWithMetrics,
  publishRuntimeReleaseViaSsh,
  verifyPublishedRuntimeBlobReleaseViaSsh,
  verifyPublishedRuntimeReleaseViaSsh,
} from '@/lib/runtime-release-streaming-publisher';
import { buildGitRuntimeBlobReleaseSnapshot, openGitRuntimeBlobReleaseSnapshot } from '@/lib/runtime-release-git-snapshot';
import { buildRuntimeReleaseMediaClosure, serializeRuntimeReleaseMediaClosure } from '@/lib/runtime-release-media-closure';
import { stableStringify } from '@/lib/aggregate-governance/hash';
import {
  parseExternalInputBundleWire,
  prepareTextbookExternalInputBundle,
} from '@/lib/runtime-external-input-bundle';
import {
  assertRuntimeReleaseSourceProvenanceProofMatchesManifest,
  buildRuntimeReleaseSourceProvenanceProof,
  parseRuntimeReleaseSourceProvenanceProof,
  serializeRuntimeReleaseSourceProvenanceProof,
} from '@/lib/runtime-release-source-proof';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function usage() {
  return [
    'Usage:',
    '  act-runtime-release prepare-external-bundle --repo-root <git-repo> --runtime-root <course-content/runtime> --generated-resources-root <resources> --source-revision <40-sha> --output <bundle.json>',
    '  act-runtime-release plan --runtime-root <path> --source-revision <40-sha> [--format v1] | plan --repo-root <git-repo> --source-revision <git-revision> --format v2 [--parent-manifest <manifest.json>] [--external-bundle <bundle.json>] [--external-bundle-root <course-content/runtime>] [--generated-resources-root <resources>]',
    '  act-runtime-release build-manifest --repo-root <git-repo> --source-revision <git-revision> --format v2 [--parent-manifest <manifest.json>] [--external-bundle <bundle.json>] [--external-bundle-root <course-content/runtime>] [--generated-resources-root <resources>] --output <manifest.json> [--receipt-output <receipt.json>] [--source-provenance-proof-output <proof.json>] [--daily-report-output <report.json>]',
    '  act-runtime-release verify-media-closure --runtime-root <path> --source-revision <40-sha> --release-id <content-addressed-id> [--format v1|v2] [--output <closure.json>]',
    '  act-runtime-release publish-streaming --repo-root <git-repo> --source-revision <git-revision> --release-id <content-addressed-id> --format v2 --manifest <manifest.json> --receipt <receipt.json> --source-provenance-proof <proof.json> --external-bundle <bundle.json> --bucket <bucket> --local-bridge-path </absolute/bridge.py> --python-binary </absolute/python3> --ossutil-path </absolute/ossutil> --ossutil-sha256 <sha256> --identity-command-path </absolute/aliyun> --identity-command-sha256 <sha256> --operator-account-id <account-id> --operator-principal-arn <acs-ram-arn> --lock-dir </absolute/dir> --spool-dir </absolute/dir> [--external-bundle-root <course-content/runtime>] [--generated-resources-root <resources>] [--parent-manifest <manifest.json>] [--credential-profile <profile>] [--daily-report-output <report.json>] [--output <receipt.json>]',
    '  act-runtime-release import-v1 --source-release-id <immutable-v1-release-id> --source-manifest-sha256 <sha256> --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
    '  act-runtime-release verify --release-id <id> --format v1|v2 --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
    '  act-runtime-release inspect --release-id <id> --format v1|v2 --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <manifest.json>]',
    '',
    'Daily v2 publishing uses a local operator credential provider; verification remains on the ECS read bridge. No AccessKey or Secret arguments are accepted.',
  ].join('\n');
}

async function writeOutput(output: string | undefined, value: unknown) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (!output) {
    process.stdout.write(serialized);
    return;
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serialized, 'utf8');
  process.stdout.write(`${JSON.stringify({ output })}\n`);
}

async function writeJsonFile(output: string, value: unknown) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCanonicalManifest(output: string, serialized: string) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serialized, 'utf8');
  process.stdout.write(`${JSON.stringify({ output })}\n`);
}

async function writeCanonicalSourceProof(output: string, proof: ReturnType<typeof buildRuntimeReleaseSourceProvenanceProof>) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serializeRuntimeReleaseSourceProvenanceProof(proof), 'utf8');
  process.stdout.write(`${JSON.stringify({ output })}\n`);
}

async function readCanonicalReceipt(output: string) {
  const wire = await readFile(output, 'utf8');
  const receipt = parseRuntimeBlobReleaseReceipt(JSON.parse(wire));
  if (wire !== serializeRuntimeBlobReleaseReceipt(receipt)) {
    throw new Error('Submitted v2 planning receipt is not canonical.');
  }
  return receipt;
}

async function readCanonicalSourceProof(output: string) {
  const wire = await readFile(output, 'utf8');
  const proof = parseRuntimeReleaseSourceProvenanceProof(JSON.parse(wire));
  if (wire !== serializeRuntimeReleaseSourceProvenanceProof(proof)) {
    throw new Error('Submitted v2 source-provenance proof is not canonical.');
  }
  return proof;
}

function sourceProofForSnapshot(snapshot: Awaited<ReturnType<typeof buildGitRuntimeBlobReleaseSnapshot>>) {
  return buildRuntimeReleaseSourceProvenanceProof({
    sourceRevision: snapshot.sourceRevision,
    integrationRef: snapshot.integrationRef,
    integrationRevision: snapshot.integrationRevision,
    manifest: snapshot.manifest,
    manifestWireSha256: runtimeBlobReleaseManifestWireSha256(snapshot.manifest),
    parentManifest: snapshot.parentManifest,
    gitTree: snapshot.gitTree.map(({ path: relativePath, mode, blobObjectId }) => ({ path: relativePath, mode, gitObjectId: blobObjectId })),
  });
}

function validateSourceProofSnapshot(
  proof: ReturnType<typeof parseRuntimeReleaseSourceProvenanceProof>,
  snapshot: Awaited<ReturnType<typeof buildGitRuntimeBlobReleaseSnapshot>>,
) {
  assertRuntimeReleaseSourceProvenanceProofMatchesManifest(proof, snapshot.manifest, runtimeBlobReleaseManifestWireSha256(snapshot.manifest));
  if (
    proof.integrationRef !== snapshot.integrationRef
    || proof.integrationRevision !== snapshot.integrationRevision
    || proof.sourceRevision !== snapshot.sourceRevision
    || stableStringify(proof.gitTree) !== stableStringify(snapshot.gitTree.map(({ path: relativePath, mode, blobObjectId }) => ({ path: relativePath, mode, gitObjectId: blobObjectId })))
  ) {
    throw new Error('Submitted v2 source-provenance proof does not match the source-authoritative Git tree identity.');
  }
  const externalFiles = snapshot.manifest.files
    .filter((file) => file.source && !('gitObjectId' in file.source))
    .map((file) => ({ path: file.path, sizeBytes: file.sizeBytes, sha256: file.sha256, source: file.source! }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (stableStringify(proof.externalFiles) !== stableStringify(externalFiles)) {
    throw new Error('Submitted v2 source-provenance proof does not match the external source identities.');
  }
  const expectedParent = snapshot.parentManifest
    ? { releaseId: snapshot.parentManifest.releaseId, manifestSha256: snapshot.parentManifest.manifestSha256, treeSha256: snapshot.parentManifest.treeSha256 }
    : null;
  if (stableStringify(proof.parent) !== stableStringify(expectedParent)) {
    throw new Error('Submitted v2 source-provenance proof does not match the parent manifest identity.');
  }
}

function reportIdentity(manifest: ReturnType<typeof parseRuntimeBlobReleaseManifest>) {
  return {
    releaseId: manifest.releaseId,
    sourceRevision: manifest.sourceRevision,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
  };
}

function emptyPublicationMetrics() {
  const verifiedBlobEntries: Array<{
    key: string;
    expectedSize: number;
    verifiedSha256: string;
    etag: string;
  }> = [];
  return {
    putCount: 0,
    inheritedBlobCount: 0,
    metadataCheckCount: 0,
    uploadedBlobBytes: 0,
    metadataReuseCount: 0,
    newUploadCount: 0,
    legacyReadbackCount: 0,
    legacyReadbackBytes: 0,
    verifiedBlobSetAlgorithm: 'sha256' as const,
    verifiedBlobSetSha256: createHash('sha256').update(stableStringify(verifiedBlobEntries)).digest('hex'),
    verifiedBlobEntries,
  };
}

function dailyPublicationPlan(snapshot: Awaited<ReturnType<typeof buildGitRuntimeBlobReleaseSnapshot>>) {
  const proof = sourceProofForSnapshot(snapshot);
  return {
    schemaVersion: 'runtime-blob-daily-publication-report.v1',
    phase: 'planned',
    release: reportIdentity(snapshot.manifest),
    sourceProvenanceProofSha256: proof.proofSha256,
    parent: snapshot.parentManifest ? reportIdentity(snapshot.parentManifest) : null,
    deltaProof: {
      inheritedLogicalFileCount: snapshot.stats.reusedFileCount,
      inheritedLogicalBytes: snapshot.stats.reusedBytes,
      bodyHashedUniqueGitBlobCount: snapshot.stats.hashedFileCount,
      bodyHashedBytes: snapshot.stats.hashedBytes,
    },
    capacityProjection: {
      logicalReleaseBytes: snapshot.manifest.totalBytes,
      estimatedNewBlobBytes: snapshot.stats.hashedBytes,
    },
    transfer: emptyPublicationMetrics(),
  };
}

async function readDailyPublicationPlan(output: string, manifest: ReturnType<typeof parseRuntimeBlobReleaseManifest>, proofSha256?: string) {
  const value: unknown = JSON.parse(await readFile(output, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Daily publication report is invalid.');
  }
  const report = value as { schemaVersion?: unknown; phase?: unknown; release?: Record<string, unknown>; sourceProvenanceProofSha256?: unknown };
  if (
    report.schemaVersion !== 'runtime-blob-daily-publication-report.v1'
    || report.phase !== 'planned'
    || report.release?.releaseId !== manifest.releaseId
    || report.release?.manifestSha256 !== manifest.manifestSha256
    || report.release?.treeSha256 !== manifest.treeSha256
    || report.sourceProvenanceProofSha256 !== proofSha256
  ) {
    throw new Error('Daily publication report does not bind the planned immutable manifest.');
  }
  return value as Record<string, unknown>;
}

function sshBridgeOptions() {
  return {
    target: required('--ssh-target'),
    bucket: required('--bucket'),
    remoteBridgePath: required('--remote-bridge-path'),
    knownHostsFile: required('--known-hosts-file'),
    identityFile: argument('--identity-file'),
    port: argument('--port') ? Number(required('--port')) : undefined,
  };
}

function localPublisherOptions() {
  return {
    bucket: required('--bucket'),
    bridgePath: required('--local-bridge-path'),
    pythonBinary: required('--python-binary'),
    ossutilPath: required('--ossutil-path'),
    ossutilSha256: required('--ossutil-sha256'),
    identityCommandPath: required('--identity-command-path'),
    identityCommandSha256: required('--identity-command-sha256'),
    operatorAccountId: required('--operator-account-id'),
    operatorPrincipalArn: required('--operator-principal-arn'),
    lockDir: required('--lock-dir'),
    spoolDir: required('--spool-dir'),
    credentialProfile: argument('--credential-profile'),
  };
}

function releaseFormat() {
  const value = argument('--format') ?? 'v1';
  if (value !== 'v1' && value !== 'v2') throw new Error('--format must be v1 or v2.');
  return value;
}

async function buildManifestForFormat(runtimeRoot: string, sourceRevision: string, releaseId: string, format: 'v1' | 'v2') {
  return format === 'v1'
    ? await buildRuntimeReleaseManifest(runtimeRoot, { releaseId, sourceRevision })
    : await buildRuntimeBlobReleaseManifest(runtimeRoot, { sourceRevision });
}

async function readParentBlobManifest() {
  const parentManifestPath = argument('--parent-manifest');
  if (!parentManifestPath) return undefined;
  return parseRuntimeBlobReleaseManifest(JSON.parse(await readFile(parentManifestPath, 'utf8')));
}

async function readExternalBundle() {
  const bundlePath = argument('--external-bundle');
  if (!bundlePath) return undefined;
  const bundle = parseExternalInputBundleWire(await readFile(bundlePath));
  const root = argument('--external-bundle-root') ?? argument('--runtime-root');
  const generatedRoot = argument('--generated-resources-root');
  return {
    ...bundle,
    ...(root ? { root: path.resolve(root) } : {}),
    ...(generatedRoot ? { generatedRoot: path.resolve(generatedRoot) } : {}),
  };
}

async function buildGitManifest(sourceRevision: string) {
  if (process.argv.includes('--integration-ref')) {
    throw new Error('Production v2 CLI fixes the ancestry authority to origin/integration; --integration-ref is not supported.');
  }
  return buildGitRuntimeBlobReleaseSnapshot({
    repoRoot: required('--repo-root'),
    sourceRevision,
    integrationRef: 'origin/integration',
    parentManifest: await readParentBlobManifest(),
    externalBundle: await readExternalBundle(),
  });
}

async function openPlannedGitManifest(sourceRevision: string) {
  if (process.argv.includes('--integration-ref')) {
    throw new Error('Production v2 CLI fixes the ancestry authority to origin/integration; --integration-ref is not supported.');
  }
  const manifestPath = required('--manifest');
  const manifestWire = await readFile(manifestPath, 'utf8');
  const manifest = parseRuntimeBlobReleaseManifest(JSON.parse(manifestWire));
  if (manifestWire !== serializeRuntimeBlobReleaseManifest(manifest)) {
    throw new Error('Submitted v2 runtime manifest is not canonical.');
  }
  const receiptPath = argument('--receipt') ?? argument('--planning-receipt');
  const proofPath = argument('--source-provenance-proof') ?? argument('--proof');
  if (!receiptPath || !proofPath) {
    throw new Error('v2 publish requires an immutable planning receipt and source-provenance proof; re-run planning.');
  }
  const receipt = await readCanonicalReceipt(receiptPath);
  const proof = await readCanonicalSourceProof(proofPath);
  if (!receipt.sourceProvenanceProofSha256 || receipt.sourceProvenanceProofSha256 !== proof.proofSha256) {
    throw new Error('Submitted v2 planning receipt is not bound to the source-provenance proof.');
  }
  const parentManifest = await readParentBlobManifest();
  // Reopen the source-authoritative Git and external-input snapshot from
  // immutable tree metadata; publish must not perform a second Git body hash.
  const snapshot = await openGitRuntimeBlobReleaseSnapshot({
    repoRoot: required('--repo-root'),
    sourceRevision,
    integrationRef: 'origin/integration',
    parentManifest,
    manifest,
    externalBundle: await readExternalBundle(),
  });
  validateSourceProofSnapshot(proof, snapshot);
  const expectedReceipt = buildRuntimeBlobReleaseReceipt(manifest, {
    sourceProvenanceProofSha256: proof.proofSha256,
  });
  if (serializeRuntimeBlobReleaseReceipt(receipt) !== serializeRuntimeBlobReleaseReceipt(expectedReceipt)) {
    throw new Error('Submitted v2 planning receipt identity does not match the canonical manifest.');
  }
  return { snapshot, receipt, proof };
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === 'prepare-external-bundle' || command === 'prepare-textbook-bundle') {
    const bundle = await prepareTextbookExternalInputBundle({
      repoRoot: required('--repo-root'),
      runtimeRoot: required('--runtime-root'),
      generatedResourcesRoot: required('--generated-resources-root'),
      sourceRevision: required('--source-revision'),
      output: required('--output'),
      externalInputId: argument('--external-input-id'),
    });
    await writeOutput(undefined, {
      externalInputId: bundle.externalInputId,
      sourceRevision: bundle.sourceRevision,
      baseSourceRevision: bundle.baseSourceRevision,
      fileCount: bundle.fileCount,
      totalBytes: bundle.totalBytes,
      manifestSha256: bundle.manifestSha256,
      wireSha256: bundle.wireSha256,
      output: argument('--output'),
    });
    return;
  }
  if (!['plan', 'build-manifest', 'verify-media-closure', 'publish-streaming', 'import-v1', 'verify', 'inspect'].includes(command)) throw new Error(usage());
  if (command === 'plan') {
    const format = releaseFormat();
    const snapshot = format === 'v2'
      ? await buildGitManifest(required('--source-revision'))
      : undefined;
    const manifest = snapshot?.manifest ?? await buildRuntimeReleaseManifest(required('--runtime-root'), {
        releaseId: 'runtime-plan',
        sourceRevision: required('--source-revision'),
      });
    const planOutput = argument('--output');
    const proofOutput = argument('--source-provenance-proof-output') ?? argument('--proof-output');
    const proof = snapshot ? sourceProofForSnapshot(snapshot) : undefined;
    if (proof && proofOutput) await writeCanonicalSourceProof(proofOutput, proof);
    await writeOutput(planOutput, {
      releaseId: deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256),
      sourceRevision: manifest.sourceRevision,
      treeSha256: manifest.treeSha256,
      ...(proof ? { sourceProvenanceProofSha256: proof.proofSha256 } : {}),
      ...(snapshot ? { parentReuse: snapshot.stats } : {}),
    });
    return;
  }
  if (command === 'build-manifest') {
    const format = releaseFormat();
    if (format !== 'v2') throw new Error('build-manifest is reserved for the v2 candidate materialization contract.');
    const snapshot = await buildGitManifest(required('--source-revision'));
    const proofOutput = argument('--source-provenance-proof-output') ?? argument('--proof-output');
    const proof = proofOutput ? sourceProofForSnapshot(snapshot) : undefined;
    const receiptOutput = argument('--receipt-output');
    if (receiptOutput && !proofOutput) {
      throw new Error('v2 planning receipt requires --source-provenance-proof-output so it can bind an immutable source-provenance proof.');
    }
    await writeCanonicalManifest(required('--output'), serializeRuntimeBlobReleaseManifest(snapshot.manifest));
    if (proof && proofOutput) await writeCanonicalSourceProof(proofOutput, proof);
    if (receiptOutput) {
      const receipt = buildRuntimeBlobReleaseReceipt(snapshot.manifest, {
        sourceProvenanceProofSha256: proof?.proofSha256,
      });
      await mkdir(path.dirname(receiptOutput), { recursive: true });
      await writeFile(receiptOutput, serializeRuntimeBlobReleaseReceipt(receipt), 'utf8');
      process.stdout.write(`${JSON.stringify({ output: receiptOutput })}\n`);
    }
    const dailyReportOutput = argument('--daily-report-output');
    if (dailyReportOutput) await writeJsonFile(dailyReportOutput, dailyPublicationPlan(snapshot));
    return;
  }
  if (command === 'verify-media-closure') {
    const format = releaseFormat();
    const manifest = await buildManifestForFormat(required('--runtime-root'), required('--source-revision'), required('--release-id'), format);
    if (manifest.releaseId !== deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256)) {
      throw new Error('Release id does not bind this runtime source identity. Run plan and use the returned release id.');
    }
    await writeOutput(argument('--output'), JSON.parse(serializeRuntimeReleaseMediaClosure(await buildRuntimeReleaseMediaClosure({
      runtimeRoot: required('--runtime-root'),
      manifest,
    }))));
    return;
  }
  if (command === 'import-v1') {
    const imported = await importV1RuntimeBlobReleaseViaSsh({
      sourceReleaseId: required('--source-release-id'),
      expectedSourceManifestSha256: required('--source-manifest-sha256'),
      ssh: sshBridgeOptions(),
    });
    const proofBody = {
      schemaVersion: 'runtime-v1-v2-equivalence-proof.v1',
      source: {
        formatVersion: imported.sourceManifest.schemaVersion,
        namespace: `runtime/releases/${imported.sourceManifest.releaseId}/`,
        releaseId: imported.sourceManifest.releaseId,
        manifestSha256: imported.sourceManifest.manifestSha256,
        manifestWireSha256: createHash('sha256').update(serializeRuntimeReleaseManifest(imported.sourceManifest)).digest('hex'),
        sourceRevision: imported.sourceManifest.sourceRevision,
      },
      candidate: {
        formatVersion: imported.manifest.schemaVersion,
        namespace: `runtime/blob-releases/${imported.manifest.releaseId}/`,
        releaseId: imported.manifest.releaseId,
        manifestSha256: imported.manifest.manifestSha256,
        manifestWireSha256: imported.receipt.wireSha256,
      },
      logicalTreeSha256: imported.manifest.treeSha256,
      logicalFileCount: imported.manifest.fileCount,
      logicalTotalBytes: imported.manifest.totalBytes,
      verifier: 'runtime-release-oss-publisher-bridge/import-v1.v1',
    };
    const equivalenceProof = {
      ...proofBody,
      proofSha256: createHash('sha256').update(stableStringify(proofBody)).digest('hex'),
    };
    await writeOutput(argument('--output'), {
      source: {
        releaseId: imported.sourceManifest.releaseId,
        manifestSha256: imported.sourceManifest.manifestSha256,
        sourceRevision: imported.sourceManifest.sourceRevision,
      },
      candidate: imported.receipt,
      equivalenceProof,
    });
    return;
  }
  const releaseId = required('--release-id');
  if (command === 'publish-streaming') {
    const sourceRevision = required('--source-revision');
    const format = releaseFormat();
    const receipt = format === 'v1'
      ? await (async () => {
        const runtimeRoot = required('--runtime-root');
        const manifest = await buildRuntimeReleaseManifest(runtimeRoot, { releaseId, sourceRevision });
        const expectedReleaseId = deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256);
        if (releaseId !== expectedReleaseId) throw new Error(`Release id does not bind this runtime source identity. Run plan and use: ${expectedReleaseId}`);
        return publishRuntimeReleaseViaSsh({ runtimeRoot, manifest, ssh: sshBridgeOptions() });
      })()
      : await (async () => {
        const planning = await openPlannedGitManifest(sourceRevision);
        const { snapshot, receipt: planningReceipt } = planning;
        const expectedReleaseId = deriveRuntimeReleaseId(snapshot.manifest.sourceRevision, snapshot.manifest.treeSha256);
        if (releaseId !== expectedReleaseId) throw new Error(`Release id does not bind this runtime source identity. Run plan and use: ${expectedReleaseId}`);
        const blobParentReleaseId = argument('--blob-parent-release-id');
        const blobParentManifestSha256 = argument('--blob-parent-manifest-sha256');
        if ((blobParentReleaseId == null) !== (blobParentManifestSha256 == null)) {
          throw new Error('Blob parent inheritance requires both --blob-parent-release-id and --blob-parent-manifest-sha256.');
        }
        const outcome = await publishRuntimeBlobReleaseLocallyWithMetrics({
          snapshot,
          manifest: snapshot.manifest,
          planningReceipt,
          local: localPublisherOptions(),
          ...(blobParentReleaseId && blobParentManifestSha256 ? {
            blobParentRelease: { releaseId: blobParentReleaseId, manifestSha256: blobParentManifestSha256 },
          } : {}),
        });
        const dailyReportOutput = argument('--daily-report-output');
        if (dailyReportOutput) {
          const report = await readDailyPublicationPlan(dailyReportOutput, snapshot.manifest, planning.proof.proofSha256);
          await writeJsonFile(dailyReportOutput, { ...report, phase: 'published', transfer: outcome.metrics });
        }
        return outcome.receipt;
      })();
    await writeOutput(argument('--output'), receipt);
    return;
  }
  const output = argument('--output');
  const format = releaseFormat();
  if (command === 'verify') {
    await writeOutput(output, format === 'v1'
      ? await verifyPublishedRuntimeReleaseViaSsh({ releaseId, ssh: sshBridgeOptions() })
      : await verifyPublishedRuntimeBlobReleaseViaSsh({ releaseId, ssh: sshBridgeOptions() }));
    return;
  }
  const store = createSshRuntimeReleaseObjectStore(sshBridgeOptions());
  if (format === 'v1') {
    const manifest = await inspectPublishedRuntimeRelease(store, releaseId);
    await writeOutput(output, JSON.parse(serializeRuntimeReleaseManifest(manifest)));
    return;
  }
  const manifest = await inspectPublishedRuntimeBlobRelease(store, releaseId);
  await writeOutput(output, JSON.parse(serializeRuntimeBlobReleaseManifest(manifest)));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
