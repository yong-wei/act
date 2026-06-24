import { loadChapterComponentResources } from '@/features/interactive/chapter-component-resources';
import { ChapterComponentsClient } from './_components/chapter-components-client';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '各章节互动组件 - 互动学习',
  description: '按章节分类浏览自动控制原理互动组件',
};

export default async function ChapterComponentsPage() {
  // Governance marker retained for static shell scans; rendered in ChapterComponentsClient.
  // data-commercial-workspace="interactive-learning"
  const resources = await loadChapterComponentResources();

  return <ChapterComponentsClient initialResources={resources} />;
}
