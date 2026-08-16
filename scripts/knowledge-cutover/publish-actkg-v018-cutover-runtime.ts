#!/usr/bin/env tsx

/**
 * Publish a cutover-capable v0.18 runtime only after READY qualification
 * and without changing production selectors (#1411).
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  V018_FROZEN_APPLICATION_REVISION,
  V018_FROZEN_IMAGE_TAG,
} from '../../src/lib/teaching-projection/publish/v018-host-shadow';
import {
  publishActKgV018CutoverRuntime,
} from '../../src/lib/teaching-projection/publish/v018-runtime-release';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function resolveActKgV018RuntimeReleaseArgs(argv: readonly string[] = process.argv.slice(2)): {
  repoRoot: string;
  outputRoot?: string;
  qualificationReport?: string;
  imageTag: string;
  frozenApplicationRevision: string;
  hostVerificationReport: string;
} {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const outputRoot = option(argv, '--output-root');
  const qualificationReport = option(argv, '--qualification-report');
  const defaultOutputRoot = path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18',
  );
  return {
    repoRoot,
    outputRoot,
    qualificationReport,
    imageTag: option(argv, '--image-tag') ?? V018_FROZEN_IMAGE_TAG,
    frozenApplicationRevision: option(argv, '--frozen-application-revision')
      ?? V018_FROZEN_APPLICATION_REVISION,
    hostVerificationReport: option(argv, '--host-verification-report')
      ?? path.join(outputRoot ?? defaultOutputRoot, 'host-shadow-verification.json'),
  };
}

export async function prepareActKgV018RuntimeRelease(
  argv: readonly string[] = process.argv.slice(2),
): Promise<{
  status: 'READY' | 'BLOCKED';
  reportPath: string;
  blockers: string[];
  receiptDigest: string;
  imageBuilt: boolean;
}> {
  const {
    repoRoot,
    outputRoot,
    qualificationReport,
    imageTag,
    frozenApplicationRevision,
    hostVerificationReport,
  } = resolveActKgV018RuntimeReleaseArgs(argv);
  const result = await publishActKgV018CutoverRuntime({
    repoRoot,
    outputRoot,
    qualificationReport,
    imageTag,
    frozenApplicationRevision,
    hostVerificationReport,
    runBuild: async ({ repoRoot: root, imageTag: tag }) => {
      execFileSync('bash', [path.join(root, 'scripts/build.sh')], {
        cwd: root,
        env: {
          ...process.env,
          IMAGE_TAG: tag,
          NODE_MAX_OLD_SPACE_SIZE: process.env.NODE_MAX_OLD_SPACE_SIZE ?? '12288',
        },
        stdio: 'inherit',
      });
      return {
        imageTag: tag,
        provenancePath: path.join(root, 'deploy/images/act-obe.tar.provenance.json'),
        imageTarPath: path.join(root, 'deploy/images/act-obe.tar'),
      };
    },
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  prepareActKgV018RuntimeRelease().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
