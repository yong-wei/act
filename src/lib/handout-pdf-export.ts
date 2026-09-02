import 'server-only';

import { access } from 'node:fs/promises';

import { chromium } from 'playwright';

import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { buildLessonHandoutPrintUrl } from '@/lib/handout-pdf';

const SYSTEM_CHROMIUM_EXECUTABLE_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((value): value is string => Boolean(value));

let chromiumExecutablePathPromise: Promise<string | undefined> | null = null;

async function resolveChromiumExecutablePath() {
  if (!chromiumExecutablePathPromise) {
    chromiumExecutablePathPromise = (async () => {
      for (const candidate of SYSTEM_CHROMIUM_EXECUTABLE_CANDIDATES) {
        try {
          await access(candidate);
          return candidate;
        } catch {
          continue;
        }
      }

      return undefined;
    })();
  }

  return chromiumExecutablePathPromise;
}

export async function generateLessonHandoutPdf({
  origin,
  lessonId,
}: {
  origin: string;
  lessonId: string;
}) {
  const runtime = await loadLessonRuntimeEntry(lessonId);
  const executablePath = await resolveChromiumExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: executablePath
      ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      : undefined,
  });

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
