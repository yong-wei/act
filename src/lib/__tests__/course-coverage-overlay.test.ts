import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buildCourseCoverageAdmissionProjection,
  AuthoritativeKnowledgeRepository,
  type AuthoritativeKnowledgeDatabase,
  type CourseCoverageResult,
  type CourseCoverageSelector,
} from '../authoritative-knowledge';
import {
  computeCourseCoverageSourceHash,
  loadAndValidateCourseCoverageOverlay,
  validateCourseCoverageOverlay,
  type CourseCoverageOverlay,
} from '../../../scripts/course-coverage/course-coverage-overlay';
import {
  loadAndValidateRelease,
  type ValidatedRelease,
} from '../../../scripts/actkg-release/authoritative-release';

const root = process.cwd();
const captureRevision = 'a'.repeat(40);
const overlayPath = path.join(
  root,
  'course-content/authoring/knowledge/course-coverage/active/automatic-control.json',
);
const schemaPath = path.join(
  root,
  'course-content/authoring/knowledge/course-coverage/course-coverage-overlay.schema.json',
);
const selector: CourseCoverageSelector = {
  courseId: 'automatic-control',
  overlayId: 'automatic-control-root-locus-coverage-v1',
  overlayVersion: '1',
  releaseSetId: 'actkg-authoritative-candidate-v1',
  releaseId: 'root-locus-engineering-v0.1',
};

let validatedRelease: ValidatedRelease;
let schema: unknown;
let source: CourseCoverageOverlay;

function rehash(overlay: CourseCoverageOverlay): CourseCoverageOverlay {
  const next = structuredClone(overlay);
  next.sourceHash = computeCourseCoverageSourceHash(next);
  return next;
}

beforeAll(async () => {
  validatedRelease = await loadAndValidateRelease({ captureRevision });
  schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as unknown;
  source = JSON.parse(readFileSync(overlayPath, 'utf8')) as CourseCoverageOverlay;
  source.authoringRevision = captureRevision;
  source = rehash(source);
});

describe('Course coverage authoring validator', () => {
  it('loads only the controlled active Overlay and keeps candidates separate', async () => {
    await expect(loadAndValidateCourseCoverageOverlay({
      requireCleanGit: false,
    })).resolves.toMatchObject({
      overlay: {
        courseId: 'automatic-control',
        entries: [{ role: 'formal_objective' }],
      },
    });
    await expect(loadAndValidateCourseCoverageOverlay({
      overlayPath: 'course-content/authoring/knowledge/course-coverage/fixtures/three-role.json',
      captureRevision,
      requireCleanGit: false,
    })).rejects.toThrow(/controlled active Overlay path/u);
  });

  it('accepts all three registered roles and sorts deterministically', async () => {
    const overlay = JSON.parse(readFileSync(path.join(
      root,
      'course-content/authoring/knowledge/course-coverage/fixtures/three-role.json',
    ), 'utf8')) as CourseCoverageOverlay;
    const result = await validateCourseCoverageOverlay(
      overlay,
      validatedRelease,
      schema,
      { captureRevision },
    );
    expect(result.entries.map((entry) => entry.role).sort()).toEqual([
      'explicit_extension',
      'formal_objective',
      'necessary_prerequisite',
    ]);
    expect(result.entries).toEqual([...result.entries].sort((left, right) => (
      left.canonicalId.localeCompare(right.canonicalId) || left.role.localeCompare(right.role)
    )));
  });

  it.each([
    ['unsupported role', (overlay: CourseCoverageOverlay) => {
      overlay.entries[0]!.role = 'suggested' as never;
    }, /schema validation failed/u],
    ['missing object', (overlay: CourseCoverageOverlay) => {
      overlay.entries[0]!.canonicalId = 'ctc:missing';
    }, /missing Canonical Object/u],
    ['duplicate role', (overlay: CourseCoverageOverlay) => {
      overlay.entries.push(structuredClone(overlay.entries[0]!));
    }, /duplicate Canonical Object and role/u],
    ['release drift', (overlay: CourseCoverageOverlay) => {
      overlay.releaseHash = 'b'.repeat(64);
    }, /pinned Release identity drift/u],
  ])('rejects %s without admitting entries', async (_name, mutate, expected) => {
    const overlay = structuredClone(source);
    mutate(overlay);
    overlay.sourceHash = computeCourseCoverageSourceHash(overlay);
    await expect(validateCourseCoverageOverlay(
      overlay,
      validatedRelease,
      schema,
      { captureRevision },
    )).rejects.toThrow(expected);
  });

  it('rejects source drift and dirty working-tree capture', async () => {
    await expect(validateCourseCoverageOverlay(
      { ...source, sourceHash: 'b'.repeat(64) },
      validatedRelease,
      schema,
      { captureRevision },
    )).rejects.toThrow(/source hash drift/u);
    await expect(loadAndValidateCourseCoverageOverlay())
      .rejects.toThrow(/clean Git HEAD/u);
    await expect(validateCourseCoverageOverlay(
      source,
      validatedRelease,
      schema,
      { captureRevision: 'invalid' },
    )).rejects.toThrow(/captureRevision is invalid/u);
  });
});

