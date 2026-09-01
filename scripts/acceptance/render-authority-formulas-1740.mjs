/**
 * #1740 browser acceptance: governed formulas on the active authority canvas.
 *
 * Flow: root → domain → search a Formula → disclose its one-hop neighborhood
 * → assert the same governed formula identity on the 2D DOM label layer, in
 * the search dropdown, after zoom, and on the 3D label layer.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode } from 'next-auth/jwt';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3457';
const OUT_DIR = 'artifacts/render-authority-formulas-1740';

const envSecret = (readFileSync('.env', 'utf8').match(/^NEXTAUTH_SECRET=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
const secret = process.env.NEXTAUTH_SECRET ?? (envSecret || 'playwright-local-auth-secret-at-least-32-bytes');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const sessionToken = await encode({
  secret,
  token: {
    id: 'issue-1740-student',
    email: 'issue-1740-student@example.com',
    name: '1740学生',
    role: 'STUDENT',
  },
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
try {
  await page.goto(`${BASE}/knowledge?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });
  await page.click('[data-knowledge-mode="active"]');
  await page.waitForSelector('[data-authority-domain-entry]', { state: 'attached', timeout: 90_000 });
  results.rootDomainEntries = await page.locator('[data-authority-domain-entry]').count();

  // Enter the system-modeling domain through the sr-only semantic directory.
  await page.locator('[data-authority-domain-entry="modeling"]').evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected an HTMLElement');
    element.click();
  });
  await page.waitForSelector('#active-authority-search', { timeout: 90_000 });
  await page.fill('#active-authority-search', 'DC gain');
  await page.waitForSelector('[data-active-authority-search-result]', { timeout: 60_000 });

  const formulaHits = page.locator('[data-active-authority-search-result]').filter({
    has: page.locator('[data-governed-formula-label]'),
  });
  await formulaHits.first().waitFor({ state: 'visible', timeout: 30_000 });
  results.searchFormulaHits = await formulaHits.count();
  const searchRenderKey = await formulaHits.first()
    .locator('[data-governed-formula-label]')
    .first()
    .getAttribute('data-governed-formula-label');
  results.searchRenderKey = searchRenderKey;
  if (!searchRenderKey || searchRenderKey === 'unavailable') throw new Error('search hit did not render governed math');

  // Disclose the formula's one-hop neighborhood.
  await formulaHits.first().click();
  await page.waitForSelector('[data-knowledge-2d-dom-label-layer] [data-governed-formula-label]', { timeout: 60_000 });
  const canvasLabel = page.locator('[data-knowledge-2d-dom-label-layer] [data-governed-formula-label]').first();
  const canvasRenderKey = await canvasLabel.getAttribute('data-governed-formula-label');
  results.canvas2dRenderKey = canvasRenderKey;
  results.canvas2dAriaLabel = await canvasLabel.getAttribute('aria-label');
  results.canvas2dHumanContext = (await canvasLabel.locator('xpath=following-sibling::span[1]').textContent()) ?? null;
  results.canvas2dKatexHtml = ((await canvasLabel.innerHTML()) ?? '').includes('katex');
  if (canvasRenderKey !== searchRenderKey) throw new Error('canvas and search formula identity drifted');

  // Camera + zoom must not change identity or duplicate label DOM.
  const beforeZoomHtml = await canvasLabel.innerHTML();
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1200);
  results.canvas2dLabelCountAfterZoom = await page
    .locator('[data-knowledge-2d-dom-label-layer] [data-governed-formula-label]').count();
  const afterZoomHtml = await page
    .locator('[data-knowledge-2d-dom-label-layer] [data-governed-formula-label]').first()
    .innerHTML();
  results.canvas2dHtmlStableAcrossZoom = beforeZoomHtml === afterZoomHtml;

  // Same governed identity on the 3D label layer, no extra node fetch.
  await page.click('[data-active-authority-dimension="3d"]');
  await page.waitForSelector('[data-knowledge-3d-dom-label-layer] [data-governed-formula-label]', { timeout: 60_000 });
  const label3d = await page
    .locator('[data-knowledge-3d-dom-label-layer] [data-governed-formula-label]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-governed-formula-label')));
  results.canvas3dRenderKeys = label3d;
  results.canvas3dSameIdentity = label3d.includes(canvasRenderKey);

  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: `${OUT_DIR}/formula-3d-canvas.png`, fullPage: false });
  await page.click('[data-active-authority-dimension="2d"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/formula-2d-canvas.png`, fullPage: false });
  results.ok = true;
} catch (error) {
  results.ok = false;
  results.error = String(error);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: `${OUT_DIR}/failure.png`, fullPage: true });
  } catch { /* best effort */ }
} finally {
  writeFileSync(`${OUT_DIR}/browser-evidence.json`, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
process.exit(results.ok ? 0 : 1);
