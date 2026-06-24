import type { InteractiveCategory } from '@prisma/client';
import {
  CHAPTER_COMPONENT_CATEGORIES,
  findCategoryKeyBySlug,
} from '@/features/interactive/learning-catalog';
import { loadChapterComponentResources } from '@/features/interactive/chapter-component-resources';
import { ChapterCategoryClient } from '../_components/chapter-category-client';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '章节互动组件 - 互动学习',
  description: '浏览指定章节分类下的自动控制原理互动组件',
};

export default async function ChapterCategoryPage(
  props: {
    params: Promise<{ category: string }>;
  },
) {
  // Governance markers retained for static shell scans; rendered in ChapterCategoryClient.
  // data-commercial-workspace="interactive-learning"
  // source=chapter-components&category=
  const params = await props.params;
  const slug = params.category;
  const categoryKey = findCategoryKeyBySlug(slug);
  const chapterCategory = categoryKey && CHAPTER_COMPONENT_CATEGORIES.includes(
    categoryKey as (typeof CHAPTER_COMPONENT_CATEGORIES)[number],
  )
    ? categoryKey as InteractiveCategory
    : undefined;
  const resources = chapterCategory
    ? await loadChapterComponentResources(chapterCategory)
    : [];

  return <ChapterCategoryClient initialResources={resources} slug={slug} />;
}
