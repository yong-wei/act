import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';
import {
  RESOURCE_BINDING_AUDIT_CONTRACT,
  RESOURCE_BINDING_GATE_CONTRACT,
  RESOURCE_BINDING_RELEASE_BUILDER_VERSION,
  RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT,
  type AnchoredBindingRuntime,
  type AnchoredResourceRuntime,
  type ResourceBindingReleaseManifestBody,
} from '@/lib/resource-binding-release/contracts';
import { evaluateResourceBindingGate } from '@/lib/resource-binding-release/gate';
import {
  loadResourceBindingRelease,
  writeResourceBindingCurrentPointer,
  writeResourceBindingRelease,
} from '@/lib/resource-binding-release/store';

const HASH = 'a'.repeat(64);

function cardResource(): AnchoredResourceRuntime {
  return {
    resourceId: 'act:card:gate-card',
    resourceType: 'card',
    title: '卡片',
    sourcePath: null,
    unitId: '1-3',
    media: null,
    anchorCount: 1,
    bindingCount: 1,
    bindingStatus: 'BOUND',
  };
}

function cardBinding(overrides: Partial<AnchoredBindingRuntime> = {}): AnchoredBindingRuntime {
  return {
    bindingId: 'bind-gate-card',
    resourceId: 'act:card:gate-card',
    resourceType: 'card',
    canonicalId: 'ctc:gate-card',
    role: 'COVERS',
    scopeId: '1-3',
    anchor: { kind: 'whole' },
    anchorKey: 'whole',
    appearance: 'first',
    teachingOrder: { unitId: '1-3', unitIndex: 3, stepIndex: null },
    focus: true,
    primary: true,
    provenance: { method: 'carry-forward-exact', matchedLabel: null, source: 'test' },
    ...overrides,
  };
}

describe('resource binding gate', () => {
  const emptyContext = {
    excludedResourceIds: [],
    noAnchorResourceIds: [],
    driftedMediaIds: [],
    unmappedCourseNodes: [],
    ambiguousLabels: [],
    mediaDurations: new Map<string, number>(),
    activeMediaSha: new Map<string, string>(),
    authorityMismatch: null,
    carryForwardGatePassed: true,
  };

  it('fails closed on entry resources, whole multi-knowledge anchors, and authority drift', () => {
    const audio: AnchoredResourceRuntime = {
      resourceId: 'act:audio:1-3',
      resourceType: 'audio',
      title: '音频',
      sourcePath: null,
      unitId: '1-3',
      media: null,
      anchorCount: 0,
      bindingCount: 1,
      bindingStatus: 'BOUND',
    };
    const result = evaluateResourceBindingGate({
      resources: [
        { ...cardResource(), resourceId: 'act:lesson:1-3', resourceType: 'lesson' },
        audio,
      ],
      bindings: [
        cardBinding({
          bindingId: 'bind-audio-whole',
          resourceId: 'act:audio:1-3',
          resourceType: 'audio',
          anchor: { kind: 'whole' },
        }),
      ],
      context: { ...emptyContext, authorityMismatch: 'authority-id-drift' },
    });
    expect(result.passed).toBe(false);
    expect(result.findings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'authority-mismatch',
      'entry-resource-present',
      'multi-knowledge-whole-anchor',
    ]));
  });

  it('fails closed on out-of-range time anchors and media drift', () => {
    const audio: AnchoredResourceRuntime = {
      resourceId: 'act:audio:1-3',
      resourceType: 'audio',
      title: '音频',
      sourcePath: null,
      unitId: '1-3',
      media: {
        mediaId: '1-3-audio',
        runtimePath: 'lessons/1-3/media/1-3-audio.mp3',
        sha256: HASH,
        durationSeconds: 10,
      },
      anchorCount: 1,
      bindingCount: 1,
      bindingStatus: 'BOUND',
    };
    const result = evaluateResourceBindingGate({
      resources: [audio],
      bindings: [cardBinding({
        bindingId: 'bind-audio-time',
        resourceId: 'act:audio:1-3',
        resourceType: 'audio',
        anchor: {
          kind: 'time',
          mediaId: '1-3-audio',
          runtimePath: 'lessons/1-3/media/1-3-audio.mp3',
          mediaSha256: 'b'.repeat(64),
          startSeconds: 0,
          endSeconds: 40,
          label: '0–40s',
        },
        anchorKey: 'time:0-40',
        appearance: 'first',
      })],
      context: {
        ...emptyContext,
        mediaDurations: new Map([['1-3-audio', 10]]),
        activeMediaSha: new Map([['lessons/1-3/media/1-3-audio.mp3', HASH]]),
      },
    });
    expect(result.passed).toBe(false);
    expect(result.findings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'time-anchor-out-of-range',
    ]));
  });

  it('passes a precise card binding', () => {
    const result = evaluateResourceBindingGate({
      resources: [cardResource()],
      bindings: [cardBinding()],
      context: emptyContext,
    });
    expect(result.passed).toBe(true);
    expect(result.status).toBe('passed');
  });
});

