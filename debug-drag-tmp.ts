import { chromium, request } from 'playwright';
const baseUrl = 'http://localhost:3102';
const targetNode = 'z反变换_7_7959c077';

async function main() {
  const api = await request.newContext();
  const csrf = await (await api.get(`${baseUrl}/api/auth/csrf`)).json() as { csrfToken: string };
  const login = await api.post(`${baseUrl}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email: process.env.DEBUG_EMAIL!, password: process.env.DEBUG_PASSWORD!, redirect: 'false', json: 'true' },
  });
  if (!login.ok()) throw new Error('login failed');
  const storageState = await api.storageState();
  await api.dispose();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, storageState });
  const page = await context.newPage();
  await page.addInitScript(() => { window.localStorage.setItem('act:knowledge-product-qa', 'true'); });
  await page.goto(`${baseUrl}/knowledge?node=${encodeURIComponent(targetNode)}&qa=knowledge-product`);
  await page.waitForTimeout(6000);
  const modeSwitch = page.locator('[data-knowledge-mode="legacy"]').first();
  if (await modeSwitch.isVisible().catch(() => false)) { await modeSwitch.click(); await page.waitForTimeout(2500); }
  const canvas = page.locator('[data-knowledge-legacy-view="true"] [data-knowledge-canvas-primary="true"]').first();
  const sel = () => canvas.getAttribute('data-knowledge-selected-node-id') ?? canvas.getAttribute('data-knowledge-selectedNodeId');
  const control = page.locator(`[data-knowledge-legacy-view="true"] [data-knowledge-node-control="${targetNode}"]`).first();
  const controlState = async () => page.evaluate(`(() => {
    const c = document.querySelector('[data-knowledge-legacy-view="true"] [data-knowledge-node-control="${targetNode}"]');
    return c ? { ariaBusy: c.getAttribute('aria-busy'), ariaExpanded: c.getAttribute('aria-expanded'), box: c.getBoundingClientRect().width } : null;
  })()`);

  console.log('tool button visible:', await page.locator('[data-knowledge-desktop-tool="view-layout"]').first().isVisible().catch(() => false));
  const tool = page.locator('[data-knowledge-desktop-tool="view-layout"]').first();
  if (await tool.isVisible().catch(() => false)) { await tool.click(); await page.waitForTimeout(800); }
  console.log('initial sel:', await sel());
  console.log('control state initial:', JSON.stringify(await controlState()));

  const box1 = await control.boundingBox();
  console.log('box1:', JSON.stringify(box1));
  await page.mouse.click(box1!.x + 0.5, box1!.y + 0.5);
  await page.waitForTimeout(1500);
  console.log('after click1 sel:', await sel());
  console.log('control state after click1:', JSON.stringify(await controlState()));

  const box2 = await control.boundingBox();
  console.log('box2:', JSON.stringify(box2));
  if (box2) {
    await page.mouse.click(box2.x + 0.5, box2.y + 0.5);
    await page.waitForTimeout(1500);
    console.log('after click2 sel:', await sel());
    console.log('control state after click2:', JSON.stringify(await controlState()));
  } else {
    console.log('control box null after deselect');
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
