import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const baseUrl = process.env.UNIT_1_2_ACCEPTANCE_BASE_URL ?? 'http://localhost:3001';
const outDir = resolve('artifacts/interactive-learning/unit-1-2-visual-contract-2026-06-18');
const screenshotDir = join(outDir, 'screenshots');
const reportPath = join(outDir, 'reports/browser-visual-contract-audit.json');
const route = '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system';
const teacher = { account: 'test_teacher', password: 'TestTeacher@Just2026!' };

mkdirSync(screenshotDir, { recursive: true });

function bucket(label) {
  return {
    label,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
}

function attachLogging(page, log) {
  page.on('console', (message) => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    log.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/_next/webpack-hmr')) return;
    log.failedRequests.push(`${request.method()} ${url} ${request.failure()?.errorText ?? ''}`.trim());
  });
}

function isBenign(issue) {
  return issue.includes('pan-yz.cldisk.com')
    || issue.includes('s2.cldisk.com')
    || issue.includes("Failed to set the 'domain' property on 'Document'");
}

async function openPage(context, label) {
  const page = await context.newPage();
  const logs = bucket(label);
  attachLogging(page, logs);
  page.on('dialog', (dialog) => dialog.accept());
  return { page, logs };
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  const accountInput = page.locator('input[name="account"]');
  await accountInput.click();
  await accountInput.pressSequentially(teacher.account);
  await page.locator('input[name="password"]').fill(teacher.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 }).catch(() => null),
    page.getByRole('button', { name: '登录', exact: true }).click(),
  ]);
  if (new URL(page.url()).pathname.startsWith('/login')) {
    await page.waitForTimeout(5000);
  }
  if (new URL(page.url()).pathname.startsWith('/login')) {
    const body = await page.locator('body').innerText().catch(() => '');
    throw new Error(`teacher login did not leave /login: ${body.slice(0, 800)}`);
  }
}

async function gotoStable(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForSelector('[data-commercial-workspace="interactive-learning"]', { timeout: 20000 });
}

