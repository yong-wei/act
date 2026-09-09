import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GIT_SHA = /^[a-f0-9]{40}$/i;
const PROJECTION_ID = /^proj-[a-f0-9]{64}$/;
const POINTER_REL = 'course-content/runtime/knowledge/projection/current.json';

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

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

export function parseTeachingProjectionRevisionAssertionArgs(argv: string[]): {
  repoRoot: string;
  sourceRevision: string;
  appRevision: string;
} {
  const sourceRevision = flagValue(argv, '--source-revision')?.trim() ?? '';
  const appRevision = flagValue(argv, '--app-revision')?.trim() ?? '';
  const repoRoot = path.resolve(flagValue(argv, '--repo-root')?.trim() || process.cwd());
  if (!GIT_SHA.test(sourceRevision) || !GIT_SHA.test(appRevision)) {
    throw new Error(
      'Usage: assert-teaching-projection-app-revision --source-revision <sha> --app-revision <sha> [--repo-root <path>]',
    );
  }
  return {
    repoRoot,
    sourceRevision: sourceRevision.toLowerCase(),
    appRevision: appRevision.toLowerCase(),
  };
}

function gitShow(repoRoot: string, revision: string, relativePath: string): string {
  return execFileSync('git', ['-C', repoRoot, 'show', `${revision}:${relativePath}`], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
}

export function readTeachingProjectionAuthoringRevisionAtSource(
  repoRoot: string,
  sourceRevision: string,
): string {
  const revision = sourceRevision.trim().toLowerCase();
  if (!GIT_SHA.test(revision)) {
    throw new Error(`source revision is invalid: ${sourceRevision}`);
  }
  let pointer: { projectionId?: string };
  try {
    pointer = JSON.parse(gitShow(repoRoot, revision, POINTER_REL)) as { projectionId?: string };
  } catch {
    throw new Error(`Teaching Projection current pointer is missing from candidate ${revision}.`);
  }
  if (!pointer.projectionId || !PROJECTION_ID.test(pointer.projectionId)) {
    throw new Error('Teaching Projection current pointer at the candidate source revision is invalid.');
  }
  const manifestRel = `course-content/runtime/knowledge/projection/releases/${pointer.projectionId}/projection-manifest.json`;
  let manifest: { authoringRevision?: string };
  try {
    manifest = JSON.parse(gitShow(repoRoot, revision, manifestRel)) as { authoringRevision?: string };
  } catch {
    throw new Error(`Teaching Projection manifest is missing from candidate ${revision}.`);
  }
  const authoring = manifest.authoringRevision?.trim() ?? '';
  if (!GIT_SHA.test(authoring)) {
    throw new Error('Teaching Projection authoringRevision at the candidate source revision is invalid.');
  }
  return authoring.toLowerCase();
}

export function resolveTeachingProjectionRevisionAssertion(input: {
  repoRoot: string;
  sourceRevision: string;
  appRevision: string;
}): { authoringRevision: string; appRevision: string } {
  const authoringRevision = readTeachingProjectionAuthoringRevisionAtSource(
    input.repoRoot,
    input.sourceRevision,
  );
  assertTeachingProjectionAppRevision(authoringRevision, input.appRevision);
  return {
    authoringRevision,
    appRevision: input.appRevision.trim().toLowerCase(),
  };
}

function main(): void {
  const parsed = parseTeachingProjectionRevisionAssertionArgs(process.argv.slice(2));
  const result = resolveTeachingProjectionRevisionAssertion(parsed);
  process.stdout.write(
    `Teaching Projection ${result.authoringRevision} matches deployed app ${result.appRevision}.\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
