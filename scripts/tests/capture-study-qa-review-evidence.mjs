import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { chromium } from '@playwright/test';

import { accountByKey } from '../db/verified-test-accounts.mjs';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const baseUrl = readArgument('--base-url');
const outputDir = readArgument('--output-dir');
const executablePath = readArgument('--executable-path');

if (!baseUrl || !outputDir || !executablePath) {
  throw new Error('Usage: node capture-study-qa-review-evidence.mjs --base-url <url> --output-dir <path> --executable-path <path>');
}

const routes = [
  { name: 'generic-chat', path: '/simulations' },
  { name: 'course-question', path: '/interactive-learning/courses/unit-1-1-see-the-full-picture' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 320, height: 900 },
];
const admin = accountByKey('admin');
const TEST_ACCOUNT = {
  account: admin.loginId,
  password: admin.password,
};

function citationGuard(verified) {
  const citation = {
    id: 'content:closed-loop:derivation',
    sourceType: 'content',
    displayTitle: '闭环传递函数教材片段',
    href: '/knowledge',
    confidence: 'high',
    evidenceBasis: 'source-pack:study-qa-review',
    citationTargetId: 'closed-loop:derivation',
    verified: true,
  };

  return verified
    ? {
      status: 'verified',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: [],
      studyQuestion: {
        intent: 'formula-derivation',
        requiredSections: ['推导步骤', '适用条件'],
        normativeGuidance: 'verified',
      },
      answerUnits: [{
        unit: '闭环传递函数的分母为 1 + G(s)H(s)',
        citationId: citation.id,
        citationTargetId: citation.citationTargetId,
        limitation: null,
      }],
      citations: [citation],
      retrievalSources: [citation],
    }
    : {
      status: 'unverified',
      missingCitationClasses: ['authoritative-source'],
      lowConfidenceReasons: ['normative-guidance-verification-required'],
      diagnosticReasons: [],
      studyQuestion: {
        intent: 'normative-content',
        requiredSections: ['核验说明'],
        normativeGuidance: 'verification-required',
      },
      answerUnits: [],
      citations: [],
      retrievalSources: [],
    };
}

function streamResponse(verified) {
  const answer = verified
    ? '闭环传递函数的分母为 1 + G(s)H(s)。[证据: content:closed-loop:derivation]'
    : '该规范性结论当前缺少可验证的权威来源，需核验后再采用。';
  const metadata = { konlingCitationGuard: citationGuard(verified) };
  const chunks = [
    { type: 'start', messageId: `study-qa-${verified ? 'verified' : 'unverified'}`, messageMetadata: metadata },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: answer },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', messageMetadata: metadata },
  ];
  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function navigateToApplication(page, pathname) {
  const target = new URL(pathname, baseUrl);
  await page.goto(target.toString(), { waitUntil: 'commit', timeout: 60_000 }).catch((error) => {
    const actual = new URL(page.url());
    if (actual.origin !== target.origin || actual.pathname !== target.pathname) {
      throw error;
    }
  });
}

