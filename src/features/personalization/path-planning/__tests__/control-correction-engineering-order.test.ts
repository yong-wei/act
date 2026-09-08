/**
 * control-correction goal consumes adopted engineering learning order (#2059).
 */

import { describe, expect, it } from 'vitest';

import {
  planActPrerequisitePath,
  type ActPathPlannerInput,
  type ActPathProjectedResourceCandidate,
} from '@/features/personalization/path-planning/internal/prerequisite-planner';

const AUTHORITY = 'ctr:release:eng-fixture-v1';
const PROJECTION = 'ctr:projection:teaching-core-v1';
const SCOPE = 'act-control-theory-core';
const TIME_DOMAIN = 'control-correction:time-domain-targets';
const ROOT_LOCUS = 'control-correction:root-locus-design';

function resource(
  resourceId: string,
  canonicalId: string,
): ActPathProjectedResourceCandidate {
  return {
    resourceId,
    resourceType: 'lesson',
    resourceNodeId: `rn:${resourceId}`,
    registryId: resourceId,
    launchTarget: `/learn/${resourceId}`,
    accessible: true,
    projectionStatus: 'BOUND',
    bindingStatus: 'BOUND',
    primary: true,
    canonicalId,
  };
}

function input(): ActPathPlannerInput {
  return {
    goalCanonicalId: ROOT_LOCUS,
    projection: {
      authorityReleaseId: AUTHORITY,
      projectionId: PROJECTION,
      projectionHash: 'proj-hash-1',
      scopeId: SCOPE,
      prerequisitePublicationId: 'prereq-pub-1',
      prerequisiteGraphIdentity: 'act-teaching-prerequisite-edges/v1',
    },
    prerequisites: [
      {
        edgeId: 'edge:engineering-order',
        sourceNodeId: TIME_DOMAIN,
        targetNodeId: ROOT_LOCUS,
        strength: 'REQUIRED',
        layer: 'ACT_TEACHING',
        relationType: 'PREREQUISITE',
        evidenceRefs: ['engineering-relation:ctkg:m4-u2u5:prerequisite:fixture'],
        scopeId: SCOPE,
        candidateOrigin: 'ENGINEERING_RELATION',
      },
    ],
    coreNodes: [
      {
        canonicalId: TIME_DOMAIN,
        pathEligible: true,
        cardPolicy: 'optional',
        moduleId: 'control-correction',
        scopeId: SCOPE,
        projectionStatus: 'PROJECTED',
        rationale: 'time-domain targets',
      },
      {
        canonicalId: ROOT_LOCUS,
        pathEligible: true,
        cardPolicy: 'optional',
        moduleId: 'control-correction',
        scopeId: SCOPE,
        projectionStatus: 'PROJECTED',
        rationale: 'root-locus design',
      },
    ],
    resources: [
      resource('lesson:time-domain', TIME_DOMAIN),
      resource('lesson:root-locus', ROOT_LOCUS),
    ],
    bindings: [
      {
        bindingId: `bind:lesson:time-domain:${TIME_DOMAIN}`,
        resourceId: 'lesson:time-domain',
        canonicalId: TIME_DOMAIN,
        role: 'COVERS',
        scopeId: SCOPE,
        primary: true,
      },
      {
        bindingId: `bind:lesson:root-locus:${ROOT_LOCUS}`,
        resourceId: 'lesson:root-locus',
        canonicalId: ROOT_LOCUS,
        role: 'COVERS',
        scopeId: SCOPE,
        primary: true,
      },
    ],
    masteredCanonicalIds: [],
  };
}

describe('control-correction engineering learning order (#2059)', () => {
  it('lets adopted engineering order rank the control-correction path and explain its source', () => {
    const result = planActPrerequisitePath(input());
    expect(result.status).toBe('ready');
    expect(result.nodes.map((n) => n.canonicalId)).toEqual([TIME_DOMAIN, ROOT_LOCUS]);
    expect(result.diagnostics.engineeringLearningOrderConstraintCount).toBe(1);
    expect(result.diagnostics.teachingOrderConstraintCount).toBe(0);
    expect(result.nodes[1]?.rationale.orderSourceByPrerequisite).toEqual({
      [TIME_DOMAIN]: 'engineering-learning-order',
    });
  });
});
