import { describe, expect, it } from 'vitest';

import optionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import practiceBaselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import registrySource from '../../../../course-content/runtime/resource-governance/micro-tutoring-validation-registry.json';
import {
  listMicroTutoringGovernedValidationItems,
  loadMicroTutoringValidationRegistry,
  projectMicroTutoringValidationForLearner,
} from '../micro-tutoring-validation-registry';

describe('micro tutoring validation registry', () => {
  it('loads 135 v2 items as independent same-node validators', () => {
    const loaded = loadMicroTutoringValidationRegistry();
    expect(loaded.issues).toEqual([]);
    expect(loaded.registry?.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
    expect(loaded.registry?.entries).toHaveLength(135);
    expect(loaded.registry?.entries.every((entry) => entry.estimatedMinutes === 2)).toBe(true);
    expect(new Set(loaded.registry?.entries.map((entry) => entry.contentHash)).size).toBe(135);
    expect(new Set(loaded.registry?.entries.map((entry) => entry.sourceId)).size).toBe(135);
    expect(loaded.registry?.entries.map((entry) => entry.catalogItemId).sort()).toEqual(
      [...practiceBaselineSource.entries.map((entry) => entry.catalogItemId)].sort(),
    );

    const pairs = new Set(
      optionAttributionSource.entries.map((entry) => `${entry.knowledgeNodeId}\0${entry.misconceptionTag}`),
    );
    const covered = new Set(
      loaded.registry!.entries.flatMap((entry) =>
        entry.relations.map((relation) => `${entry.knowledgeNodeId}\0${relation.misconceptionTag}`)),
    );
    expect(covered).toEqual(pairs);
  });

  it('selects a different same-node practice item and fails closed on identity reuse', () => {
    const sample = optionAttributionSource.entries.find((entry) =>
      entry.knowledgeNodeId === 'kn:autocontrol:controller-correction')!;
    const source = practiceBaselineSource.entries.find((entry) =>
      entry.catalogItemId.includes('control-correction-practice-01'))!;
    const sourceId = 'control-correction-practice-01';
    const matches = listMicroTutoringGovernedValidationItems({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      sourceQuestionId: sourceId,
      sourceContentHash: source.contentHash,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((item) => item.questionId !== sourceId)).toBe(true);
    expect(matches.every((item) => item.contentHash !== source.contentHash)).toBe(true);
    expect(matches[0]?.id).toBe('micro-tutoring-validation:control-correction-checkpoint-01');
    expect(matches[0]?.itemRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(matches)).not.toContain('independenceRationale');
    expect(JSON.stringify(projectMicroTutoringValidationForLearner(matches[0]!))).not.toContain('purposeRationale');

    expect(listMicroTutoringGovernedValidationItems({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: 'misconception:unknown',
      sourceQuestionId: sourceId,
      sourceContentHash: source.contentHash,
    })).toEqual([]);
    expect(listMicroTutoringGovernedValidationItems({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      sourceQuestionId: sourceId,
      sourceContentHash: source.contentHash,
      authorityRows: [{
        id: 'other',
        questionId: 'other',
        contentHash: 'b'.repeat(64),
      }],
    })).toEqual([]);
    expect(listMicroTutoringGovernedValidationItems({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      sourceQuestionId: sourceId,
      sourceContentHash: source.contentHash,
      authorityRows: matches.map((item) => ({
        id: item.id,
        questionId: item.questionId,
        contentHash: item.contentHash,
        metadata: { remediationValidation: { learnerVisible: false } },
      })),
    })).toEqual([]);
  });

  it('excludes a renamed candidate that reuses the source content hash', () => {
    const sample = optionAttributionSource.entries[0];
    const source = registrySource.entries[0];
    const clone = {
      ...source,
      id: 'micro-tutoring-validation:cloned',
      catalogItemId: `${source.catalogItemId}-clone`,
      sourceId: `${source.sourceId}-clone`,
      studentQuestionRef: {
        ...source.studentQuestionRef,
        catalogItemId: `${source.catalogItemId}-clone`,
        sourceId: `${source.sourceId}-clone`,
      },
    };
    const loaded = loadMicroTutoringValidationRegistry({
      ...registrySource,
      entries: [source, clone, ...registrySource.entries.slice(1)],
    });
    expect(loaded.issues.map((issue) => issue.code)).toContain('DUPLICATE_CONTENT');

    const selected = listMicroTutoringGovernedValidationItems({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      sourceQuestionId: `${source.sourceId}-other`,
      sourceContentHash: source.contentHash,
    });
    expect(selected.every((item) => item.contentHash !== source.contentHash)).toBe(true);
  });

  it('rejects a forged source and a private privacy level', () => {
    const forged = loadMicroTutoringValidationRegistry({
      ...registrySource,
      source: 'forged-source',
    });
    expect(forged.issues).toContainEqual({ code: 'SOURCE_DRIFT', ref: 'registry-source' });
    expect(forged.registry).toBeNull();

    const privateEntry = {
      ...registrySource.entries[0],
      privacyLevel: 'teacher-scoped',
    };
    const privateRegistry = loadMicroTutoringValidationRegistry({
      ...registrySource,
      entries: [privateEntry],
    });
    expect(privateRegistry.issues.map((issue) => issue.code)).toContain('PRIVACY_INVALID');
  });

  it('fails closed when an approved assessment item has no validation-purpose decision', () => {
    const candidate = { ...registrySource.entries[0], purposeDecision: null };
    const loaded = loadMicroTutoringValidationRegistry({
      ...registrySource,
      entries: [candidate, ...registrySource.entries.slice(1)],
    });
    expect(loaded.registry).toBeNull();
    expect(loaded.issues.map((issue) => issue.code)).toContain('PURPOSE_INVALID');
  });
});
