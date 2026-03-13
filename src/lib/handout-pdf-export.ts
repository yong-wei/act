import 'server-only';

import { chromium } from 'playwright';

import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { buildLessonHandoutPrintUrl } from '@/lib/handout-pdf';

export async function generateLessonHandoutPdf({
  origin,
  lessonId,
}: {
  origin: string;
  lessonId: string;
}) {
  const runtime = await loadLessonRuntimeEntry(lessonId);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.goto(buildLessonHandoutPrintUrl({ origin, lessonId }), {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('[data-handout-print-ready="true"]', {
      state: 'attached',
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    return {
      pdf,
      lessonTitle: runtime.lesson.title,
    };
  } finally {
    await browser.close();
  }
}
