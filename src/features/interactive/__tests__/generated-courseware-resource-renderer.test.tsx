import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TeachingResource } from '@prisma/client';

import { projectCoursewareForStudent } from '@/lib/smart-courseware/domain';
import { validCoursewareManifest } from '@/lib/smart-courseware/__tests__/fixtures';

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({ updatePageContext: vi.fn() }),
}));
vi.mock('@/features/lesson-engine/ContextInjector', () => ({
  useLessonContext: () => ({ title: '测试课堂' }),
}));
vi.mock('@/features/interactive/hooks/useResourceInteractionTracking', () => ({
  useResourceInteractionTracking: () => ({ trackKnowledgeCardOpen: vi.fn() }),
}));
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <span data-next-image={String(props.src ?? '')} />,
}));

import { ResourceRenderer } from '@/features/lesson-engine/resource-renderer';

const studentProjection = projectCoursewareForStudent({
  draftId: 'draft-1',
  version: 1,
  runtimeManifest: validCoursewareManifest(),
  orderingPermutationSecret: 'generated-courseware-resource-renderer-test-secret',
});

describe('generated courseware classroom resource rendering', () => {
  it('renders immutable student content and active response controls without teacher fields', () => {
    const contentHtml = renderResource('step-1');
    const activityHtml = renderResource('step-3');

    expect(contentHtml).toContain('data-generated-courseware-resource="publication-v1"');
    expect(contentHtml).toContain('Content module-1');
    expect(activityHtml).toContain('data-courseware-student-activity="step-3"');
    expect(activityHtml).toContain('Prompt module-3');
    expect(activityHtml).toContain('type="radio"');
    expect(activityHtml).toContain('A');
    expect(activityHtml).not.toContain('教师专用解释');
    expect(activityHtml).not.toContain('referenceAnswer');
    expect(activityHtml).not.toContain('providerKind');
  });

  it('keeps legacy STATIC_TEXT rendering unchanged', () => {
    const html = renderToStaticMarkup(<ResourceRenderer resource={resource({
      config: {},
      content: 'legacy static body',
      generatedCoursewarePublicationId: null,
    })} />);
    expect(html).toContain('legacy static body');
    expect(html).not.toContain('data-generated-courseware-resource="');
  });

  it('fails closed when config identity differs from the governed publication link', () => {
    const html = renderToStaticMarkup(<ResourceRenderer resource={resource({
      config: {
        kind: 'generated-courseware-student-runtime-v1',
        publicationRevisionId: 'publication-v1',
        manifestHash: 'manifest-v1',
        stepId: 'step-1',
        runtimeManifest: studentProjection.runtimeManifest,
      },
      generatedCoursewarePublicationId: 'publication-v2',
    })} />);
    expect(html).not.toContain('data-generated-courseware-resource="');
    expect(html).toContain('data-generated-courseware-resource-integrity="invalid"');
    expect(html).not.toContain('占位内容不得成为运行时输出');
  });
});

function renderResource(stepId: string) {
  return renderToStaticMarkup(<ResourceRenderer resource={resource({
    config: {
      kind: 'generated-courseware-student-runtime-v1',
      publicationRevisionId: 'publication-v1',
      manifestHash: 'manifest-v1',
      stepId,
      runtimeManifest: studentProjection.runtimeManifest,
    },
  })} />);
}

function resource(overrides: {
  config: Record<string, unknown>;
  content?: string | null;
  generatedCoursewarePublicationId?: string | null;
}) {
  return {
    id: 'resource-v1',
    title: '已发布互动课件',
    description: null,
    type: 'STATIC_TEXT' as const,
    content: overrides.content ?? '## 占位内容不得成为运行时输出',
    registryId: null,
    category: null,
    displayName: '已发布互动课件',
    displayOrder: 0,
    teacherOnly: false,
    config: overrides.config,
    aiHints: null,
    authorId: 'teacher-1',
    generatedCoursewarePublicationId: overrides.generatedCoursewarePublicationId === undefined
      ? 'publication-v1'
      : overrides.generatedCoursewarePublicationId,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  } as unknown as TeachingResource;
}
