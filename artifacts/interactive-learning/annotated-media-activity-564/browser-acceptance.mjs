import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.ANNOTATED_MEDIA_REVIEW_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/annotated-media-activity-564');
const coreStates = [
  { state: 'student-unreleased', role: 'student' },
  { state: 'student-released', role: 'student' },
  { state: 'selected-hotspot', role: 'student' },
  { state: 'student-submitted', role: 'student' },
  { state: 'teacher-reveal', role: 'teacher' },
  { state: 'teacher-diagnostics', role: 'teacher' },
];
const themes = ['light', 'dark'];
const viewports = {
  mobile: { width: 390, height: 1000 },
  desktop: { width: 1440, height: 1000 },
  projection: { width: 1920, height: 1080 },
};
const cases = coreStates.flatMap(({ state, role }) => (
  themes.flatMap((theme) => (
    Object.entries(viewports).map(([viewport, size]) => ({
      name: `${state}-${viewport}-${theme}`,
      role,
      state,
      theme,
      viewport,
      size,
      path: `browser-evidence/${state}-${viewport}-${theme}.png`,
    }))
  ))
)).concat([
  {
    name: 'teacher-answer-reveal-desktop-light',
    role: 'teacher',
    state: 'teacher-answer-reveal',
    theme: 'light',
    viewport: 'desktop',
    size: viewports.desktop,
    path: 'browser-evidence/teacher-answer-reveal-desktop-light.png',
  },
  {
    name: 'student-diagnostics-denied-mobile-light',
    role: 'student',
    state: 'teacher-diagnostics',
    theme: 'light',
    viewport: 'mobile',
    size: viewports.mobile,
    path: 'browser-evidence/student-diagnostics-denied-mobile-light.png',
  },
  {
    name: 'guest-readonly-mobile-dark',
    role: 'guest',
    state: 'guest-readonly',
    theme: 'dark',
    viewport: 'mobile',
    size: viewports.mobile,
    path: 'browser-evidence/guest-readonly-mobile-dark.png',
  },
]);

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

