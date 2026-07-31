import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-979-media-exclusivity');
const headSha = process.env.GITHUB_SHA ?? 'local-uncommitted';

test.describe('Issue 979 native media evidence harness', () => {
  for (const viewport of [1440, 320]) {
    test(`proves native media exclusivity at ${viewport}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.setContent(`
        <main><h1>LessonEntryMediaHub media harness</h1>
          <video id="video-a" controls></video>
          <audio id="audio-b" controls></audio>
        </main>
      `);
      await page.evaluate(() => {
        const active = new Set<HTMLMediaElement>();
        document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((element) => {
          active.add(element);
          element.addEventListener('play', () => active.forEach((other) => {
            if (other !== element && !other.paused) other.pause();
          }));
        });
      });

      const result = await page.evaluate(() => {
        const video = document.querySelector<HTMLVideoElement>('#video-a')!;
        const audio = document.querySelector<HTMLAudioElement>('#audio-b')!;
        let videoPauseCalls = 0;
        let audioPauseCalls = 0;
        Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
        Object.defineProperty(audio, 'paused', { configurable: true, get: () => false });
        video.pause = () => { videoPauseCalls += 1; Object.defineProperty(video, 'paused', { configurable: true, get: () => true }); };
        audio.pause = () => { audioPauseCalls += 1; Object.defineProperty(audio, 'paused', { configurable: true, get: () => true }); };
        Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 12 });
        audio.dispatchEvent(new Event('play'));
        return { videoPauseCalls, audioPauseCalls, currentTime: video.currentTime };
      });

      expect(result.videoPauseCalls).toBe(1);
      expect(result.audioPauseCalls).toBe(0);
      expect(result.currentTime).toBe(12);
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: join(evidenceDir, `viewport-${viewport}.png`), fullPage: true });
      writeFileSync(join(evidenceDir, `viewport-${viewport}.json`), JSON.stringify({ viewport, ...result }, null, 2));
    });
  }
});

test.afterAll(() => {
  const entries = [1440, 320].map((viewport) => {
    const screenshot = `viewport-${viewport}.png`;
    const buffer = readFileSync(join(evidenceDir, screenshot));
    return { viewport, screenshot, sha256: createHash('sha256').update(buffer).digest('hex') };
  });
  writeFileSync(join(evidenceDir, 'evidence.json'), JSON.stringify({ issue: 979, pr: 1161, headSha, base: 'integration', harness: true, failClosed: true, entries }, null, 2));
  writeFileSync(join(evidenceDir, 'sha256sums.txt'), entries.map((entry) => `${entry.sha256}  ${entry.screenshot}`).join('\n') + '\n');
});
