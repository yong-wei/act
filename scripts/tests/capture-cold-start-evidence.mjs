import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/cold-start-1151');
const baseUrl = process.env.COLD_START_BASE_URL ?? 'http://localhost:3001';
const capturePath = '/assessment/adaptive-practice?demo=1&goal=frequency-response-foundations';

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
  const raw = readFileSync(fullPath, 'utf8');
  const normalized = raw.replace(/\r\n/g, '\n');
  return createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex');
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
    captureCommandResult: null,
    captureUrl: new URL(capturePath, baseUrl).toString(),
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
      const response = await page.goto(new URL(capturePath, baseUrl).toString(), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      if (!response || response.status() >= 400) {
        throw new Error(`Navigation failed with status ${response?.status() ?? 'no-response'}`);
      }
      if (!page.url().includes('/assessment/adaptive-practice')) {
        throw new Error(`Redirected away from adaptive-practice: ${page.url()}`);
      }

      // 冷启动卡片与核心标题必须在超时前渲染，失败直接抛错
      await page.waitForFunction(() => {
        const coldStart = document.querySelector('[data-adaptive-path-cold-start="product-language"]');
        const heading = document.querySelector('h1, h2');
        const workspace = document.querySelector('[data-adaptive-path-center]');
        return coldStart && heading && workspace;
      }, { timeout: 30000 });

      // 断言冷启动两组说明文案可见
      const coldStartCard = page.locator('[data-adaptive-path-cold-start="product-language"]');
      if (!(await coldStartCard.isVisible())) {
        throw new Error('Cold-start card is not visible');
      }
      const basisText = coldStartCard.getByText('推荐依据', { exact: true });
      const guidanceText = coldStartCard.getByText('提升推荐准确度', { exact: true });
      if (!(await basisText.isVisible())) {
        throw new Error('Cold-start recommendation basis text is not visible');
      }
      if (!(await guidanceText.isVisible())) {
        throw new Error('Cold-start improvement guidance text is not visible');
      }

      // 断言主要路径操作与学习记录入口仍可达
      const generationAction = page.locator('[data-adaptive-path-generation-action]').first();
      const evidenceLink = page.locator('a[href="/profile/evidence"]').first();
      const pathManagement = page.locator('[data-adaptive-path-local-command="path-management"]').first();
      if (!(await generationAction.isVisible())) {
        throw new Error('Path generation action is not visible');
      }
      if (!(await evidenceLink.isVisible())) {
        throw new Error('Learning record entry is not visible');
      }
      if (!(await pathManagement.isVisible())) {
        throw new Error('Path management action is not visible');
      }

      // 断言当前视口无横向溢出
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (hasHorizontalOverflow) {
        throw new Error(`Horizontal overflow detected at ${target.width}px`);
      }

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

    manifest.captureCommandResult = 'exit 0';
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
