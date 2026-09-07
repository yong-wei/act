import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolveLiveResourceIndexRevision } from '../../src/features/knowledge/resource-index/revision';
import {
  DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE,
} from '../../src/lib/teaching-projection/contracts';
import {
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../../src/lib/teaching-projection/store';

const GIT_SHA = /^[a-f0-9]{40}$/i;

export function assertTeachingProjectionAppRevision(
  authoringRevision: string,
  captureRevision: string,
): void {
  const authoring = authoringRevision.trim().toLowerCase();
  const capture = captureRevision.trim().toLowerCase();
  if (!GIT_SHA.test(authoring) || capture.endsWith('-dirty') || !GIT_SHA.test(capture) || authoring !== capture) {
    throw new Error(
      `Teaching Projection authoringRevision (${authoringRevision}) does not match app capture (${captureRevision}).`,
    );
  }
}

function main(): void {
  const paths = resolveTeachingProjectionStorePaths(path.join(
    process.cwd(),
    DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE,
  ));
  const active = resolveActiveTeachingProjection(paths);
  if (active.status !== 'available' || !active.staged) {
    throw new Error(`Active Teaching Projection is unavailable: ${active.detail ?? 'unknown'}.`);
  }
  const captureRevision = resolveLiveResourceIndexRevision();
  assertTeachingProjectionAppRevision(
    active.staged.artifacts.manifest.authoringRevision,
    captureRevision,
  );
  process.stdout.write(`Teaching Projection revision matches ${captureRevision}.\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
