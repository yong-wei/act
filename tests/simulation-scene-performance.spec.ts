import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * 虚拟仿真场景视觉管线性能 spec（destroyer 样板）。
 * 行为契约：档位属性、切档后粒子/水面/后处理预算同步、低档不快于高档异常。
 * 绝对帧预算验收在真实硬件上进行（视觉 QA 证据）；本 spec 只设环境性
 * 灾难回归上限（headless/软件渲染下仍应远低于该值），避免设备差异抖动。
 */

const ENV_CATASTROPHIC_FRAME_MS = 500;
const SAMPLE_SECONDS = 3;

type FrameStats = { p50: number; p95: number; mean: number; samples: number };

async function gotoDestroyer(page: Page) {
  await page.goto('/simulations/destroyer', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 60_000 });
  await page.waitForSelector('[data-scene-quality-tier]', { state: 'attached', timeout: 30_000 });
  // 等模型与资产加载稳定（进度占位消失或超时继续）
  await page.waitForTimeout(4_000);
}

async function sampleFrameStats(page: Page, seconds: number): Promise<FrameStats> {
  return page.evaluate(async (sampleSeconds) => {
    const deltas: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        if (deltas.length < sampleSeconds * 120) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const percentile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      mean: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
      samples: deltas.length,
    };
  }, seconds);
}

async function forceTier(page: Page, tier: 'high' | 'medium' | 'low') {
  await page.click(`[data-quality-tier="${tier}"]`);
  await page.waitForFunction(
    (expected) => document.querySelector('[data-scene-quality-tier]')?.getAttribute('data-scene-quality-tier') === expected,
    tier,
    { timeout: 5_000 }
  );
}

test.describe('simulation scene visual pipeline performance', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('lng route mounts the pipeline with quality contracts', async ({ page }) => {
    await page.goto('/simulations/lng', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForSelector('[data-scene-quality-tier]', { state: 'attached', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    await expect(page.locator('[data-scene-environment-switcher]')).toBeVisible();
    await expect(page.locator('[data-scene-quality-select]')).toBeVisible();
    await expect(page.locator('[data-soundscape-muted]')).toBeVisible();
    await expect(page.locator('[data-teaching-annotations]')).toBeVisible();

    const stats = await sampleFrameStats(page, 2);
    expect(stats.samples).toBeGreaterThan(10);
    expect(stats.p95).toBeLessThan(ENV_CATASTROPHIC_FRAME_MS);
  });

  test('container route mounts the pipeline with quality contracts', async ({ page }) => {
    await page.goto('/simulations/container', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForSelector('[data-scene-quality-tier]', { state: 'attached', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    await expect(page.locator('[data-scene-environment-switcher]')).toBeVisible();
    await expect(page.locator('[data-scene-quality-select]')).toBeVisible();
    await expect(page.locator('[data-soundscape-muted]')).toBeVisible();
    await expect(page.locator('[data-teaching-annotations]')).toBeVisible();

    const stats = await sampleFrameStats(page, 2);
    expect(stats.samples).toBeGreaterThan(10);
    expect(stats.p95).toBeLessThan(ENV_CATASTROPHIC_FRAME_MS);
  });

  test('cruise route mounts the pipeline with quality contracts', async ({ page }) => {
    await page.goto('/simulations/cruise', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForSelector('[data-scene-quality-tier]', { state: 'attached', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    await expect(page.locator('[data-scene-environment-switcher]')).toBeVisible();
    await expect(page.locator('[data-scene-quality-select]')).toBeVisible();
    await expect(page.locator('[data-soundscape-muted]')).toBeVisible();
    await expect(page.locator('[data-teaching-annotations]')).toBeVisible();

    const stats = await sampleFrameStats(page, 2);
    expect(stats.samples).toBeGreaterThan(10);
    expect(stats.p95).toBeLessThan(ENV_CATASTROPHIC_FRAME_MS);
  });

  test('cruise scene geometry matches lng at the same viewport', async ({ page }) => {
    const measure = async (route: string) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-sim-ui]', { timeout: 60_000 });
      const box = await page.locator('[data-sim-ui]').boundingBox();
      if (!box) throw new Error(`missing [data-sim-ui] bounding box on ${route}`);
      return box;
    };
    const cruise = await measure('/simulations/cruise');
    const lng = await measure('/simulations/lng');
    expect(Math.abs(cruise.width - lng.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(cruise.height - lng.height)).toBeLessThanOrEqual(2);
  });

  test('destroyer scene mounts pipeline chrome and quality contracts', async ({ page }) => {
    await gotoDestroyer(page);

    // 管线 chrome：环境预设切换器、画质档位、静音、教学标注开关
    await expect(page.locator('[data-scene-environment-switcher]')).toBeVisible();
    await expect(page.locator('[data-scene-quality-select]')).toBeVisible();
    await expect(page.locator('[data-soundscape-muted]')).toBeVisible();
    await expect(page.locator('[data-teaching-annotations]')).toBeVisible();

    // 默认档位契约：高档预算（粒子 2200、水面 high、后处理开）
    const attrs = page.locator('[data-scene-quality-tier]');
    const tier = await attrs.getAttribute('data-scene-quality-tier');
    expect(['high', 'medium', 'low']).toContain(tier);

    // 强制低档：粒子预算 550、水面 low、后处理关
    await forceTier(page, 'low');
    await expect(attrs).toHaveAttribute('data-wake-particle-cap', '550');
    await expect(attrs).toHaveAttribute('data-water-tier', 'low');
    await expect(attrs).toHaveAttribute('data-post-enabled', 'false');

    // 强制高档：粒子预算 2200、水面 high、后处理开
    await forceTier(page, 'high');
    await expect(attrs).toHaveAttribute('data-wake-particle-cap', '2200');
    await expect(attrs).toHaveAttribute('data-water-tier', 'high');
    await expect(attrs).toHaveAttribute('data-post-enabled', 'true');

    // 环境预设切换：五套可切
    for (const preset of ['open-sea', 'dawn-haze', 'sunset-warm', 'overcast', 'storm-blue']) {
      await page.click(`[data-environment-preset="${preset}"]`);
      await page.waitForTimeout(300);
    }
  });

  test('frame time stays below catastrophic bound and low tier is not slower than high', async ({ page }) => {
    await gotoDestroyer(page);

    await forceTier(page, 'high');
    const high = await sampleFrameStats(page, SAMPLE_SECONDS);

    await forceTier(page, 'low');
    const low = await sampleFrameStats(page, SAMPLE_SECONDS);

    const evidence = {
      capturedAt: new Date().toISOString(),
      route: '/simulations/destroyer',
      high,
      low,
      note: '绝对帧预算验收以真实硬件视觉 QA 为准；本记录为行为契约证据。',
    };
    await writeFile(
      join(process.cwd(), 'artifacts', 'simulation-scene-performance.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8'
    );

    expect(high.samples).toBeGreaterThan(10);
    expect(high.p95).toBeLessThan(ENV_CATASTROPHIC_FRAME_MS);
    expect(low.p95).toBeLessThan(ENV_CATASTROPHIC_FRAME_MS);
    // 低档不应显著慢于高档（降档语义）；留 25% 抖动余量
    expect(low.p95).toBeLessThanOrEqual(high.p95 * 1.25 + 1);
  });
});