function isActiveStudentCase(item) {
  return item.role === 'student' && (
    item.state === 'student-released'
    || item.state === 'selected-hotspot'
    || item.state === 'student-submitted'
  );
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport: item.size });
    await page.addInitScript((theme) => {
      localStorage.setItem('ai-obe-theme', theme);
    }, item.theme);
    const url = `${baseUrl}/review/annotated-media-activity-564?${queryFor(item)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-annotated-media-kind="visual.annotatedMedia"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('[data-embedded-activity-kind="visual.embedded-activity"]').waitFor({ state: 'visible', timeout: 15000 });
    const activeStudentCase = isActiveStudentCase(item);
    if (!activeStudentCase) {
      await page.waitForFunction(() => document.querySelector('[data-annotated-media-submit="closed-loop-media"]')?.hasAttribute('disabled'), { timeout: 15000 });
    } else {
      await page.waitForFunction(() => !document.querySelector('[data-annotated-media-submit="closed-loop-media"]')?.hasAttribute('disabled'), { timeout: 15000 });
    }

    const checks = await page.evaluate(() => {
      const isVisible = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0);
      };
      const reviewMain = document.querySelector('[data-annotated-media-review="issue-564"]');
      const diagnostics = document.querySelector('[data-annotated-media-teacher-diagnostics="visible"]');
      const pair = document.querySelector('[data-annotated-media-module-pair="visible"]');
      const pairRect = pair?.getBoundingClientRect();
      const diagnosticsRect = diagnostics?.getBoundingClientRect();
      const overlapsDiagnostics = Boolean(
        pairRect
        && diagnosticsRect
        && diagnosticsRect.left < pairRect.right
        && diagnosticsRect.right > pairRect.left
        && diagnosticsRect.top < pairRect.bottom
        && diagnosticsRect.bottom > pairRect.top,
      );
      return {
        noVerticalListClass: !(reviewMain?.outerHTML ?? '').includes('space-y-4'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
          && document.body.scrollWidth <= document.body.clientWidth,
        mediaCanvas: isVisible('[data-annotated-media-canvas="normalized"]'),
        maskVisible: isVisible('[data-annotated-media-mask="visible"]'),
        hotspotCount: document.querySelectorAll('button[data-annotated-media-annotation-id]').length,
        inputHotspotVisible: isVisible('[data-annotated-media-annotation-id="input-hotspot"]'),
        outputHotspotVisible: isVisible('[data-annotated-media-annotation-id="output-hotspot"]'),
        riskHotspotVisible: isVisible('[data-annotated-media-annotation-id="risk-hotspot"]'),
        roleInputVisible: Boolean(document.querySelector('[data-annotated-media-evidence-role="input"]')),
        roleRiskVisible: Boolean(document.querySelector('[data-annotated-media-evidence-role="risk"]')),
        embeddedOptions: document.querySelectorAll('button[data-embedded-activity-option-id]').length,
        annotatedSubmitCount: document.querySelectorAll('button[data-annotated-media-submit]').length,
        embeddedSubmitCount: document.querySelectorAll('button[data-embedded-activity-submit]').length,
        enabledSubmitCount: document.querySelectorAll('button[data-annotated-media-submit]:not([disabled]),button[data-embedded-activity-submit]:not([disabled])').length,
        diagnosticsVisible: Boolean(diagnostics),
        answerRevealVisible: Boolean(document.querySelector('[data-annotated-media-answer-reveal="visible"]')),
        diagnosticsAccessDenied: Boolean(document.querySelector('[data-annotated-media-diagnostics-access="teacher-only"]')),
        diagnosticsUseTeachingLabels: Boolean(
          document.querySelector('[data-annotated-media-diagnostic-selected]')?.textContent?.includes('输入信号')
          && document.querySelector('[data-annotated-media-diagnostic-omitted]')?.textContent?.includes('反馈风险')
          && document.querySelector('[data-annotated-media-diagnostic-roles]')?.textContent?.includes('output')
        ),
        teacherDiagnosticsClearPrimaryStage: !overlapsDiagnostics,
        noInternalLeaks: !/(payload|renderer|visual\\.annotated|visual\\.embedded|structure-intro\\.svg)/i.test(reviewMain?.textContent ?? ''),
      };
    });

    const accessibility = {
      keyboardTargetTypes: [],
      keyboardReachable: false,
      visibleFocus: false,
      clickedSelection: false,
      evidenceSubmitted: false,
    };
    const selectableHotspotId = item.state === 'teacher-diagnostics' ? 'risk-hotspot' : 'input-hotspot';
    const hotspot = page.locator(`[data-annotated-media-annotation-id="${selectableHotspotId}"]`).first();
    if (activeStudentCase) {
      await hotspot.focus();
      await hotspot.press('Enter');
      try {
        await page.waitForFunction(() => {
          const panel = document.querySelector('[data-annotated-media-kind="visual.annotatedMedia"]');
          return Number(panel?.getAttribute('data-annotated-media-selected-count') ?? '0') > 0;
        }, undefined, { timeout: 1500 });
      } catch {
        await hotspot.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => {
          const panel = document.querySelector('[data-annotated-media-kind="visual.annotatedMedia"]');
          return Number(panel?.getAttribute('data-annotated-media-selected-count') ?? '0') > 0;
        }, undefined, { timeout: 5000 });
      }
    }
    accessibility.clickedSelection = await page.locator('[data-annotated-media-kind="visual.annotatedMedia"]').evaluate(
      (element) => Number(element.getAttribute('data-annotated-media-selected-count') ?? '0') > 0,
    );
    if (activeStudentCase) {
      const option = page.locator('[data-embedded-activity-option-id="output-hotspot"]');
      await option.focus();
      await option.press('Enter');
      const mediaSubmit = page.locator('[data-annotated-media-submit="closed-loop-media"]');
      await mediaSubmit.focus();
      await mediaSubmit.press('Enter');
      const activitySubmit = page.locator('[data-embedded-activity-submit="media-choice"]');
      await activitySubmit.focus();
      await activitySubmit.press('Enter');
    }
    accessibility.evidenceSubmitted = await page.locator('[data-annotated-media-last-submission="visible"]').count() > 0;

    for (let index = 0; index < 80; index += 1) {
      await page.keyboard.press('Tab');
      const snapshot = await page.evaluate(() => {
        const active = document.activeElement;
        const rect = active?.getBoundingClientRect();
        const targetType =
          active?.getAttribute('data-annotated-media-annotation-id') ? 'hotspot'
            : active?.getAttribute('data-embedded-activity-option-id') ? 'embedded-option'
              : active?.getAttribute('data-annotated-media-submit') ? 'media-submit'
                : active?.getAttribute('data-embedded-activity-submit') ? 'activity-submit'
                  : null;
        return {
          targetType,
          visibleFocus: Boolean(targetType && rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth),
        };
      });
      if (snapshot.targetType && !accessibility.keyboardTargetTypes.includes(snapshot.targetType)) accessibility.keyboardTargetTypes.push(snapshot.targetType);
      accessibility.visibleFocus = accessibility.visibleFocus || snapshot.visibleFocus;
      if (accessibility.keyboardTargetTypes.length >= (activeStudentCase ? 4 : 1)) break;
    }
    accessibility.keyboardReachable = activeStudentCase
      ? ['hotspot', 'embedded-option', 'media-submit', 'activity-submit'].every((targetType) => accessibility.keyboardTargetTypes.includes(targetType))
      : accessibility.keyboardTargetTypes.length === 0;

    if (
      !checks.noVerticalListClass
      || !checks.noHorizontalOverflow
      || !checks.mediaCanvas
      || !checks.maskVisible
      || checks.hotspotCount < 3
      || !checks.inputHotspotVisible
      || !checks.outputHotspotVisible
      || !checks.riskHotspotVisible
      || !checks.roleInputVisible
      || !checks.roleRiskVisible
      || checks.embeddedOptions < 3
      || checks.annotatedSubmitCount < 1
      || checks.embeddedSubmitCount < 1
      || !checks.teacherDiagnosticsClearPrimaryStage
      || !checks.noInternalLeaks
      || (item.state === 'teacher-answer-reveal' && !checks.answerRevealVisible)
      || (item.state === 'teacher-reveal' && checks.answerRevealVisible)
      || !accessibility.keyboardReachable
      || (activeStudentCase && !accessibility.visibleFocus)
      || (activeStudentCase && !accessibility.clickedSelection)
      || (!activeStudentCase && accessibility.clickedSelection && item.state !== 'selected-hotspot' && item.state !== 'student-submitted')
      || (activeStudentCase && !accessibility.evidenceSubmitted)
      || (!activeStudentCase && (accessibility.evidenceSubmitted || checks.enabledSubmitCount > 0))
    ) {
      throw new Error(`${item.name} failed annotated media browser checks: ${JSON.stringify({ checks, accessibility })}`);
    }
    if (item.state === 'teacher-diagnostics' && item.role === 'teacher' && (!checks.diagnosticsVisible || !checks.diagnosticsUseTeachingLabels)) {
      throw new Error(`${item.name} did not show teacher diagnostics labels: ${JSON.stringify(checks)}`);
    }
    if (item.state === 'teacher-diagnostics' && item.role !== 'teacher' && (checks.diagnosticsVisible || !checks.diagnosticsAccessDenied)) {
      throw new Error(`${item.name} exposed teacher diagnostics to ${item.role}: ${JSON.stringify(checks)}`);
    }

    const screenshotPath = resolve(outDir, item.path);
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({
      ...item,
      route: '/review/annotated-media-activity-564',
      url,
      screenshot: `artifacts/interactive-learning/annotated-media-activity-564/${item.path}`,
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
  route: '/review/annotated-media-activity-564',
  roles: ['student', 'teacher'],
  rolesWithGuest: ['student', 'teacher', 'guest'],
  themes,
  viewports: Object.keys(viewports),
  states: [...new Set(cases.map((item) => item.state))],
  matrix: {
    requiredCoreStates: coreStates.map((item) => item.state),
    themes,
    viewports: Object.keys(viewports),
    expectedCoreCaptures: coreStates.length * themes.length * Object.keys(viewports).length,
    actualCoreCaptures: results.filter((item) => coreStates.some((core) => core.state === item.state && core.role === item.role)).length,
  },
  noHorizontalOverflow: results.every((item) => item.checks.noHorizontalOverflow),
  teacherDiagnosticsClearPrimaryStage: results.every((item) => item.checks.teacherDiagnosticsClearPrimaryStage),
  hotspotSelectionVerified: results.filter(isActiveStudentCase).every((item) => item.checks.clickedSelection),
  embeddedActivityVerified: results.every((item) => item.checks.embeddedOptions >= 3),
  keyboardSelectionVerified: results.every((item) => item.checks.keyboardReachable),
  teacherAnswerRevealDistinct: results.some((item) => item.state === 'teacher-answer-reveal' && item.checks.answerRevealVisible)
    && results.some((item) => item.state === 'teacher-reveal' && !item.checks.answerRevealVisible)
    && results.find((item) => item.name === 'teacher-reveal-desktop-light')?.sha256 !== results.find((item) => item.name === 'teacher-answer-reveal-desktop-light')?.sha256,
  diagnosticsUseTeachingLabels: results
    .filter((item) => item.state === 'teacher-diagnostics')
    .filter((item) => item.role === 'teacher')
    .every((item) => item.checks.diagnosticsUseTeachingLabels),
  results,
};

writeFileSync(resolve(outDir, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: audit.status, captures: results.length }, null, 2));
