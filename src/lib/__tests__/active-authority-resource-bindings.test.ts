import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { join } from 'node:path';

import { loadNodeDetailShard } from '@/lib/authority-domain-shards';
import {
  attachActiveAuthorityResourceBindings,
  humanTitleFromResourceId,
  projectAuthorityNodeResourceBindings,
} from '@/lib/authority-domain-shards/resource-bindings';
import * as teachingProjectionStore from '@/lib/teaching-projection/store';
import type { AuthorityNodeDetailShard } from '@/lib/authority-domain-shards/contracts';
import type {
  TeachingBindingRuntime,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';
import { toResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';

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

  it('fills a human title from resourceId instead of dropping the binding', () => {
    const projected = projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      resources: [
        resource({
          resourceId: 'act:audio:3-2',
          resourceType: 'audio',
          title: null,
        }),
      ],
      bindings: [
        binding({
          bindingId: 'bind-audio',
          resourceId: 'act:audio:3-2',
          canonicalId: 'ctc:modeling-node',
          role: 'EXPLAINS',
        }),
      ],
    });
    expect(humanTitleFromResourceId('act:audio:3-2')).toBe('3-2 音频');
    expect(projected).toEqual(expect.objectContaining({
      state: 'available',
      items: [expect.objectContaining({
        title: '3-2 音频',
        resourceKind: '音频',
        availability: 'available',
        launch: {
          kind: 'registry-resource',
          href: '/interactive-learning/courses/unit-3-2-routh-stability-boundary',
        },
      })],
    }));
  });

  it('keeps cards in shell and resolves governed textbook sections', () => {
    const textbookId = `act:textbook-section:${toResourceIdToken(
      'dorf-modern-control-systems:chapter-01:section-01',
      'sourceAnchorId',
    )}`;
    const projected = projectAuthorityNodeResourceBindings({
      nodeId: 'ctc:modeling-node',
      resources: [
        resource({ resourceId: 'act:card:safe-card', resourceType: 'card', title: '稳定性卡片' }),
        resource({ resourceId: textbookId, resourceType: 'textbook-section', title: '第一章第一节' }),
      ],
      bindings: [
        binding({
          bindingId: 'bind-card',
          resourceId: 'act:card:safe-card',
          canonicalId: 'ctc:modeling-node',
          role: 'EXPLAINS',
        }),
        binding({
          bindingId: 'bind-textbook',
          resourceId: textbookId,
          canonicalId: 'ctc:modeling-node',
          role: 'COVERS',
        }),
      ],
    });
    expect(projected).toEqual(expect.objectContaining({
      state: 'available',
      items: expect.arrayContaining([
        expect.objectContaining({
          title: '稳定性卡片',
          availability: 'available',
          launch: { kind: 'viewer-shell', href: null },
        }),
        expect.objectContaining({
          title: '第一章第一节',
          availability: 'available',
          launch: {
            kind: 'direct-route',
            href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-01/section-01',
          },
        }),
      ]),
    }));
    expect(JSON.stringify(projected)).not.toContain('act:card:');
    expect(JSON.stringify(projected)).not.toContain('course-content/');
  });

  it('does not treat overlay vs course projection id as identity mismatch', () => {
    const shard = loadNodeDetailShard('ctkg:v3e-object-a21bf9714ef096463309f7ef');
    const coursePointer = teachingProjectionStore.readCurrentTeachingProjectionPointer(
      teachingProjectionStore.resolveTeachingProjectionStorePaths(
        join(process.cwd(), 'course-content/runtime/knowledge/projection'),
      ),
    );
    expect(shard.envelope.teaching.projectionId).not.toBe(coursePointer?.projectionId);
    const projected = attachActiveAuthorityResourceBindings(shard);
    expect(projected.message).not.toBe('当前系统资源与所选对象身份不一致。');
    expect(projected.state === 'available' || projected.state === 'empty').toBe(true);
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
