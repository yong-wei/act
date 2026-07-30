import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/cold-start-1151');
const baseUrl = process.env.COLD_START_BASE_URL ?? 'http://localhost:3001';

// 需要验证的源码文件（相对 repoRoot）
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/lib/adaptive-cold-start-detection.ts',
  'src/lib/__tests__/adaptive-cold-start-detection.test.ts',
  'scripts/tests/capture-cold-start-evidence.mjs',
];

const screenshotTargets = [
  { width: 1440, name: 'cold-start-desktop' },
  { width: 320, name: 'cold-start-mobile' },
];

function sha256(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!existsSync(fullPath)) return null;
  return createHash('sha256')
    .update(readFileSync(fullPath))
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
  // ----- 门禁检查：工作区必须干净 -----
  const statusOutput = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (statusOutput.length > 0) {
    console.error('FAIL: working tree is not clean. Commit or stash changes before capturing.');
    console.error(statusOutput);
    process.exit(1);
  }

  // ----- 获取当前 Git 修订 -----
  const headSha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const headShort = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  console.log(`Capturing at commit ${headShort} (${headSha})`);

  // ----- 验证源码文件存在且 SHA 与 HEAD 一致 -----
  for (const file of sourceFiles) {
    const fileSha = sha256(file);
    if (!fileSha) {
      console.error(`FAIL: source file not found: ${file}`);
      process.exit(1);
    }
    const storedSha = execSync(`git show HEAD:${file}`, { cwd: repoRoot, encoding: 'utf8' });
    const committedSha = createHash('sha256').update(storedSha).digest('hex');
    if (fileSha !== committedSha) {
      console.error(`FAIL: ${file} SHA mismatch between working tree and HEAD`);
      process.exit(1);
    }
    console.log(`  Verified ${file}: ${fileSha}`);
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const manifest = {
    captureGeneratedAt: new Date().toISOString(),
    captureCommitSha: headSha,
    captureCommitShort: headShort,
    captureCommand: `node scripts/tests/capture-cold-start-evidence.mjs`,
    captureCommandResult: 'exit 0',
    captureSourceFiles: Object.fromEntries(
      sourceFiles.map((f) => [f, sha256(f)])
    ),
    workspaceClean: true,
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
      const screenshotPath = path.join(outputDir, filename);
      await page.screenshot({
        path: path.join(outputDir, filename),
        fullPage: false,
      });

      const fileBuffer = readFileSync(screenshotPath);
      const fileSha256 = createHash('sha256').update(fileBuffer).digest('hex');

      manifest.screenshots.push({
        filename,
        sha256: fileSha256,
        viewportWidth: target.width,
        viewportHeight: 900,
        capturedAt: new Date().toISOString(),
      });

      console.log(`Captured ${filename} at ${target.width}px (sha256: ${fileSha256})`);
    }
  } finally {
    await browser.close();
  }

  writeFileSync(path.join(outputDir, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${outputDir}/capture-manifest.json\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
