import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const evidenceDir = 'artifacts/commercial-ui/interactive-ai-error-recovery-1870';
const CANARY = 'INTERNAL-STACK-CANARY-1870';
const COURSE_DEMO_URL = '/interactive-learning/courses/unit-2-1-modeling-language/student/demo';

type ChatFailure = { status: number; body: unknown } | { network: true } | { stream: string };

const providerUnavailable: Extract<ChatFailure, { status: number }> = {
  status: 503,
  body: {
    error: 'AI_SERVICE_UNAVAILABLE',
    message: '智能助手暂时无法连接外部模型，请稍后再试。',
    trace: `${CANARY} SiliconFlow`,
  },
};

async function addStudentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'interactive-error-student-1870',
      email: 'interactive-error-student-1870@example.test',
      name: 'Interactive Error Student',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

async function installCourseRoutes(page: Page, chatFailure: ChatFailure) {
  await page.route('**/api/auth/session', (route) => route.fulfill({
    json: {
      user: {
        id: 'interactive-error-student-1870',
        email: 'interactive-error-student-1870@example.test',
        name: 'Interactive Error Student',
        role: 'STUDENT',
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    },
  }));
  await page.route('**/api/ai/sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { conversations: [] } });
    }
    return route.fulfill({ status: 201, json: { id: 'conversation-interactive-1870' } });
  });
  await page.route('**/api/ai/sessions/**', (route) => route.fulfill({
    json: {
      id: 'conversation-interactive-1870',
      messages: [],
    },
  }));
  await page.route('**/api/ai/chat', (route) => {
    if ('network' in chatFailure) return route.abort('failed');
    if ('stream' in chatFailure) {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Interactive-AI-Session': 'recoverable' },
        body: chatFailure.stream,
      });
    }
    return route.fulfill({
      status: chatFailure.status,
      contentType: 'application/json',
      body: JSON.stringify(chatFailure.body),
    });
  });
}

async function openPanelAndAsk(page: Page, question: string) {
  // 页内 AI 助手挂在首个带 AI 提示的学习步骤（step 7/16），逐页前进直到出现入口。
  const openDialog = page.getByRole('button', { name: '向 AI 对照', exact: true });
  for (let attempt = 0; attempt < 16 && !(await openDialog.count()); attempt += 1) {
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await page.waitForTimeout(400);
  }
  await expect(openDialog).toBeVisible({ timeout: 30_000 });
  await openDialog.click();

  const input = page.locator('textarea[name="interactive-ai-input"]');
  await expect(input).toBeVisible();
  await input.fill(question);
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  return input;
}

async function assertNoRawFailureLeakage(page: Page, alertText: string) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(CANARY);
  expect(bodyText).not.toContain('AI_SERVICE_UNAVAILABLE');
  expect(bodyText).not.toContain('SiliconFlow');
  expect(bodyText).not.toContain('Failed to fetch');
  expect(bodyText).not.toContain('AI request failed');
  expect(alertText).toContain('智能');
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function captureEvidence(page: Page, filename: string) {
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, filename), fullPage: true });
}

for (const viewport of [{ name: 'desktop-1440', width: 1440, height: 900 }, { name: 'mobile-320', width: 320, height: 900 }]) {
  test(`interactive course AI panel renders student-safe 503 recovery at ${viewport.name}`, async ({ context, page }) => {
    test.setTimeout(120_000);
    await addStudentSession(context);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installCourseRoutes(page, providerUnavailable);
    await page.goto(COURSE_DEMO_URL, { waitUntil: 'domcontentloaded' });

    await openPanelAndAsk(page, '这一步的传递函数怎么列？');

    const alert = page.locator('[data-interactive-ai-error="service-unavailable"]');
    await expect(alert).toBeVisible();
    const alertText = await alert.innerText();
    await assertNoRawFailureLeakage(page, alertText);

    const retry = alert.getByRole('button', { name: '稍后重试' });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();

    await assertNoHorizontalOverflow(page);
    await captureEvidence(page, `interactive-503-${viewport.name}.png`);
  });
}