async function screenshot(page, name) {
  const path = join(screenshotDir, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function assertStep07BlockDiagram(page, report, scope) {
  const result = await page.evaluate(() => {
    const q = (selector) => document.querySelector(selector);
    const edgeGroup = (id) => q(`[data-structure-diagram-edge-id="${id}"]`);
    const edgePath = (id) => edgeGroup(id)?.querySelector('[data-structure-diagram-edge-main-line="true"]');
    const parseLastPoint = (d) => {
      const matches = [...d.matchAll(/(?:M|L)\s+([0-9.]+)\s+([0-9.]+)/g)];
      const last = matches.at(-1);
      if (!last) return null;
      return { x: Number(last[1]), y: Number(last[2]) };
    };
    const parseFirstPoint = (d) => {
      const match = d.match(/(?:M|L)\s+([0-9.]+)\s+([0-9.]+)/);
      if (!match) return null;
      return { x: Number(match[1]), y: Number(match[2]) };
    };
    const toPx = (point, svgRect) => ({
      x: svgRect.left + (point.x / 100) * svgRect.width,
      y: svgRect.top + (point.y / 100) * svgRect.height,
    });
    const close = (actual, expected, tolerance = 2.5) => Math.abs(actual - expected) <= tolerance;

    const diagram = q('[data-structure-diagram-id="closed-loop-block-diagram"]');
    const svg = q('[data-structure-diagram-svg="block"]');
    const sum = q('[data-structure-diagram-node-id="sum"]');
    const chrome = diagram?.closest('[data-commercial-module-chrome]');
    if (!diagram || !svg || !sum || !chrome) return { pass: false, reason: 'missing diagram, svg, sum, or chrome' };

    const svgRect = svg.getBoundingClientRect();
    const sumRect = sum.getBoundingClientRect();
    const sumCenter = { x: sumRect.left + sumRect.width / 2, y: sumRect.top + sumRect.height / 2 };
    const rEnd = parseLastPoint(edgePath('r-to-sum')?.getAttribute('d') ?? '');
    const eStart = parseFirstPoint(edgePath('sum-to-controller')?.getAttribute('d') ?? '');
    const feedbackEnd = parseLastPoint(edgePath('sensor-to-sum')?.getAttribute('d') ?? '');
    if (!rEnd || !eStart || !feedbackEnd) return { pass: false, reason: 'missing parsed endpoints' };

    const rEndPx = toPx(rEnd, svgRect);
    const eStartPx = toPx(eStart, svgRect);
    const feedbackEndPx = toPx(feedbackEnd, svgRect);
    const chromeStyle = getComputedStyle(chrome);
    const outputEdgeLabel = q('[data-structure-diagram-edge-label-id="output-to-sensor"]');
    const plantOutputLabel = q('[data-structure-diagram-edge-label-id="plant-to-output"]');
    const defaultEdges = [...document.querySelectorAll('[data-structure-diagram-edge-id]')].map((group) => ({
      id: group.getAttribute('data-structure-diagram-edge-id'),
      selected: group.getAttribute('data-structure-diagram-edge-selected'),
      highlighted: group.getAttribute('data-structure-diagram-edge-highlighted'),
      stroke: group.querySelector('[data-structure-diagram-edge-main-line="true"]')?.getAttribute('stroke'),
      vectorEffect: group.querySelector('[data-structure-diagram-edge-main-line="true"]')?.getAttribute('vector-effect'),
    }));

    const checks = {
      noModeLabel: !q('[data-structure-diagram-mode-label="visual"]'),
      noSubmit: !q('[data-structure-diagram-submit="closed-loop-block-diagram"]'),
      noOutputEdgeLabel: !outputEdgeLabel && !plantOutputLabel,
      chromeTransparent: chromeStyle.padding === '0px' && chromeStyle.borderLeftWidth === '0px' && chromeStyle.backgroundImage === 'none',
      rToSumLeftRim: close(rEndPx.x, sumRect.left) && close(rEndPx.y, sumCenter.y),
      sumToControllerRightRim: close(eStartPx.x, sumRect.right) && close(eStartPx.y, sumCenter.y),
      feedbackToSumBottomRim: close(feedbackEndPx.x, sumCenter.x) && close(feedbackEndPx.y, sumRect.bottom),
      allEdgesNonScaling: defaultEdges.every((edge) => edge.vectorEffect === 'non-scaling-stroke'),
      allEdgesDefaultUnselected: defaultEdges.every((edge) => edge.selected === 'false' && edge.highlighted === 'false'),
      allEdgesDefaultPrimary: defaultEdges.every((edge) => edge.stroke === 'hsl(var(--platform-action-primary))'),
      keyboardTargets: document.querySelectorAll('[data-structure-diagram-edge-keyboard-selectable="true"][role="button"][tabindex="0"]').length >= 7,
    };
    return {
      pass: Object.values(checks).every(Boolean),
      checks,
      endpoints: {
        rEndPx,
        eStartPx,
        feedbackEndPx,
        sumRect: { left: sumRect.left, right: sumRect.right, top: sumRect.top, bottom: sumRect.bottom, width: sumRect.width, height: sumRect.height },
      },
      defaultEdges,
    };
  });
  if (!result.pass) {
    throw new Error(`${scope} step-07 block diagram geometry failed: ${JSON.stringify(result, null, 2)}`);
  }

  await page.locator('[data-structure-diagram-edge-hit-target="sensor-to-sum"]').focus();
  await page.keyboard.press('Enter');
  const selected = await page.evaluate(() => {
    const group = document.querySelector('[data-structure-diagram-edge-id="sensor-to-sum"]');
    const main = group?.querySelector('[data-structure-diagram-edge-main-line="true"]');
    const halo = group?.querySelector('[data-structure-diagram-edge-halo]');
    return {
      selected: group?.getAttribute('data-structure-diagram-edge-selected'),
      highlighted: group?.getAttribute('data-structure-diagram-edge-highlighted'),
      stroke: main?.getAttribute('stroke'),
      haloStroke: halo?.getAttribute('stroke'),
    };
  });
  if (
    selected.selected !== 'true'
    || selected.highlighted !== 'true'
    || selected.stroke !== 'hsl(var(--platform-brand-evidence))'
    || selected.haloStroke !== 'hsl(var(--platform-brand-evidence))'
  ) {
    throw new Error(`${scope} step-07 keyboard edge selection failed: ${JSON.stringify(selected, null, 2)}`);
  }
  report[scope].blockDiagram = { geometry: result, keyboardSelection: selected };
}

async function assertVisible(page, selector, label) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20000 });
  return label;
}

