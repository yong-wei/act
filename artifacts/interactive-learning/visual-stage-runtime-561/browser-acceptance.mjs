import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.VISUAL_STAGE_REVIEW_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/visual-stage-runtime-561');
const cases = [
  {
    name: 'student-unreleased-desktop-light',
    role: 'student',
    state: 'student-unreleased',
    theme: 'light',
    viewport: 'desktop',
    size: { width: 1440, height: 1000 },
    path: 'browser-evidence/student-unreleased-desktop-light.png',
  },
  {
    name: 'student-released-desktop-dark',
    role: 'student',
    state: 'student-released',
    theme: 'dark',
    viewport: 'desktop',
    size: { width: 1440, height: 1000 },
    path: 'browser-evidence/student-released-desktop-dark.png',
  },
  {
    name: 'student-submitted-mobile-light',
    role: 'student',
    state: 'student-submitted',
    theme: 'light',
    viewport: 'mobile',
    size: { width: 390, height: 1000 },
    path: 'browser-evidence/student-submitted-mobile-light.png',
  },
  {
    name: 'teacher-reveal-projection-dark',
    role: 'teacher',
    state: 'teacher-reveal',
    theme: 'dark',
    viewport: 'projection',
    size: { width: 1920, height: 1080 },
    path: 'browser-evidence/teacher-reveal-projection-dark.png',
  },
  {
    name: 'teacher-answer-reveal-desktop-light',
    role: 'teacher',
    state: 'teacher-answer-reveal',
    theme: 'light',
    viewport: 'desktop',
    size: { width: 1440, height: 1000 },
    path: 'browser-evidence/teacher-answer-reveal-desktop-light.png',
  },
  {
    name: 'teacher-diagnostics-desktop-dark',
    role: 'teacher',
    state: 'teacher-diagnostics',
    theme: 'dark',
    viewport: 'desktop',
    size: { width: 1440, height: 1000 },
    path: 'browser-evidence/teacher-diagnostics-desktop-dark.png',
  },
  {
    name: 'guest-unavailable-mobile-light',
    role: 'guest',
    state: 'guest-unavailable',
    theme: 'light',
    viewport: 'mobile',
    size: { width: 390, height: 1000 },
    path: 'browser-evidence/guest-unavailable-mobile-light.png',
  },
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function queryFor(item) {
  return new URLSearchParams({
    role: item.role,
    state: item.state,
    theme: item.theme,
  }).toString();
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport: item.size });
    await page.addInitScript((theme) => {
      localStorage.setItem('ai-obe-theme', theme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    }, item.theme);
    const url = `${baseUrl}/review/visual-stage-runtime-561?${queryFor(item)}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const canvas = page.locator('[data-visual-stage-canvas="normalized"]');
    await canvas.waitFor({ state: 'visible', timeout: 15000 });
    const checks = await page.evaluate(() => {
      const canvasElement = document.querySelector('[data-visual-stage-canvas="normalized"]');
      const reviewMain = document.querySelector('[data-visual-stage-review="issue-561"]');
      const diagnostics = document.querySelector('[data-visual-stage-teacher-diagnostics="visible"]');
      const canvasRect = canvasElement?.getBoundingClientRect();
      const diagnosticsRect = diagnostics?.getBoundingClientRect();
      const overlapsDiagnostics = Boolean(
        canvasRect
        && diagnosticsRect
        && diagnosticsRect.left < canvasRect.right
        && diagnosticsRect.right > canvasRect.left
        && diagnosticsRect.top < canvasRect.bottom
        && diagnosticsRect.bottom > canvasRect.top,
      );
      return {
        freeform: canvasElement?.getAttribute('data-visual-stage-layout') === 'freeform',
        noVerticalListClass: !(reviewMain?.outerHTML ?? '').includes('space-y-4'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
          && document.body.scrollWidth <= document.body.clientWidth,
        layerCount: document.querySelectorAll('[data-visual-stage-layer-id]').length,
        teacherControlsClearPrimaryStage: !overlapsDiagnostics,
      };
    });
    let accessibility = { keyboardReachable: false, visibleFocus: false };
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      accessibility = await page.evaluate(() => {
        const active = document.activeElement;
        const rect = active?.getBoundingClientRect();
        const keyboardReachable = active?.getAttribute('data-visual-stage-canvas') === 'normalized';
        return {
          keyboardReachable,
          visibleFocus: Boolean(
            keyboardReachable
            && rect
            && rect.width > 0
            && rect.height > 0
            && rect.bottom > 0
            && rect.right > 0
            && rect.top < window.innerHeight
            && rect.left < window.innerWidth,
          ),
        };
      });
      if (accessibility.keyboardReachable) break;
    }
    if (
      !checks.freeform
      || !checks.noVerticalListClass
      || !checks.noHorizontalOverflow
      || !checks.teacherControlsClearPrimaryStage
      || !accessibility.keyboardReachable
      || !accessibility.visibleFocus
    ) {
      throw new Error(`${item.name} failed visual stage browser checks: ${JSON.stringify(checks)}`);
    }
    const screenshotPath = resolve(outDir, item.path);
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({
      ...item,
      route: '/review/visual-stage-runtime-561',
      url,
      screenshot: `artifacts/interactive-learning/visual-stage-runtime-561/${item.path}`,
      sha256: sha256(screenshotPath),
      checks: { ...checks, ...accessibility },
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const audit = {
  status: 'pass',
  capturedAt: new Date().toISOString(),
  route: '/review/visual-stage-runtime-561',
  roles: ['student', 'teacher', 'guest'],
  themes: ['light', 'dark'],
  viewports: ['mobile', 'desktop', 'projection'],
  states: [
    'student-unreleased',
    'student-released',
    'student-submitted',
    'teacher-reveal',
    'teacher-answer-reveal',
    'teacher-diagnostics',
    'guest-unavailable',
  ],
  noHorizontalOverflow: results.every((item) => item.checks.noHorizontalOverflow),
  teacherControlsClearPrimaryStage: results.every((item) => item.checks.teacherControlsClearPrimaryStage),
  freeformStageVerified: results.every((item) => item.checks.freeform && item.checks.noVerticalListClass),
  results,
};

writeFileSync(resolve(outDir, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: audit.status, captures: results.length }, null, 2));
