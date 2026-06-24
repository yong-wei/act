import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.DERIVATION_STAGE_REVIEW_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/derivation-stage-runtime-562');
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
    }, item.theme);
    const url = `${baseUrl}/review/derivation-stage-runtime-562?${queryFor(item)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('[data-derivation-stage-canvas="normalized"]');
    await canvas.waitFor({ state: 'visible', timeout: 15000 });
    const checks = await page.evaluate(() => {
      const canvasElement = document.querySelector('[data-derivation-stage-canvas="normalized"]');
      const reviewMain = document.querySelector('[data-derivation-stage-review="issue-562"]');
      const diagnostics = document.querySelector('[data-derivation-stage-teacher-diagnostics="visible"]');
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
      const blockRoles = [...document.querySelectorAll('[data-derivation-stage-color-role]')]
        .map((node) => node.getAttribute('data-derivation-stage-color-role'));
      const connectors = [...document.querySelectorAll('[data-derivation-stage-connector-id]')]
        .map((node) => ({
          id: node.getAttribute('data-derivation-stage-connector-id'),
          from: node.getAttribute('data-derivation-stage-connector-from'),
          to: node.getAttribute('data-derivation-stage-connector-to'),
          x1: node.getAttribute('x1'),
          y1: node.getAttribute('y1'),
          x2: node.getAttribute('x2'),
          y2: node.getAttribute('y2'),
        }));
      return {
        freeform: canvasElement?.getAttribute('data-derivation-stage-layout') === 'freeform',
        noVerticalListClass: !(reviewMain?.outerHTML ?? '').includes('space-y-4'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
          && document.body.scrollWidth <= document.body.clientWidth,
        katexRendered: document.querySelectorAll('.katex').length > 0
          && canvasElement?.getAttribute('data-katex-rendered') === 'true',
        formulaBlockCount: document.querySelectorAll('[data-derivation-stage-formula-block-id]').length,
        hasSemanticColorRoles: blockRoles.includes('cancel') || blockRoles.includes('result'),
        revealStepCount: document.querySelectorAll('[data-derivation-stage-reveal-step-id]').length,
        connectorCount: connectors.length,
        connectorEndpointsBoundToTargets: connectors.some((connector) => (
          connector.id === 'definition-to-target'
          && connector.from === 'known-g'
          && connector.to === 'result-block'
          && connector.x1 !== '12'
          && connector.y1 !== '18'
          && connector.x2 !== '88'
          && connector.y2 !== '72'
        )),
        releaseState: document.querySelector('[data-derivation-stage-id]')?.getAttribute('data-derivation-stage-release-state'),
        teacherControlsClearPrimaryStage: !overlapsDiagnostics,
      };
    });
    let accessibility = { keyboardReachable: false, visibleFocus: false };
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      accessibility = await page.evaluate(() => {
        const active = document.activeElement;
        const rect = active?.getBoundingClientRect();
        const keyboardReachable = active?.getAttribute('data-derivation-stage-canvas') === 'normalized';
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
      throw new Error(`${item.name} failed derivation stage browser checks: ${JSON.stringify(checks)}`);
    }
    if (item.state === 'student-unreleased' || item.state === 'guest-unavailable') {
      if (checks.revealStepCount !== 0) {
        throw new Error(`${item.name} leaked reveal steps before release: ${JSON.stringify(checks)}`);
      }
    } else if (checks.revealStepCount < 3) {
      throw new Error(`${item.name} did not expose released reveal steps: ${JSON.stringify(checks)}`);
    }
    if ((item.state === 'teacher-reveal' || item.state === 'teacher-answer-reveal' || item.state === 'teacher-diagnostics') && !checks.connectorEndpointsBoundToTargets) {
      throw new Error(`${item.name} did not bind connector endpoints to visible targets: ${JSON.stringify(checks)}`);
    }
    if (item.state !== 'student-unreleased' && item.state !== 'guest-unavailable' && !checks.katexRendered) {
      throw new Error(`${item.name} did not render released formulas through KaTeX: ${JSON.stringify(checks)}`);
    }
    const screenshotPath = resolve(outDir, item.path);
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({
      ...item,
      route: '/review/derivation-stage-runtime-562',
      url,
      screenshot: `artifacts/interactive-learning/derivation-stage-runtime-562/${item.path}`,
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
  route: '/review/derivation-stage-runtime-562',
  roles: ['student', 'teacher'],
  rolesWithGuest: ['student', 'teacher', 'guest'],
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
  katexRendered: results
    .filter((item) => item.state !== 'student-unreleased' && item.state !== 'guest-unavailable')
    .every((item) => item.checks.katexRendered),
  formulaBlockRolesVerified: results.some((item) => item.checks.hasSemanticColorRoles),
  connectorEndpointsVerified: results.some((item) => item.checks.connectorEndpointsBoundToTargets),
  results,
};

writeFileSync(resolve(outDir, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: audit.status, captures: results.length }, null, 2));
