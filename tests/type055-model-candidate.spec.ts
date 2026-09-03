import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * type055-nanchang-101 v2.0.0 候选模型包浏览器验收（issue #1898 任务 3.3/3.4/5.2）。
 *
 * - QA 页首屏只请求一个 ship LOD；demo/payload/collision 不被请求；
 * - 代表性主舰动画与武器演示片段实际播放并产生可见节点变换；
 * - 弹药模板按需克隆生成、寿命销毁，与主舰生命周期分离；
 * - 候选 GLB 加载失败时回退旧模型候选链，画布仍可渲染。
 */

const PACKAGE_BASE = '/assets/model-releases/type055-nanchang-101/v2.0.0';
const LOD_URLS = [`${PACKAGE_BASE}/type055-nanchang-101-ship-lod0.glb`, `${PACKAGE_BASE}/type055-nanchang-101-ship-lod1.glb`, `${PACKAGE_BASE}/type055-nanchang-101-ship-lod2.glb`];
const DEMO_URL = `${PACKAGE_BASE}/type055-nanchang-101-weapon-demo.glb`;
const PAYLOAD_URL = `${PACKAGE_BASE}/type055-nanchang-101-weapon-payloads.glb`;
const COLLISION_URL = `${PACKAGE_BASE}/type055-nanchang-101-collision.glb`;
const LEGACY_PRIMARY = '/assets/models-opt/destroyer.glb';

const EVIDENCE_DIR = path.join(process.cwd(), 'artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance');

interface GlbRequestLedger {
  glbUrls: string[];
  bytes: Record<string, number>;
}

function trackGlbRequests(page: Page): GlbRequestLedger {
  const ledger: GlbRequestLedger = { glbUrls: [], bytes: {} };
  page.on('response', async (response) => {
    // 统一记录 pathname（response.url() 是绝对地址，比较基准是相对路径常量）
    const pathname = new URL(response.url()).pathname;
    if (!pathname.endsWith('.glb')) return;
    if (!ledger.glbUrls.includes(pathname)) ledger.glbUrls.push(pathname);
    if (ledger.bytes[pathname] === undefined) {
      try {
        const body = await response.body();
        ledger.bytes[pathname] = body.byteLength;
      } catch {
        ledger.bytes[pathname] = -1;
      }
    }
  });
  return ledger;
}

async function waitForQaReady(page: Page) {
  await page.goto('/simulations/type055-model-candidate', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__type055Qa?.ready === true, undefined, { timeout: 60_000 });
}

test.describe.configure({ mode: 'serial' });

test('first screen requests exactly one ship LOD and no weapon/collision roles', async ({ page }) => {
  const ledger = trackGlbRequests(page);
  await waitForQaReady(page);

  const shipUrl = await page.evaluate(() => window.__type055Qa?.shipUrl ?? null);
  expect(shipUrl).toBe(LOD_URLS[0]);

  const shipGlbs = ledger.glbUrls.filter((url) => LOD_URLS.includes(url));
  expect(shipGlbs).toEqual([LOD_URLS[0]]);
  // 武器与碰撞角色不得进入首屏请求
  expect(ledger.glbUrls).not.toContain(DEMO_URL);
  expect(ledger.glbUrls).not.toContain(PAYLOAD_URL);
  expect(ledger.glbUrls).not.toContain(COLLISION_URL);

  await expect(page.locator('canvas')).toHaveCount(1);
});

test('plays representative ship animations with observable node transforms', async ({ page }) => {
  await waitForQaReady(page);

  const cases: { clip: string; node: string }[] = [
    { clip: 'rudder_port', node: 'RUDDER_PORT' },
    { clip: 'prop_port_spin', node: 'PROP_PORT' },
    { clip: 'main_gun_yaw', node: 'MAIN_GUN_TURRET' },
    { clip: 'hangar_port_open', node: 'G05_HANGAR_PANEL_01' },
    { clip: 'vls_aft_r01_c01_hatch', node: 'VLS_AFT_ARRAY_R01_C01_HATCH_PIVOT' },
    { clip: 'national_flag_wind', node: 'FLAG_BONE_02' },
  ];
  const results: Record<string, unknown> = {};
  for (const { clip, node } of cases) {
    const moved = await page.evaluate(async ({ clipName, nodeName }) => {
      const api = window.__type055Qa!;
      const before = api.sampleNode(nodeName);
      if (!before) return { status: 'node-not-found', clip: clipName, node: nodeName };
      const played = api.playAnimation(clipName);
      if (played !== `playing:${clipName}`) return { status: played, clip: clipName, node: nodeName };
      await new Promise((resolve) => setTimeout(resolve, 700));
      const after = api.sampleNode(nodeName);
      const movedEnough = after !== null
        && (Math.abs(after.rotation[0] - before.rotation[0])
          + Math.abs(after.rotation[1] - before.rotation[1])
          + Math.abs(after.rotation[2] - before.rotation[2])
          + Math.abs(after.position[0] - before.position[0])
          + Math.abs(after.position[1] - before.position[1])
          + Math.abs(after.position[2] - before.position[2])) > 1e-4;
      return { status: movedEnough ? 'moved' : 'no-observable-transform', clip: clipName, node: nodeName, before, after };
    }, { clipName: clip, nodeName: node });
    results[clip] = moved;
    expect(moved.status, `${clip} on ${node}`).toBe('moved');
  }
  writeEvidence('ship-animations.json', results);
});

