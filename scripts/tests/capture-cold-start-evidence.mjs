import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/cold-start-1151');
const baseUrl = process.env.COLD_START_BASE_URL ?? 'http://localhost:3001';
const screenshotTargets = [
  { width: 1440, name: 'cold-start-desktop' },
  { width: 320, name: 'cold-start-mobile' },
];

function sha256(relativePath) {
  return createHash('sha256')
    .update(readFileSync(path.join(repoRoot, relativePath)))
    .digest('hex');
}

function safeName(value) {
  return value
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}

async function capture() {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const manifest = {
    captureGeneratedAt: new Date().toISOString(),
    captureSourceSha: {
      'src/app/assessment/adaptive-practice/page.tsx': sha256('src/app/assessment/adaptive-practice/page.tsx'),
      'src/lib/adaptive-cold-start-detection.ts': sha256('src/lib/adaptive-cold-start-detection.ts'),
      'src/lib/__tests__/adaptive-cold-start-detection.test.ts': sha256('src/lib/__tests__/adaptive-cold-start-detection.test.ts'),
    },
    captureCommitSha: process.env.GITHUB_SHA || null,
    screenshots: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();

  try {
    for (const target of screenshotTargets) {
      await page.setViewportSize({ width: target.width, height: 900 });
      await page.goto(new URL('/assessment/adaptive-practice', baseUrl).toString(), {
        waitUntil: 'networkidle',
        timeout: 30000,
      }).catch(() => {});

      // 等待页面核心组件渲染
      await page.waitForFunction(() => {
        const coldStart = document.querySelector('[data-adaptive-path-cold-start]');
        const heading = document.querySelector('h1, h2');
        const buttons = document.querySelectorAll('button, a[href]');
        return coldStart && heading && buttons.length > 3;
      }, { timeout: 30000 }).catch(() => {});

      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const filename = `${target.name}.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
        fullPage: false,
      });

      manifest.screenshots.push({
        filename,
        viewportWidth: target.width,
        viewportHeight: 900,
        capturedAt: new Date().toISOString(),
      });

      console.log(`Captured ${filename} at ${target.width}px`);
    }
  } finally {
    await browser.close();
  }

  writeFileSync(path.join(outputDir, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${outputDir}/capture-manifest.json`);
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