describe('Course coverage Repository and shared admission projection', () => {
  function availableDatabase(): AuthoritativeKnowledgeDatabase {
    const entry = {
      overlayVersionId: `${selector.overlayId}@${selector.overlayVersion}`,
      releaseId: selector.releaseId,
      canonicalId: 'covered-1',
      role: 'formal_objective',
      ordinal: 0,
    };
    const delegates = {
      courseCoverageOverlayVersion: {
        findUnique: vi.fn(async () => ({
          id: entry.overlayVersionId,
          schemaVersion: 'act-course-coverage-overlay/v1',
          ...selector,
          authoringRevision: captureRevision,
          captureRevision,
          sourceHash: 'c'.repeat(64),
          releaseHash: 'd'.repeat(64),
          lockRawHash: 'e'.repeat(64),
        })),
        findMany: vi.fn(),
      },
      courseCoverageOverlayEntry: {
        findUnique: vi.fn(),
        findMany: vi.fn(async () => [entry]),
      },
      courseCoverageImportReceipt: {
        findUnique: vi.fn(async () => ({
          authoringRevision: captureRevision,
          captureRevision,
          sourceHash: 'c'.repeat(64),
          releaseHash: 'd'.repeat(64),
          lockRawHash: 'e'.repeat(64),
          entryCount: 1,
        })),
        findMany: vi.fn(),
      },
      actkgReleaseSet: {
        findUnique: vi.fn(async () => ({
          id: selector.releaseSetId,
          candidateState: 'CANDIDATE',
        })),
        findMany: vi.fn(),
      },
      actkgRelease: {
        findUnique: vi.fn(async () => ({
          id: selector.releaseId,
          releaseSetId: selector.releaseSetId,
          releaseHash: 'd'.repeat(64),
          lockRawHash: 'e'.repeat(64),
        })),
        findMany: vi.fn(),
      },
      actkgAuthoritativeObject: {
        findUnique: vi.fn(),
        findMany: vi.fn(async () => [{ releaseId: selector.releaseId, canonicalId: 'covered-1' }]),
      },
    };
    return {
      $transaction: vi.fn(async (callback, options) => {
        expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
        return callback(delegates as never);
      }),
    };
  }

  it('returns auditable roles while leaving complete Release read behavior independent', async () => {
    const repository = new AuthoritativeKnowledgeRepository(availableDatabase());
    await expect(repository.readCourseCoverage()).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'missing-selector',
      productionAuthoritative: false,
    });
    const result = await repository.readCourseCoverage(selector);
    expect(result).toMatchObject({
      status: 'available',
      audit: {
        courseId: selector.courseId,
        releaseId: selector.releaseId,
        productionAuthoritative: false,
      },
      entries: [{ canonicalId: 'covered-1', role: 'formal_objective' }],
    });
  });

  it('admits only covered ids for every formal target and fails closed otherwise', () => {
    const available: CourseCoverageResult = {
      status: 'available',
      selector,
      audit: {
        ...selector,
        overlayVersionId: `${selector.overlayId}@${selector.overlayVersion}`,
        authoringRevision: captureRevision,
        captureRevision,
        sourceHash: 'c'.repeat(64),
        releaseHash: 'd'.repeat(64),
        lockRawHash: 'e'.repeat(64),
        productionAuthoritative: false,
      },
      entries: [
        { canonicalId: 'covered-1', role: 'formal_objective', ordinal: 0 },
        { canonicalId: 'covered-1', role: 'necessary_prerequisite', ordinal: 1 },
      ],
      diagnostics: [],
      productionAuthoritative: false,
    };
    for (const target of ['recommendation', 'kaq', 'path', 'assessment', 'new-fact'] as const) {
      expect(buildCourseCoverageAdmissionProjection(available, target).coveredCanonicalIds)
        .toEqual(['covered-1']);
    }
    const unavailable: CourseCoverageResult = {
      status: 'unavailable',
      selector: null,
      reason: 'missing-selector',
      diagnostics: [],
      productionAuthoritative: false,
    };
    expect(buildCourseCoverageAdmissionProjection(unavailable, 'path').coveredCanonicalIds).toEqual([]);
    expect(buildCourseCoverageAdmissionProjection({
      ...available,
      status: 'drift',
      diagnostics: [{
        code: 'release-drift',
        field: 'release.releaseHash',
        expected: 'd',
        actual: 'e',
      }],
    }, 'assessment').coveredCanonicalIds).toEqual([]);
  });
});

describe('production isolation contract', () => {
  it('has no API mutation endpoint or production consumer reference to coverage tables', () => {
    const repositorySource = readFileSync(
      path.join(root, 'src/lib/authoritative-knowledge/repository.ts'),
      'utf8',
    );
    const appSources = readFileSync(path.join(root, 'src/app/api/ai/chat/route.ts'), 'utf8');
    expect(repositorySource).toContain('readCourseCoverage');
    expect(appSources).not.toMatch(/CourseCoverage|courseCoverage/u);
    const search = spawnSync('rg', [
      '-l',
      'courseCoverageOverlayVersion|courseCoverageOverlayEntry|courseCoverageImportReceipt',
      'src',
      '--glob',
      '!**/__tests__/**',
    ], { cwd: root, encoding: 'utf8' });
    expect(search.status).toBe(0);
    expect(search.stdout.trim().split('\n').sort()).toEqual([
      'src/lib/authoritative-knowledge/repository.ts',
    ]);
  });
});
