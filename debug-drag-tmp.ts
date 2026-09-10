// 一次性探针 v2：probe 坐标拖拽 + legacy 读回。
import { chromium, request } from 'playwright';

const baseUrl = 'http://localhost:3102';

async function main() {
  const api = await request.newContext();
  const csrfResponse = await api.get(`${baseUrl}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const loginResponse = await api.post(`${baseUrl}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email: process.env.DEBUG_EMAIL!, password: process.env.DEBUG_PASSWORD!, redirect: 'false', json: 'true' },
  });
  if (!loginResponse.ok()) throw new Error(`login failed: ${loginResponse.status()}`);
  const storageState = await api.storageState();
  await api.dispose();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, storageState });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/knowledge?intent=contextual-recommendation`);
  await page.waitForTimeout(3000);
  const modeSwitch = page.locator('[data-knowledge-mode-control="legacy"]').first();
  if (await modeSwitch.isVisible().catch(() => false)) {
    await modeSwitch.click();
    await page.waitForTimeout(2000);
  }
  const canvas = page.locator('[data-knowledge-legacy-view="true"] [data-knowledge-canvas-primary="true"]').first();

  // 找可见的节点控制（boundingBox 非空）
  const allControls = page.locator('[data-knowledge-legacy-view="true"] [data-knowledge-node-control]');
  const total = await allControls.count();
  let nodeId: string | null = null;
  let box: { x: number; y: number; width: number; height: number } | null = null;
  for (let i = 0; i < Math.min(total, 40); i += 1) {
    const candidate = allControls.nth(i);
    const candidateBox = await candidate.boundingBox().catch(() => null);
    if (candidateBox && candidateBox.width > 0) {
      nodeId = await candidate.getAttribute('data-knowledge-node-control');
      box = candidateBox;
      console.log(`visible control #${i}:`, nodeId, JSON.stringify(candidateBox));
      break;
    }
  }
  console.log('total controls:', total);
  if (!nodeId || !box) throw new Error('no visible node control');

  // 真实点击选中
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  console.log('selectedNodeId:', await canvas.getAttribute('data-knowledge-selectedNodeId'));

  // probe 坐标
  const probePoints = await page.evaluate(`(() => {
    const probe = window.__knowledgeGraphProductQaSelectedNodeDragPoints;
    if (typeof probe !== 'function') return [];
    return probe().map((p) => ({ x: Number(p?.x), y: Number(p?.y) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  })()`) as Array<{ x: number; y: number }>;
  console.log('probe points:', JSON.stringify(probePoints.slice(0, 4)));

  // 悬停 probe 点 → 预览
  if (probePoints.length > 0) {
    await page.mouse.move(probePoints[0].x, probePoints[0].y);
    await page.waitForTimeout(400);
    console.log('preview count after hover:', await page.locator('[data-knowledge-local-panel="node-hover-preview"]').count());
  }

  // probe 点拖拽
  if (probePoints.length > 0) {
    const { x, y } = probePoints[0];
    await page.mouse.move(x, y);
    await page.waitForTimeout(150);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 36, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('after probe-drag pinned:', await canvas.getAttribute('data-knowledge-pinned-node-count'), 'sig:', (await canvas.getAttribute('data-knowledge-pinned-layout-signature'))?.slice(0, 80));
  }

  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
