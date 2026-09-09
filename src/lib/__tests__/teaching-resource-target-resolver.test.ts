import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { verifyGovernedRegistryCard } from '@/features/ai/companion/governed-registry-card';
import {
  classifyTeachingResourceTarget,
  parseTextbookBookId,
  resolveTeachingResourceTarget,
} from '@/lib/teaching-resource-target-resolver';

const prismaFindUnique = vi.mocked(prisma.teachingResource.findUnique);
const loadUnits = vi.mocked(loadTextbookCitationUnits);
const registryMetadata = vi.mocked(getRegisteredResourceMetadataByNodeId);
const verifyRegistry = vi.mocked(verifyGovernedRegistryCard);

const TEXTBOOK_RESOURCE_ID =
  'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-03/section-3.8/example-3.6';

const DORF_UNIT = {
  id: TEXTBOOK_RESOURCE_ID,
  bookId: 'dorf-modern-control-systems',
  edition: '14th Global Edition',
  sourceRevision: 'rev-2026-08-01',
  title: 'Example 3.6',
  kind: 'example',
  naturalNumber: null,
  structuralPath: ['chapter-chapter-03', 'section-3.8', 'example-3.6'],
  markdown: '# Example 3.6\n开环传递函数…',
  fragments: [],
};

function unitMarkdownHash(markdown: string): string {
  // 与生产一致的口径：sha256 前缀（identity.hashTextbookMarkdown）
  return `sha256:${createHash('sha256').update(markdown, 'utf-8').digest('hex')}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('teaching-resource-target-resolver', () => {
  it('按前缀与 kind 分类三段解析目标', () => {
    expect(classifyTeachingResourceTarget(TEXTBOOK_RESOURCE_ID)).toBe('textbook-unit');
    expect(classifyTeachingResourceTarget('registry:lesson15-lag-lead-workshop')).toBe('governed-registry-resource');
    expect(classifyTeachingResourceTarget('arena-task:arena-task-1')).toBe('governed-registry-resource');
    expect(classifyTeachingResourceTarget('res-0001')).toBe('interactive-resource');
    expect(classifyTeachingResourceTarget('res-0001', 'textbook-unit')).toBe('textbook-unit');
    expect(parseTextbookBookId(TEXTBOOK_RESOURCE_ID)).toBe('dorf-modern-control-systems');
    expect(parseTextbookBookId('not-a-textbook')).toBeNull();
  });

  it('教材单元解析成功并返回单元身份；哈希漂移按 hash-drift 降级', async () => {
    loadUnits.mockResolvedValue([DORF_UNIT]);
    const resolved = await resolveTeachingResourceTarget({
      resourceId: TEXTBOOK_RESOURCE_ID,
      versionHash: null,
      viewerRole: 'student',
      teacherOnlyPolicy: 'role-gated',
    });
    expect(resolved).toMatchObject({
      status: 'available',
      kind: 'textbook-unit',
      href: '/textbooks/dorf-modern-control-systems/14th Global Edition/chapter-chapter-03/section-3.8/example-3.6',
    });
    if (resolved.status !== 'available' || !resolved.textbookIdentity) throw new Error('unreachable');
    expect(resolved.textbookIdentity.bookId).toBe('dorf-modern-control-systems');
    expect(resolved.textbookIdentity.contentHash).toBe(unitMarkdownHash(DORF_UNIT.markdown));

    const drifted = await resolveTeachingResourceTarget({
      resourceId: TEXTBOOK_RESOURCE_ID,
      versionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      viewerRole: 'student',
      teacherOnlyPolicy: 'always-unavailable',
    });
    expect(drifted).toMatchObject({ status: 'unavailable', reason: 'hash-drift' });
  });

  it('registry 资源：快照哈希校验与 live 解析双路径', async () => {
    verifyRegistry.mockReturnValue({ status: 'available', href: '/simulations/type055' });
    const snapshotVerified = await resolveTeachingResourceTarget({
      resourceId: 'registry:lesson15-lag-lead-workshop',
      versionHash: 'registry-sha256:abc',
      viewerRole: 'student',
      teacherOnlyPolicy: 'always-unavailable',
    });
    expect(snapshotVerified).toMatchObject({ status: 'available', href: '/simulations/type055' });
    expect(verifyRegistry).toHaveBeenCalledWith('registry:lesson15-lag-lead-workshop', 'registry-sha256:abc');

    // live 解析（控灵）：不比对哈希，取当前 launch/render 目标。
    registryMetadata.mockReturnValue({
      launchTarget: '/interactive-learning/resources/registry-1',
      renderTarget: null,
    } as never);
    const live = await resolveTeachingResourceTarget({
      resourceId: 'registry:lesson15-lag-lead-workshop',
      versionHash: null,
      viewerRole: 'student',
      teacherOnlyPolicy: 'role-gated',
    });
    expect(live).toMatchObject({ status: 'available', href: '/interactive-learning/resources/registry-1' });

    registryMetadata.mockReturnValue(undefined);
    const missing = await resolveTeachingResourceTarget({
      resourceId: 'registry:gone',
      versionHash: null,
      viewerRole: 'student',
      teacherOnlyPolicy: 'role-gated',
    });
    expect(missing).toMatchObject({ status: 'unavailable', reason: 'not-found' });
  });

  it('DB TeachingResource：companion 语义 teacherOnly 一律 not-found；role-gated 学生 fail closed、教师可见', async () => {
    prismaFindUnique.mockResolvedValue({
      teacherOnly: true,
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      type: 'HANDOUT',
      content: null,
    } as never);
    const companionSemantics = await resolveTeachingResourceTarget({
      resourceId: 'res-teacher-only',
      versionHash: '2026-09-01T00:00:00.000Z',
      viewerRole: 'teacher',
      teacherOnlyPolicy: 'always-unavailable',
    });
    expect(companionSemantics).toMatchObject({ status: 'unavailable', reason: 'not-found' });

    const studentDenied = await resolveTeachingResourceTarget({
      resourceId: 'res-teacher-only',
      versionHash: null,
      viewerRole: 'student',
      teacherOnlyPolicy: 'role-gated',
    });
    expect(studentDenied).toMatchObject({ status: 'unavailable', reason: 'unauthorized' });

    const teacherAllowed = await resolveTeachingResourceTarget({
      resourceId: 'res-teacher-only',
      versionHash: null,
      viewerRole: 'teacher',
      teacherOnlyPolicy: 'role-gated',
    });
    expect(teacherAllowed).toMatchObject({
      status: 'available',
      href: '/interactive-learning/resources/res-teacher-only',
    });
  });

  it('DB 资源 updatedAt 漂移按 hash-drift 降级；STATIC_MEDIA 返回内嵌地址', async () => {
    prismaFindUnique.mockResolvedValue({
      teacherOnly: false,
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      type: 'HANDOUT',
      content: null,
    } as never);
    const drifted = await resolveTeachingResourceTarget({
      resourceId: 'res-1',
      versionHash: '2026-08-01T00:00:00.000Z',
      viewerRole: 'student',
      teacherOnlyPolicy: 'always-unavailable',
    });
    expect(drifted).toMatchObject({ status: 'unavailable', reason: 'hash-drift' });

    prismaFindUnique.mockResolvedValue({
      teacherOnly: false,
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      type: 'STATIC_MEDIA',
      content: 'https://assets.example.com/intro.mp4',
    } as never);
    const media = await resolveTeachingResourceTarget({
      resourceId: 'res-media',
      versionHash: '2026-09-01T00:00:00.000Z',
      viewerRole: 'student',
      teacherOnlyPolicy: 'always-unavailable',
    });
    expect(media).toMatchObject({
      status: 'available',
      mediaUrl: 'https://assets.example.com/intro.mp4',
      mediaKind: 'video',
      href: '/interactive-learning/resources/res-media',
    });
  });
});
