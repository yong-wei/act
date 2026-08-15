import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-979-media-exclusivity');
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`Evidence capture requires a clean tracked worktree:\n${dirty}`);
  mkdirSync(evidenceDir, { recursive: true });
});

for (const viewport of [1440, 320]) {
  test(`Issue 979 production component at ${viewport}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.goto('/evidence/issue-979');
    const media = page.locator('audio, video');
    expect(await media.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('[data-media-coordinator-ready="true"]')).toHaveCount(3);
    const result = await media.evaluateAll((elements) => {
      const first = elements[0] as HTMLMediaElement;
      const second = elements[1] as HTMLMediaElement;
      let firstPauseCalls = 0;
      let secondPauseCalls = 0;
      Object.defineProperty(first, 'paused', { configurable: true, get: () => false });
      Object.defineProperty(second, 'paused', { configurable: true, get: () => false });
      first.pause = () => { firstPauseCalls += 1; };
      second.pause = () => { secondPauseCalls += 1; };
      first.currentTime = 12;
      second.dispatchEvent(new Event('play'));
      return { firstPauseCalls, secondPauseCalls, currentTime: first.currentTime };
    });
    expect(result).toEqual({ firstPauseCalls: 1, secondPauseCalls: 0, currentTime: 12 });
    const screenshot = `viewport-${viewport}.png`;
    await page.screenshot({ path: join(evidenceDir, screenshot), fullPage: true });
    writeFileSync(join(evidenceDir, `viewport-${viewport}.json`), JSON.stringify({ viewport, route: '/evidence/issue-979', ...result }, null, 2));
  });
}

test.afterAll(() => {
  const entries = [1440, 320].map((viewport) => {
    const screenshot = `viewport-${viewport}.png`;
    if (!existsSync(join(evidenceDir, screenshot))) throw new Error(`Missing required evidence screenshot: ${screenshot}`);
    return { viewport, screenshot, sha256: createHash('sha256').update(readFileSync(join(evidenceDir, screenshot))).digest('hex') };
  });
  writeFileSync(join(evidenceDir, 'evidence.json'), JSON.stringify({ issue: 979, pr: 1161, headSha, base: 'integration', route: '/evidence/issue-979', harness: 'LessonEntryMediaHub', failClosed: true, capturedAt: new Date().toISOString(), entries }, null, 2));
  writeFileSync(join(evidenceDir, 'sha256sums.txt'), `${entries.map((entry) => `${entry.sha256}  ${entry.screenshot}`).join('\n')}\n`);
});
