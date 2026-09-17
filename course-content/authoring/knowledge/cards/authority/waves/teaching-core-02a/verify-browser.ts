import { chromium } from '@playwright/test';
import { verifiedAuthForm } from '../../../../../../../tests/verified-test-credentials';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const batch = dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:3004';
async function main() {
  const pid = execFileSync('lsof', ['-t', '-iTCP:3004', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n')[0];
  const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find((line) => line.startsWith('n'))?.slice(1);
  assert.equal(cwd, process.cwd());
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const csrf = await (await context.request.get(base + '/api/auth/csrf')).json();
    await context.request.post(base + '/api/auth/callback/credentials?json=true', { form: { ...verifiedAuthForm('student'), csrfToken: csrf.csrfToken, callbackUrl: base, json: 'true' } });
    const page = await context.newPage();
    await page.goto(base + '/knowledge', { timeout: 120000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新版', exact: true }).click();
    await page.getByRole('button', { name: '系统建模', exact: true }).press('Enter');
    await page.getByText('正在加载知识图谱…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
    await page.getByRole('button', { name: '元件级联负载效应' }).first().waitFor({ timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '元件级联负载效应', exact: true }).press('Enter');
    await page.getByText('正在加载节点详情…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
    await page.getByText('知识卡', { exact: true }).first().waitFor({timeout: 60000});
    await page.waitForLoadState('networkidle');
    await page.locator('button[data-active-resource-title="元件级联负载效应"]').click();
    await page.waitForLoadState('networkidle');
    await page.getByText('核对要点', { exact: false }).last().waitFor({ timeout: 60000 });
    assert((await page.locator('body').innerText()).includes('自检'));
    assert.equal(await page.locator('.katex-error').count(), 0, 'Visible card contains broken math');
    await page.screenshot({ path: join(batch, 'graph-card-browser.png'), fullPage: false });
    await page.getByText('核对要点', { exact: false }).last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(batch, 'graph-card-self-check.png'), fullPage: false });
    writeFileSync(join(batch, 'browser-verification.json'), JSON.stringify({status: 'passed', method: 'authenticated Playwright Chromium, graph domain -> precise component loading node -> resource viewer', keyboardGraphNavigation: true, displayedSelfCheck: true, readingCompletions: 0, representativeCard: '元件级联负载效应'}, null, 2) + '\n');
    console.log('PASS graph -> component loading card viewer -> authored self-check');
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
