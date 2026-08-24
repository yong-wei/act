import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import baselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import attributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  defaultMicroTutoringOptionAttributions,
  findMicroTutoringOptionAttribution,
  isMicroTutoringOptionAttribution,
  microTutoringOptionAttributionReviewSourceHash,
  type MicroTutoringOptionAttribution,
} from '../micro-tutoring-option-attribution';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const catalogItems = readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
const reviewDecisions = readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl');

describe('micro-tutoring v2 assessment baseline and option attributions', () => {
  it('fixes the reviewed 135-item denominator and stage counts', () => {
    expect(baselineSource.version).toBe('micro-tutoring-assessment-baseline.v2');
    expect(baselineSource.itemCount).toBe(135);
    expect(baselineSource.entries).toHaveLength(135);
    expect(baselineSource.stageCounts).toEqual({
      practice: 54,
      checkpoint: 27,
      remediation: 27,
      readiness: 2,
      'readiness-gate': 25,
    });
    expect(new Set(baselineSource.entries.map((entry) => entry.catalogItemId)).size).toBe(135);
  });

  it('binds every baseline entry to the current catalog and human review', () => {
    const catalogById = new Map(catalogItems.map((item) => [item.catalogItemId, item]));
    const reviewById = new Map(reviewDecisions.map((decision) => [decision.catalogItemId, decision]));
    for (const entry of baselineSource.entries) {
      const item = catalogById.get(entry.catalogItemId);
      const decision = reviewById.get(entry.catalogItemId);
      expect(item).toMatchObject({
        contentHash: entry.contentHash,
        reviewState: 'path-eligible',
        eligibilityState: 'path-eligible',
      });
      expect(decision).toMatchObject({
        decisionKind: 'human-review',
        outcome: 'approved',
        sourceContentHash: entry.contentHash,
        selectedStagePurpose: entry.assessmentStage,
        reviewSourceHash: entry.itemReviewSourceHash,
      });
    }
  });

  it('contains one current v3 attribution for every wrong option and none for correct options', () => {
    expect(attributionSource.version).toBe('micro-tutoring-option-attributions.v3');
    expect(attributionSource.entries).toHaveLength(272);
    const entries = attributionSource.entries as MicroTutoringOptionAttribution[];
    const identities = new Set(entries.map((entry) =>
      `${entry.catalogItemId}\u0000${entry.contentHash}\u0000${entry.optionKey}`));
    expect(identities.size).toBe(entries.length);
    expect(entries.every(isMicroTutoringOptionAttribution)).toBe(true);
    expect(entries.every((entry) =>
      entry.reviewSourceHash === microTutoringOptionAttributionReviewSourceHash(entry))).toBe(true);

    const catalogById = new Map(catalogItems.map((item) => [item.catalogItemId, item]));
    for (const entry of entries) {
      const item = catalogById.get(entry.catalogItemId);
      const option = (item?.questionRefs.options ?? []).find((candidate) => candidate.key === entry.optionKey);
      expect(option?.isCorrect).toBe(false);
    }
  });

  it('keeps sibling misconception, summary and review evidence independent', () => {
    const byItem = new Map<string, MicroTutoringOptionAttribution[]>();
    for (const entry of attributionSource.entries as MicroTutoringOptionAttribution[]) {
      byItem.set(entry.catalogItemId, [...(byItem.get(entry.catalogItemId) ?? []), entry]);
    }
    for (const siblings of byItem.values()) {
      expect(new Set(siblings.map((entry) => entry.misconceptionTag)).size).toBe(siblings.length);
      expect(new Set(siblings.map((entry) => entry.evidenceSummary)).size).toBe(siblings.length);
      expect(new Set(siblings.map((entry) => entry.reviewSourceHash)).size).toBe(siblings.length);
    }
  });

  it('uses v2 by default and resolves the reported checkpoint option exactly', () => {
    const item = catalogItems.find((candidate) =>
      candidate.sourceId === 'stability-margin-frequency-analysis-checkpoint-03');
    expect(item).toBeDefined();
    if (!item) throw new Error('missing checkpoint catalog item');
    const decision = reviewDecisions.find((candidate) => candidate.catalogItemId === item.catalogItemId);
    expect(decision?.reviewSourceHash).toBeTruthy();
    if (!decision?.reviewSourceHash) throw new Error('missing checkpoint review decision');
    expect(defaultMicroTutoringOptionAttributions()).toHaveLength(272);
    expect(findMicroTutoringOptionAttribution({
      catalogItemId: item.catalogItemId,
      contentHash: item.contentHash,
      selectedOptionKey: 'B',
      correctOptionKey: 'C',
      assessmentStage: 'checkpoint',
      itemReviewSourceHash: decision.reviewSourceHash,
      reviewedLearningGoalIds: decision.selectedLearningGoalIds,
      reviewedKnowledgeNodeIds: decision.selectedGraphNodeIds,
      reviewedMisconceptionTags: decision.misconceptionRefs,
    })).toMatchObject({
      assessmentStage: 'checkpoint',
      learningGoalId: 'stability-margin-frequency-analysis',
      optionKey: 'B',
      version: 'micro-tutoring-option-attribution.v3',
    });
  });

  it('rejects v3 records with missing stage or drifted review evidence', () => {
    const [entry] = attributionSource.entries as MicroTutoringOptionAttribution[];
    const { assessmentStage: _assessmentStage, ...missingStage } = entry;
    expect(isMicroTutoringOptionAttribution({
      ...missingStage,
      reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(missingStage),
    })).toBe(false);
    expect(isMicroTutoringOptionAttribution({ ...entry, itemReviewSourceHash: 'sha256:'.padEnd(71, '0') })).toBe(false);
  });

  it('fails closed for missing, duplicate and content-drifted exact identities', () => {
    const entry = (attributionSource.entries as MicroTutoringOptionAttribution[]).find((candidate) =>
      candidate.catalogItemId.endsWith('stability-margin-frequency-analysis-checkpoint-03') &&
      candidate.optionKey === 'B')!;
    const input = {
      catalogItemId: entry.catalogItemId,
      contentHash: entry.contentHash,
      selectedOptionKey: entry.optionKey,
      correctOptionKey: 'C',
      assessmentStage: entry.assessmentStage,
      itemReviewSourceHash: entry.itemReviewSourceHash,
      reviewedLearningGoalIds: [entry.learningGoalId],
      reviewedKnowledgeNodeIds: [entry.knowledgeNodeId],
      reviewedMisconceptionTags: [entry.misconceptionTag],
    };
    expect(findMicroTutoringOptionAttribution({ ...input, entries: [] })).toBeNull();
    expect(findMicroTutoringOptionAttribution({ ...input, entries: [entry, entry] })).toBeNull();
    expect(findMicroTutoringOptionAttribution({
      ...input,
      contentHash: '0'.repeat(64),
      entries: [entry],
    })).toBeNull();
    expect(findMicroTutoringOptionAttribution({
      ...input,
      assessmentStage: 'practice',
      entries: [entry],
    })).toBeNull();
  });
});
