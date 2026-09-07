import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));

import {
  assertTeachingProjectionAppRevision,
  parseTeachingProjectionRevisionAssertionArgs,
  readTeachingProjectionAuthoringRevisionAtSource,
} from '../../../scripts/knowledge/assert-teaching-projection-app-revision';

describe('Teaching Projection app revision assertion', () => {
  const revision = 'a'.repeat(40);

  it('accepts only the same clean revision', () => {
    expect(() => assertTeachingProjectionAppRevision(revision, revision)).not.toThrow();
    expect(() => assertTeachingProjectionAppRevision(revision, `${revision}-dirty`)).toThrow();
    expect(() => assertTeachingProjectionAppRevision(revision, 'b'.repeat(40))).toThrow();
    expect(() => assertTeachingProjectionAppRevision('invalid', revision)).toThrow();
  });

  it('requires an explicit candidate source revision and deployed app revision', () => {
    expect(() => parseTeachingProjectionRevisionAssertionArgs([])).toThrow(/Usage/);
    expect(() => parseTeachingProjectionRevisionAssertionArgs(['--source-revision', revision])).toThrow(/Usage/);
    expect(() => parseTeachingProjectionRevisionAssertionArgs(['--app-revision', revision])).toThrow(/Usage/);
    expect(parseTeachingProjectionRevisionAssertionArgs([
      '--source-revision', revision,
      '--app-revision', revision,
      '--repo-root', '/tmp/repo',
    ])).toEqual({
      repoRoot: path.resolve('/tmp/repo'),
      sourceRevision: revision,
      appRevision: revision,
    });
  });

  it('reads authoringRevision from the git object at the candidate source revision', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const authoring = readTeachingProjectionAuthoringRevisionAtSource(process.cwd(), head);
    expect(authoring).toMatch(/^[a-f0-9]{40}$/);
  });

  it('does not read the operator worktree pointer or live index revision', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'scripts/knowledge/assert-teaching-projection-app-revision.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/resolveLiveResourceIndexRevision/);
    expect(source).not.toMatch(/resolveActiveTeachingProjection/);
    expect(source).toContain('--source-revision');
    expect(source).toContain('--app-revision');
    expect(source).toContain('function gitShow');
    expect(source).toContain('POINTER_REL');
  });
});
