import { describe, expect, it } from 'vitest';

import optionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import v1OptionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions.json';
import v1ProjectionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-resource-projection.json';
import projectionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-resource-projection-v2.json';
import { parseMicroTutoringLearningAction } from '../micro-tutoring-learning-actions';
import {
  listMicroTutoringGovernedResources,
  loadMicroTutoringResourceProjection,
} from '../micro-tutoring-resource-registry';

describe('micro tutoring resource projection', () => {
  it('loads the published projection for every option-attribution node/tag pair', () => {
    const loaded = loadMicroTutoringResourceProjection();
    expect(loaded.issues).toEqual([]);
    expect(loaded.projection?.entries).toHaveLength(9);

    const pairs = new Set(
      optionAttributionSource.entries.map((entry) => `${entry.knowledgeNodeId}\0${entry.misconceptionTag}`),
    );
    const covered = new Set(
      loaded.projection!.entries.flatMap((entry) =>
        entry.relations.map((relation) => `${entry.knowledgeNodeId}\0${relation.misconceptionTag}`)),
    );
    expect(covered).toEqual(pairs);
    expect(loaded.projection!.entries.every((entry) => entry.estimatedMinutes <= 8)).toBe(true);
    expect(loaded.projection!.entries.every((entry) => entry.launchTarget.startsWith('/interactive-learning/resources/'))).toBe(true);
  });

  it('selects a stable resource by node and misconception and fails closed on mismatches', () => {
    const sample = optionAttributionSource.entries[0];
    const matches = listMicroTutoringGovernedResources({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.actionPath.startsWith('/')).toBe(true);
    expect(matches[0]?.actionId).toBeTruthy();

    expect(listMicroTutoringGovernedResources({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: 'misconception:unknown',
    })).toEqual([]);
    expect(listMicroTutoringGovernedResources({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      authorityRows: [{ id: 'other', registryId: 'other', teacherOnly: false }],
    })).toEqual([]);
    expect(listMicroTutoringGovernedResources({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      authorityRows: [{
        id: matches[0]!.registryId,
        registryId: matches[0]!.registryId,
        teacherOnly: false,
        config: { resourceNodePlanning: { privacyLevel: 'teacher-scoped' } },
      }],
    })).toEqual([]);
    expect(listMicroTutoringGovernedResources({
      knowledgeNodeId: sample.knowledgeNodeId,
      misconceptionTag: sample.misconceptionTag,
      captureRevision: 'a'.repeat(40),
      authorityRows: [{
        id: matches[0]!.registryId,
        registryId: matches[0]!.registryId,
        teacherOnly: false,
        config: { resourceNodePlanning: { privacyLevel: 'student-visible' } },
      }],
    })).toEqual([]);
  });

  it('rejects a forged source, unknown registry and passive-only action', () => {
    const forged = loadMicroTutoringResourceProjection({
      ...projectionSource,
      source: 'forged-source',
    });
    expect(forged.issues).toContainEqual({ code: 'SOURCE_DRIFT', ref: 'projection-source' });
    expect(forged.projection).toBeNull();

    const unknownRegistry = {
      ...projectionSource.entries[0],
      registryId: 'not-a-registered-resource',
      teachingResourceRef: 'registry:not-a-registered-resource',
    };
    const unknown = loadMicroTutoringResourceProjection({
      ...projectionSource,
      entries: [unknownRegistry],
    });
    expect(unknown.issues.map((issue) => issue.code)).toContain('REGISTRY_UNKNOWN');

    const v1 = loadMicroTutoringResourceProjection(v1ProjectionSource, v1OptionAttributionSource);
    expect(v1.issues).toEqual([]);
    expect(v1.projection?.version).toBe('micro-tutoring-resource-projection.v1');
    expect(v1.projection?.entries).toHaveLength(9);

    const passive = parseMicroTutoringLearningAction({
      id: 'action-1',
      version: 'micro-tutoring-learning-action.v1',
      type: 'reading-explanation',
      learningObjective: '了解节点',
      studentInstruction: '打开页面即可',
      completionCondition: '仅打开页面',
      estimatedMinutes: 6,
    });
    expect(passive.issues.map((issue) => issue.code)).toContain('ACTION_PASSIVE_ONLY');
    expect(passive.action).toBeNull();
  });
});