async function openSidebar(page) {
  const opener = page.locator('button[aria-label*="控灵"]').first();
  await opener.waitFor({ state: 'visible', timeout: 30_000 });
  await opener.click();
  await page.locator('input[name="global-ai-sidebar-input"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function establishAuthenticatedSession(context) {
  const page = await context.newPage();
  try {
    const csrfResponse = await page.request.get(new URL('/api/auth/csrf', baseUrl).toString());
    const csrf = await csrfResponse.json();
    if (!csrfResponse.ok() || typeof csrf.csrfToken !== 'string') {
      throw new Error(`Failed to obtain test-session CSRF token: ${csrfResponse.status()}`);
    }

    const loginResponse = await page.request.post(new URL('/api/auth/callback/credentials?json=true', baseUrl).toString(), {
      form: {
        csrfToken: csrf.csrfToken,
        email: TEST_ACCOUNT.account,
        password: TEST_ACCOUNT.password,
        callbackUrl: baseUrl,
        json: 'true',
      },
    });
    if (!loginResponse.ok()) {
      throw new Error(`Failed to establish test session: ${loginResponse.status()}`);
    }

    const sessionResponse = await page.request.get(new URL('/api/auth/session', baseUrl).toString());
    const session = await sessionResponse.json();
    if (!sessionResponse.ok() || typeof session?.user?.role !== 'string') {
      throw new Error(`Test session is missing an authenticated role: ${sessionResponse.status()}`);
    }
  } finally {
    await page.close();
  }
}

async function sendQuestion(page, question, status) {
  const input = page.locator('input[name="global-ai-sidebar-input"]');
  await input.fill(question);
  await input.press('Enter');
  await page.locator(`[data-konling-citation-panel][data-konling-citation-status="${status}"]`).last().waitFor({
    state: 'visible',
    timeout: 10_000,
  });
}

async function captureState(page, route, viewport, state) {
  const filename = `${route.name}-${viewport.width}-${state}.png`;
  const screenshotPath = resolve(outputDir, filename);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const evaluation = await page.evaluate(() => ({
    visibleMessageText: Array.from(document.querySelectorAll('.ai-message-content'))
      .map((element) => element.textContent ?? '')
      .join('\n'),
    citationStatuses: Array.from(document.querySelectorAll('[data-konling-citation-panel]'))
      .map((element) => element.dataset.konlingCitationStatus ?? null),
    studyContracts: Array.from(document.querySelectorAll('[data-konling-study-question-contract]'))
      .map((element) => element.textContent ?? ''),
    horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > window.innerWidth + 1,
  }));

  return {
    route: route.path,
    routeName: route.name,
    viewport: { width: viewport.width, height: viewport.height },
    state,
    screenshot: relative(process.cwd(), screenshotPath),
    screenshotSha256: await sha256(screenshotPath),
    internalEvidenceMarkerHidden: !evaluation.visibleMessageText.includes('[证据:'),
    citationStatuses: evaluation.citationStatuses,
    normativeVerificationVisible: evaluation.studyContracts.some((contract) => contract.includes('需核验')),
    horizontalOverflow: evaluation.horizontalOverflow,
  };
}

async function captureRoute(browser, route, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const evidence = [];

  try {
    await establishAuthenticatedSession(context);
    const page = await context.newPage();
    await page.route('**/api/ai/chat', async (request) => {
      const body = request.request().postData() ?? '';
      const verified = !body.includes('规范性');
      await request.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
        body: streamResponse(verified),
      });
    });
    await navigateToApplication(page, route.path);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.waitForFunction(() => document.body?.innerText.trim().length > 20, null, { timeout: 10_000 });
    await openSidebar(page);
    await sendQuestion(page, '请推导闭环传递函数的分母。', 'verified');
    evidence.push(await captureState(page, route, viewport, 'verified'));

    await sendQuestion(page, '这条规范性要求是否可以直接采用？', 'missing');
    const unverified = await captureState(page, route, viewport, 'verification-required');
    unverified.historyMessagePreserved = unverified.citationStatuses.includes('verified');
    evidence.push(unverified);
  } finally {
    await context.close();
  }

  return evidence;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const evidence = [];
  for (const route of routes) {
    for (const viewport of viewports) {
      evidence.push(...await captureRoute(browser, route, viewport));
    }
  }
  const failures = evidence.filter((entry) => (
    !entry.internalEvidenceMarkerHidden
    || entry.horizontalOverflow
    || (entry.state === 'verified' && !entry.citationStatuses.includes('verified'))
    || (entry.state === 'verification-required' && (!entry.citationStatuses.includes('missing') || !entry.normativeVerificationVisible || !entry.historyMessagePreserved))
  ));
  const manifest = {
    change: 'upgrade-konling-traceable-study-qa',
    evidenceMode: 'route-ui-with-deterministic-server-shaped-chat-stream',
    generatedAt: new Date().toISOString(),
    baseUrl,
    browser: executablePath,
    evidence,
    failures,
  };
  await writeFile(resolve(outputDir, 'evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (failures.length > 0) throw new Error(`Study QA UI evidence failed: ${JSON.stringify(failures)}`);
} finally {
  await browser.close();
}
