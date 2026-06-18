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
      texts: ['微分方程', '船舶航向方程', '惯性项'],
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

  const forbidden = ['svg-comparison', 'interactive-figure', 'payload', 'capabilityRef', 'unsupported', 'Learning Content'];
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
    student: { steps: [], screenshots: {} },
    teacher: { steps: [], screenshots: {} },
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
