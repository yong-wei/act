import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

test.describe.configure({ mode: 'serial' });

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1758-standalone-copilot-conversation');
const generatorPath = 'tests/standalone-copilot-conversation-1758.spec.ts';
const sourceFiles = [
  'src/app/ai/copilot/page.tsx',
  'src/hooks/useKonlingConversationLibrary.ts',
  'src/app/api/ai/chat/route.ts',
  'src/app/api/ai/sessions/route.ts',
] as const;
const representativeRoute = '/ai/copilot';
const screenshots: Array<Record<string, unknown>> = [];

type StoredConversation = {
  id: string;
  title: string;
  courseId: string;
  pageId: string;
  pinned: boolean;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }>;
};

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' }).trim();
}

function chatStream(text: string) {
  return [
    'data: {"type":"start","messageId":"assistant-1758"}',
    'data: {"type":"text-start","id":"text-1758"}',
    `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1758', delta: text })}`,
    'data: {"type":"text-end","id":"text-1758"}',
    'data: {"type":"finish","finishReason":"stop"}',
    'data: [DONE]',
    '',
  ].join('\n\n');
}

function summary(conversation: StoredConversation) {
  const { messages: _messages, ...rest } = conversation;
  return rest;
}

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const loginResponse = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: '/ai/copilot',
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}

async function installLibrary(page: Page, options?: { failActive?: boolean; failDelete?: boolean }) {
  const now = '2026-09-01T00:00:00.000Z';
  const conversations: StoredConversation[] = [{
    id: 'conv-owned',
    title: '已保存的控灵会话',
    courseId: 'ai-assistant',
    pageId: '/ai/copilot',
    pinned: false,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: '2026-09-08T00:00:00.000Z',
    messages: [
      { id: 'sys', role: 'system', content: '[控灵当前页面上下文]' },
      { id: 'user-1', role: 'user', content: '请解释稳态误差' },
      { id: 'assistant-1', role: 'assistant', content: '稳态误差是终值与参考值之差。' },
    ],
  }];
  const chatBodies: unknown[] = [];
  let nextId = 2;

  await page.route('**/api/ai/copilot-profile**', async (route) => {
    await route.fulfill({
      json: {
        version: 'governed-copilot-profile-context.v1',
        status: 'missing',
        authenticatedUserId: 'student-1',
        displayName: '张三',
        limitations: ['当前没有可核验的学习画像。'],
        nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '去做一次自适应练习，补充学习证据' },
      },
    });
  });

  await page.route('**/api/ai/sessions**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const id = url.pathname.replace(/^\/api\/ai\/sessions\/?/, '') || null;

    if (!id && method === 'GET') {
      await route.fulfill({ json: { conversations: conversations.map(summary) } });
      return;
    }
    if (!id && method === 'POST') {
      const created: StoredConversation = {
        id: `conv-new-${nextId++}`,
        title: '新对话',
        courseId: 'ai-assistant',
        pageId: '/ai/copilot',
        pinned: false,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        expiresAt: '2026-09-08T00:00:00.000Z',
        messages: [],
      };
      conversations.unshift(created);
      await route.fulfill({ json: created });
      return;
    }
    const conversation = conversations.find((item) => item.id === id);
    if (method === 'GET') {
      if (options?.failActive || !conversation) {
        await route.fulfill({ status: 404, json: { error: 'Conversation not found' } });
        return;
      }
      await route.fulfill({ json: { ...conversation, userId: 'student-1', assistantBinding: null } });
      return;
    }
    if (method === 'DELETE' && conversation) {
      if (options?.failDelete) {
        await route.fulfill({ status: 500, json: { error: '删除控灵会话失败' } });
        return;
      }
      const index = conversations.findIndex((item) => item.id === conversation.id);
      conversations.splice(index, 1);
      await route.fulfill({ json: { success: true, deletedConversationId: conversation.id } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'Conversation not found' } });
  });

  await page.route('**/api/ai/chat**', async (route) => {
    const payload = await route.request().postDataJSON();
    chatBodies.push(payload);
    const conversationId = typeof payload?.conversationId === 'string'
      ? payload.conversationId
      : typeof payload?.body?.conversationId === 'string'
        ? payload.body.conversationId
        : null;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversationId || !conversation) {
      await route.fulfill({ status: 404, json: { error: 'Conversation not found' } });
      return;
    }
    conversation.messages.push(
      { id: `user-${conversation.messages.length}`, role: 'user', content: '请继续解释' },
      { id: `assistant-${conversation.messages.length}`, role: 'assistant', content: '已写入同一会话。' },
    );
    await route.fulfill({
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: chatStream('已写入同一会话。'),
    });
  });

  return { conversations, chatBodies };
}

async function capture(page: Page, name: string, assertions: string[]) {
  mkdirSync(evidenceDir, { recursive: true });
  const file = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  const size = page.viewportSize();
  screenshots.push({
    file: `artifacts/commercial-ui/issue-1758-standalone-copilot-conversation/${name}.png`,
    sha256: sha256(readFileSync(file)),
    scenario: name,
    route: representativeRoute,
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    assertions,
  });
}