test('renders transparent decal materials from the package', async ({ page }) => {
  await waitForQaReady(page);
  const decals = await page.evaluate(() => window.__type055Qa!.decalMaterials());
  expect(decals.length).toBeGreaterThanOrEqual(2);
  for (const decal of decals) {
    expect(decal.transparent, `${decal.name} must be transparent`).toBe(true);
  }
  writeEvidence('decals.json', decals);
});

test('loads weapon demo on demand and plays its combined clips', async ({ page }) => {
  const ledger = trackGlbRequests(page);
  await waitForQaReady(page);

  await page.evaluate(() => window.__type055Qa!.demo.load());
  await page.waitForFunction(() => window.__type055Qa?.demo.loaded === true, undefined, { timeout: 60_000 });
  expect(ledger.glbUrls).toContain(DEMO_URL);

  const played = await page.evaluate(async () => {
    const api = window.__type055Qa!;
    const result: Record<string, string> = {};
    for (const clip of ['demo_weapon_systems_overview', 'demo_ciws_burst', 'demo_main_gun_fire', 'demo_hq10_launch']) {
      result[clip] = api.demo.play(clip);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return result;
  });
  for (const [clip, status] of Object.entries(played)) {
    expect(status, clip).toBe(`playing:${clip}`);
  }
  writeEvidence('demo-clips.json', played);
});

test('spawns and destroys payload munitions on demand, separate from the ship', async ({ page }) => {
  const ledger = trackGlbRequests(page);
  await waitForQaReady(page);

  await page.evaluate(() => window.__type055Qa!.payload.load());
  await page.waitForFunction(() => window.__type055Qa?.payload.loaded === true, undefined, { timeout: 60_000 });
  expect(ledger.glbUrls).toContain(PAYLOAD_URL);

  const lifecycle = await page.evaluate(() => {
    const api = window.__type055Qa!;
    const templates = api.payload.templates();
    const first = templates[0] ?? '';
    const spawnResult = api.payload.spawn(first);
    const spawned = api.payload.spawned();
    const destroyed = api.payload.destroyAll();
    const remaining = api.payload.spawned();
    return { templates, first, spawnResult, spawnedCount: spawned.length, destroyed, remainingCount: remaining.length };
  });
  expect(lifecycle.templates.length).toBeGreaterThan(0);
  expect(lifecycle.spawnResult).toMatch(/^spawned:/);
  expect(lifecycle.spawnedCount).toBe(1);
  expect(lifecycle.destroyed).toBe(1);
  expect(lifecycle.remainingCount).toBe(0);
  writeEvidence('payload-lifecycle.json', lifecycle);
});

test('falls back to the legacy candidate chain when the LOD GLB cannot load', async ({ page }) => {
  const ledger = trackGlbRequests(page);
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('.glb')) failedRequests.push(pathname);
  });
  for (const lod of LOD_URLS) {
    await page.route(lod, (route) => route.abort('failed'));
  }
  await page.goto('/simulations/type055-model-candidate', { waitUntil: 'domcontentloaded' });
  // 候选全部失败 → 旧模型候选链接管，QA 装配以旧模型 URL 就绪
  await page.waitForFunction(
    ([legacyOptimized, legacyOriginal]) => (
      window.__type055Qa?.shipUrl === legacyOptimized || window.__type055Qa?.shipUrl === legacyOriginal
    ),
    [LEGACY_PRIMARY, '/assets/destroyer.glb'],
    { timeout: 60_000 },
  );
  // 被拦截的候选请求以 requestfailed 记录；旧模型候选链最终成功响应
  expect(failedRequests.some((url) => LOD_URLS.includes(url))).toBe(true);
  expect(ledger.glbUrls).toContain(LEGACY_PRIMARY);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('destroyer scene with the candidate enabled loads one LOD and survives quality tier switching', async ({ page }) => {
  test.setTimeout(180_000);
  const ledger = trackGlbRequests(page);
  await page.goto('/simulations/destroyer?model=type055-v2', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 60_000 });
  await page.waitForSelector('[data-scene-quality-tier]', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(6_000);

  // 候选启用：首屏只请求一个 ship LOD（tier 自动档），且不预载旧模型主候选
  const shipGlbs = ledger.glbUrls.filter((url) => LOD_URLS.includes(url));
  expect(shipGlbs.length).toBe(1);
  expect(ledger.glbUrls).not.toContain(LEGACY_PRIMARY);
  expect(ledger.glbUrls).not.toContain(DEMO_URL);
  expect(ledger.glbUrls).not.toContain(PAYLOAD_URL);

  // 档位切换 → 对应 LOD 请求；画布与仿真不重置（无页面错误）
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.click('[data-chrome-popover-trigger="quality"]');
  await page.click('[data-quality-tier="low"]');
  await page.waitForFunction(() => {
    const requests = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return requests.some((entry) => entry.name.includes('type055-nanchang-101-ship-lod2.glb'));
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(2_000);
  expect(pageErrors).toEqual([]);
  writeEvidence('destroyer-candidate-requests.json', {
    glbUrls: ledger.glbUrls,
    bytes: ledger.bytes,
  });
});

function writeEvidence(file: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(path.join(EVIDENCE_DIR, file), `${JSON.stringify(payload, null, 2)}\n`);
}
