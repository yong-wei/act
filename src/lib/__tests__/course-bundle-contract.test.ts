import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  computeCourseBundleDigest,
  computeCourseBundleIdentityProjectionHash,
  generatedCoursewareBundleId,
  hashOrderedPathDigest,
  isGeneratedCoursewareBundleId,
  sha256Hex,
} from '../course-bundle/contract';

describe('course bundle contract', () => {
  it('computes a stable digest over present resources regardless of key order', () => {
    const left = computeCourseBundleDigest({
      canonicalLessonId: '1-1',
      resourceHashes: {
        schemaVersion: 'course-bundle-resource-hashes.v1',
        lesson: 'a'.repeat(64),
        graphOverlay: 'b'.repeat(64),
        interactiveManifest: 'c'.repeat(64),
      },
    });
    const right = computeCourseBundleDigest({
      canonicalLessonId: '1-1',
      resourceHashes: {
        interactiveManifest: 'c'.repeat(64),
        graphOverlay: 'b'.repeat(64),
        schemaVersion: 'course-bundle-resource-hashes.v1',
        lesson: 'a'.repeat(64),
      },
    });
    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the digest when any resource hash changes or a resource appears', () => {
    const base = {
      canonicalLessonId: '1-1',
      resourceHashes: {
        schemaVersion: 'course-bundle-resource-hashes.v1' as const,
        lesson: 'a'.repeat(64),
        graphOverlay: 'b'.repeat(64),
      },
    };
    const changedHandout = {
      canonicalLessonId: '1-1',
      resourceHashes: {
        ...base.resourceHashes,
        handoutMarkdown: 'd'.repeat(64),
      },
    };
    const changedLesson = {
      canonicalLessonId: '1-1',
      resourceHashes: {
        ...base.resourceHashes,
        lesson: 'z'.repeat(64),
      },
    };
    expect(computeCourseBundleDigest(base)).not.toBe(computeCourseBundleDigest(changedHandout));
    expect(computeCourseBundleDigest(base)).not.toBe(computeCourseBundleDigest(changedLesson));
  });

  it('hashes the identity projection deterministically including alias family', () => {
    const hash = computeCourseBundleIdentityProjectionHash({
      schemaVersion: 'course-bundle-identity-projection.v1',
      canonicalLessonId: '1-2',
      runtimeLessonDir: '1-2',
      routeSegment: 'unit-1-2-modeling-from-object-to-system',
      aliasFamily: {
        lessonKeys: ['k'],
        presetKeys: ['p'],
        evidenceAliases: ['e'],
      },
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('orders path digests so insertion order does not matter but content does', () => {
    const a = hashOrderedPathDigest([
      { path: 'z.md', sha256: '1' },
      { path: 'a.md', sha256: '2' },
    ]);
    const b = hashOrderedPathDigest([
      { path: 'a.md', sha256: '2' },
      { path: 'z.md', sha256: '1' },
    ]);
    const c = hashOrderedPathDigest([
      { path: 'a.md', sha256: 'changed' },
      { path: 'z.md', sha256: '1' },
    ]);
    const d = hashOrderedPathDigest([
      { path: 'a.md', sha256: '2' },
      { path: 'z.md', sha256: null },
    ]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it('serializes canonical JSON with sorted keys', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('namespaces generated courseware bundle ids', () => {
    expect(generatedCoursewareBundleId('pub-1')).toBe('generated-courseware:pub-1');
    expect(isGeneratedCoursewareBundleId('generated-courseware:pub-1')).toBe(true);
    expect(isGeneratedCoursewareBundleId('1-1')).toBe(false);
  });

  it('hashes hex digests consistently for strings and buffers', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex(Buffer.from('abc')));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
