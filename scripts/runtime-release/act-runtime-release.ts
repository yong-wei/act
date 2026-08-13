import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildRuntimeBlobReleaseManifest,
  buildRuntimeReleaseManifest,
  deriveRuntimeReleaseId,
  serializeRuntimeBlobReleaseManifest,
  serializeRuntimeReleaseManifest,
} from '@/lib/runtime-release';
import { inspectPublishedRuntimeBlobRelease, inspectPublishedRuntimeRelease } from '@/lib/runtime-release-store';
import {
  createSshRuntimeReleaseObjectStore,
  importV1RuntimeBlobReleaseViaSsh,
  publishRuntimeBlobReleaseViaSsh,
  publishRuntimeReleaseViaSsh,
  verifyPublishedRuntimeBlobReleaseViaSsh,
  verifyPublishedRuntimeReleaseViaSsh,
} from '@/lib/runtime-release-streaming-publisher';
import { buildGitRuntimeBlobReleaseSnapshot } from '@/lib/runtime-release-git-snapshot';
import { buildRuntimeReleaseMediaClosure, serializeRuntimeReleaseMediaClosure } from '@/lib/runtime-release-media-closure';
import { stableStringify } from '@/lib/aggregate-governance/hash';

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
    '  act-runtime-release plan --runtime-root <path> --source-revision <40-sha> [--format v1] | plan --repo-root <git-repo> --source-revision <git-revision> --format v2',
    '  act-runtime-release build-manifest --repo-root <git-repo> --source-revision <git-revision> --format v2 --output <manifest.json>',
    '  act-runtime-release verify-media-closure --runtime-root <path> --source-revision <40-sha> --release-id <content-addressed-id> [--format v1|v2] [--output <closure.json>]',
    '  act-runtime-release publish-streaming --repo-root <git-repo> --source-revision <git-revision> --release-id <content-addressed-id> --format v2 --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
    '  act-runtime-release import-v1 --source-release-id <immutable-v1-release-id> --source-manifest-sha256 <sha256> --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
    '  act-runtime-release verify --release-id <id> --format v1|v2 --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
    '  act-runtime-release inspect --release-id <id> --format v1|v2 --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <manifest.json>]',
    '',
    'Streaming publish delegates credentials to the restricted ECS bridge. No AccessKey or Secret arguments are accepted.',
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

async function buildGitManifest(sourceRevision: string) {
  if (process.argv.includes('--integration-ref')) {
    throw new Error('Production v2 CLI fixes the ancestry authority to origin/integration; --integration-ref is not supported.');
  }
  return buildGitRuntimeBlobReleaseSnapshot({
    repoRoot: required('--repo-root'),
    sourceRevision,
    integrationRef: 'origin/integration',
  });
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
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
    await writeOutput(argument('--output'), {
      releaseId: deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256),
      sourceRevision: manifest.sourceRevision,
      treeSha256: manifest.treeSha256,
    });
    return;
  }
  if (command === 'build-manifest') {
    const format = releaseFormat();
    if (format !== 'v2') throw new Error('build-manifest is reserved for the v2 candidate materialization contract.');
    const snapshot = await buildGitManifest(required('--source-revision'));
    await writeOutput(required('--output'), JSON.parse(serializeRuntimeBlobReleaseManifest(snapshot.manifest)));
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
        const snapshot = await buildGitManifest(sourceRevision);
        const expectedReleaseId = deriveRuntimeReleaseId(snapshot.manifest.sourceRevision, snapshot.manifest.treeSha256);
        if (releaseId !== expectedReleaseId) throw new Error(`Release id does not bind this runtime source identity. Run plan and use: ${expectedReleaseId}`);
        return publishRuntimeBlobReleaseViaSsh({ snapshot, manifest: snapshot.manifest, ssh: sshBridgeOptions() });
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
