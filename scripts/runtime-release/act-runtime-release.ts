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
  publishRuntimeBlobReleaseViaSsh,
  publishRuntimeReleaseViaSsh,
  verifyPublishedRuntimeBlobReleaseViaSsh,
  verifyPublishedRuntimeReleaseViaSsh,
} from '@/lib/runtime-release-streaming-publisher';
import { buildRuntimeReleaseMediaClosure, serializeRuntimeReleaseMediaClosure } from '@/lib/runtime-release-media-closure';

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
    '  act-runtime-release plan --runtime-root <path> --source-revision <40-sha> [--format v1|v2]',
    '  act-runtime-release verify-media-closure --runtime-root <path> --source-revision <40-sha> --release-id <content-addressed-id> [--format v1|v2] [--output <closure.json>]',
    '  act-runtime-release publish-streaming --runtime-root <path> --source-revision <40-sha> --release-id <content-addressed-id> --bucket <bucket> --ssh-target <user@host> --remote-bridge-path </absolute/bridge.py> --known-hosts-file </absolute/known_hosts> [--port <port>] [--identity-file </absolute/key>] [--output <receipt.json>]',
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

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!['plan', 'verify-media-closure', 'publish-streaming', 'verify', 'inspect'].includes(command)) throw new Error(usage());
  if (command === 'plan') {
    const format = releaseFormat();
    const manifest = format === 'v1'
      ? await buildRuntimeReleaseManifest(required('--runtime-root'), {
        releaseId: 'runtime-plan',
        sourceRevision: required('--source-revision'),
      })
      : await buildRuntimeBlobReleaseManifest(required('--runtime-root'), {
        sourceRevision: required('--source-revision'),
      });
    await writeOutput(argument('--output'), {
      releaseId: deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256),
      sourceRevision: manifest.sourceRevision,
      treeSha256: manifest.treeSha256,
    });
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
  const releaseId = required('--release-id');
  if (command === 'publish-streaming') {
    const runtimeRoot = required('--runtime-root');
    const sourceRevision = required('--source-revision');
    const format = releaseFormat();
    const manifest = await buildManifestForFormat(runtimeRoot, sourceRevision, releaseId, format);
    const expectedReleaseId = deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256);
    if (releaseId !== expectedReleaseId) {
      throw new Error(`Release id does not bind this runtime source identity. Run plan and use: ${expectedReleaseId}`);
    }
    const receipt = format === 'v1'
      ? await publishRuntimeReleaseViaSsh({ runtimeRoot, manifest, ssh: sshBridgeOptions() })
      : await publishRuntimeBlobReleaseViaSsh({ runtimeRoot, manifest, ssh: sshBridgeOptions() });
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
