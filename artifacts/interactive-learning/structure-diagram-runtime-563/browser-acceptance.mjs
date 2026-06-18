import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.STRUCTURE_DIAGRAM_REVIEW_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/structure-diagram-runtime-563');
const coreStates = [
  { state: 'student-unreleased', role: 'student' },
  { state: 'student-released', role: 'student' },
  { state: 'graph-constructed', role: 'student' },
  { state: 'student-submitted', role: 'student' },
  { state: 'teacher-reveal', role: 'teacher' },
  { state: 'teacher-answer-reveal', role: 'teacher' },
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

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport: item.size });
    await page.addInitScript((theme) => {
      localStorage.setItem('ai-obe-theme', theme);
    }, item.theme);
    const url = `${baseUrl}/review/structure-diagram-runtime-563?${queryFor(item)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-structure-diagram-kind="visual.blockDiagram"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('[data-structure-diagram-kind="visual.signalFlowGraph"]').waitFor({ state: 'visible', timeout: 15000 });
    if (item.role === 'guest') {
      await page.waitForFunction(() => (
        document.querySelector('[data-structure-diagram-submit="closed-loop-signal-flow"]')?.hasAttribute('disabled')
      ), { timeout: 15000 });
    } else {
      await page.waitForFunction(() => (
        !document.querySelector('[data-structure-diagram-submit="closed-loop-signal-flow"]')?.hasAttribute('disabled')
      ), { timeout: 15000 });
    }
    const checks = await page.evaluate(() => {
      const isVisible = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0);
      };
      const reviewMain = document.querySelector('[data-structure-diagram-review="issue-563"]');
      const diagnostics = document.querySelector('[data-structure-diagram-teacher-diagnostics="visible"]');
      const pair = document.querySelector('[data-structure-diagram-module-pair="visible"]');
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
      const blockDiagram = document.querySelector('[data-structure-diagram-kind="visual.blockDiagram"]');
      const signalFlow = document.querySelector('[data-structure-diagram-kind="visual.signalFlowGraph"]');
      return {
        blockCanvas: Boolean(blockDiagram?.querySelector('[data-structure-diagram-canvas="normalized"]')),
        signalCanvas: Boolean(signalFlow?.querySelector('[data-structure-diagram-canvas="normalized"]')),
        noVerticalListClass: !(reviewMain?.outerHTML ?? '').includes('space-y-4'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
          && document.body.scrollWidth <= document.body.clientWidth,
        blockNodeCount: blockDiagram?.querySelectorAll('[data-structure-diagram-node-id]').length ?? 0,
        blockEdgeCount: blockDiagram?.querySelectorAll('[data-structure-diagram-edge-id]').length ?? 0,
        signalNodeCount: signalFlow?.querySelectorAll('[data-structure-diagram-node-id]').length ?? 0,
        branchCount: signalFlow?.querySelectorAll('[data-structure-diagram-branch-id]').length ?? 0,
        forwardPathVisible: isVisible('[data-structure-diagram-forward-path="g-forward unity-forward"]'),
        loopVisible: isVisible('[data-structure-diagram-loop="unity-forward h-feedback"]'),
        masonTraceVisible: isVisible('[data-structure-diagram-mason-term-id="delta-term"][data-structure-diagram-related-ids="forward-path-1 feedback-loop-1"]'),
        highlightedFeedback: Boolean(blockDiagram?.querySelector('[data-structure-diagram-edge-id="feedback-signal"][data-structure-diagram-edge-highlighted="true"]')),
        highlightedLoop: Boolean(signalFlow?.querySelector('[data-structure-diagram-branch-id="h-feedback"][data-structure-diagram-branch-highlighted="true"]')),
        selectableNodeCount: document.querySelectorAll('button[data-structure-diagram-node-id]').length,
        selectableEdgeCount: document.querySelectorAll('button[data-structure-diagram-edge-select-id]').length,
        selectableBranchCount: document.querySelectorAll('button[data-structure-diagram-branch-select-id]').length,
        selectableRevealCount: document.querySelectorAll('button[data-structure-diagram-reveal-id]').length,
        selectablePathCount: document.querySelectorAll('button[data-structure-diagram-forward-path]').length,
        selectableLoopCount: document.querySelectorAll('button[data-structure-diagram-loop]').length,
        selectableMasonCount: document.querySelectorAll('[data-structure-diagram-mason-term-id][role="button"],button[data-structure-diagram-mason-term-id]').length,
        submitCount: document.querySelectorAll('button[data-structure-diagram-submit]').length,
        enabledSubmitCount: document.querySelectorAll('button[data-structure-diagram-submit]:not([disabled])').length,
        teacherDiagnosticsVisible: Boolean(diagnostics),
        diagnosticsAccessDenied: Boolean(document.querySelector('[data-structure-diagram-diagnostics-access="teacher-only"]')),
        diagnosticsUseTeachingLabels: Boolean(
          document.querySelector('[data-structure-diagram-diagnostic-nodes]')?.textContent?.includes('中间变量 θ')
          && document.querySelector('[data-structure-diagram-diagnostic-paths]')?.textContent?.includes('前向路径 P1')
          && document.querySelector('[data-structure-diagram-diagnostic-loops]')?.textContent?.includes('反馈环路 L1')
          && document.querySelector('[data-structure-diagram-diagnostic-differences]')?.textContent?.includes('漏连反馈支路')
        ),
        teacherDiagnosticsClearPrimaryStage: !overlapsDiagnostics,
      };
    });
    let accessibility = {
      keyboardTargetTypes: [],
      keyboardReachable: false,
      visibleFocus: false,
      clickedSelection: false,
      evidenceSubmitted: false,
    };
    const selectableNode = page.locator('[data-structure-diagram-kind="visual.blockDiagram"] button[data-structure-diagram-node-id]').first();
    const selectableNodeId = await selectableNode.getAttribute('data-structure-diagram-node-id');
    await selectableNode.click({ force: true });
    await page.waitForFunction((nodeId) => (
      document.querySelector(`[data-structure-diagram-kind="visual.blockDiagram"] [data-structure-diagram-node-id="${nodeId}"]`)
        ?.getAttribute('data-structure-diagram-node-selected') === 'true'
    ), selectableNodeId, { timeout: 5000 });
    const clickedSelection = Boolean(selectableNodeId);
    if (item.role !== 'guest') {
      await page.locator('[data-structure-diagram-submit="closed-loop-signal-flow"]').click();
    }
    accessibility.evidenceSubmitted = await page.locator('[data-structure-diagram-last-submission="visible"]').count() > 0;
    for (let index = 0; index < 80; index += 1) {
      await page.keyboard.press('Tab');
      const snapshot = await page.evaluate(() => {
        const active = document.activeElement;
        const rect = active?.getBoundingClientRect();
        const targetType =
          active?.getAttribute('data-structure-diagram-node-id') ? 'node'
            : active?.getAttribute('data-structure-diagram-edge-select-id') ? 'edge'
              : active?.getAttribute('data-structure-diagram-branch-select-id') ? 'branch'
                : active?.getAttribute('data-structure-diagram-reveal-id') ? 'reveal'
                  : active?.getAttribute('data-structure-diagram-forward-path') ? 'path'
                    : active?.getAttribute('data-structure-diagram-loop') ? 'loop'
                      : active?.getAttribute('data-structure-diagram-mason-term-id') ? 'mason'
                        : null;
        return {
          targetType,
          visibleFocus: Boolean(targetType && rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth),
        };
      });
      if (snapshot.targetType && !accessibility.keyboardTargetTypes.includes(snapshot.targetType)) {
        accessibility.keyboardTargetTypes.push(snapshot.targetType);
      }
      accessibility.visibleFocus = accessibility.visibleFocus || snapshot.visibleFocus;
      if (accessibility.keyboardTargetTypes.length >= 7) break;
    }
    accessibility.keyboardReachable = ['node', 'edge', 'branch', 'reveal', 'path', 'loop', 'mason']
      .every((targetType) => accessibility.keyboardTargetTypes.includes(targetType));
    accessibility.clickedSelection = clickedSelection;
    if (
      !checks.blockCanvas
      || !checks.signalCanvas
      || !checks.noVerticalListClass
      || !checks.noHorizontalOverflow
      || checks.blockNodeCount < 8
      || checks.blockEdgeCount < 8
      || checks.signalNodeCount < 3
      || checks.branchCount < 3
      || !checks.forwardPathVisible
      || !checks.loopVisible
      || !checks.masonTraceVisible
      || checks.selectableNodeCount < 11
      || checks.selectableEdgeCount < 8
      || checks.selectableBranchCount < 3
      || checks.selectableRevealCount < 2
      || checks.selectablePathCount < 1
      || checks.selectableLoopCount < 1
      || checks.selectableMasonCount < 1
      || checks.submitCount < 2
      || !checks.teacherDiagnosticsClearPrimaryStage
      || !accessibility.keyboardReachable
      || !accessibility.visibleFocus
      || !accessibility.clickedSelection
      || (item.role !== 'guest' && !accessibility.evidenceSubmitted)
      || (item.role === 'guest' && (accessibility.evidenceSubmitted || checks.enabledSubmitCount > 0))
    ) {
      throw new Error(`${item.name} failed structure diagram browser checks: ${JSON.stringify({ checks, accessibility })}`);
    }
    if (item.state === 'teacher-diagnostics' && item.role === 'teacher' && (!checks.highlightedFeedback || !checks.highlightedLoop || !checks.diagnosticsUseTeachingLabels || !checks.teacherDiagnosticsVisible)) {
      throw new Error(`${item.name} did not highlight feedback evidence targets: ${JSON.stringify(checks)}`);
    }
    if (item.state === 'teacher-diagnostics' && item.role !== 'teacher' && (checks.teacherDiagnosticsVisible || !checks.diagnosticsAccessDenied)) {
      throw new Error(`${item.name} exposed teacher diagnostics to ${item.role}: ${JSON.stringify(checks)}`);
    }
    const screenshotPath = resolve(outDir, item.path);
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({
      ...item,
      route: '/review/structure-diagram-runtime-563',
      url,
      screenshot: `artifacts/interactive-learning/structure-diagram-runtime-563/${item.path}`,
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
  route: '/review/structure-diagram-runtime-563',
  roles: ['student', 'teacher'],
  rolesWithGuest: ['student', 'teacher', 'guest'],
  themes: ['light', 'dark'],
  viewports: ['mobile', 'desktop', 'projection'],
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
  blockDiagramVerified: results.every((item) => item.checks.blockCanvas && item.checks.blockNodeCount >= 8 && item.checks.blockEdgeCount >= 8),
  signalFlowGraphVerified: results.every((item) => item.checks.signalCanvas && item.checks.branchCount >= 3),
  pathLoopMasonTraceVerified: results.every((item) => item.checks.forwardPathVisible && item.checks.loopVisible && item.checks.masonTraceVisible),
  keyboardSelectionVerified: results.every((item) => item.checks.keyboardReachable && item.checks.clickedSelection),
  diagnosticsUseTeachingLabels: results
    .filter((item) => item.state === 'teacher-diagnostics')
    .filter((item) => item.role === 'teacher')
    .every((item) => item.checks.diagnosticsUseTeachingLabels),
  results,
};

writeFileSync(resolve(outDir, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: audit.status, captures: results.length }, null, 2));
