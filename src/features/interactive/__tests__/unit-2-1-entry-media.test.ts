import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 2-1 entry media runtime', () => {
  it('parses the runtime media index into typed resources', () => {
    const markdown = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/2-1/media/2-1-media.md'),
      'utf8',
    );

    const resources = parseRuntimeLessonMediaIndex(markdown);

    expect(resources.map((item) => item.filename)).toEqual([
      '2-1-intro-video.mp4',
      '2-1-audio.m4a',
      '2-1-slides.pdf',
      '2-1-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[1]).toMatchObject({
      kind: 'audio',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[2]).toMatchObject({
      kind: 'pdf',
      accessMode: 'new_tab',
      embedMode: 'none',
      status: 'ready',
    });
  });

  it('keeps blank media slots as pending resources instead of dropping them', () => {
    const resources = parseRuntimeLessonMediaIndex(
      ['# demo-intro-video.mp4', '', '', '# demo-slides.pdf', '', 'https://example.com/slides'].join('\n'),
    );

    expect(resources[0]).toMatchObject({
      filename: 'demo-intro-video.mp4',
      url: null,
      status: 'pending',
    });
    expect(resources[1]).toMatchObject({
      filename: 'demo-slides.pdf',
      url: 'https://example.com/slides',
      status: 'ready',
    });
  });

  it('renders the 2-1 pre-study area as inline media with course-facing copy only', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-2-1-modeling-language/entry-page.tsx'),
      'utf8',
    );
    const sharedSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
      'utf8',
    );

    expect(source).toContain('课前预习台');
    expect(source).toContain('预习导入视频');
    expect(source).toContain('完整课程视频');
    expect(source).toContain('[introVideoResource, courseVideoResource].map');
    expect(source).toContain('lessonRuntime.mediaResources');
    expect(source).not.toContain('运行态媒体索引');
    expect(source).not.toContain('2-1-media.md');
    expect(source).not.toContain('讲义入口');
    expect(source).not.toContain('<Dialog open={Boolean(activeMedia)}');
    expect(source).toContain('在线阅读讲义');
    expect(source).toContain('setIsHandoutOpen(true)');
    expect(source).toContain('LessonEntryHandoutDialog');
    expect(source).not.toContain('href={lessonRuntime.handoutPath}');
    expect(source).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
    expect(source).toContain('lessonRuntime.handoutPdfPath');
    expect(source).toContain('lessonId: lessonRuntime.lesson.lesson_id');
    expect(source).toContain('下载 PDF 讲义');
    expect(source).toContain('overflow-hidden rounded-[24px]');
    expect(source).toContain("resource.kind === 'audio' ? 'h-[188px] sm:h-[220px]' : 'aspect-[16/9] min-h-[240px] sm:min-h-[320px] lg:min-h-[420px]'");
    expect(source).toContain('block h-full w-full border-0');
    expect(source).toContain("isAudio ? 'lg:col-span-2' : ''");
    expect(source).toContain("innerClassName=\"mx-auto w-full max-w-[520px]\"");
    expect(source).toContain('key={`${resource.id}-${embedVersion}`}');
    expect(source).toContain('解析实验版');
    expect(source).toContain('/api/course-runtime/audio-preview-source');
    expect(sharedSource).toContain('hideHandoutEntry?: boolean');
    expect(sharedSource).toContain('export function LessonEntryHandoutDialog');
    expect(sharedSource).toContain('handoutPdfPath: runtime.handoutPdfPath');
  });
});