test('interactive course AI panel maps network failure to retry-later without raw exception text', async ({ context, page }) => {
  test.setTimeout(120_000);
  await addStudentSession(context);
  await installCourseRoutes(page, { network: true });
  await page.goto(COURSE_DEMO_URL, { waitUntil: 'domcontentloaded' });

  const input = await openPanelAndAsk(page, '断网时的问题');

  const alert = page.locator('[data-interactive-ai-error="network-unavailable"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('网络连接不可用，请检查网络后重试。');
  await expect(alert.getByRole('button', { name: '稍后重试' })).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Failed to fetch');
});

test('interactive course AI panel keeps the specialized isolation state with a re-ask action', async ({ context, page }) => {
  test.setTimeout(120_000);
  await addStudentSession(context);
  await installCourseRoutes(page, {
    status: 409,
    body: { error: 'INTERACTIVE_AI_RESOURCE_MISMATCH', trace: CANARY },
  });
  await page.goto(COURSE_DEMO_URL, { waitUntil: 'domcontentloaded' });

  await openPanelAndAsk(page, '会被隔离的问题');

  const alert = page.locator('[data-interactive-ai-error="state-conflict"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('当前资源的对话已隔离，请重新提问。');
  await expect(alert.getByRole('button', { name: '重新提问' })).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('INTERACTIVE_AI_RESOURCE_MISMATCH');
  expect(bodyText).not.toContain(CANARY);
});

test('interactive course AI panel renders the assistant reply after recovery and drops the prior failure', async ({ context, page }) => {
  test.setTimeout(120_000);
  await addStudentSession(context);

  let chatFailure: ChatFailure = providerUnavailable;
  await page.route('**/api/auth/session', (route) => route.fulfill({
    json: {
      user: {
        id: 'interactive-error-student-1870',
        email: 'interactive-error-student-1870@example.test',
        name: 'Interactive Error Student',
        role: 'STUDENT',
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    },
  }));
  await page.route('**/api/ai/sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { conversations: [] } });
    }
    return route.fulfill({ status: 201, json: { id: 'conversation-interactive-1870' } });
  });
  await page.route('**/api/ai/sessions/**', (route) => route.fulfill({
    json: { id: 'conversation-interactive-1870', messages: [] },
  }));
  await page.route('**/api/ai/chat', (route) => {
    if ('network' in chatFailure) return route.abort('failed');
    if ('stream' in chatFailure) {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Interactive-AI-Session': 'recoverable' },
        body: chatFailure.stream,
      });
    }
    return route.fulfill({
      status: chatFailure.status,
      contentType: 'application/json',
      body: JSON.stringify(chatFailure.body),
    });
  });

  await page.goto(COURSE_DEMO_URL, { waitUntil: 'domcontentloaded' });

  const input = await openPanelAndAsk(page, '失败后恢复的问题');
  await expect(page.locator('[data-interactive-ai-error="service-unavailable"]')).toBeVisible();

  // 完成匹配的恢复动作（稍后重试 → 聚焦输入）后服务恢复，同一会话继续提问成功。
  await page.locator('[data-interactive-ai-error="service-unavailable"]')
    .getByRole('button', { name: '稍后重试' })
    .click();
  chatFailure = { stream: `0:${JSON.stringify('先按开环增益列写传函，再代入阻尼比约束。')}\n` };
  await input.fill('失败后恢复的问题');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();

  await expect(page.getByText('先按开环增益列写传函，再代入阻尼比约束。')).toBeVisible();
  await expect(page.locator('[data-interactive-ai-error]')).toHaveCount(0);
  await expect(page.getByText('失败后恢复的问题').first()).toBeVisible();
  await captureEvidence(page, 'interactive-recovered-1440.png');
});