async function assertBodyIncludes(page, text, label = text) {
  try {
    await page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      text,
      { timeout: 20000 },
    );
  } catch (error) {
    throw new Error(`missing visible text for ${label}: ${text}`);
  }
  return label;
}

async function assertBodyExcludes(page, forbidden) {
  const found = await page.evaluate((items) => {
    const text = document.body.innerText;
    return items.filter((item) => text.includes(item));
  }, forbidden);
  if (found.length > 0) {
    throw new Error(`visible internal naming leakage: ${found.join(', ')}`);
  }
}

async function studentAudit(browser, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const { page, logs } = await openPage(context, 'student-demo');
  report.logs.push(logs);

  const forbidden = [
    'svg-comparison',
    'interactive-figure',
    'drag-pole-panel',
    'ship-simulation',
    'payload',
    'capabilityRef',
    'unsupported',
    'Learning Content',
    '互动任务',
    '结构证据提交',
    '提交结构图证据',
  ];

  const steps = [
    {
      id: 'step-04',
      selectors: ['[data-visual-stage-id="modeling-paths"]'],
      texts: ['建模的两条路径', '机理建模', '数据驱动建模'],
    },
    {
      id: 'step-05',
      selectors: ['[data-derivation-stage-id="ship-equation-derivation"]'],
      texts: ['微分方程', '物理对象的第一次翻译'],
    },
    {
      id: 'step-07',
      selectors: ['[data-structure-diagram-id="closed-loop-block-diagram"]'],
      texts: ['方框图', '系统的结构表达'],
    },
    {
      id: 'step-08',
      selectors: ['[data-structure-diagram-id="closed-loop-signal-flow"]'],
      texts: ['信号流图', '变量间的决定关系'],
    },
    {
      id: 'step-09',
      selectors: ['[data-static-surface-3d-panel="magnitude-surface"]'],
      texts: ['三维幅值曲面', '重置视角'],
    },
    {
      id: 'step-10',
      selectors: [
        '[data-control-workbench-capability="control-root-locus-design-map"]',
        '[data-control-workbench-panel="root-locus"]',
      ],
      texts: ['拖动极点看响应', '提交当前观察'],
    },
    {
      id: 'step-11',
      selectors: [
        '[data-control-workbench-capability="control-linked-comparison"]',
        '[data-annotated-media-id="three-ships-response-evidence"]',
      ],
      texts: ['三艘船，三种行为', 'B 的近虚轴极点'],
    },
    {
      id: 'step-12',
      selectors: ['[data-derivation-stage-id="characteristic-equation-worked-example"]'],
      texts: ['从特征方程到行为判断', '特征方程'],
    },
    {
      id: 'step-14',
      selectors: ['[data-visual-stage-id="modeling-summary-map"]'],
      texts: ['建模专题的局部地图'],
    },
  ];

  for (const step of steps) {
    await gotoStable(page, `${route}/student/demo?step=${step.id}`);
    for (const selector of step.selectors) await assertVisible(page, selector, `${step.id}:${selector}`);
    for (const text of step.texts) await assertBodyIncludes(page, text);
    await assertBodyExcludes(page, forbidden);
    report.student.steps.push(step.id);
  }
  report.student.screenshots.step04 = await screenshot(page, 'student-step-04-visual-stage.png');
  await gotoStable(page, `${route}/student/demo?step=step-07`);
  await assertStep07BlockDiagram(page, report, 'student');
  report.student.screenshots.step07 = await screenshot(page, 'student-step-07-block-diagram.png');
  await gotoStable(page, `${route}/student/demo?step=step-08`);
  report.student.screenshots.step08 = await screenshot(page, 'student-step-08-signal-flow.png');
  await gotoStable(page, `${route}/student/demo?step=step-09`);
  report.student.screenshots.step09 = await screenshot(page, 'student-step-09-static-surface-3d.png');
  await gotoStable(page, `${route}/student/demo?step=step-11`);
  report.student.screenshots.step11 = await screenshot(page, 'student-step-11-control-and-hotspots.png');
  await context.close();
}

