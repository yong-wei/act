/**
 * #2105/#2121 频谱后端对照的设备端测量采集（真实浏览器 + 真实 GPU）。
 *
 * 用法（在仓库根、生产服务器运行中）:
 *   node scripts/tests/collect-marine-fft-measurement.mjs [baseUrl] [outDir] [backends]
 *   缺省: baseUrl=http://127.0.0.1:3101 outDir=.logs/marine-fft-measurement-<ts> backends=fft,gerstner,webgpu:fft,webgpu:gerstner
 *
 * 每后端三轮：
 *   1) 冷加载轮（新 BrowserContext，首载口径 = navigation loadEvent + 后端 ready）
 *   2) 测量轮（10s 预热丢弃编译帧 + 60s rAF 墙钟帧间隔窗口，与
 *      quality-state.tsx 的 __marinePerformanceEvidence 同口径：挂起恢复首帧跳过、
 *      >=1s 前台长卡顿单独计数不污染帧样本；对照页未挂该探针，此处页面内注入等价采样）
 *   3) 录像轮（30s webm + t30s 截图；path() 必须在 context.close() 前取）
 *
 * 产物: <outDir>/{backend}-raw.json + raw-summary.json + video/{backend}.webm|t30s.png，
 * 供 scripts/tests/run-spectral-evaluation.ts 消费（组装 SpectralBackendMeasurement）。
 *
 * 已知坑（勿回退）：
 *   - 对照页不设置 data-scene-quality-tier（生产 simulation 页专用标记）——
 *     gerstner 分支 ready 判定只能用 canvas + 2 rAF；fft 分支用 __fftOceanRuntime
 *     出现 + gpuFrames()>0（因此 fft 轮 URL 必须带 qa=fft-ocean）。
 *   - page.evaluate(expressionString, arg) 不给字符串表达式传参——页面内逻辑必须以
 *     真函数传入。
 *   - 同机 rAF 口径随前台刷新档在 60/120Hz 间浮动（都算满帧锁定，如实记录档位）。
 *   - 软件渲染（SwiftShader/llvmpipe）会导致测量无效——脚本检测到即中止。
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(REPO_ROOT, 'package.json'));
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:3101';
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const OUT = process.argv[3] ?? join(REPO_ROOT, '.logs', `marine-fft-measurement-${timestamp}`);
const ROUTES = (process.argv[4] ?? 'fft,gerstner,webgpu:fft,webgpu:gerstner').split(',').filter(Boolean).map(parseRoute);
const PAGE = '/simulations/fft-ocean-comparison';
mkdirSync(join(OUT, 'video'), { recursive: true });

function parseRoute(token) {
  const trimmed = token.trim();
  if (trimmed.startsWith('webgpu:')) {
    const backend = trimmed.slice('webgpu:'.length);
    return { api: 'webgpu', backend, key: `webgpu-${backend}` };
  }
  return { api: 'webgl', backend: trimmed, key: trimmed };
}

function routeUrl(route) {
  const api = route.api === 'webgpu' ? '&api=webgpu' : '';
  return `${BASE}${PAGE}?backend=${route.backend}${api}&qa=fft-ocean`;
}

function stats(samples) {
  if (samples.length === 0) return { count: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return {
    count: samples.length,
    meanMs: Number(mean.toFixed(3)),
    medianMs: Number(sorted[Math.floor(0.5 * (sorted.length - 1))].toFixed(3)),
    p95Ms: Number(sorted[Math.floor(0.95 * (sorted.length - 1))].toFixed(3)),
    worstMs: Number(sorted[sorted.length - 1].toFixed(3)),
    approxFps: Number((1000 / mean).toFixed(2)),
  };
}

const GPU_INFO = `(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return null;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
})()`;

const rafWindow = (durationMs) => new Promise((resolve) => {
  const samples = [];
  let stallCount = 0, stallWorstMs = 0;
  let last = performance.now();
  let suspended = document.visibilityState === 'hidden';
  let wasSuspended = false;
  const t0 = performance.now();
  const onVis = () => {
    const h = document.visibilityState === 'hidden';
    if (h !== suspended) { suspended = h; last = performance.now(); if (!h) wasSuspended = true; }
  };
  document.addEventListener('visibilitychange', onVis);
  const tick = () => {
    const now = performance.now();
    const d = now - last; last = now;
    const skip = wasSuspended; wasSuspended = false;
    if (!suspended && !skip && d > 0) {
      if (d >= 1000) { stallCount += 1; stallWorstMs = Math.max(stallWorstMs, d); }
      else samples.push(d);
    }
    if (now - t0 >= durationMs) {
      document.removeEventListener('visibilitychange', onVis);
      resolve({ samples, stallCount, stallWorstMs });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const backendReady = (backend) => new Promise((resolve) => {
  const started = performance.now();
  const check = () => {
    if (backend === 'fft') {
      const rt = window.__fftOceanRuntime;
      if (rt && rt.gpuPipelineActive && typeof rt.gpuFrames === 'function' && rt.gpuFrames() > 0) {
        resolve(performance.now() - started); return;
      }
    } else if (document.querySelector('canvas')) {
      requestAnimationFrame(() => requestAnimationFrame(() => { resolve(performance.now() - started); }));
      return;
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
});

const routeReady = (route) => new Promise((resolve) => {
  const started = performance.now();
  const finish = (ready, status) => resolve({
    ready,
    status,
    waitMs: performance.now() - started,
  });
  const check = () => {
    if (performance.now() - started > 30_000) {
      finish(false, 'timeout');
      return;
    }
    const status = document.querySelector('[data-webgpu-status]')?.getAttribute('data-webgpu-status');
    if (status && status !== 'ready') {
      finish(false, status);
      return;
    }
    if (route.api === 'webgpu') {
      if (window.__marineWebGpu?.ready?.() && document.querySelector('canvas')) {
        finish(true, 'ready');
        return;
      }
    } else if (route.backend === 'fft') {
      const rt = window.__fftOceanRuntime;
      if (rt && rt.gpuPipelineActive && typeof rt.gpuFrames === 'function' && rt.gpuFrames() > 0) {
        finish(true, 'ready');
        return;
      }
    } else if (document.querySelector('canvas')) {
      requestAnimationFrame(() => requestAnimationFrame(() => finish(true, 'ready')));
      return;
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
});

async function coldLoadRound(browser, route) {
  const backend = route.backend;
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(routeUrl(route), { waitUntil: 'load', timeout: 120_000 });
  const loadWallMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { ttfbMs: n.responseStart, domContentLoadedMs: n.domContentLoadedEventEnd, loadEventMs: n.loadEventEnd } : null;
  });
  const ready = await page.evaluate(routeReady, route);
  const coldHs = backend === 'fft' && route.api !== 'webgpu'
    ? await page.evaluate(() => window.__fftOceanRuntime?.cpuSignificantWaveHeightMeters ?? null)
    : null;
  await context.close();
  return { loadWallMs, nav, readyWaitMs: ready.waitMs, ready, coldHs };
}

async function measurementRound(browser, route) {
  const backend = route.backend;
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto(routeUrl(route), { waitUntil: 'load', timeout: 120_000 });
  const ready = await page.evaluate(routeReady, route);
  if (!ready.ready) {
    await context.close();
    if (route.api === 'webgpu' && ready.status !== 'timeout') {
      return {
        unavailable: true,
        status: ready.status,
        stageCollection: null,
        frameStats: null,
        longForegroundStallCount: 0,
        longForegroundWorstMs: 0,
      };
    }
    throw new Error(`${route.key} 未就绪：${ready.status}`);
  }
  const gpuRenderer = await page.evaluate(GPU_INFO);
  if (/swiftshader|llvmpipe|software/i.test(String(gpuRenderer))) {
    throw new Error(`软件渲染路径（${gpuRenderer}）——测量无效，中止`);
  }
  await page.waitForTimeout(10_000);
  const fftProbeBefore = backend === 'fft' && route.api !== 'webgpu'
    ? await page.evaluate(() => {
        const rt = window.__fftOceanRuntime;
        return { hs: rt.cpuSignificantWaveHeightMeters, frames: rt.gpuFrames(), renderer: rt.rendererInfo };
      })
    : null;
  const window1 = await page.evaluate(rafWindow, 60_000);
  const stageCollection = await page.evaluate(async () => {
    const probe = window.__marineStagePerformance;
    if (!probe?.collect) throw new Error('stage performance probe missing');
    return probe.collect();
  });
  const fftProbeAfter = backend === 'fft' && route.api !== 'webgpu'
    ? await page.evaluate(() => {
        const rt = window.__fftOceanRuntime;
        return {
          hs: rt.cpuSignificantWaveHeightMeters,
          frames: rt.gpuFrames(),
          webgpuAvailable: rt.webgpuAvailable,
          resolution: rt.resolution,
          pointQueryMs: rt.measurePointQueryMs(60),
          pointQueryKind: rt.pointQueryKind,
        };
      })
    : null;
  await context.close();
  return {
    gpuRenderer,
    api: route.api,
    fftProbeBefore,
    fftProbeAfter,
    frameStats: stats(window1.samples),
    stageCollection,
    longForegroundStallCount: window1.stallCount,
    longForegroundWorstMs: Number(window1.stallWorstMs.toFixed(1)),
  };
}

async function videoRound(browser, route) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: join(OUT, 'video'), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const videoHandle = page.video();
  await page.goto(routeUrl(route), { waitUntil: 'load', timeout: 120_000 });
  const ready = await page.evaluate(routeReady, route);
  if (!ready.ready) {
    await context.close();
    return { skipped: true, status: ready.status, shots: [], videoPath: null };
  }
  await page.waitForTimeout(30_000);
  const shot = join(OUT, 'video', `${route.key}-t30s.png`);
  await page.screenshot({ path: shot, timeout: 60_000 });
  const rawVideoPath = videoHandle ? await videoHandle.path() : null;
  await context.close();
  let videoPath = null;
  if (rawVideoPath) {
    videoPath = join(OUT, 'video', `${route.key}.webm`);
    const { renameSync, existsSync, rmSync } = await import('node:fs');
    if (existsSync(videoPath)) rmSync(videoPath);
    renameSync(rawVideoPath, videoPath);
  }
  return { shots: [shot], videoPath };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stageRouteCost(measured) {
  if (measured?.unavailable) return null;
  const rounds = measured?.stageCollection?.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0) {
    throw new Error('刷新率样本不能代替阶段或完成工作量');
  }
  const costs = rounds.map((round) => {
    if (round.labeledAs === 'frame-intervals' || round.method === 'frame-intervals') {
      throw new Error('阶段采集不得把帧间隔当成 GPU 耗时');
    }
    if (round.method === 'gpu-elapsed') {
      if (!(round.gpuMs > 0)) throw new Error('GPU 查询没有返回有效耗时');
      return { gpuMs: round.gpuMs, completedWorkMs: round.completedWorkMs ?? null };
    }
    if (round.method === 'completed-work') {
      if (round.gpuMs !== null) throw new Error('完成墙钟不能写入 GPU 耗时');
      if (!(typeof round.completedWorkMs === 'number' && Number.isFinite(round.completedWorkMs))) {
        throw new Error('完成工作量缺失');
      }
      return { gpuMs: null, completedWorkMs: round.completedWorkMs };
    }
    throw new Error(`未知阶段计时方法 ${round.method}`);
  });
  const gpuValues = costs.map((cost) => cost.gpuMs).filter((value) => value !== null);
  const completedValues = costs.map((cost) => cost.completedWorkMs).filter((value) => value !== null);
  const gpuReady = gpuValues.length === costs.length;
  return {
    method: gpuReady ? 'gpu-elapsed' : 'completed-work',
    gpuMs: gpuReady ? median(gpuValues) : null,
    completedWorkMs: completedValues.length === costs.length ? median(completedValues) : null,
    rounds: costs.length,
  };
}

const browser = await chromium.launch({ headless: false });
for (const route of ROUTES) {
  console.log(`[${route.key}] 冷加载轮…`);
  const cold = await coldLoadRound(browser, route);
  console.log(`[${route.key}] load=${cold.loadWallMs}ms ready=+${cold.readyWaitMs.toFixed(0)}ms`);
  console.log(`[${route.key}] 测量轮（10s 预热 + 60s 窗口）…`);
  const measured = await measurementRound(browser, route);
  if (measured.unavailable) {
    console.log(`[${route.key}] 不可用：${measured.status}`);
    writeFileSync(join(OUT, `${route.key}-raw.json`), `${JSON.stringify({ cold, measured, video: null }, null, 2)}\n`);
    continue;
  }
  console.log(`[${route.key}] ${JSON.stringify(measured.frameStats)} stalls=${measured.longForegroundStallCount}`);
  console.log(`[${route.key}] 录像轮（30s）…`);
  const video = await videoRound(browser, route);
  writeFileSync(join(OUT, `${route.key}-raw.json`), `${JSON.stringify({ cold, measured, video }, null, 2)}\n`);
}
await browser.close();
const merged = {};
for (const f of readdirSync(OUT)) {
  if (f.endsWith('-raw.json')) merged[f.replace('-raw.json', '')] = JSON.parse(readFileSync(join(OUT, f), 'utf8'));
}
writeFileSync(join(OUT, 'raw-summary.json'), `${JSON.stringify(merged, null, 2)}\n`);
const routeCosts = {};
for (const [backend, payload] of Object.entries(merged)) {
  const cost = stageRouteCost(payload.measured);
  if (cost) routeCosts[backend] = cost;
}
const routes = Object.values(routeCosts);
writeFileSync(join(OUT, 'cost-comparison.json'), `${JSON.stringify({
  equalPresentationIsEqualCost: false,
  method: routes.length > 0 && routes.every((route) => route.method === 'gpu-elapsed') ? 'gpu-elapsed' : 'completed-work',
  routes: routeCosts,
}, null, 2)}\n`);
console.log(`done → ${OUT}`);
