import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teachingResource: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/textbook-reader', () => ({
  buildTextbookReaderHref: vi.fn(({ bookId, edition, unitPath }: { bookId: string; edition: string; unitPath: string[] }) =>
    `/textbooks/${bookId}/${edition}/${unitPath.join('/')}`),
  loadTextbookCitationUnits: vi.fn(),
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getRegisteredResourceMetadataByNodeId: vi.fn(),
}));

vi.mock('@/features/ai/companion/governed-registry-card', () => ({
  verifyGovernedRegistryCard: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { loadTextbookCitationUnits } from '@/lib/textbook-reader';
import { getRegisteredResourceMetadataByNodeId } from '@/lib/resource-registry-metadata';
import { extractVersionBoundHandle } from '@/lib/textbook-resource-coach/href';
import {
  konlingTeachingResourceViewerRole,
  resolveKonlingTeachingResourceCitations,
} from '@/lib/konling-teaching-resource-citations';
import { buildKonlingCitationCanonicalKey } from '@/lib/konling-citation-protocol';
import type { KonlingLinkedTeachingResource } from '@/lib/konling-teaching-projection-context';

const prismaFindUnique = vi.mocked(prisma.teachingResource.findUnique);
const loadUnits = vi.mocked(loadTextbookCitationUnits);
const registryMetadata = vi.mocked(getRegisteredResourceMetadataByNodeId);

const TEXTBOOK_RESOURCE_ID =
  'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-03/section-3.8/example-3.6';

function linkedResource(overrides: Partial<KonlingLinkedTeachingResource>): KonlingLinkedTeachingResource {
  return {
    resourceId: 'res-base',
    resourceType: 'HANDOUT',
    role: 'EXPLAINS',
    title: '基础资源',
    primary: false,
    canonicalId: 'ctc:focus-1',
    scopeId: 'course-1',
    sourcePath: null,
    citationSafe: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = 'unit-test-strong-secret-0f3a1b';
});

afterEach(() => {
  delete process.env.KONLING_SERVER_MODE_CONTEXT_SECRET;
});

describe('konling-teaching-resource-citations', () => {
  it('viewer role 映射：student 默认、teacher/admin 显式', () => {
    expect(konlingTeachingResourceViewerRole('student')).toBe('student');
    expect(konlingTeachingResourceViewerRole(undefined)).toBe('student');
    expect(konlingTeachingResourceViewerRole('teacher')).toBe('teacher');
    expect(konlingTeachingResourceViewerRole('admin')).toBe('admin');
  });

  it('教材单元绑定资源解析为带 vbh 句柄的教材引用', async () => {
    loadUnits.mockResolvedValue([{
      id: TEXTBOOK_RESOURCE_ID,
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      sourceRevision: 'rev-2026-08-01',
      title: 'Example 3.6',
      kind: 'example',
      naturalNumber: null,
      structuralPath: ['chapter-chapter-03', 'section-3.8', 'example-3.6'],
      markdown: '# Example 3.6',
      fragments: [],
    }]);

    const resolution = await resolveKonlingTeachingResourceCitations({
      viewerRole: 'student',
      projectionId: 'proj-test',
      linkedResources: [linkedResource({
        resourceId: TEXTBOOK_RESOURCE_ID,
        resourceType: null,
        title: 'Dorf 例题 3.6',
      })],
    });

    expect(resolution.unresolved).toEqual([]);
    expect(resolution.citations).toHaveLength(1);
    const citation = resolution.citations[0]!;
    expect(citation.sourceType).toBe('textbook');
    expect(citation.href && extractVersionBoundHandle(citation.href)).toBeTruthy();
    expect(citation.identity).toMatchObject({
      kind: 'textbook',
      bookId: 'dorf-modern-control-systems',
      unitId: TEXTBOOK_RESOURCE_ID,
    });
    expect(citation.evidenceBasis).toBe('teaching-projection:textbook-unit');
    expect(buildKonlingCitationCanonicalKey(citation.identity)).toContain('dorf-modern-control-systems');
  });

  it('registry 与 DB 资源解析为 teaching-resource 引用；teacherOnly 学生 fail closed 且记录不可见原因', async () => {
    registryMetadata.mockReturnValue({
      launchTarget: '/simulations/type055',
      renderTarget: null,
    } as never);
    prismaFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'res-gone') return null;
      return {
        teacherOnly: where.id === 'res-teacher-only',
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        type: 'HANDOUT',
        content: null,
      } as never;
    });

    const resolution = await resolveKonlingTeachingResourceCitations({
      viewerRole: 'student',
      projectionId: null,
      linkedResources: [
        linkedResource({ resourceId: 'registry:lesson13-physics-builder-simple', title: '阻尼实验' }),
        linkedResource({ resourceId: 'res-handout', title: '课堂讲义' }),
        linkedResource({ resourceId: 'res-teacher-only', title: '教师专用' }),
        linkedResource({ resourceId: 'res-gone', title: '已删除资源' }),
        linkedResource({ resourceId: 'res-handout', title: '重复资源' }),
      ],
    });

    expect(resolution.citations.map((citation) => citation.id)).toEqual([
      'teach-res:registry:lesson13-physics-builder-simple',
      'teach-res:res-handout',
    ]);
    for (const citation of resolution.citations) {
      expect(citation.sourceType).toBe('teaching-resource');
      expect(citation.verifiable).toBe(true);
      expect(citation.identity.kind).toBe('teaching-resource');
    }
    expect(resolution.citations[0]).toMatchObject({ href: '/simulations/type055' });
    expect(resolution.citations[1]).toMatchObject({ href: '/interactive-learning/resources/res-handout' });
    expect(resolution.unresolved).toEqual([
      { resourceId: 'res-teacher-only', reason: 'interactive-resource:unauthorized' },
      { resourceId: 'res-gone', reason: 'interactive-resource:not-found' },
    ]);
  });
});
