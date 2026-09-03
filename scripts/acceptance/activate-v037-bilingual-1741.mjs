/**
 * #1741 browser acceptance: atomic zh↔en switching over the real product
 * chain with the sealed v0.37 qualification package.
 *
 * Root domain names (interface catalog), en concept labels, en search
 * matching, teaching/engineering relation labels, and switch-back integrity.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode } from 'next-auth/jwt';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3458';
const OUT_DIR = 'artifacts/activate-v037-bilingual-authority-graph-1741';

const envSecret = (readFileSync('.env', 'utf8').match(/^NEXTAUTH_SECRET=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
const secret = process.env.NEXTAUTH_SECRET ?? (envSecret || 'playwright-local-auth-secret-at-least-32-bytes');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const sessionToken = await encode({
  secret,
  token: { id: 'issue-1741-student', email: 'issue-1741-student@example.com', name: '1741学生', role: 'STUDENT' },
});
await context.addCookies([{
  name: 'next-auth.session-token',
  value: sessionToken,
  domain: '127.0.0.1',
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
}]);
const page = await context.newPage();
const results = {};
const zhChars = /[\u4e00-\u9fff]/;

try {
  await page.goto(`${BASE}/knowledge?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });
  await page.click('[data-knowledge-mode="active"]');
  await page.waitForSelector('[data-authority-domain-entry="modeling"]', { state: 'attached', timeout: 90_000 });
  results.rootLocaleZh = await page.locator('[data-graph-locale]').first().getAttribute('data-graph-locale');
  results.zhRootName = await page.locator('[data-authority-root-label="name"]').first().textContent();
  results.enButtonEnabledInitially = await page.locator('[data-graph-language="en"]').isEnabled();

  // Switch to English at the root level: domain names come from the interface catalog.
  await page.click('[data-graph-language="en"]');
  await page.waitForFunction(() => (
    document.querySelector('[data-graph-locale]')?.getAttribute('data-graph-locale') === 'en'
  ), { timeout: 60_000 });
  // 事务提交是原子的：等 root 帧真正落成英文（interface catalog 域名），
  // 而不是只等 locale 状态翻转。
  await page.waitForFunction(() => {
    const entry = document.querySelector('[data-authority-domain-entry="modeling"]');
    return entry && entry.textContent && /[A-Za-z]{3,}/.test(entry.textContent);
  }, { timeout: 60_000 });
  results.enRootName = await page.locator('[data-authority-root-label="name"]').first().textContent();
  results.enRootEntryText = await page.locator('[data-authority-domain-entry="modeling"]').textContent();
  results.enButtonPressed = await page.locator('[data-graph-language="en"]').getAttribute('aria-pressed');
  results.noUnavailableNotice = (await page.locator('[data-graph-language-unavailable="en"]').count()) === 0;

  // Enter the domain in English: concept labels and relations switch together.
  await page.locator('[data-authority-domain-entry="modeling"]').evaluate((el) => el.click());
  await page.waitForSelector('#active-authority-search', { timeout: 90_000 });
  // 域内 en 帧就绪：sr-only 语义边不再含中文（谓词/方向 label 已投影）。
  await page.waitForFunction(() => {
    const edges = document.querySelector('[data-active-authority-semantic-edges]');
    return edges && !/[\u4e00-\u9fff]/.test(edges.textContent ?? '');
  }, { timeout: 60_000 });
  const semanticDir = page.locator('[data-active-authority-semantic-nodes]');
  results.enDirectoryHasEntries = await semanticDir.locator('[data-active-authority-node]').count();
  const firstNodeText = await semanticDir.locator('[data-active-authority-node-label]').first().textContent();
  results.enFirstNodeLabel = firstNodeText?.slice(0, 60);
  results.enFrameZhLeakInDirectory = await semanticDir
    .locator('[data-active-authority-node-label]')
    .filter({ hasText: zhChars })
    .count();

  // English search must match English object names.
  await page.fill('#active-authority-search', 'gain');
  await page.waitForSelector('[data-active-authority-search-result]', { timeout: 60_000 });
  results.enSearchHits = await page.locator('[data-active-authority-search-result]').count();
  const firstHit = await page.locator('[data-active-authority-search-result]').first().innerText();
  results.enSearchFirstHit = firstHit.replace(/\n/g, ' | ').slice(0, 80);
  results.enSearchHitsContainZh = await page
    .locator('[data-active-authority-search-result]')
    .filter({ hasText: zhChars })
    .count();

  // Relation labels (sr-only semantic edges) must be English in the en frame.
  const edgeText = await page.locator('[data-active-authority-semantic-edges]').first().innerText();
  results.enSemanticEdgesSample = edgeText.split('\n').filter(Boolean).slice(0, 4);
  results.enEdgesContainZh = (edgeText.match(zhChars) ?? []).length;

  // Select a node: the inspector shows English name/description.
  await page.locator('[data-active-authority-search-result]').first().click();
  await page.waitForSelector('[data-active-authority-main="true"] [data-inspector-node-detail], [data-active-inspector-math]', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const inspectorText = await page.locator('[data-active-authority-graph="true"]').first().innerText();
  results.inspectorHasEnglish = /[A-Za-z]{4,}/.test(inspectorText);
  await page.screenshot({ path: `${OUT_DIR}/en-domain-inspector.png`, fullPage: false }).catch(() => undefined);

  // Switch back to Chinese inside the domain: labels restore atomically.
  await page.click('[data-graph-language="zh-CN"]');
  await page.waitForFunction(() => (
    document.querySelector('[data-graph-locale]')?.getAttribute('data-graph-locale') === 'zh-CN'
  ), { timeout: 60_000 });
  // 反向事务提交完成：目录第一项恢复中文。
  await page.waitForFunction(() => {
    const dir = document.querySelector('[data-active-authority-semantic-nodes]');
    return dir && /[\u4e00-\u9fff]/.test(dir.textContent ?? '');
  }, { timeout: 60_000 });
  const zhDirText = await page.locator('[data-active-authority-semantic-nodes]').first().innerText();
  results.zhRestoredDirectorySample = zhDirText.split('\n').filter(Boolean).slice(0, 3);
  results.zhRestoredHasChinese = zhChars.test(zhDirText);

  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: `${OUT_DIR}/zh-restored.png`, fullPage: false });
  results.ok = true;
} catch (error) {
  results.ok = false;
  results.error = String(error);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: `${OUT_DIR}/failure.png`, fullPage: true });
  } catch { /* best effort */ }
} finally {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/browser-evidence.json`, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
process.exit(results.ok ? 0 : 1);
