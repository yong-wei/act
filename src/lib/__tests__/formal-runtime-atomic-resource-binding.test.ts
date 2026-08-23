import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FIXTURE_AUTHORITY,
  admitFormalBinding,
  applyAtomDisposition,
  assertFormalPreflight,
  assertNotForbiddenIdentity,
  assertQualified,
  buildCandidateInventory,
  buildFormalResourceEnvelope,
  buildMediaAtoms,
  buildQuestionAtom,
  buildTextAtoms,
  classifyReleaseEntries,
  closeIncludedResource,
  deriveMediaEnds,
  fixtureEntries,
  historicalV2SatisfiesFormalGate,
  launcherConsumesAnchor,
  migrateLegacyBinding,
  projectFormalResource,
  projectionLeaksGovernance,
  qualifyPipeline,
  questionBindingStale,
  rebuildFrozenQualificationReceipt,
  resolveCourseMediaTranscript,
  resolveIntroTranscript,
  retainUnchangedTextAtoms,
  stampBindingsWithEnvelope,
  visualFamilyFor,
} from '@/lib/formal-runtime-atomic-resource-binding';
import { projectionDigest } from '@/lib/formal-runtime-atomic-resource-binding';

function mappingReceipt() {
  return rebuildFrozenQualificationReceipt('canonical-mapping', 'map/v1', 'cfg-map');
}

