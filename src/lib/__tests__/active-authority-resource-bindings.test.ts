import { describe, expect, it } from 'vitest';

import {
  attachActiveAuthorityResourceBindings,
  projectAuthorityNodeResourceBindings,
} from '@/lib/authority-domain-shards/resource-bindings';
import type { AuthorityNodeDetailShard } from '@/lib/authority-domain-shards/contracts';
import type {
  TeachingBindingRuntime,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';

function resource(overrides: Partial<TeachingResourceRuntime> & Pick<TeachingResourceRuntime, 'resourceId' | 'resourceType' | 'title'>): TeachingResourceRuntime {
  return {
    projectionMode: 'OPTIONAL',
    scopeId: 'course-package:1-1',
    sourcePath: '/tmp/secret/handout.md',
    legacyCrosswalkRef: null,
    bindingCount: 1,
    bindingStatus: 'BOUND',
    projectionStatus: 'BOUND',
    bindingDigest: 'a'.repeat(64),
    ...overrides,
  };
}

function binding(overrides: Partial<TeachingBindingRuntime> & Pick<TeachingBindingRuntime, 'bindingId' | 'resourceId' | 'canonicalId' | 'role'>): TeachingBindingRuntime {
  return {
    scopeId: 'course-package:1-1',
    sourcePath: '/tmp/secret/binding.json',
    primary: true,
    rationale: null,
    ...overrides,
  };
}

describe('active Authority resource binding projection', () => {
  it('projects course launch descriptors without canonical IDs or source paths', () => {
    const projected = projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      resources: [
        resource({
          resourceId: 'act:lesson:1-1',
          resourceType: 'lesson',
          title: '看见全貌',
        }),
      ],
      bindings: [
        binding({
          bindingId: 'bind-1',
          resourceId: 'act:lesson:1-1',
          canonicalId: 'ctc:modeling-node',
          role: 'EXPLAINS',
        }),
      ],
    });
    expect(projected).toEqual({
      state: 'available',
      items: [
        expect.objectContaining({
          title: '看见全貌',
          bindingRole: '讲解',
          resourceKind: '课程',
          availability: 'available',
          launch: {
            kind: 'registry-resource',
            href: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
          },
        }),
      ],
    });
    expect(JSON.stringify(projected)).not.toContain('ctc:modeling-node');
    expect(JSON.stringify(projected)).not.toContain('/tmp/secret');
    expect(JSON.stringify(projected)).not.toContain('act:lesson:1-1');
  });

  it('omits guessed canonical routes and reports an honest empty state', () => {
    expect(projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      resources: [],
      bindings: [],
    })).toEqual({
      state: 'empty',
      message: '暂无已授权系统资源。',
    });

    const unavailable = projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      resources: [
        resource({
          resourceId: 'act:textbook:dorf',
          resourceType: 'textbook',
          title: '教材章节',
        }),
      ],
      bindings: [
        binding({
          bindingId: 'bind-2',
          resourceId: 'act:textbook:dorf',
          canonicalId: 'ctc:modeling-node',
          role: 'COVERS',
        }),
      ],
    });
    expect(unavailable).toEqual({
      state: 'available',
      items: [
        expect.objectContaining({
          title: '教材章节',
          bindingRole: '引用',
          resourceKind: '教材',
          availability: 'unavailable',
          launch: { kind: 'unavailable', href: null },
        }),
      ],
    });
    expect(JSON.stringify(unavailable)).not.toContain('act:textbook:dorf');
  });

  it('keeps base detail usable when teaching identity is not matched', () => {
    const shard = {
      shardClass: 'node-detail',
      envelope: {
        contract: 'act-authority-shard-envelope/v1',
        authority: {
          snapshotId: 'snap-1',
          snapshotHash: 'a'.repeat(64),
          releaseId: 'release-1',
          releaseSetId: 'set-1',
          activationId: 'activation-1',
          activationHash: 'b'.repeat(64),
          projectionId: null,
          projectionHash: null,
        },
        catalog: { catalogId: 'catalog-1', catalogHash: 'c'.repeat(64), catalogVersion: 'v1' },
        teaching: { status: 'unavailable', projectionId: null, projectionHash: null, teachingCacheFamily: null },
        match: { authority: true, catalog: true, teaching: false },
      },
      node: {
        id: 'node-1',
        canonicalType: 'DomainConcept',
        label: '节点',
        description: '说明仍可用',
        teachingFields: {},
        governance: { reviewStatus: null, publicationStatus: null, lifecycleStatus: null },
        sources: [],
        media: { cardAvailable: false, infographAvailable: false },
        semanticSupport: { supported: true, readOnly: true as const },
      },
    } as unknown as AuthorityNodeDetailShard;
    expect(attachActiveAuthorityResourceBindings(shard)).toEqual({
      state: 'unavailable',
      message: '当前系统资源暂时不可用。',
    });
    expect(shard.node.label).toBe('节点');
    expect(shard.node.description).toBe('说明仍可用');
  });

  it('omits student launch hrefs that resolve onto teacher or admin surfaces', () => {
    const projected = projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      viewerRole: 'STUDENT',
      resources: [
        resource({
          resourceId: 'act:lesson:1-1',
          resourceType: 'lesson',
          title: '看见全貌',
        }),
      ],
      bindings: [
        binding({
          bindingId: 'bind-1',
          resourceId: 'act:lesson:1-1',
          canonicalId: 'ctc:modeling-node',
          role: 'EXPLAINS',
        }),
      ],
    });
    expect(projected.state).toBe('available');
    if (projected.state === 'available') {
      expect(projected.items[0]?.launch.href).not.toMatch(/^\/(?:teacher|admin)(?:\/|$)/);
    }
  });
});
