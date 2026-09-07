import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { assertTeachingProjectionAppRevision } from '../../../scripts/knowledge/assert-teaching-projection-app-revision';

describe('Teaching Projection app revision assertion', () => {
  const revision = 'a'.repeat(40);

  it('accepts only the same clean revision', () => {
    expect(() => assertTeachingProjectionAppRevision(revision, revision)).not.toThrow();
    expect(() => assertTeachingProjectionAppRevision(revision, `${revision}-dirty`)).toThrow();
    expect(() => assertTeachingProjectionAppRevision(revision, 'b'.repeat(40))).toThrow();
    expect(() => assertTeachingProjectionAppRevision('invalid', revision)).toThrow();
  });
});
