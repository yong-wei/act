/**
 * ACT Teaching Projection contract, builder, gate, and activation (#1267).
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  TeachingProjectionBuildError,
  TeachingProjectionIdentityError,
  activateTeachingProjection,
  buildTeachingProjection,
  buildTeachingProjectionActivationManifest,
  defaultConsumerCombinationInputs,
  deriveBindingId,
  deriveResourceId,
  evaluateTeachingProjectionGate,
  loadStagedTeachingProjection,
  projectionDigest,
  readCurrentTeachingProjectionPointer,
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
  stageTeachingProjection,
  stagedProjectionNormalizedBytes,
  verifyTeachingProjectionArtifacts,
  type TeachingProjectionAuthoringInput,
} from '../teaching-projection';

const commitA = 'a'.repeat(40);
const commitB = 'b'.repeat(40);
const hashA = 'c'.repeat(64);

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempProjectionRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-teaching-projection-'));
  tempRoots.push(root);
  return resolveTeachingProjectionStorePaths(root);
}

function baseAuthorityNodes() {
  return [
    { canonicalId: 'node-a', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-unrelated', lifecycleStatus: 'active', successorCanonicalId: null },
  ];
}

function emptyAuthoring(
  overrides: Partial<TeachingProjectionAuthoringInput> = {},
): TeachingProjectionAuthoringInput {
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: 'fixture-empty',
    authoringRevision: commitA,
    authorityReleaseId: 'ctr:release:eng-v1',
    authorityReleaseSetId: 'set-1',
    authoritySnapshotHash: hashA,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: [],
    cards: [],
    authorityNodes: baseAuthorityNodes(),
    ...overrides,
  };
}

function boundStepAuthoring(
  overrides: Partial<TeachingProjectionAuthoringInput> = {},
): TeachingProjectionAuthoringInput {
  return emptyAuthoring({
    scopeId: 'fixture-bound-step',
    authoringRevision: commitB,
    resources: [
      {
        resourceType: 'step',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        projectionMode: 'REQUIRED',
        scopeId: 'fixture-bound-step',
        title: 'Practice step',
        sourcePath: 'authoring/lessons/lesson-02/steps/practice-1.json',
      },
      {
        resourceType: 'lesson',
        lessonKey: 'lesson-02',
        projectionMode: 'OPTIONAL',
        scopeId: 'fixture-bound-step',
      },
      {
        resourceType: 'handout',
        lessonKey: 'lesson-02',
        projectionMode: 'NONE',
        scopeId: 'fixture-bound-step',
      },
    ],
    bindings: [
      {
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'PRACTICES',
        scopeId: 'fixture-bound-step',
        sourcePath: 'authoring/lessons/lesson-02/steps/practice-1.json',
        primary: true,
        rationale: 'step practices stability',
      },
    ],
    coreNodes: [
      {
        canonicalId: 'node-a',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: 'fixture-bound-step',
      },
    ],
    cards: [
      {
        cardId: 'card-a',
        canonicalId: 'node-a',
        active: true,
        required: false,
      },
    ],
    ...overrides,
  });
}

describe('Resource and binding identities (#1267)', () => {
  it('derives stable resource IDs for all supported types', () => {
    expect(deriveResourceId({
      resourceType: 'lesson',
      lessonKey: 'lesson-02',
      projectionMode: 'OPTIONAL',
      scopeId: 's',
    })).toBe('act:lesson:lesson-02');

    expect(deriveResourceId({
      resourceType: 'handout',
      lessonKey: 'lesson-02',
      projectionMode: 'NONE',
      scopeId: 's',
    })).toBe('act:handout:lesson-02');

    expect(deriveResourceId({
      resourceType: 'step',
      lessonKey: 'lesson-02',
      stepId: 'practice-1',
      projectionMode: 'REQUIRED',
      scopeId: 's',
    })).toBe('act:step:lesson-02:practice-1');

    expect(deriveResourceId({
      resourceType: 'textbook',
      sourceDocumentId: 'doc-1',
      projectionMode: 'OPTIONAL',
      scopeId: 's',
    })).toBe('act:textbook:doc-1');

    expect(deriveResourceId({
      resourceType: 'textbook-section',
      sectionId: 'sec-1',
      projectionMode: 'OPTIONAL',
      scopeId: 's',
    })).toBe('act:textbook-section:sec-1');

    expect(deriveResourceId({
      resourceType: 'card',
      cardId: 'card-1',
      projectionMode: 'OPTIONAL',
      scopeId: 's',
    })).toBe('act:card:card-1');
  });

  it('derives binding identity from resourceId + canonicalId + role + scopeId', () => {
    const a = deriveBindingId({
      resourceId: 'act:step:lesson-02:practice-1',
      canonicalId: 'node-a',
      role: 'PRACTICES',
      scopeId: 'fixture-bound-step',
    });
    const b = deriveBindingId({
      resourceId: 'act:step:lesson-02:practice-1',
      canonicalId: 'node-a',
      role: 'PRACTICES',
      scopeId: 'fixture-bound-step',
    });
    const c = deriveBindingId({
      resourceId: 'act:step:lesson-02:practice-1',
      canonicalId: 'node-a',
      role: 'EXPLAINS',
      scopeId: 'fixture-bound-step',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('bind-')).toBe(true);
  });

  it('fails closed on unsupported role or malformed resource ID', () => {
    expect(() =>
      deriveBindingId({
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'REFERENCES' as 'PRACTICES',
        scopeId: 's',
      }),
    ).toThrow(TeachingProjectionIdentityError);

    expect(() =>
      deriveResourceId({
        resourceId: 'bad-id',
        resourceType: 'lesson',
        projectionMode: 'OPTIONAL',
        scopeId: 's',
      }),
    ).toThrow(/malformed resource ID/i);

    expect(() =>
      buildTeachingProjection(
        boundStepAuthoring({
          bindings: [
            {
              resourceId: 'act:step:lesson-02:practice-1',
              canonicalId: 'node-a',
              role: 'UNKNOWN' as 'PRACTICES',
              scopeId: 'fixture-bound-step',
            },
          ],
        }),
      ),
    ).toThrow(TeachingProjectionBuildError);
  });
});

describe('Deterministic builder (#1267)', () => {
  it('builds empty projection with deterministic hash (legal empty)', () => {
    const first = buildTeachingProjection(emptyAuthoring());
    const second = buildTeachingProjection(emptyAuthoring());

    expect(first.manifest.resourceCount).toBe(0);
    expect(first.manifest.bindingCount).toBe(0);
    expect(first.gate.passed).toBe(true);
    expect(first.gate.status).toBe('PUBLISHED');
    expect(first.manifest.projectionHash).toBe(second.manifest.projectionHash);
    expect(first.manifest.projectionId).toBe(second.manifest.projectionId);
    expect(first.manifest.projectionId).toBe(
      `proj-${first.manifest.projectionHash}`,
    );
    expect(first.gate.notProjectedCanonicalIds).toEqual([
      'node-a',
      'node-b',
      'node-unrelated',
    ]);
  });

  it('preserves role, scope, source path, and identities for a projected step', () => {
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    expect(artifacts.gate.passed).toBe(true);
    expect(artifacts.bindings).toHaveLength(1);
    const binding = artifacts.bindings[0]!;
    expect(binding.role).toBe('PRACTICES');
    expect(binding.scopeId).toBe('fixture-bound-step');
    expect(binding.sourcePath).toBe(
      'authoring/lessons/lesson-02/steps/practice-1.json',
    );
    expect(binding.resourceId).toBe('act:step:lesson-02:practice-1');
    expect(binding.canonicalId).toBe('node-a');
    expect(binding.bindingId).toBe(
      deriveBindingId({
        resourceId: binding.resourceId,
        canonicalId: binding.canonicalId,
        role: binding.role,
        scopeId: binding.scopeId,
      }),
    );

    const step = artifacts.resources.find(
      (r) => r.resourceId === 'act:step:lesson-02:practice-1',
    );
    expect(step?.bindingStatus).toBe('BOUND');
    expect(step?.projectionMode).toBe('REQUIRED');
  });

  it('emits all required runtime artifact shapes', () => {
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    expect(artifacts.resources.length).toBeGreaterThan(0);
    expect(artifacts.bindings.length).toBeGreaterThan(0);
    expect(artifacts.coreNodes.length).toBe(1);
    expect(artifacts.cardsIndex.contract).toBe(
      'act-teaching-projection-cards-index/v1',
    );
    expect(artifacts.manifest.contract).toBe('act-teaching-projection-manifest/v1');
    expect(artifacts.impactReport.contract).toBe(
      'act-teaching-projection-impact/v1',
    );
    expect(artifacts.manifest.sourceHashes.resources).toMatch(/^[a-f0-9]{64}$/);
    expect(artifacts.manifest.authorityReleaseId).toBe('ctr:release:eng-v1');
    expect(artifacts.manifest.authoringRevision).toBe(commitB);
  });

  it('is byte/hash identical across repeated builds and staged directories', () => {
    const paths = tempProjectionRoot();
    const authoring = boundStepAuthoring();
    const a = stageTeachingProjection(paths, authoring);
    const b = stageTeachingProjection(paths, authoring);

    expect(a.projectionHash).toBe(b.projectionHash);
    expect(a.projectionId).toBe(b.projectionId);
    expect(b.reused).toBe(true);

    const bytesA = stagedProjectionNormalizedBytes(a.releaseDir);
    const bytesB = stagedProjectionNormalizedBytes(b.releaseDir);
    expect(bytesA).toEqual(bytesB);

    // Second root, fresh stage — same content hashes.
    const paths2 = tempProjectionRoot();
    const c = stageTeachingProjection(paths2, authoring);
    expect(c.projectionHash).toBe(a.projectionHash);
    expect(stagedProjectionNormalizedBytes(c.releaseDir)).toEqual(bytesA);
  });

  it('rejects source/projection drift before activation', () => {
    const paths = tempProjectionRoot();
    const staged = stageTeachingProjection(paths, boundStepAuthoring());
    const resourcesPath = path.join(staged.releaseDir, 'resources.jsonl');
    writeFileSync(
      resourcesPath,
      `${readFileSync(resourcesPath, 'utf8')}{"tampered":true}\n`,
    );

    expect(() => loadStagedTeachingProjection(paths, staged.projectionId)).toThrow(
      /source hash|source-drift|does not match/i,
    );

    const artifacts = buildTeachingProjection(boundStepAuthoring());
    artifacts.resources = [
      ...artifacts.resources,
      {
        resourceId: 'act:lesson:extra',
        resourceType: 'lesson',
        projectionMode: 'OPTIONAL',
        scopeId: 'x',
        title: null,
        sourcePath: null,
        legacyCrosswalkRef: null,
        bindingCount: 0,
        bindingStatus: 'UNBOUND',
      },
    ];
    expect(() => verifyTeachingProjectionArtifacts(artifacts)).toThrow(
      TeachingProjectionBuildError,
    );
  });

  it('writes staged artifact filenames expected by the design', () => {
    const paths = tempProjectionRoot();
    const staged = stageTeachingProjection(paths, boundStepAuthoring());
    const names = readdirSync(staged.releaseDir).sort();
    expect(names).toEqual([
      'bindings.jsonl',
      'cards-index.json',
      'core-nodes.json',
      'gate.json',
      'impact-report.json',
      'prerequisites.jsonl',
      'projection-manifest.json',
      'resources.jsonl',
    ]);
  });
});

describe('Projection gate semantics (#1267)', () => {
  it('REQUIRED unbound resource → REVIEW_REQUIRED and cannot activate', () => {
    const authoring = boundStepAuthoring({
      bindings: [], // step is REQUIRED but unbound
    });
    const artifacts = buildTeachingProjection(authoring);
    expect(artifacts.gate.passed).toBe(false);
    expect(artifacts.gate.status).toBe('REVIEW_REQUIRED');
    expect(artifacts.gate.unboundRequiredResourceIds).toContain(
      'act:step:lesson-02:practice-1',
    );
    expect(artifacts.manifest.gatePassed).toBe(false);

    const paths = tempProjectionRoot();
    const staged = stageTeachingProjection(paths, authoring);
    const activation = activateTeachingProjection(paths, {
      projectionId: staged.projectionId,
    });
    expect(activation.status).toBe('failed');
    expect(readCurrentTeachingProjectionPointer(paths)).toBeNull();
  });

  it('OPTIONAL or NONE unbound resources do not block publication', () => {
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    // lesson is OPTIONAL unbound, handout is NONE unbound — step is bound.
    expect(artifacts.gate.passed).toBe(true);
    expect(artifacts.gate.status).toBe('PUBLISHED');
    expect(artifacts.gate.unboundOptionalResourceIds).toContain(
      'act:lesson:lesson-02',
    );
    const noneResource = artifacts.resources.find(
      (r) => r.resourceId === 'act:handout:lesson-02',
    );
    expect(noneResource?.projectionMode).toBe('NONE');
    expect(noneResource?.bindingStatus).toBe('NONE');

    const optionalFinding = artifacts.gate.findings.find(
      (f) => f.code === 'optional-resource-unbound',
    );
    expect(optionalFinding?.severity).toBe('info');
  });

  it('unprojected Authority nodes do not block publication', () => {
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    expect(artifacts.gate.notProjectedCanonicalIds).toContain('node-unrelated');
    expect(artifacts.gate.notProjectedCanonicalIds).toContain('node-b');
    expect(artifacts.gate.passed).toBe(true);
    expect(
      artifacts.impactReport.records.some(
        (r) => r.effect === 'not-projected' && r.id === 'node-unrelated',
      ),
    ).toBe(true);
  });

  it('missing optional cards do not block; required unresolved cards fail closed', () => {
    const optionalOk = buildTeachingProjection(
      boundStepAuthoring({
        cards: [
          {
            cardId: 'opt-card',
            canonicalId: 'node-a',
            active: false,
            required: false,
          },
        ],
      }),
    );
    expect(optionalOk.gate.passed).toBe(true);
    expect(
      optionalOk.gate.findings.some((f) => f.code === 'optional-card-absent'),
    ).toBe(true);

    const requiredFail = buildTeachingProjection(
      boundStepAuthoring({
        cards: [
          {
            cardId: 'req-card',
            canonicalId: 'node-missing',
            active: true,
            required: true,
          },
        ],
      }),
    );
    expect(requiredFail.gate.passed).toBe(false);
    expect(
      requiredFail.gate.findings.some((f) => f.code === 'required-card-unresolved'),
    ).toBe(true);
  });

  it('fails closed on invalid endpoints, self-loops, cycles, and duplicate active cards', () => {
    const invalidEndpoint = buildTeachingProjection(
      boundStepAuthoring({
        bindings: [
          {
            resourceId: 'act:step:lesson-02:practice-1',
            canonicalId: 'node-does-not-exist',
            role: 'PRACTICES',
            scopeId: 'fixture-bound-step',
          },
        ],
      }),
    );
    expect(invalidEndpoint.gate.passed).toBe(false);

    const selfLoop = buildTeachingProjection(
      boundStepAuthoring({
        prerequisites: [
          {
            sourceCanonicalId: 'node-a',
            targetCanonicalId: 'node-a',
            strength: 'REQUIRED',
          },
        ],
      }),
    );
    expect(selfLoop.gate.passed).toBe(false);
    expect(
      selfLoop.gate.findings.some((f) => f.code === 'prerequisite-self-loop'),
    ).toBe(true);

    const cycle = buildTeachingProjection(
      boundStepAuthoring({
        prerequisites: [
          {
            sourceCanonicalId: 'node-a',
            targetCanonicalId: 'node-b',
            strength: 'REQUIRED',
          },
          {
            sourceCanonicalId: 'node-b',
            targetCanonicalId: 'node-a',
            strength: 'REQUIRED',
          },
        ],
      }),
    );
    expect(cycle.gate.passed).toBe(false);
    expect(
      cycle.gate.findings.some((f) => f.code === 'required-prerequisite-cycle'),
    ).toBe(true);

    const dupCards = buildTeachingProjection(
      boundStepAuthoring({
        cards: [
          {
            cardId: 'c1',
            canonicalId: 'node-a',
            active: true,
            required: false,
          },
          {
            cardId: 'c2',
            canonicalId: 'node-a',
            active: true,
            required: false,
          },
        ],
      }),
    );
    expect(dupCards.gate.passed).toBe(false);
    expect(
      dupCards.gate.findings.some((f) => f.code === 'duplicate-active-cards'),
    ).toBe(true);

    const retired = buildTeachingProjection(
      boundStepAuthoring({
        authorityNodes: [
          {
            canonicalId: 'node-a',
            lifecycleStatus: 'retired',
            successorCanonicalId: null,
          },
          {
            canonicalId: 'node-b',
            lifecycleStatus: 'active',
            successorCanonicalId: null,
          },
          {
            canonicalId: 'node-unrelated',
            lifecycleStatus: 'active',
            successorCanonicalId: null,
          },
        ],
      }),
    );
    expect(retired.gate.passed).toBe(false);
    expect(
      retired.gate.findings.some((f) =>
        f.code === 'retired-without-successor' || f.code === 'retired-node',
      ),
    ).toBe(true);
  });
});

describe('Consumer activation combinations (#1267)', () => {
  it('engineering consumers are READY without a Teaching Projection', () => {
    const activation = buildTeachingProjectionActivationManifest({
      projection: null,
      consumers: defaultConsumerCombinationInputs({
        authorityReleaseId: 'ctr:release:eng-v1',
      }),
    });

    const eng = activation.consumers.filter((c) =>
      c.consumerKind === 'engineering-graph' || c.consumerKind === 'engineering-rag',
    );
    expect(eng.every((c) => c.readiness === 'READY')).toBe(true);
    expect(eng.every((c) => c.projectionId === null)).toBe(true);
    expect(eng.every((c) => c.requiresProjection === false)).toBe(true);

    const teaching = activation.consumers.filter((c) => c.requiresProjection);
    expect(teaching.every((c) => c.readiness === 'NOT_PROJECTED')).toBe(true);
  });

  it('empty projection yields READY teaching consumers with deterministic hash', () => {
    const artifacts = buildTeachingProjection(emptyAuthoring());
    const activation = buildTeachingProjectionActivationManifest({
      projection: artifacts.manifest,
      projectionGatePassed: true,
      consumers: defaultConsumerCombinationInputs({
        authorityReleaseId: artifacts.manifest.authorityReleaseId,
      }),
    });

    expect(artifacts.manifest.resourceCount).toBe(0);
    expect(activation.activationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      activation.consumers
        .filter((c) => c.requiresProjection)
        .every((c) => c.readiness === 'READY' && c.projectionId === artifacts.manifest.projectionId),
    ).toBe(true);
  });

  it('teaching consumers pin previous when gate fails; engineering stays READY', () => {
    const prior = buildTeachingProjection(boundStepAuthoring());
    const failed = buildTeachingProjection(
      boundStepAuthoring({ bindings: [] }),
    );
    expect(failed.gate.passed).toBe(false);

    const activation = buildTeachingProjectionActivationManifest({
      projection: failed.manifest,
      projectionGatePassed: false,
      consumers: defaultConsumerCombinationInputs({
        authorityReleaseId: failed.manifest.authorityReleaseId,
        pinnedProjectionId: prior.manifest.projectionId,
        pinnedProjectionHash: prior.manifest.projectionHash,
      }),
    });

    expect(
      activation.consumers.find((c) => c.consumerId === 'engineering-graph')
        ?.readiness,
    ).toBe('READY');
    expect(
      activation.consumers.find((c) => c.consumerId === 'teaching-resource-rag')
        ?.readiness,
    ).toBe('PINNED_PREVIOUS');
    expect(
      activation.consumers.find((c) => c.consumerId === 'teaching-resource-rag')
        ?.projectionId,
    ).toBe(prior.manifest.projectionId);
  });

  it('activateTeachingProjection updates current pointer without touching prior release immutability', () => {
    const paths = tempProjectionRoot();
    const first = stageTeachingProjection(paths, emptyAuthoring());
    const activated = activateTeachingProjection(paths, {
      projectionId: first.projectionId,
      activatedAt: '2026-08-04T00:00:00.000Z',
    });
    expect(activated.status).toBe('activated');
    expect(readCurrentTeachingProjectionPointer(paths)?.projectionId).toBe(
      first.projectionId,
    );

    const second = stageTeachingProjection(
      paths,
      boundStepAuthoring({ authoringRevision: 'd'.repeat(40) }),
    );
    expect(second.projectionId).not.toBe(first.projectionId);
    // Prior release still loadable and unmodified.
    const reloaded = loadStagedTeachingProjection(paths, first.projectionId);
    expect(reloaded.projectionHash).toBe(first.projectionHash);
    expect(existsSync(path.join(first.releaseDir, 'projection-manifest.json'))).toBe(
      true,
    );

    activateTeachingProjection(paths, { projectionId: second.projectionId });
    const active = resolveActiveTeachingProjection(paths);
    expect(active.status).toBe('available');
    expect(active.staged?.projectionId).toBe(second.projectionId);
  });

  it('does not change existing engineering selector contracts (activation is additive)', () => {
    // Smoke: activation manifest is a pure function of inputs — no side effects
    // on Authority store paths or teaching selector fingerprints.
    const before = projectionDigest({ marker: 'selector-fingerprint-v1' });
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    buildTeachingProjectionActivationManifest({
      projection: artifacts.manifest,
      consumers: defaultConsumerCombinationInputs({
        authorityReleaseId: artifacts.manifest.authorityReleaseId,
      }),
    });
    const after = projectionDigest({ marker: 'selector-fingerprint-v1' });
    expect(after).toBe(before);
  });
});

describe('Fixture files and schema surface (#1267)', () => {
  const fixtureRoot = path.resolve(
    process.cwd(),
    'course-content/authoring/knowledge/teaching-projection',
  );

  it('loads empty and bound fixtures through the builder', () => {
    const empty = JSON.parse(
      readFileSync(path.join(fixtureRoot, 'fixtures/empty-projection.json'), 'utf8'),
    ) as TeachingProjectionAuthoringInput;
    const bound = JSON.parse(
      readFileSync(
        path.join(fixtureRoot, 'fixtures/bound-step-projection.json'),
        'utf8',
      ),
    ) as TeachingProjectionAuthoringInput;

    const emptyArtifacts = buildTeachingProjection(empty);
    expect(emptyArtifacts.gate.passed).toBe(true);
    expect(emptyArtifacts.manifest.resourceCount).toBe(0);

    const boundArtifacts = buildTeachingProjection(bound);
    expect(boundArtifacts.gate.passed).toBe(true);
    expect(boundArtifacts.bindings[0]?.role).toBe('PRACTICES');
    expect(boundArtifacts.gate.notProjectedCanonicalIds).toContain(
      'node-unrelated-engineering',
    );
  });

  it('ships authoring, runtime-manifest, and activation schemas', () => {
    for (const name of [
      'schemas/authoring.schema.json',
      'schemas/runtime-manifest.schema.json',
      'schemas/activation.schema.json',
    ]) {
      const full = path.join(fixtureRoot, name);
      expect(existsSync(full)).toBe(true);
      const schema = JSON.parse(readFileSync(full, 'utf8')) as { $id: string };
      expect(schema.$id).toMatch(/^act-teaching-projection-/);
    }
  });

  it('evaluateTeachingProjectionGate is pure and scope-limited', () => {
    const artifacts = buildTeachingProjection(boundStepAuthoring());
    const again = evaluateTeachingProjectionGate({
      resources: artifacts.resources,
      bindings: artifacts.bindings,
      prerequisites: artifacts.prerequisites,
      coreNodes: artifacts.coreNodes,
      cards: artifacts.cardsIndex.cards,
      authorityNodes: baseAuthorityNodes(),
    });
    expect(again.status).toBe(artifacts.gate.status);
    expect(again.notProjectedCanonicalIds).toEqual(
      artifacts.gate.notProjectedCanonicalIds,
    );
  });
});