describe('resource binding store', () => {
  it('writes and reloads a release without changing the binding hash', () => {
    const repo = mkdtempSync(join(tmpdir(), 'act-binding-store-'));
    const resources = [cardResource()];
    const bindings = [cardBinding()];
    const gate = evaluateResourceBindingGate({
      resources,
      bindings,
      context: {
        excludedResourceIds: [],
        noAnchorResourceIds: [],
        driftedMediaIds: [],
        unmappedCourseNodes: [],
        ambiguousLabels: [],
        mediaDurations: new Map(),
        activeMediaSha: new Map(),
        authorityMismatch: null,
        carryForwardGatePassed: true,
      },
    });
    const resourcesText = resources.map((row) => JSON.stringify(row)).join('\n');
    const bindingsText = bindings.map((row) => JSON.stringify(row)).join('\n');
    const body: ResourceBindingReleaseManifestBody = {
      contract: RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT,
      builderVersion: RESOURCE_BINDING_RELEASE_BUILDER_VERSION,
      scopeId: 'course',
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.37',
      authorityReleaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v0.37-r6',
      authoritySnapshotId: `snap-${HASH}`,
      authoritySnapshotHash: HASH,
      authorityRevisionLabel: 'control-theory-engineering-v0.37-r6',
      bindingRevision: 99,
      prerequisitePublicationId: null,
      carryForwardProjectionId: `proj-${HASH}`,
      carryForwardProjectionHash: HASH,
      activeRuntimeReleaseId: null,
      sourceHashes: {
        anchors: HASH,
        unitScopes: HASH,
        crosswalk: HASH,
        review: HASH,
        courseOrder: HASH,
        activeRuntimeMediaIndex: HASH,
        carryForwardResources: HASH,
        carryForwardBindings: HASH,
        resources: projectionSha256(resourcesText),
        bindings: projectionSha256(bindingsText),
        gate: projectionDigest(gate),
      },
      resourceCount: 1,
      bindingCount: 1,
      canonicalCount: 1,
      unitCount: 1,
      appearanceCounts: { first: 1, revisit: 0, reference: 0 },
      anchorKindCounts: { step: 0, heading: 0, time: 0, section: 0, whole: 1 },
      gateStatus: gate.status,
      gatePassed: gate.passed,
    };
    const bindingHash = projectionDigest(body);
    const built = {
      manifest: {
        ...body,
        bindingReleaseId: 'control-theory-engineering-v0.37-r6-b99',
        bindingHash,
      },
      resources,
      bindings,
      gate,
      audit: {
        contract: RESOURCE_BINDING_AUDIT_CONTRACT,
        bindingReleaseId: 'control-theory-engineering-v0.37-r6-b99',
        resourceCount: 1,
        bindingCount: 1,
        canonicalCount: 1,
        perNodeBindingCount: {
          min: 1, p50: 1, p90: 1, max: 1, nodesAtOrAbove50: 0, nodesAtOrAbove100: 0,
        },
        topFanoutResources: [],
        topBoundNodes: [],
        roleCounts: { COVERS: 1 },
        provenanceCounts: { 'carry-forward-exact': 1 },
        appearanceCounts: { first: 1, revisit: 0, reference: 0 },
        anchorKindCounts: { step: 0, heading: 0, time: 0, section: 0, whole: 1 },
        resourceTypeCounts: { card: 1 },
        baseline: {
          kind: 'none',
          id: null,
          resourceCount: null,
          bindingCount: null,
          canonicalCount: null,
          maxPerNode: null,
        },
      },
    };
    try {
      writeResourceBindingRelease(repo, built);
      writeResourceBindingCurrentPointer(repo, built.manifest, '2026-09-13T00:00:00.000Z');
      const loaded = loadResourceBindingRelease(repo, built.manifest.bindingReleaseId);
      expect(loaded.manifest.bindingHash).toBe(bindingHash);
      expect(loaded.bindings).toEqual(bindings);
      expect(loaded.resources).toEqual(resources);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
