import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { chromium } from '@playwright/test';
import { prisma } from '@/lib/prisma';

config({ path: '.env.local', quiet: true });
const origin = process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3001';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
assert(process.env.ILAB_IDENTITY_STUB === 'local-fixture', 'This test requires the local ILAB protocol fixture');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const users: string[] = [];
let mappedUserId: string | undefined;
try {
  for (const role of [null, 'STUDENT', 'TEACHER', 'ADMIN'] as const) {
    const context = await browser.newContext({ viewport: { width: 1801, height: 867 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      if (role) {
        const employeeNumber = `QA-ILAB-${randomUUID()}`;
        const password = randomBytes(24).toString('base64url');
        const user = await prisma.user.create({ data: { name: '实验空间既有登录身份验收夹具', role,
          employeeNumber, passwordHash: await bcrypt.hash(password, 10) } });
        users.push(user.id);
        await page.goto(`${origin}/login?callbackUrl=%2Fsimulations`, { waitUntil: 'networkidle' });
        await page.getByPlaceholder('学号/工号').fill(employeeNumber);
        await page.getByPlaceholder('密码', { exact: true }).fill(password);
        await page.getByRole('button', { name: '登录', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/simulations', { waitUntil: 'domcontentloaded' });
        const prior = await (await context.request.get(`${origin}/api/auth/session`)).json();
        assert.equal(prior.user.id, user.id);
      }
      await page.goto(`${origin}/simulations/cruise?ticket=qa-identity-${role ?? 'anonymous'}&graphics=webgl`, { waitUntil: 'domcontentloaded' });
      await page.getByText('实验空间已连接，进度保存到实验空间账号，成绩与报告回传实验空间。', { exact: true }).waitFor();
      await page.waitForFunction(() => {
        const input = document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与方案依据"]');
        return input && !input.matches(':disabled') && !new URLSearchParams(location.search).has('ticket');
      });
      const identity = await (await context.request.get(`${origin}/api/auth/session`)).json();
      assert(identity.user.id && !users.includes(identity.user.id));
      assert.equal(identity.user.role, 'STUDENT');
      const account = await prisma.user.findUniqueOrThrow({ where: { id: identity.user.id }, select: { accountSource: true } });
      assert.equal(account.accountSource, 'ILAB');
      mappedUserId ??= identity.user.id;
      assert.equal(identity.user.id, mappedUserId);
      const originId = await page.evaluate(() => sessionStorage.getItem('act-vessel-origin:cruise-comfort'));
      assert(originId);
      const run = await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { originId }, select: { userId: true, appId: true } });
      assert.equal(run.userId, mappedUserId);
      assert.equal(run.appId, 'act-qa-first-release');
      assert.equal((await context.request.get(`${origin}/api/ai/sessions`)).status(), 200);
      console.log(JSON.stringify({ initialRole: role ?? 'anonymous', mappedStudent: true, accountSource: 'ILAB',
        sessionAndRunOwnerMatch: true, sameMappedAccount: true, konlingSessionStatus: 200, originalSceneReady: true }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
}
