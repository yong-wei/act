import { notFound } from 'next/navigation';

import { LessonEntryMediaHub } from '@/features/interactive/shared/lesson-entry-media-hub';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function Issue979EvidencePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const runtime = await loadLessonRuntimeEntry('2-1');
  const urls = new Map([
    ['2-1-intro-video.mp4', '/evidence/issue-979-intro.mp4'],
    ['2-1-course.mp4', '/evidence/issue-979-course.mp4'],
    ['2-1-audio.m4a', '/evidence/issue-979-audio.mp3'],
  ]);
  return <LessonEntryMediaHub lessonRuntime={{ ...runtime, mediaResources: runtime.mediaResources.map((resource) => urls.has(resource.filename) ? { ...resource, url: urls.get(resource.filename)!, embedMode: 'none', status: 'ready' } : resource) }} courseLabel="Issue 979 evidence" />;
}