async function teacherAudit(browser, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const { page, logs } = await openPage(context, 'teacher-demo');
  report.logs.push(logs);
  await login(page);
  await gotoStable(page, `${route}/teacher/demo`);

  const forbidden = ['svg-comparison', 'interactive-figure', 'payload', 'capabilityRef', 'unsupported', 'Learning Content', '结构证据提交', '提交结构图证据'];
  const select = page.locator('select[name="lessonStep"]').first();
  const steps = [
    {
      id: 'step-04',
      selectors: ['[data-visual-stage-id="modeling-paths"]'],
      texts: ['建模的两条路径'],
    },
    {
      id: 'step-07',
      selectors: ['[data-structure-diagram-id="closed-loop-block-diagram"]'],
      texts: ['方框图'],
    },
    {
      id: 'step-09',
      selectors: ['[data-static-surface-3d-panel="magnitude-surface"]'],
      texts: ['三维幅值曲面'],
    },
    {
      id: 'step-10',
      selectors: ['[data-control-workbench-capability="control-root-locus-design-map"]'],
      texts: ['发放作答', '拖动极点看响应'],
    },
    {
      id: 'step-11',
      selectors: ['[data-control-workbench-capability="control-linked-comparison"]'],
      texts: ['三艘船，三种行为'],
    },
    {
      id: 'step-12',
      selectors: ['[data-derivation-stage-id="characteristic-equation-worked-example"]'],
      texts: ['从特征方程到行为判断'],
    },
  ];

  for (const step of steps) {
    await select.selectOption(step.id);
    await page.waitForFunction((id) => window.location.search.includes(id), step.id, { timeout: 10000 }).catch(() => undefined);
    for (const selector of step.selectors) await assertVisible(page, selector, `${step.id}:${selector}`);
    for (const text of step.texts) await assertBodyIncludes(page, text);
    await assertBodyExcludes(page, forbidden);
    report.teacher.steps.push(step.id);
  }
  await select.selectOption('step-07');
  await assertStep07BlockDiagram(page, report, 'teacher');
  report.teacher.screenshots.step07 = await screenshot(page, 'teacher-step-07-block-diagram.png');
  await select.selectOption('step-08');
  report.teacher.screenshots.step08 = await screenshot(page, 'teacher-step-08-signal-flow.png');
  await select.selectOption('step-09');
  report.teacher.screenshots.step09 = await screenshot(page, 'teacher-step-09-static-surface-3d.png');
  await select.selectOption('step-10');
  report.teacher.screenshots.step10 = await screenshot(page, 'teacher-step-10-control-workbench.png');
  await context.close();
}

async function main() {
  const report = {
    status: 'pass',
    baseUrl,
    checkedAt: new Date().toISOString(),
    student: { steps: [], screenshots: {}, blockDiagram: null },
    teacher: { steps: [], screenshots: {}, blockDiagram: null },
    logs: [],
    blockingLogIssues: [],
    benignLogIssues: [],
  };

  const browser = await chromium.launch({ headless: true });
  try {
    await studentAudit(browser, report);
    await teacherAudit(browser, report);
  } catch (error) {
    report.status = 'fail';
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    await browser.close();
    const issues = report.logs.flatMap((entry) => [
      ...entry.consoleErrors.map((message) => `${entry.label}: console error: ${message}`),
      ...entry.pageErrors.map((message) => `${entry.label}: page error: ${message}`),
      ...entry.failedRequests.map((message) => `${entry.label}: request failed: ${message}`),
    ]);
    report.benignLogIssues = issues.filter(isBenign);
    report.blockingLogIssues = issues.filter((issue) => !isBenign(issue));
    if (report.blockingLogIssues.length > 0 && report.status === 'pass') {
      report.status = 'fail';
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'pass') {
      throw new Error(`browser visual contract audit failed; see ${reportPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