function assertNoOverflow(page: Page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  })).then((overflow) => {
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  });
}

test('standalone Copilot restores, sends, and governs conversation lifecycle', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });
  await establishAuthenticatedSession(page.context());
  const library = await installLibrary(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  const main = page.getByRole('main');
  await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-copilot-conversation-library]')).toBeVisible();
  await expect(main.getByText('请解释稳态误差')).toBeVisible();
  await expect(main.getByText('稳态误差是终值与参考值之差。')).toBeVisible();
  await expect(main.getByText('[控灵当前页面上下文]')).toHaveCount(0);
  await capture(page, 'restore-desktop-1440', ['refresh restores owned visible history']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(main.getByText('请解释稳态误差')).toBeVisible();

  const composer = main.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
  await composer.fill('请继续解释');
  await main.getByRole('button', { name: '发送' }).click();
  await expect.poll(() => library.chatBodies.length).toBeGreaterThan(0);
  const payload = library.chatBodies[0] as { conversationId?: string; body?: { conversationId?: string } };
  expect(payload.conversationId ?? payload.body?.conversationId).toBe('conv-owned');
  await expect(main.getByText('已写入同一会话。')).toBeVisible();

  await page.locator('[data-copilot-new-conversation]').click();
  await expect(page.locator('[data-copilot-conversation-select]')).toHaveValue(/conv-new-/);
  await expect(main.getByText('欢迎使用')).toBeVisible();
  await expect(page.locator('[data-copilot-conversation-select]').locator('option', { hasText: '已保存的控灵会话' })).toHaveCount(1);

  await page.locator('[data-copilot-conversation-select]').selectOption('conv-owned');
  await expect(main.getByText('请解释稳态误差')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('[data-copilot-delete-conversation]').click();
  await expect(page.locator('[data-copilot-conversation-select]').locator('option', { hasText: '已保存的控灵会话' })).toHaveCount(0);
  await expect(main.getByText('欢迎使用')).toBeVisible();
});

test('standalone Copilot recovery failure is not an empty conversation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });
  await establishAuthenticatedSession(page.context());
  await installLibrary(page, { failActive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
  const main = page.getByRole('main');
  await expect(page.locator('[data-copilot-conversation-status="recovery-failed"]')).toBeVisible();
  await expect(main.getByText('会话恢复失败，不是空会话。')).toBeVisible();
  await expect(main.getByRole('button', { name: '重试' })).toBeVisible();
  await expect(main.getByText('欢迎使用')).toHaveCount(0);
});

test('standalone Copilot keeps recovered history when delete fails', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });
  await establishAuthenticatedSession(page.context());
  await installLibrary(page, { failDelete: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
  const main = page.getByRole('main');
  await expect(main.getByText('请解释稳态误差')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('[data-copilot-delete-conversation]').click();
  await expect(main.getByText('智能助手暂时无法完成请求')).toBeVisible();
  await expect(page.locator('[data-copilot-conversation-status="recovery-failed"]')).toHaveCount(0);
  await expect(main.getByText('请解释稳态误差')).toBeVisible();
  await expect(main.getByLabel('请输入您的问题，例如：帮我解释一个控制概念')).toBeEnabled();
});

test('standalone Copilot stays usable at 320px and without a session', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('act:app-shell:navigation-preference', 'collapsed');
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
  const main = page.getByRole('main');
  await expect(page.locator('[data-copilot-conversation-status="unauthenticated"]')).toBeVisible();
  await expect(main.getByRole('link', { name: '登录后恢复会话' })).toBeVisible();
  await expect(main.getByLabel('请输入您的问题，例如：帮我解释一个控制概念')).toBeDisabled();
  await assertNoOverflow(page);

  await establishAuthenticatedSession(page.context());
  await installLibrary(page);
  await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
  const composer = main.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
  await expect(page.getByLabel('选择会话')).toBeVisible();
  await composer.focus();
  await expect(composer).toBeFocused();
  await expect(main.getByText('请解释稳态误差')).toBeVisible();
  await assertNoOverflow(page);
  await capture(page, 'restore-mobile-320', ['320px composer reachable without horizontal overflow']);

  const sourceRevision = git(['rev-parse', 'HEAD']);
  const files = [generatorPath, ...sourceFiles];
  const dirty = git(['status', '--porcelain', '--', generatorPath, ...sourceFiles]);
  expect(dirty, 'evidence source files must be clean at capture HEAD').toBe('');
  for (const file of files) {
    expect(git(['hash-object', file]), `${file} working tree must match ${sourceRevision}`).toBe(
      git(['rev-parse', `${sourceRevision}:${file}`]),
    );
  }
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'evidence-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    issue: 1758,
    capturedAt: new Date().toISOString(),
    commitSha: sourceRevision,
    generator: generatorPath,
    generatorSha256: sha256(readFileSync(join(process.cwd(), generatorPath))),
    representativeRoute,
    sourceSha256: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(join(process.cwd(), file)))]),
    ),
    sourceGitBlobIds: Object.fromEntries(
      files.map((file) => [file, git(['hash-object', file])]),
    ),
    screenshots,
  }, null, 2)}\n`);
});
