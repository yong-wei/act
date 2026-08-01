import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/cold-start-1151');
const capturePath = '/assessment/adaptive-practice?demo=1&intent=landing';
const nextDevEntrypoint = './node_modules/next/dist/bin/next';

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

function gitRaw(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function gitOutput(args) {
  return gitRaw(args).trim();
}

function hashText(value) {
  return createHash('sha256')
    .update(value.replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex');
}

function hashBuffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!existsSync(fullPath)) return null;
  return hashText(readFileSync(fullPath, 'utf8'));
}

function committedSha(relativePath) {
  return hashText(gitRaw(['show', `HEAD:${relativePath}`]));
}

function captureRevision({ logFiles = false } = {}) {
  const statusOutput = gitOutput(['status', '--porcelain']);
  if (statusOutput.length > 0) {
    throw new Error(`working-tree-not-clean:\n${statusOutput}`);
  }

  const headSha = gitOutput(['rev-parse', 'HEAD']);
  const headShort = gitOutput(['rev-parse', '--short', 'HEAD']);
  const captureSourceFiles = {};

  for (const file of sourceFiles) {
    const fileSha = sha256(file);
    if (!fileSha) throw new Error(`source-file-not-found:${file}`);
    if (fileSha !== committedSha(file)) {
      throw new Error(`source-file-sha-mismatch:${file}`);
    }
    captureSourceFiles[file] = fileSha;
    if (logFiles) console.log(`  Verified ${file}: ${fileSha}`);
  }

  return { headSha, headShort, sourceFiles: captureSourceFiles };
}

function assertCaptureRevisionUnchanged(initialRevision) {
  const currentRevision = captureRevision();
  if (currentRevision.headSha !== initialRevision.headSha) {
    throw new Error(
      `capture-head-drift:${initialRevision.headSha}->${currentRevision.headSha}`,
    );
  }

  for (const file of sourceFiles) {
    if (currentRevision.sourceFiles[file] !== initialRevision.sourceFiles[file]) {
      throw new Error(`capture-source-file-drift:${file}`);
    }
  }
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error('temporary-port-allocation-failed'));
        else resolve(port);
      });
    });
  });
}

function startNextDevServer(port, baseUrl) {
  const child = spawn(
    process.execPath,
    [nextDevEntrypoint, 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEXTAUTH_URL: baseUrl,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  );
  child.stdout?.on('data', (chunk) => process.stdout.write(`[cold-start-next] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[cold-start-next] ${chunk}`));
  return child;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 120_000;
  let lastFailure = 'no-response';
  let spawnError;
  const onError = (error) => {
    spawnError = error;
  };
  child.on('error', onError);
  try {
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`next-dev-spawn-failed:${spawnError.message}`);
      }
      if (child.exitCode !== null) {
        throw new Error(`next-dev-exited:${child.exitCode}`);
      }
      try {
        const response = await fetch(url, { redirect: 'manual' });
        if (response.status < 500) return;
        lastFailure = `status-${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`next-dev-readiness-timeout:${lastFailure}`);
  } finally {
    child.off('error', onError);
  }
}

async function stopNextDevServer(child) {
  if (!child?.pid) return;

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') console.error('Failed to stop Next dev process:', error);
  }

  const deadline = Date.now() + 5_000;
  while (child.exitCode === null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error?.code !== 'ESRCH') console.error('Failed to kill Next dev process:', error);
    }
  }
}

async function capture() {
  let nextServer;
  let browser;
  let temporaryDir;
  let manifestTempPath;

  try {
    const initialRevision = captureRevision({ logFiles: true });
    console.log(
      `Capturing at commit ${initialRevision.headShort} (${initialRevision.headSha})`,
    );

    temporaryDir = mkdtempSync(path.join(os.tmpdir(), 'act-cold-start-1151-'));
    const port = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const captureUrl = new URL(capturePath, baseUrl).toString();

    nextServer = startNextDevServer(port, baseUrl);
    await waitForServer(baseUrl, nextServer);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'zh-CN' });
    const page = await context.newPage();
    const screenshots = [];

    for (const target of screenshotTargets) {
      await page.setViewportSize({ width: target.width, height: 900 });
      const response = await page.goto(captureUrl, {
        waitUntil: 'networkidle',
        timeout: 30_000,
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
        const cardText = coldStart?.textContent ?? '';
        return coldStart && heading && workspace &&
          cardText.includes('推荐依据') &&
          cardText.includes('提升推荐准确度');
      }, { timeout: 30_000 });

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
      if (!(await generationAction.isVisible()) || !(await generationAction.isEnabled())) {
        throw new Error('Path generation action is not visible and enabled');
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

      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const filename = `${target.name}.png`;
      const screenshotPath = path.join(temporaryDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const fileSha256 = hashBuffer(readFileSync(screenshotPath));
      screenshots.push({
        filename,
        sha256: fileSha256,
        viewportWidth: target.width,
        viewportHeight: 900,
        capturedAt: new Date().toISOString(),
      });

      console.log(`Captured ${filename} at ${target.width}px (sha256: ${fileSha256})`);
    }

    await browser.close();
    browser = undefined;
    await stopNextDevServer(nextServer);
    nextServer = undefined;

    // 两个视口均完成后、任何治理产物写入前复核捕获修订。
    assertCaptureRevisionUnchanged(initialRevision);

    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    for (const screenshot of screenshots) {
      copyFileSync(
        path.join(temporaryDir, screenshot.filename),
        path.join(outputDir, screenshot.filename),
      );
    }

    const manifest = {
      captureGeneratedAt: new Date().toISOString(),
      captureCommitSha: initialRevision.headSha,
      captureCommitShort: initialRevision.headShort,
      captureCommand: 'node scripts/tests/capture-cold-start-evidence.mjs',
      captureCommandResult: 'exit 0',
      captureUrl,
      captureSourceFiles: initialRevision.sourceFiles,
      workspaceClean: true,
      screenshots,
    };
    const manifestPath = path.join(outputDir, 'capture-manifest.json');
    manifestTempPath = path.join(outputDir, `.capture-manifest-${process.pid}.tmp`);
    writeFileSync(manifestTempPath, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(manifestTempPath, manifestPath);
    manifestTempPath = undefined;

    console.log(`\nManifest written to ${manifestPath}\n`);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    if (browser) await browser.close().catch((error) => console.error('Failed to close browser:', error));
    if (nextServer) await stopNextDevServer(nextServer);
    if (manifestTempPath) rmSync(manifestTempPath, { force: true });
    if (temporaryDir) rmSync(temporaryDir, { recursive: true, force: true });
  }
}

capture().catch((error) => {
  console.error('Capture failed:', error);
  process.exitCode = 1;
});
