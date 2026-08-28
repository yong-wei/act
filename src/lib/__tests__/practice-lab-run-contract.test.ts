import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ArtifactRunContractError,
  CONTRACT_SCHEMA,
  OWNER_MATRIX,
  ROUTE_DENOMINATOR,
  assertEvaluationBoundToAcceptedSubmission,
  assertNoOfficialPromotion,
  canonicalIdentityHash,
  projectArenaOfficialEvaluationIdentity,
  projectArenaPreviewIdentity,
  projectArenaSubmissionIdentity,
  projectPracticeOutcomeIdentity,
  projectSimulationRunIdentity,
  rejectHiddenPublicPayload,
  rejectVirtualPreviewRequestBody,
} from '@/lib/practice-lab-run-contract';

const repoRoot = process.cwd();

function identityInput() {
  return {
    sourceId: 'preview-1',
    ownerUserId: 'student-1',
    taskId: 'task-cruise-roll-blackbox-identification',
    specHash: 'sha256:spec',
    artifactHash: 'artifact-abc',
    controllerSnapshotRef: 'ArenaControllerArtifact:artifact-abc',
    protocolVersion: '1.0',
    runtimeVersion: 'arena-virtual-preview-runtime-v1',
    modelVersion: 'cruise-roll-controller-preview-v1',
    seed: 12,
    checksum: 'sha256:deadbeef',
  };
}

describe('practice lab artifact/run contract', () => {
  it('freezes owner and route denominators', () => {
    expect(OWNER_MATRIX).toHaveLength(7);
    expect(ROUTE_DENOMINATOR).toEqual(expect.arrayContaining([
      '/api/arena/virtual-simulation-runs',
      '/api/arena/evaluate',
      '/api/simulation/runs',
    ]));
  });

  it('seals a preview envelope as non-official surrogate', () => {
    const { identity, publicProjection } = projectArenaPreviewIdentity(identityInput());
    expect(identity.schemaVersion).toBe(CONTRACT_SCHEMA);
    expect(identity.evaluationVisibility).toBe('preview');
    expect(identity.officialEligible).toBe(false);
    expect(identity.executor).toBe('server');
    expect(identity.authoritySource).toBe('control-engine-server-facade');
    expect(identity.modelRelation).toBe('surrogate');
    expect(identity.prohibitsMixedClaims).toBe(true);
    expect(identity.canonicalIdentityHash).toBe(canonicalIdentityHash(identity));
    expect(publicProjection.officialEligible).toBe(false);
  });

  it('changes canonical hash when task identity or official eligibility changes', () => {
    const left = projectArenaPreviewIdentity(identityInput()).identity;
    const right = projectArenaPreviewIdentity({ ...identityInput(), taskId: 'task-b' }).identity;
    expect(left.canonicalIdentityHash).not.toBe(right.canonicalIdentityHash);
    const official = projectArenaOfficialEvaluationIdentity(identityInput());
    expect(official.canonicalIdentityHash).not.toBe(left.canonicalIdentityHash);
  });

  it('rejects official promotion of preview and practice', () => {
    const preview = projectArenaPreviewIdentity(identityInput()).identity;
    const practice = projectPracticeOutcomeIdentity({
      ...identityInput(),
      executor: 'browser',
      authoritySource: 'control-engine-browser-facade',
    });
    expect(practice.evaluationVisibility).toBe('practice');
    expect(practice.officialEligible).toBe(false);
    expect(() => assertNoOfficialPromotion(preview, 'ArenaSubmission')).toThrow(ArtifactRunContractError);
    expect(() => assertNoOfficialPromotion(practice, 'leaderboard')).toThrow(/practice-outcome/);
  });

  it('binds shared evaluations through accepted submissions', () => {
    expect(() => assertEvaluationBoundToAcceptedSubmission({
      ownerUserId: 'student-1',
      acceptedSubmissionUserIds: [],
    })).toThrow(/unbound/);
    expect(() => assertEvaluationBoundToAcceptedSubmission({
      ownerUserId: 'student-1',
      acceptedSubmissionUserIds: ['student-1', 'student-2'],
    })).not.toThrow();
    expect(projectArenaOfficialEvaluationIdentity(identityInput()).authority).toBe('arena-evaluator');
    expect(projectArenaSubmissionIdentity(identityInput()).ownerRef.id).toBe('student-1');
    expect(projectSimulationRunIdentity({
      ...identityInput(),
      executor: 'server',
      authoritySource: 'control-engine-server-facade',
    }).sourceKind).toBe('simulation-run');
  });

  it('rejects hidden public payloads and client preview result fields', () => {
    expect(() => rejectHiddenPublicPayload({ summary: { trackingError: 1 }, hiddenDataset: {} })).toThrow(/hiddenDataset/);
    expect(rejectVirtualPreviewRequestBody({ trace: [] })).toContain('trace');
    expect(rejectVirtualPreviewRequestBody({ hiddenInputs: { omega: 1 } })).toContain('hiddenInputs');
    expect(rejectVirtualPreviewRequestBody({ taskId: 'task' })).toBeNull();
  });

  it('has a single envelope hasher and no parallel PracticeRun schema', () => {
    const hasherHits = readdirSync(path.join(repoRoot, 'src/lib/practice-lab-run-contract'))
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) => {
        const source = readFileSync(path.join(repoRoot, 'src/lib/practice-lab-run-contract', file), 'utf8');
        return source.includes('export function canonicalIdentityHash') ? [file] : [];
      });
    expect(hasherHits).toEqual(['canonicalize.ts']);
    const prisma = readFileSync(path.join(repoRoot, 'prisma/schema.prisma'), 'utf8');
    expect(prisma).not.toMatch(/model PracticeRun\b/);
    const route = readFileSync(path.join(repoRoot, 'src/app/api/arena/virtual-simulation-runs/route.ts'), 'utf8');
    expect(route).toContain('rejectVirtualPreviewRequestBody');
    const writer = readFileSync(path.join(repoRoot, 'src/features/arena/blackbox/controller-preview.ts'), 'utf8');
    expect(writer).toContain('payload: {');
    expect(writer).toContain('metadata: previewBoundary');
  });

  it('keeps sealed identity field order deterministic', () => {
    const first = projectArenaPreviewIdentity(identityInput()).identity;
    const second = projectArenaPreviewIdentity(identityInput()).identity;
    expect(first.canonicalIdentityHash).toBe(second.canonicalIdentityHash);
    expect(Number.isFinite(first.toleranceProfile.absolute)).toBe(true);
  });
});
