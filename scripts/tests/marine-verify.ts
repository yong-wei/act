/**
 * M5 海洋路线的单一验收入口（#2137）。
 *
 *   npx tsx scripts/tests/marine-verify.ts --suite smoke|compare|extended
 *
 * compare 打开四条路线的 wave-only 与 feature-parity，写下截图、帧间隔和阶段成本。
 * extended 另加有界的像素/CPU/效果压力，以及七船页面上的五个布局。
 * 不改生产默认后端。模拟压力不会被写成另一台设备。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

import {
  extendedCoverageFailures,
  htmlLooksLikeNextDev,
  judgeMarineRouteBenchmark,
  type EvidenceKind,
  type M5RouteId,
  type M5SceneId,
  type RouteObservation,
} from '@/resources/simulations/scene/quality/marine-route-benchmark';

const SUITES = ['smoke', 'compare', 'extended'] as const;
type Suite = (typeof SUITES)[number];

const ROUTES: ReadonlyArray<{ id: M5RouteId; backend: 'gerstner' | 'fft'; api: 'webgl' | 'webgpu' }> = [
  { id: 'webgl-gerstner', backend: 'gerstner', api: 'webgl' },
  { id: 'webgl-fft', backend: 'fft', api: 'webgl' },
  { id: 'webgpu-gerstner', backend: 'gerstner', api: 'webgpu' },
  { id: 'webgpu-fft', backend: 'fft', api: 'webgpu' },
];

const SCENES: readonly M5SceneId[] = ['wave-only', 'feature-parity'];

const FLEET: ReadonlyArray<{ href: string; layout: string }> = [
  { href: '/simulations/destroyer?qa=marine-layout', layout: 'open-sea-distant-islands' },
  { href: '/simulations/lng?qa=marine-layout', layout: 'harbor-entrance-channel' },
  { href: '/simulations/container?qa=marine-layout', layout: 'harbor-entrance-channel' },
  { href: '/simulations/icebreaker?qa=marine-layout', layout: 'polar-ice-field' },
  { href: '/simulations/cruise?qa=marine-layout', layout: 'harbor-entrance-channel' },
  { href: '/simulations/drilling?qa=marine-layout', layout: 'offshore-operations-area' },
  { href: '/simulations/dredger?qa=marine-layout', layout: 'shallow-construction-site' },
];

function suiteFromArgv(argv: readonly string[]): Suite {
  const index = argv.indexOf('--suite');
  const value = index >= 0 ? argv[index + 1] : 'compare';
  if (!SUITES.includes(value as Suite)) throw new Error(`suite must be ${SUITES.join('|')}`);
  return value as Suite;
}

async function assertProductionServer(base: string): Promise<void> {
  let html = '';
  try {
    const response = await fetch(`${base}/simulations/fft-ocean-comparison?backend=gerstner&scene=wave-only`, {
      signal: AbortSignal.timeout(5000),
    });
    html = await response.text();
  } catch {
    throw new Error(`marine:verify needs a production server at ${base}. Start it with npm run build && npm run start, then set MARINE_VERIFY_BASE. This command does not start next dev.`);
  }
  if (htmlLooksLikeNextDev(html)) {
    throw new Error(`marine:verify refuses the next dev server at ${base}. Official cost reports require a production build.`);
  }
}

function routeUrl(base: string, route: (typeof ROUTES)[number], scene: M5SceneId): string {
  const api = route.api === 'webgpu' ? '&api=webgpu' : '';
  return `${base}/simulations/fft-ocean-comparison?backend=${route.backend}&scene=${scene}${api}`;
}

interface ComparisonReading {
  frameP95Ms: number | null;
  frameMedianMs: number | null;
  renderer: string | null;
  hostUnavailable: boolean;
  labReady: boolean;
  visualPassed: boolean;
  webgpuReady: boolean;
  features: { optics?: string; foam?: boolean; planar?: boolean; shallow?: boolean } | null;
  gpuMs: number | null;
  gpuSamples: number[];
  completedWorkMs: number | null;
  pixelMean: number | null;
  canvasWidth: number;
}

async function readComparison(page: Page, durationMs: number): Promise<ComparisonReading> {
  const source = `(async () => {
    const duration = ${durationMs};
    const samples = [];
    let last = performance.now();
    const started = last;
    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        const delta = now - last;
        last = now;
        if (delta > 0 && delta < 1000) samples.push(delta);
        if (now - started >= duration) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.sort((a, b) => a - b);
    const pick = (ratio) => (samples.length === 0 ? null : samples[Math.floor(ratio * (samples.length - 1))]);
    const canvas = document.querySelector('canvas');
    const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
    let renderer = null;
    if (gl) {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const value = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      renderer = typeof value === 'string' ? value : null;
    }
    const webgpu = window.__marineWebGpu;
    const identity = webgpu && webgpu.identity ? webgpu.identity() : null;
    const features = webgpu && webgpu.features ? webgpu.features() : null;
    const labReady = !!(window.__marineComparisonLab && window.__marineComparisonLab.ready && window.__marineComparisonLab.ready());
    const visual = window.__marineVisualAcceptance && window.__marineVisualAcceptance.run ? window.__marineVisualAcceptance.run() : null;
    const stage = window.__marineStagePerformance && window.__marineStagePerformance.collect
      ? await window.__marineStagePerformance.collect()
      : null;
    const rounds = stage && stage.rounds ? stage.rounds : [];
    const gpuSamples = rounds.filter((round) => round.method === 'gpu-elapsed' && round.gpuMs > 0).map((round) => round.gpuMs).sort((a, b) => a - b);
    const workSamples = rounds.filter((round) => round.completedWorkMs > 0).map((round) => round.completedWorkMs).sort((a, b) => a - b);
    const statusNode = document.querySelector('[data-webgpu-status]');
    const status = statusNode ? statusNode.getAttribute('data-webgpu-status') : null;
    let pixel = null;
    if (gl && canvas && canvas.width > 0) {
      const data = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
      pixel = (data[0] + data[1] + data[2]) / (3 * 255);
    }
    return {
      frameP95Ms: pick(0.95),
      frameMedianMs: pick(0.5),
      renderer: renderer || (identity && identity.vendor) || window.__marineWebGpuBackend || null,
      hostUnavailable: status === 'unavailable' || status === 'failed' || (identity && (identity.status === 'unavailable' || identity.status === 'failed')),
      labReady,
      visualPassed: !!(visual && visual.passed === true),
      webgpuReady: !!(webgpu && webgpu.ready && webgpu.ready()),
      features,
      gpuMs: gpuSamples.length ? gpuSamples[Math.floor((gpuSamples.length - 1) / 2)] : null,
      gpuSamples,
      completedWorkMs: workSamples.length ? workSamples[Math.floor((workSamples.length - 1) / 2)] : null,
      pixelMean: pixel,
      canvasWidth: canvas ? canvas.width : 0,
    };
  })()`;
  return page.evaluate(source) as Promise<ComparisonReading>;
}

function softwareFallback(renderer: string | null): boolean {
  return /swiftshader|llvmpipe|softpipe/i.test(renderer ?? '');
}

function toObservation(input: {
  route: M5RouteId;
  scene: M5SceneId;
  reading: ComparisonReading;
  imagePath: string;
  evidenceKind: EvidenceKind;
}): RouteObservation {
  const { reading, route, scene } = input;
  const webgpu = route.startsWith('webgpu');
  const featureParity = scene === 'feature-parity';
  const features = reading.features;
  const coreFeaturesPresent = webgpu
    ? (featureParity
      ? features?.optics === 'shared' && features.foam === true && features.planar === true && features.shallow === true
      : reading.webgpuReady)
    : (featureParity ? reading.visualPassed : reading.labReady && reading.canvasWidth > 0);
  return {
    route,
    scene,
    implemented: webgpu ? reading.webgpuReady || reading.hostUnavailable || features !== null : reading.labReady,
    coreFeaturesPresent: reading.hostUnavailable ? false : coreFeaturesPresent,
    hardwareContext: reading.hostUnavailable ? null : reading.renderer,
    renderer: reading.renderer,
    softwareFallback: softwareFallback(reading.renderer),
    frameP95Ms: reading.frameP95Ms,
    frameMedianMs: reading.frameMedianMs,
    gpuMs: reading.gpuMs,
    completedWorkMs: reading.completedWorkMs,
    costSamples: reading.gpuSamples,
    qualityScore: reading.pixelMean,
    pixelMean: reading.pixelMean,
    imagePath: input.imagePath,
    evidenceKind: input.evidenceKind,
    hostUnavailable: reading.hostUnavailable,
  };
}

async function main() {
  const suite = suiteFromArgv(process.argv.slice(2));
  const base = process.env.MARINE_VERIFY_BASE ?? 'http://127.0.0.1:3211';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const outDir = join(process.cwd(), '.logs', `marine-verify-${stamp}`);
  mkdirSync(join(outDir, 'images'), { recursive: true });
  await assertProductionServer(base);
  const browser: Browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const observations: RouteObservation[] = [];
  const fleet: Array<{ href: string; layout: string | null; expectedLayout: string; canvasWidth: number }> = [];
  const scans = {
    fftResolutions: [] as number[],
    lods: [] as string[],
    cpuRates: [] as number[],
    workerAt1Ms: null as number | null,
    workerAt4Ms: null as number | null,
    workerScope: null as 'worker-limited' | 'main-thread-only' | null,
    pixelScales: [] as number[],
    effectInjection: null as string | null,
    workerThrottleMeasured: false,
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const wantedScenes = suite === 'smoke' ? (['wave-only'] as const) : SCENES;
    const wantedRoutes = suite === 'smoke' ? ROUTES.slice(0, 1) : ROUTES;
    for (const route of wantedRoutes) {
      for (const scene of wantedScenes) {
        await page.goto(routeUrl(base, route, scene), { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForFunction(() => {
          const host = window as unknown as {
            __marineComparisonLab?: { ready?: () => boolean };
            __marineWebGpu?: { ready?: () => boolean };
          };
          return host.__marineComparisonLab?.ready?.() === true
            || host.__marineWebGpu?.ready?.() === true
            || document.querySelector('[data-webgpu-status="unavailable"], [data-webgpu-status="failed"]') !== null;
        }, undefined, { timeout: 90_000 });
        const reading = await readComparison(page, 1500);
        const imagePath = join('images', `${route.id}-${scene}.png`);
        await page.screenshot({ path: join(outDir, imagePath) });
        observations.push(toObservation({ route: route.id, scene, reading, imagePath, evidenceKind: 'actual' }));
      }
    }
    if (suite === 'extended') {
      const readyExpression = "!!((window.__marineComparisonLab && window.__marineComparisonLab.ready && window.__marineComparisonLab.ready()) || (window.__marineWebGpu && window.__marineWebGpu.ready && window.__marineWebGpu.ready()) || document.querySelector('[data-webgpu-status=\"unavailable\"], [data-webgpu-status=\"failed\"]'))";
      const cdp = await page.context().newCDPSession(page);
      await page.goto(routeUrl(base, ROUTES[0]!, 'wave-only'), { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForFunction(readyExpression, undefined, { timeout: 90_000 });
      for (const rate of [1, 4, 6]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        scans.cpuRates.push(rate);
        const throttled = await readComparison(page, 800);
        observations.push(toObservation({
          route: 'webgl-gerstner',
          scene: 'wave-only',
          reading: throttled,
          imagePath: `images/cpu-throttle-${rate}.png`,
          evidenceKind: 'cpu-throttle',
        }));
      }
      const workerAt = async (rate: number) => {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const elapsed = await page.evaluate(`new Promise((resolve) => {
          const worker = new Worker(URL.createObjectURL(new Blob([
            'self.onmessage=(event)=>{let x=0;const n=event.data|0;for(let i=0;i<n;i+=1){x=(Math.imul(x,1664525)+1013904223)>>>0}postMessage(x)}'
          ], { type: 'text/javascript' })));
          const started = performance.now();
          worker.onmessage = () => { const ms = performance.now() - started; worker.terminate(); resolve(ms); };
          worker.postMessage(4000000);
        })`);
        return typeof elapsed === 'number' ? elapsed : Number.NaN;
      };
      scans.workerAt1Ms = await workerAt(1);
      scans.workerAt4Ms = await workerAt(4);
      scans.workerScope = scans.workerAt4Ms > scans.workerAt1Ms * 1.5 ? 'worker-limited' : 'main-thread-only';
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      for (const width of [1280, 1920, 2560, 3840]) {
        const height = width === 1280 ? 720 : width === 1920 ? 1080 : width === 2560 ? 1440 : 2160;
        await page.setViewportSize({ width, height });
        await page.goto(routeUrl(base, ROUTES[0]!, 'wave-only'), { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForFunction(readyExpression, undefined, { timeout: 90_000 });
        const scaled = await readComparison(page, 400);
        scans.pixelScales.push(scaled.canvasWidth);
        observations.push(toObservation({
          route: 'webgl-gerstner',
          scene: 'wave-only',
          reading: scaled,
          imagePath: `images/pixel-${width}.png`,
          evidenceKind: 'pixel-scale',
        }));
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(routeUrl(base, ROUTES[0]!, 'feature-parity'), { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForFunction(readyExpression, undefined, { timeout: 90_000 });
      await page.evaluate("window.__marineComparisonLab && window.__marineComparisonLab.setReflectionEnabled && window.__marineComparisonLab.setReflectionEnabled(false)");
      scans.effectInjection = 'reflection-disabled';
      const broken = await readComparison(page, 400);
      observations.push(toObservation({
        route: 'webgl-gerstner',
        scene: 'feature-parity',
        reading: broken,
        imagePath: 'images/effect-injection.png',
        evidenceKind: 'effect-injection',
      }));
      for (const resolution of [128, 256, 512]) {
        await page.goto(`${routeUrl(base, ROUTES[1]!, 'wave-only')}&resolution=${resolution}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForFunction(readyExpression, undefined, { timeout: 90_000 });
        const reported = await page.locator('[data-fft-resolution]').getAttribute('data-fft-resolution');
        if (reported === String(resolution)) scans.fftResolutions.push(resolution);
      }
      for (const lod of ['low', 'high']) {
        await page.goto(`${routeUrl(base, ROUTES[1]!, 'wave-only')}&lod=${lod}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForFunction(readyExpression, undefined, { timeout: 90_000 });
        const reported = await page.locator('[data-lod]').getAttribute('data-lod');
        if (reported === lod) scans.lods.push(lod);
      }
      for (const ship of FLEET) {
        await page.goto(`${base}${ship.href}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForFunction("!!(window.__marineLayoutStats && window.__marineLayoutStats.layoutId)", undefined, { timeout: 90_000 });
        const layout = await page.evaluate(() => (window as unknown as { __marineLayoutStats?: { layoutId?: string | null } }).__marineLayoutStats?.layoutId ?? null);
        const canvasWidth = await page.evaluate(() => document.querySelector('canvas')?.width ?? 0);
        fleet.push({ href: ship.href, layout, expectedLayout: ship.layout, canvasWidth });
        const shipName = ship.href.split('?')[0]?.split('/').pop() ?? 'ship';
        await page.screenshot({ path: join(outDir, 'images', `${shipName}.png`) });
      }
    }
  } finally {
    await browser.close();
  }
  const report = judgeMarineRouteBenchmark({ observations, productionDefaultChanged: false });
  const coverageFailures = suite === 'extended'
    ? extendedCoverageFailures({
      observations,
      pixelScales: scans.pixelScales,
      cpuRates: scans.cpuRates,
      workerAt1Ms: scans.workerAt1Ms,
      workerAt4Ms: scans.workerAt4Ms,
      fftResolutions: scans.fftResolutions,
      lods: scans.lods,
      fleet,
    })
    : [];
  const passed = report.passed && coverageFailures.length === 0 && (suite !== 'smoke' || observations.length > 0);
  const payload = {
    suite,
    passed,
    report,
    observations,
    scans,
    fleet,
    coverageFailures,
    productionDefaultChanged: false,
  };
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(payload, null, 2)}\n`);
  if (suite !== 'smoke') {
    const summaryDir = join(process.cwd(), 'artifacts/openspec/issue-2137-marine-benchmark');
    mkdirSync(summaryDir, { recursive: true });
    writeFileSync(join(summaryDir, 'latest-report.json'), `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(JSON.stringify({ passed, outDir, failed: report.failedRoutes, winner: report.significantWinner }));
  const smokeOk = observations.some((item) => item.implemented && Boolean(item.hardwareContext || item.hostUnavailable));
  if ((suite === 'smoke' && !smokeOk) || (suite !== 'smoke' && !passed)) process.exitCode = 1;
}

void main();
