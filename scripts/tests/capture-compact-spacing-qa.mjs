import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { accountByKey } from '../db/verified-test-accounts.mjs';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/compact-spacing-685');
const baseUrl = process.env.COMPACT_SPACING_QA_BASE_URL ?? 'http://localhost:3001';
const teacher = accountByKey('teacher');
const teacherAccount = process.env.COMPACT_SPACING_QA_TEACHER_ACCOUNT ?? teacher.loginId;
const teacherPassword = process.env.COMPACT_SPACING_QA_TEACHER_PASSWORD ?? teacher.password;
const appShellNavigationPreferenceKey = 'act:app-shell:navigation-preference';

const widths = [1024, 1100, 1279, 1440, 1920, 2560, 768, 320];
const routes = [
  { href: '/knowledge', family: 'knowledge-map', readyText: '知识图谱' },
  { href: '/interactive-learning', family: 'text-first', readyText: 'Interactive Learning' },
  { href: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system', family: 'interactive-course-entry', readyText: '1-2：建模' },
  { href: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/demo?step=step-07', family: 'student-runtime', navigationMode: 'hidden-immersive', readyText: '方框图——系统的结构表达' },
  { href: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/demo?step=step-07', family: 'teacher-runtime', auth: 'teacher', navigationMode: 'hidden-immersive', readyText: '方框图——系统的结构表达' },
  { href: '/assessment/adaptive-practice', family: 'adaptive-practice', readyText: '自适应' },
  { href: '/simulations', family: 'simulation-workspace', readyText: '仿真' },
  { href: '/teacher', family: 'teacher-operations', auth: 'teacher', readyText: '教师运营台' },
  { href: '/teacher/grading-workbench?demo=1', family: 'report-evidence', auth: 'teacher', readyText: '报告评分工作台' },
  { href: '/login', family: 'form-first', navigationMode: 'auth-callback-panel', readyText: '账号登录', edgeMode: 'intrinsic' },
];

function sha256(relativePath) {
  return createHash('sha256')
    .update(readFileSync(path.join(repoRoot, relativePath)))
    .digest('hex');
}

function safeName(value) {
  return value
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}

async function prepareAuthenticatedTeacherSession(context) {
  const page = await context.newPage();
  try {
    await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    const loginForm = page.locator('form').first();
    await loginForm.locator('input[name="account"]').fill(teacherAccount);
    await loginForm.locator('input[name="password"]').fill(teacherPassword);
    const submitButton = loginForm.getByRole('button', { name: '登录' });
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    await submitButton.click();
    await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), null, { timeout: 15000 });
  } finally {
    await page.close();
  }
}

async function waitForHydratedPage(page, route) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const primary = document.querySelector('[data-platform-compact-page-edge="true"], [data-lesson-runtime-shell], main, body');
    const text = document.body?.innerText?.trim() ?? '';
    const primaryRect = primary?.getBoundingClientRect();
    const hasPrimary = Boolean(primaryRect && primaryRect.width > 0 && primaryRect.height > 0);
    const hasInteractiveControl = Boolean(document.querySelector('a[href], button, input, select, textarea, [role="button"]'));
    return hasPrimary && text.length > 20 && hasInteractiveControl && !/加载|Loading/i.test(text);
  }, null, { timeout: 30000 });
  if (route.readyText) {
    await page.waitForFunction((readyText) => document.body.innerText.includes(readyText), route.readyText, { timeout: 30000 });
  }
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function collectMetrics(page, route, width, screenshot) {
  return page.evaluate(({ route, width, screenshot }) => {
    const edge = document.querySelector('[data-platform-compact-page-edge="true"]')
      ?? document.querySelector('[data-lesson-runtime-shell]')
      ?? document.querySelector('main')
      ?? document.body;
    const edgeRect = edge.getBoundingClientRect();
    const body = document.body;
    const doc = document.documentElement;
    const dock = document.querySelector('[data-page-floating-controls]');
    const inspector = document.querySelector('[data-knowledge-inspector], [data-app-shell-zone="support-drawer"], [data-lesson-runtime-local-tools]');
    const navigationBoundaryRight = Array.from(document.querySelectorAll('[data-shell-navigation-state]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isVisible = rect.width > 0
          && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden';
        return isVisible ? rect.right : 0;
      })
      .reduce((max, value) => Math.max(max, value), 0);
    const dockRect = dock?.getBoundingClientRect();
    const inspectorRect = inspector?.getBoundingClientRect();
    const overlaps = Boolean(dockRect && inspectorRect && !(
      dockRect.right <= inspectorRect.left
      || dockRect.left >= inspectorRect.right
      || dockRect.bottom <= inspectorRect.top
      || dockRect.top >= inspectorRect.bottom
    ));
    const navigationState = route.navigationMode === 'hidden-immersive' || route.navigationMode === 'auth-callback-panel'
      ? route.navigationMode
      : width >= 1440
        ? (document.querySelector('[data-app-shell-navigation-state="expanded"]') ? 'desktop-expanded' : 'desktop-collapsed')
        : width <= 640
          ? 'mobile-drawer'
          : 'workspace-command-surface';
    const maxEdge = width >= 1024 ? 32 : width >= 640 ? 24 : 16;
    const pageLevelCenteredWrappers = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const className = typeof element.className === 'string' ? element.className : '';
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isVisible = rect.width > 0
          && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden';
        const hasCenteredWidthClass = /\bmx-auto\b/.test(className)
          && (/\bmax-w-/.test(className) || /\bcontainer\b/.test(className));
        const isPageScale = rect.width >= Math.min(window.innerWidth * 0.55, 720)
          && rect.height >= 120;
        const isAllowedComponent = Boolean(element.closest('[role="dialog"], [data-radix-popper-content-wrapper], [data-component-intrinsic-width], [data-page-floating-controls]'));
        if (!isVisible || !hasCenteredWidthClass || !isPageScale || isAllowedComponent) return null;
        return {
          tagName: element.tagName.toLowerCase(),
          className: className.slice(0, 180),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(Boolean)
      .slice(0, 12);
    const bodyText = document.body?.innerText?.trim() ?? '';
    const finalUrl = window.location.pathname + window.location.search;
    const hydrationReady = Boolean(document.querySelector('a[href], button, input, select, textarea, [role="button"]'))
      && bodyText.length > 20
      && !/加载|Loading/i.test(bodyText);
    const finalUrlMatches = finalUrl === route.href;

    return {
      href: route.href,
      family: route.family,
      edgeMode: route.edgeMode ?? 'page-edge',
      requestedUrl: route.href,
      finalUrl,
      finalUrlMatches,
      width,
      viewportWidth: window.innerWidth,
      navigationState,
      primaryContentLeft: Math.round(edgeRect.left),
      primaryContentRight: Math.round(edgeRect.right),
      primaryContentWidth: Math.round(edgeRect.width),
      navigationBoundaryRight: Math.round(navigationBoundaryRight),
      compactEdgeMaxPx: maxEdge,
      horizontalOverflow: Math.ceil(Math.max(body.scrollWidth, doc.scrollWidth)) > window.innerWidth + 1,
      auxiliaryCollisionFree: !overlaps,
      hydrationReady,
      pageLevelCenteredWrapperCount: pageLevelCenteredWrappers.length,
      pageLevelCenteredWrappers,
      screenshot,
      screenshotSha256: '',
    };
  }, { route, width, screenshot });
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const publicContext = await browser.newContext();
  const teacherContext = await browser.newContext();
  const visualEvidence = [];
  const diagnostics = [];

  try {
    await prepareAuthenticatedTeacherSession(teacherContext);
    for (const route of routes) {
      for (const width of widths) {
        const context = route.auth === 'teacher' ? teacherContext : publicContext;
        const page = await context.newPage();
        await page.setViewportSize({ width, height: 900 });
        const navigationPreference = width >= 1440 && width !== 1920 ? 'expanded' : 'collapsed';
        await page.addInitScript(({ storageKey, navigationPreference }) => {
          window.localStorage.setItem(storageKey, navigationPreference);
        }, { storageKey: appShellNavigationPreferenceKey, navigationPreference });
        const url = new URL(route.href, baseUrl).toString();
        console.log(`capturing ${route.family}@${width} ${route.href}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForHydratedPage(page, route);
        const fileName = `${route.family}-${width}-${safeName(route.href)}.png`;
        const absoluteScreenshot = path.join(outputDir, fileName);
        await page.screenshot({ path: absoluteScreenshot, fullPage: false });
        const screenshot = path.relative(repoRoot, absoluteScreenshot);
        const metrics = await collectMetrics(page, route, width, screenshot);
        metrics.screenshotSha256 = sha256(screenshot);
        visualEvidence.push(metrics);
        if (
          metrics.horizontalOverflow
          || !metrics.auxiliaryCollisionFree
          || !metrics.hydrationReady
          || !metrics.finalUrlMatches
          || metrics.pageLevelCenteredWrapperCount > 0
        ) diagnostics.push(metrics);
        await page.close();
      }
    }
  } finally {
    await publicContext.close();
    await teacherContext.close();
    await browser.close();
  }

  const evidence = {
    change: 'standardize-sitewide-compact-spacing',
    generatedAt: new Date().toISOString(),
    baseUrl,
    requiredWidths: widths,
    visualEvidence,
    diagnostics,
  };
  writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  if (diagnostics.length > 0) {
    throw new Error(`compact spacing visual diagnostics failed: ${JSON.stringify(diagnostics, null, 2)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
