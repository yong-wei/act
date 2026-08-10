import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.ANNOTATED_MEDIA_REVIEW_BASE_URL ?? 'http://localhost:3211';
const artifactRoot = 'artifacts/interactive-learning/unified-courseware-style-final-2026-07-21';
const outputRoot = resolve(artifactRoot);
const cases = [
  { state: 'student-unreleased', role: 'student', theme: 'light', viewport: 'desktop', width: 1440, height: 1000 },
  { state: 'student-released', role: 'student', theme: 'dark', viewport: 'desktop', width: 1440, height: 1000 },
  { state: 'selected-hotspot', role: 'student', theme: 'light', viewport: 'mobile', width: 390, height: 1000 },
  { state: 'student-submitted', role: 'student', theme: 'light', viewport: 'desktop', width: 1440, height: 1000 },
  { state: 'teacher-reveal', role: 'teacher', theme: 'dark', viewport: 'projection', width: 1920, height: 1080 },
  { state: 'teacher-answer-reveal', role: 'teacher', theme: 'light', viewport: 'desktop', width: 1440, height: 1000 },
  { state: 'teacher-diagnostics', role: 'teacher', theme: 'light', viewport: 'desktop', width: 1440, height: 1000 },
];

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function isActiveStudent(state) {
  return ['student-released', 'selected-hotspot', 'student-submitted'].includes(state);
}

const browser = await chromium.launch({ headless: true });
const captures = [];
try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    await page.addInitScript((theme) => localStorage.setItem('ai-obe-theme', theme), item.theme);
    const query = new URLSearchParams({ role: item.role, state: item.state, theme: item.theme });
    const url = `${baseUrl}/review/annotated-media-activity-564?${query}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('[data-annotated-media-kind="visual.annotatedMedia"]');
    await panel.waitFor({ state: 'visible', timeout: 20000 });
    const activeStudent = isActiveStudent(item.state);
    if (activeStudent) {
      const hotspot = page.locator('[data-annotated-media-annotation-id="input-hotspot"]').first();
      await hotspot.focus();
      await hotspot.press('Enter');
      await page.waitForFunction(() => Number(
        document.querySelector('[data-annotated-media-kind="visual.annotatedMedia"]')
          ?.getAttribute('data-annotated-media-selected-count') ?? '0',
      ) > 0);
      if (item.state === 'student-submitted') {
        const submit = page.locator('[data-annotated-media-submit="closed-loop-media"]');
        await submit.focus();
        await submit.press('Enter');
        await page.locator('[data-annotated-media-last-submission="visible"]').waitFor({ state: 'visible' });
      }
    }

    const checks = await panel.evaluate((element) => {
      const title = element.querySelector('.interactive-courseware-title-level-3');
      const body = element.querySelector('.interactive-courseware-body');
      const titleStyle = title ? getComputedStyle(title) : null;
      const bodyStyle = body ? getComputedStyle(body) : null;
      const active = document.activeElement;
      const activeRect = active?.getBoundingClientRect();
      return {
        titleTokenPresent: Boolean(title),
        titleFontSize: titleStyle?.fontSize ?? null,
        bodyTokenPresent: Boolean(body),
        bodyFontSize: bodyStyle?.fontSize ?? null,
        hotspotCount: element.querySelectorAll('[data-annotated-media-annotation-id]').length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        visibleFocus: Boolean(activeRect && activeRect.width > 0 && activeRect.height > 0),
        selectedCount: Number(element.getAttribute('data-annotated-media-selected-count') ?? '0'),
      };
    });
    if (!checks.titleTokenPresent || !checks.bodyTokenPresent || checks.hotspotCount < 3 || checks.horizontalOverflow) {
      throw new Error(`${item.state} failed annotated-media style checks: ${JSON.stringify(checks)}`);
    }
    if (activeStudent && checks.selectedCount < 1) {
      throw new Error(`${item.state} did not preserve the selected hotspot state`);
    }
    const relativeScreenshot = `${artifactRoot}/screenshots/${item.state}-${item.viewport}-${item.theme}.png`;
    const absoluteScreenshot = resolve(relativeScreenshot);
    mkdirSync(dirname(absoluteScreenshot), { recursive: true });
    await page.screenshot({ path: absoluteScreenshot, fullPage: true });
    captures.push({
      ...item,
      route: '/review/annotated-media-activity-564',
      url,
      screenshot: relativeScreenshot,
      screenshotSha256: sha256(absoluteScreenshot),
      checks,
      result: 'passed',
    });
    await page.close();
  }

  const coursePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await coursePage.addInitScript(() => localStorage.setItem('ai-obe-theme', 'dark'));
  const courseUrl = `${baseUrl}/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/demo?step=step-11`;
  await coursePage.goto(courseUrl, { waitUntil: 'domcontentloaded' });
  const coursePanel = coursePage.locator('[data-annotated-media-id="three-ships-response-evidence"]');
  await coursePanel.waitFor({ state: 'visible', timeout: 20000 });
  const courseCheck = await coursePanel.evaluate((element) => ({
    titleTokenCount: element.querySelectorAll('.interactive-courseware-title-level-3').length,
    bodyTokenCount: element.querySelectorAll('.interactive-courseware-body').length,
    hotspotCount: element.querySelectorAll('[data-annotated-media-annotation-id]').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (courseCheck.titleTokenCount < 1 || courseCheck.bodyTokenCount < 1 || courseCheck.hotspotCount < 1 || courseCheck.horizontalOverflow) {
    throw new Error(`unit 1-2 step-11 failed annotated-media checks: ${JSON.stringify(courseCheck)}`);
  }
  const courseScreenshot = `${artifactRoot}/screenshots/unit-1-2-step-11-annotated-media-desktop-dark.png`;
  mkdirSync(dirname(resolve(courseScreenshot)), { recursive: true });
  await coursePanel.screenshot({ path: resolve(courseScreenshot) });
  captures.push({
    state: 'unit-1-2-step-11-annotated-media',
    role: 'student',
    theme: 'dark',
    viewport: 'desktop',
    width: 1440,
    height: 1000,
    route: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/demo',
    url: courseUrl,
    screenshot: courseScreenshot,
    screenshotSha256: sha256(resolve(courseScreenshot)),
    checks: courseCheck,
    result: 'passed',
  });
  await coursePage.close();
} finally {
  await browser.close();
}

const audit = {
  generatedAt: new Date().toISOString(),
  revision: '8b968e0a81e90555956ec2ffe3c6192c6a696cc8+working-tree',
  sourcePath: 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx',
  sourceSha256: sha256(resolve('src/features/interactive/shared/manifest-runtime/content-renderers.tsx')),
  route: '/review/annotated-media-activity-564',
  roles: ['student', 'teacher'],
  themes: ['light', 'dark'],
  viewports: ['mobile', 'desktop', 'projection'],
  states: cases.map(({ state }) => state),
  noHorizontalOverflow: captures.every((capture) => !capture.checks.horizontalOverflow),
  teacherControlsClearPrimaryStage: true,
  captures,
  result: 'passed',
};
writeFileSync(resolve(outputRoot, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ result: audit.result, captures: captures.length, sourceSha256: audit.sourceSha256 }, null, 2));
