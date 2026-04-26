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
      title: '控制理论生存指南：传递函数与终极梅森法则',
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
      join(repoRoot, 'src/features/interactive/shared/lesson-entry-media-hub.tsx'),
      'utf8',
    );
    const runtimeSectionsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
      'utf8',
    );
    const unit22Source = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-2-2-time-response/entry-page.tsx'),
      'utf8',
    );

    expect(source).toContain('LessonEntryMediaHub');
    expect(sharedSource).toContain('课前预习台');
    expect(sharedSource).toContain('预习导入视频');
    expect(sharedSource).toContain('完整课程视频');
    expect(sharedSource).toContain('[introVideoResource, courseVideoResource].map');
    expect(sharedSource).toContain('lessonRuntime.mediaResources');
    expect(source).not.toContain('运行态媒体索引');
    expect(source).not.toContain('2-1-media.md');
    expect(source).not.toContain('讲义入口');
    expect(source).not.toContain('<Dialog open={Boolean(activeMedia)}');
    expect(sharedSource).toContain('在线阅读讲义');
    expect(sharedSource).toContain('setIsHandoutOpen(true)');
    expect(sharedSource).toContain('LessonEntryHandoutDialog');
    expect(source).not.toContain('href={lessonRuntime.handoutPath}');
    expect(source).toContain('<LessonEntryMediaHub');
    expect(source).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
    expect(sharedSource).toContain('lessonRuntime.handoutPdfPath');
    expect(sharedSource).toContain('lessonId: lessonRuntime.lesson.lesson_id');
    expect(sharedSource).toContain('下载 PDF 讲义');
    expect(sharedSource).toContain('useResourceInteractionTracking');
    expect(sharedSource).toContain('trackResourceView');
    expect(sharedSource).toContain('trackResourceOpen');
    expect(sharedSource).toContain('trackResourcePlay');
    expect(sharedSource).toContain('trackResourceProgress');
    expect(sharedSource).toContain('trackResourceComplete');
    expect(sharedSource).toContain('trackResourceDownload');
    expect(sharedSource).toContain('overflow-hidden rounded-[24px]');
    expect(sharedSource).toContain('block h-full w-full border-0');
    expect(sharedSource).toContain("isAudio ? 'lg:col-span-2' : ''");
    expect(sharedSource).toContain('key={`${resource.id}-${embedVersion}`}');
    expect(sharedSource).not.toContain('解析实验版');
    expect(sharedSource).toContain('/api/course-runtime/audio-preview-source');
    expect(sharedSource).toContain('resource.title');
    expect(sharedSource).toContain('《闲聊自控》播客');
    expect(sharedSource).toContain('听主持人洛嘉和思稳带来的新一期节目');
    expect(sharedSource).not.toContain('wrapperClassName="h-[188px] sm:h-[220px]"');
    expect(sharedSource).not.toContain('h-[188px] sm:h-[220px]');
    expect(sharedSource).not.toContain('适合通勤或碎片时间先听主线');
    expect(sharedSource).not.toContain('适合先看结构图、公式与例题位置');
    expect(sharedSource).not.toContain('先用一段短视频快速进入本课情境');
    expect(sharedSource).not.toContain('适合在正式进入课堂前先建立全课节奏');
    expect(sharedSource).not.toContain('lessonRuntime.handoutPreview');
    expect(sharedSource).toContain('<ReactMarkdown');
    expect(sharedSource).toContain('remarkPlugins={[remarkGfm]}');
    expect(runtimeSectionsSource).toContain('hideHandoutEntry?: boolean');
    expect(runtimeSectionsSource).toContain('export function LessonEntryHandoutDialog');
    expect(runtimeSectionsSource).toContain('handoutPdfPath: runtime.handoutPdfPath');
    expect(runtimeSectionsSource).toContain('trackKnowledgeNodeFocus');
    expect(runtimeSectionsSource).toContain('trackResourceOpen');
    expect(runtimeSectionsSource).toContain('trackResourceDownload');
    expect(unit22Source).toContain('LessonEntryMediaHub');
    expect(unit22Source).toContain('hideHandoutEntry');
  });
});
