import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildRuntimeReleaseManifest, deriveRuntimeReleaseId, serializeRuntimeReleaseManifest } from '@/lib/runtime-release';
import {
  createEcsRamRoleOssRuntimeReleaseStore,
  inspectPublishedRuntimeRelease,
  publishRuntimeRelease,
  verifyPublishedRuntimeRelease,
} from '@/lib/runtime-release-store';

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
    '  act-runtime-release plan --runtime-root <path> --source-revision <40-sha>',
    '  act-runtime-release publish --runtime-root <path> --source-revision <40-sha> --release-id <content-addressed-id> --bucket <bucket> --region <region> --role-name <ecs-role> [--output <receipt.json>]',
    '  act-runtime-release verify --release-id <id> --bucket <bucket> --region <region> --role-name <ecs-role> [--output <receipt.json>]',
    '  act-runtime-release inspect --release-id <id> --bucket <bucket> --region <region> --role-name <ecs-role> [--output <manifest.json>]',
    '',
    'The command only obtains temporary credentials from the named ECS RAM Role. It accepts no AccessKey or Secret arguments.',
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

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!['plan', 'publish', 'verify', 'inspect'].includes(command)) throw new Error(usage());
  if (command === 'plan') {
    const manifest = await buildRuntimeReleaseManifest(required('--runtime-root'), {
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
  const releaseId = required('--release-id');
  const store = createEcsRamRoleOssRuntimeReleaseStore({
    bucket: required('--bucket'),
    region: required('--region'),
    roleName: required('--role-name'),
  });
  const output = argument('--output');
  if (command === 'publish') {
    const manifest = await buildRuntimeReleaseManifest(required('--runtime-root'), {
      releaseId,
      sourceRevision: required('--source-revision'),
    });
    const expectedReleaseId = deriveRuntimeReleaseId(manifest.sourceRevision, manifest.treeSha256);
    if (releaseId !== expectedReleaseId) {
      throw new Error(`Release id does not bind this runtime source identity. Run plan and use: ${expectedReleaseId}`);
    }
    const receipt = await publishRuntimeRelease({ store, runtimeRoot: required('--runtime-root'), manifest });
    await writeOutput(output, receipt);
    return;
  }
  if (command === 'verify') {
    await writeOutput(output, await verifyPublishedRuntimeRelease(store, releaseId));
    return;
  }
  const manifest = await inspectPublishedRuntimeRelease(store, releaseId);
  await writeOutput(output, JSON.parse(serializeRuntimeReleaseManifest(manifest)));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
