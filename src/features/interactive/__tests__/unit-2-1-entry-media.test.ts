import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
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
      title: '自动送餐车突然偏离白线，带出“先把真实对象翻译成统一分析对象”',
      url: 'https://pan-yz.cldisk.com/preview/objectshowpreview.html?objectid=6f944597c1bc96903ae733fdba8be76c&v=1775441123459&puid=26652392&enc=93c945dddf969644aad33c03d7c1ef34&wps=c5d9d56b07c2b278fdf1054ddaf0a3bcd70d687fb84ea7b5',
    });
    expect(resources[1]).toMatchObject({
      kind: 'audio',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      title: '梅森公式与传函',
      url: 'https://pan-yz.cldisk.com/preview/objectshowpreview.html?objectid=e79ae1ee62f81b213a8fa0d291748503&v=1775441168379&puid=26652392&enc=b4b169b719e768ffc75eba66f266d50e&wps=c5d9d56b07c2b278227a6249c6130b34d70d687fb84ea7b5',
    });
    expect(resources[2]).toMatchObject({
      kind: 'pdf',
      accessMode: 'new_tab',
      embedMode: 'none',
      status: 'ready',
      title: 'Control Theory Speedrun',
    });
  });

  it('parses the runtime media document handout summary override', () => {
    const markdown = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/2-1/media/2-1-media.md'),
      'utf8',
    );

    const document = parseRuntimeLessonMediaDocument(markdown);

    expect(document.handoutSummary).toContain('控制系统建模');
    expect(document.handoutSummary).toContain('梅森增益公式');
  });

  it('keeps blank media slots as pending resources instead of dropping them', () => {
    const resources = parseRuntimeLessonMediaIndex(
      ['# demo-intro-video.mp4', '', '', '# demo-slides.pdf', '- 演示课件', '', 'https://example.com/slides'].join('\n'),
    );

    expect(resources[0]).toMatchObject({
      filename: 'demo-intro-video.mp4',
      title: 'demo-intro-video.mp4',
      url: null,
      status: 'pending',
    });
    expect(resources[1]).toMatchObject({
      filename: 'demo-slides.pdf',
      title: '演示课件',
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
    expect(source).toContain('block h-full w-full border-0');
    expect(source).toContain("isAudio ? 'lg:col-span-2' : ''");
    expect(source).toContain('key={`${resource.id}-${embedVersion}`}');
    expect(source).not.toContain('解析实验版');
    expect(source).toContain('/api/course-runtime/audio-preview-source');
    expect(source).toContain('resource.title');
    expect(source).toContain('《闲聊自控》播客');
    expect(source).toContain('听主持人洛嘉和思稳带来的新一期节目');
    expect(source).not.toContain('wrapperClassName="h-[188px] sm:h-[220px]"');
    expect(source).not.toContain('h-[188px] sm:h-[220px]');
    expect(source).not.toContain('适合通勤或碎片时间先听主线');
    expect(source).not.toContain('适合先看结构图、公式与例题位置');
    expect(source).not.toContain('先用一段短视频快速进入本课情境');
    expect(source).not.toContain('适合在正式进入课堂前先建立全课节奏');
    expect(source).not.toContain('lessonRuntime.handoutPreview');
    expect(source).toContain('<ReactMarkdown');
    expect(source).toContain('remarkPlugins={[remarkGfm]}');
    expect(sharedSource).toContain('hideHandoutEntry?: boolean');
    expect(sharedSource).toContain('export function LessonEntryHandoutDialog');
    expect(sharedSource).toContain('handoutPdfPath: runtime.handoutPdfPath');
  });
});