describe('formal-runtime-atomic-resource-binding', () => {
  it('freezes the candidate denominator and ignores working-tree extras', () => {
    const first = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
      workingTreeExtras: ['scratch/local.mp4'],
    });
    const second = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    expect(first.candidates).toHaveLength(3);
    expect(first.candidateHash).toBe(second.candidateHash);
    expect(first.candidates.every((row) => row.disposition === 'EXCLUDED')).toBe(true);
    expect(() => assertNotForbiddenIdentity('filename')).toThrow(/cannot establish/);
    expect(() => assertNotForbiddenIdentity('signed-url')).toThrow(/cannot establish/);
  });

  it('fails completeness when a frozen entry is unclassified', () => {
    expect(() => classifyReleaseEntries([
      {
        entryId: 'mystery',
        path: 'mystery.bin',
        source: { kind: 'git-blob', gitObjectId: 'a'.repeat(40), contentSha256: 'b'.repeat(64) },
        classification: 'maybe' as 'resource',
      },
    ])).toThrow(/neither a registered resource nor an explicit non-resource/);
  });

  it('derives media paragraph ends and rejects invalid timing', () => {
    expect(deriveMediaEnds({ starts: [0, 4.5], durationSeconds: 10 })).toEqual([4.5, 10]);
    expect(() => deriveMediaEnds({ starts: [0, 0], durationSeconds: 10 })).toThrow(/duplicate/);
    expect(() => deriveMediaEnds({ starts: [8], durationSeconds: 5 })).toThrow(/out of range/);
  });

  it('includes a resource with one BOUND atom and one NON_TEACHING intro', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const video = inventory.candidates.find((row) => row.subtype === 'video')!;
    const atoms = buildMediaAtoms({
      resource: video,
      scriptId: 'intro-script',
      scriptHash: 's'.repeat(64),
      durationSeconds: 12,
      paragraphs: [
        { paragraphId: 'intro', body: 'welcome', startSeconds: 0 },
        { paragraphId: 'explain', body: 'closed loop', startSeconds: 3 },
      ],
    });
    const intro = applyAtomDisposition(atoms[0], 'NON_TEACHING', ['evidence:intro-bumper']);
    const explain = applyAtomDisposition(atoms[1], 'BOUND', ['evidence:identity-crosswalk']);
    const receipt = mappingReceipt();
    const binding = admitFormalBinding({
      candidate: {
        resourceId: video.resourceId,
        atomId: explain.atomId,
        canonicalId: 'ctc:a',
        role: 'EXPLAINS',
        scopeId: 'act-control-theory',
        method: 'identity',
        confidence: 0.99,
        evidenceRefs: ['evidence:identity-crosswalk'],
      },
      atom: explain,
      mappingReceipt: receipt,
      mappingVersion: 'map/v1',
      mappingConfig: 'cfg-map',
    });
    const provisionallyClosed = closeIncludedResource({
      candidate: video,
      atoms: [intro, explain],
      bindings: [binding],
    });
    const others = inventory.candidates.filter((row) => row.resourceId !== video.resourceId);
    const envelope = buildFormalResourceEnvelope({
      releaseId: 'rel-formal-test',
      sourceRevision: 'a'.repeat(40),
      treeSha256: 'f'.repeat(64),
      authority: FIXTURE_AUTHORITY,
      courseScopeId: 'act-control-theory',
      candidates: [provisionallyClosed, ...others],
      bindings: [binding],
      qualifications: [receipt],
    });
    const stamped = stampBindingsWithEnvelope([binding], envelope.envelopeHash);
    const included = closeIncludedResource({
      candidate: video,
      atoms: [intro, explain],
      bindings: stamped,
      envelopeHash: envelope.envelopeHash,
    });
    assertFormalPreflight({
      envelope,
      candidates: [included, ...others],
      bindings: stamped,
      qualifications: [receipt],
    });
    expect(included.disposition).toBe('INCLUDED');
    expect(stamped[0]?.envelopeHash).toBe(envelope.envelopeHash);
    expect(intro.disposition).toBe('NON_TEACHING');
  });

  it('excludes a teaching resource with no bound atom and keeps it in the denominator', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const card = inventory.candidates.find((row) => row.subtype === 'card')!;
    const atoms = buildTextAtoms({
      resource: card,
      paragraphs: [{ paragraphId: 'p1', body: 'definition' }],
    });
    const closed = closeIncludedResource({
      candidate: card,
      atoms,
      bindings: [],
    });
    expect(closed.disposition).toBe('EXCLUDED');
    expect(inventory.candidateHash).toBe(buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    }).candidateHash);
  });

  it('does not let label/alias, OPTIONAL, or legacy NONE become formal BOUND', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const video = inventory.candidates[0];
    const atoms = buildMediaAtoms({
      resource: video,
      scriptId: 'script',
      scriptHash: 's'.repeat(64),
      durationSeconds: 8,
      paragraphs: [{ paragraphId: 'p', body: 'x', startSeconds: 0 }],
    });
    const receipt = mappingReceipt();
    expect(() => admitFormalBinding({
      candidate: {
        resourceId: video.resourceId,
        atomId: atoms[0].atomId,
        canonicalId: 'ctc:a',
        role: 'EXPLAINS',
        scopeId: 'act-control-theory',
        method: 'label-alias',
        confidence: 1,
        evidenceRefs: ['evidence:identity-crosswalk'],
      },
      atom: atoms[0],
      mappingReceipt: receipt,
      mappingVersion: 'map/v1',
      mappingConfig: 'cfg-map',
    })).toThrow(/candidates only/);
    expect(migrateLegacyBinding({ projectionMode: 'OPTIONAL', method: 'identity' })).toBe('candidate');
    expect(migrateLegacyBinding({ projectionMode: 'NONE', method: 'identity' })).toBe('candidate');
    expect(closeIncludedResource({
      candidate: { ...video, deliveryMode: 'OPTIONAL' },
      atoms: [applyAtomDisposition(atoms[0], 'BOUND', ['evidence:identity-crosswalk'])],
      bindings: [],
    }).disposition).toBe('EXCLUDED');
  });

  it('uses production script for intro-video and qualified ASR only without a script', () => {
    const intro = resolveIntroTranscript({
      mediaHash: 'b'.repeat(64),
      verifiedMediaHash: 'b'.repeat(64),
      scriptId: 'intro-1',
      scriptHash: 's'.repeat(64),
      designSourceHash: 'd'.repeat(64),
      asrOutput: 'ignored asr',
    });
    expect(intro.authority).toBe('production-script');
    const asr = rebuildFrozenQualificationReceipt('asr', 'asr/v1', 'cfg-asr');
    const seg = rebuildFrozenQualificationReceipt('segmentation', 'seg/v1', 'cfg-seg');
    const align = rebuildFrozenQualificationReceipt('time-alignment', 'ta/v1', 'cfg-ta');
    expect(resolveCourseMediaTranscript({
      hasProductionScript: false,
      asrReceipt: asr,
      segmentationReceipt: seg,
      alignmentReceipt: align,
      versions: { asr: 'asr/v1', segmentation: 'seg/v1', alignment: 'ta/v1' },
      configs: { asr: 'cfg-asr', segmentation: 'cfg-seg', alignment: 'cfg-ta' },
    })).toBe('asr');
  });

  it('invalidates changed questions and retains unchanged text atoms', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const card = inventory.candidates.find((row) => row.subtype === 'card')!;
    const previous = buildTextAtoms({
      resource: card,
      paragraphs: [
        { paragraphId: 'p1', body: 'stable' },
        { paragraphId: 'p2', body: 'old' },
      ],
    });
    const next = buildTextAtoms({
      resource: card,
      paragraphs: [
        { paragraphId: 'p1', body: 'stable' },
        { paragraphId: 'p2', body: 'new' },
      ],
    });
    const retained = retainUnchangedTextAtoms(previous, next);
    expect(retained[0].atomId).toBe(previous[0].atomId);
    expect(retained[1].atomId).not.toBe(previous[1].atomId);
    const question = buildQuestionAtom({
      resource: inventory.candidates.find((row) => row.subtype === 'exercise')!,
      questionId: 'q1',
      stem: 'what is k',
      options: ['1', '2'],
      answer: '1',
      explanation: 'gain',
    });
    expect(questionBindingStale({
      previousHash: question.contentSha256,
      stem: 'what is k now',
      options: ['1', '2'],
      answer: '1',
      explanation: 'gain',
      hashOf: projectionDigest,
    })).toBe(true);
  });

  it('projects only safe fields for an included current envelope and keeps historical v2 ungated', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const video = inventory.candidates.find((row) => row.subtype === 'video')!;
    const atoms = buildMediaAtoms({
      resource: video,
      scriptId: 'script',
      scriptHash: 's'.repeat(64),
      durationSeconds: 6,
      paragraphs: [{ paragraphId: 'p', body: 'body', startSeconds: 0 }],
    });
    const bound = applyAtomDisposition(atoms[0], 'BOUND', ['evidence:identity-crosswalk']);
    const receipt = mappingReceipt();
    const others = inventory.candidates.filter((row) => row.resourceId !== video.resourceId);
    const binding = admitFormalBinding({
      candidate: {
        resourceId: video.resourceId,
        atomId: bound.atomId,
        canonicalId: 'ctc:a',
        role: 'EXPLAINS',
        scopeId: 'act-control-theory',
        method: 'identity',
        confidence: 0.99,
        evidenceRefs: ['evidence:identity-crosswalk'],
      },
      atom: bound,
      mappingReceipt: receipt,
      mappingVersion: 'map/v1',
      mappingConfig: 'cfg-map',
    });
    const provisionallyClosed = closeIncludedResource({
      candidate: video,
      atoms: [bound],
      bindings: [binding],
    });
    const sealed = buildFormalResourceEnvelope({
      releaseId: 'rel-formal-test',
      sourceRevision: 'a'.repeat(40),
      treeSha256: 'f'.repeat(64),
      authority: FIXTURE_AUTHORITY,
      courseScopeId: 'act-control-theory',
      candidates: [provisionallyClosed, ...others],
      bindings: [binding],
      qualifications: [receipt],
    });
    const stamped = stampBindingsWithEnvelope([binding], sealed.envelopeHash);
    const closed = closeIncludedResource({
      candidate: video,
      atoms: [bound],
      bindings: stamped,
      envelopeHash: sealed.envelopeHash,
    });
    assertFormalPreflight({
      envelope: sealed,
      candidates: [closed, ...others],
      bindings: stamped,
      qualifications: [receipt],
    });
    const projected = projectFormalResource({
      title: 'Intro clip',
      candidate: closed,
      atom: bound,
      binding: stamped[0]!,
      envelope: sealed,
      activeEnvelope: sealed,
    });
    expect(projected.visualFamily).toBe('media');
    expect(visualFamilyFor('exercise')).toBe('exercise');
    expect(projectionLeaksGovernance(projected)).toBe(false);
    expect(historicalV2SatisfiesFormalGate(false)).toBe(false);
    expect(launcherConsumesAnchor({ subtype: 'video', anchorKind: 'media-paragraph' })).toBe(true);
    expect(launcherConsumesAnchor({ subtype: 'card', anchorKind: 'media-paragraph' })).toBe(false);
  });

  it('rejects sealed close and preflight until bindings carry the sealed envelope hash', () => {
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    const video = inventory.candidates.find((row) => row.subtype === 'video')!;
    const atoms = buildMediaAtoms({
      resource: video,
      scriptId: 'script',
      scriptHash: 's'.repeat(64),
      durationSeconds: 6,
      paragraphs: [{ paragraphId: 'p', body: 'body', startSeconds: 0 }],
    });
    const bound = applyAtomDisposition(atoms[0], 'BOUND', ['evidence:identity-crosswalk']);
    const receipt = mappingReceipt();
    const binding = admitFormalBinding({
      candidate: {
        resourceId: video.resourceId,
        atomId: bound.atomId,
        canonicalId: 'ctc:a',
        role: 'EXPLAINS',
        scopeId: 'act-control-theory',
        method: 'identity',
        confidence: 0.99,
        evidenceRefs: ['evidence:identity-crosswalk'],
      },
      atom: bound,
      mappingReceipt: receipt,
      mappingVersion: 'map/v1',
      mappingConfig: 'cfg-map',
    });
    const provisionallyClosed = closeIncludedResource({
      candidate: video,
      atoms: [bound],
      bindings: [binding],
    });
    const others = inventory.candidates.filter((row) => row.resourceId !== video.resourceId);
    const envelope = buildFormalResourceEnvelope({
      releaseId: 'rel-formal-test',
      sourceRevision: 'a'.repeat(40),
      treeSha256: 'f'.repeat(64),
      authority: FIXTURE_AUTHORITY,
      courseScopeId: 'act-control-theory',
      candidates: [provisionallyClosed, ...others],
      bindings: [binding],
      qualifications: [receipt],
    });
    expect(closeIncludedResource({
      candidate: video,
      atoms: [bound],
      bindings: [binding],
      envelopeHash: envelope.envelopeHash,
    }).disposition).toBe('EXCLUDED');
    expect(() => assertFormalPreflight({
      envelope,
      candidates: [provisionallyClosed, ...others],
      bindings: [binding],
      qualifications: [receipt],
    })).toThrow(/not stamped with the sealed envelope/);
    const stamped = stampBindingsWithEnvelope([binding], envelope.envelopeHash);
    expect(closeIncludedResource({
      candidate: video,
      atoms: [bound],
      bindings: stamped,
      envelopeHash: envelope.envelopeHash,
    }).disposition).toBe('INCLUDED');
  });

  it('rebuilds qualification receipts from frozen outputs and rejects caller-mutated hashes', () => {
    const honest = mappingReceipt();
    assertQualified(honest, 'canonical-mapping', 'map/v1', 'cfg-map');
    const forgedOutput = qualifyPipeline({
      pipelineKind: 'canonical-mapping',
      pipelineVersion: 'map/v1',
      pipelineConfigDigest: 'cfg-map',
      gold: [
        { id: 'map-bound', expected: 'admit' },
        { id: 'map-label', expected: 'exclude' },
      ],
      holdout: [{ id: 'map-holdout', expected: 'admit' }],
      admittedGoldIds: ['map-bound'],
      admittedHoldoutIds: ['map-holdout'],
      output: { mapping: ['forged:x'] },
    });
    expect(forgedOutput.receiptId).not.toBe(honest.receiptId);
    expect(() => assertQualified(forgedOutput, 'canonical-mapping', 'map/v1', 'cfg-map'))
      .toThrow(/not qualified/);
    const swappedHash = { ...honest, outputHash: forgedOutput.outputHash };
    expect(() => assertQualified(swappedHash, 'canonical-mapping', 'map/v1', 'cfg-map'))
      .toThrow(/not qualified/);
    const inventory = buildCandidateInventory({
      courseScopeId: 'act-control-theory',
      entries: fixtureEntries(),
    });
    expect(() => assertFormalPreflight({
      envelope: buildFormalResourceEnvelope({
        releaseId: 'rel-formal-test',
        sourceRevision: 'a'.repeat(40),
        treeSha256: 'f'.repeat(64),
        authority: FIXTURE_AUTHORITY,
        courseScopeId: 'act-control-theory',
        candidates: inventory.candidates,
        bindings: [],
        qualifications: [swappedHash],
      }),
      candidates: inventory.candidates,
      bindings: [],
      qualifications: [swappedHash],
    })).toThrow(/drifted from frozen pipeline output/);
  });

  it('does not mutate production selectors', () => {
    const current = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/runtime/knowledge/authority-domain-shards/current.json',
    ), 'utf8'));
    expect(current.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(current.teachingProjectionId).toBeNull();
  });
});
