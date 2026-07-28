import { createHash } from 'node:crypto';
import { cpus, freemem, hostname, platform, release, totalmem } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';

type Bounds = { id: string; x: number; y: number; width: number; height: number; radius?: number };
type Snapshot = {
  renderMode: '2D' | '3D';
  visibleNodeIds: string[];
  bodyIds: string[];
  labelIds: string[];
  visibleLineIds: string[];
  edgeTraces?: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    points: Array<{ x: number; y: number }>;
  }>;
  bodyBounds: Bounds[];
  labelBounds: Bounds[];
  canonicalEdges: Array<{
    id: string;
    family: string;
    direction: string;
    sourceId: string;
    targetId: string;
  }>;
  corridorIds: { nodeIds: string[]; edgeIds: string[] };
  markerCount: number;
  viewportCoverage: {
    declared: number;
    body: number;
    label: number;
    eligible: number;
    deferred: number;
    visibleLine: number;
  };
  camera: Record<string, unknown>;
};
type Fixture = {
  selection: Record<string, unknown> & {
    viewportCoverageMinimums: Record<'2D' | '3D', { body: number; label: number }>;
  };
  graphVersion: string;
  rootPayload: Record<string, unknown> & { nodes: Array<{ id: string }> };
  expansionPayload: Record<string, unknown> & {
    nodes: Array<Record<string, unknown> & { id: string; name: string }>;
  };
};
type Cases = {
  cases: {
    lessons: Array<{ id: string; origin: string; exactBytesSha256: string; cardOrder: string[] }>;
    densestAssociation: { origin: string; selectedNodeId: string; candidateEdgeIds: string[]; expectedVisibleCap: number };
    corridor: { origin: string; selectedNodeId: string; directPostRequisiteEdgeIds: string[] };
    reciprocalScc: { origin: string; nodes: Array<{ id: string; name: string }>; links: Array<{ sourceId: string; targetId: string }> };
    noOrder: { origin: string; domainName: string; activeLessonId: null; orderSource: string; nodeIds: string[] };
    crossDomain: { origin: string; relation: { sourceId: string; targetId: string; relationType: string } };
  };
};
type RoundEvidence = {
  renderer: '2D' | '3D';
  round: number;
  intervalsMs: number[];
  longTasks: Array<{ name: string; startTime: number; duration: number }>;
  markerCounts: number[];
  metrics: {
    nodeOverlapCount: number;
    labelOverlapPairs: number;
    labelCount: number;
    labelRatioDenominator: number;
    labelPairRatio: number;
    declaredCount: number;
    bodyCount: number;
    eligibleCount: number;
    deferredCount: number;
    visibleLineCount: number;
    markerMaximum: number;
    ambientWithinBudget: boolean;
    p95IntervalMs: number;
    longTasksAbove100ms: number;
  };
  snapshot: Snapshot;
};
type PixelEvidence = {
  family: 'post-requisite' | 'association';
  targetRgb: [number, number, number];
  changedTargetPixelCount: number;
  changedTargetCoverageRatio: number;
  meanRgbDelta: number;
  p95RgbDelta: number;
  meanContrastRatio: number;
  traceability: {
    edgeId: string;
    sourceId: string;
    targetId: string;
    corridorSampleCount: number;
    coveredSampleCount: number;
    coveredSampleRatio: number;
    longestContinuousCoveredRatio: number;
    corridorTargetPixelCount: number;
    targetMarkerPixelCount: number;
    rendererOriginOffset: { x: number; y: number };
    coordinateFrame: 'raw' | 'canvas-offset' | 'canvas-offset-y-flipped';
    rendererPixelSize: { width: number; height: number };
    projectedBounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
};

const repoRoot = process.cwd();
const fixtureRoot = join(repoRoot, 'tests/fixtures/knowledge-graph-task-7-4');
const evidencePath = join(repoRoot, 'artifacts/knowledge-graph-task-7-4/reference-evidence.json');
const devServerFallback = process.env.PLAYWRIGHT_KNOWLEDGE_PERFORMANCE_SERVER_MODE === 'dev';

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function p95(values: number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function circleOverlapCount(bounds: Bounds[]): number {
  let overlaps = 0;
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      const a = bounds[left];
      const b = bounds[right];
      const aRadius = a.radius ?? Math.min(a.width, a.height) / 2;
      const bRadius = b.radius ?? Math.min(b.width, b.height) / 2;
      const distance = Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
      if (distance < aRadius + bRadius - 0.5) overlaps += 1;
    }
  }
  return overlaps;
}

function rectangleOverlapPairs(bounds: Bounds[]): number {
  let overlaps = 0;
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      const a = bounds[left];
      const b = bounds[right];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) overlaps += 1;
    }
  }
  return overlaps;
}

function visibleLabelOverlapRatio(overlapPairs: number, visibleLabelCount: number): number {
  const denominator = visibleLabelCount;
  return denominator > 0 ? overlapPairs / denominator : 0;
}

async function snapshot(page: Page): Promise<Snapshot> {
  await page.waitForFunction(
    () => Boolean((window as Window & { __knowledgeGraphTask74Snapshot?: Snapshot }).__knowledgeGraphTask74Snapshot),
    undefined,
    { timeout: 10_000 },
  );
  return page.evaluate(() => {
    const value = (window as Window & { __knowledgeGraphTask74Snapshot?: Snapshot }).__knowledgeGraphTask74Snapshot;
    if (!value) throw new Error('Task 7.4 snapshot is unavailable.');
    return value;
  });
}

async function activateNode(page: Page, nodeId: string): Promise<void> {
  await page.locator(`[data-knowledge-node-control="${nodeId}"]`).evaluate((element) => (element as HTMLButtonElement).click());
}

async function switchRenderer(page: Page, renderer: '2D' | '3D'): Promise<void> {
  const panel = page.locator('[data-knowledge-desktop-tool-panel="view-layout"]');
  if (!await panel.isVisible()) {
    await page.locator('[data-knowledge-command-trigger="view-layout"]').click();
  }
  await panel
    .getByRole('button', { name: `${renderer} 视图` })
    .click();
  await expect.poll(async () => (await snapshot(page)).renderMode).toBe(renderer);
}

async function closeEvidenceOverlays(page: Page): Promise<void> {
  const inspectorClose = page.getByRole('button', { name: '关闭知识节点检查器' });
  if (await inspectorClose.isVisible()) await inspectorClose.click();
  const toolClose = page.locator('[data-knowledge-command-close="true"]');
  if (await toolClose.isVisible()) await toolClose.click();
  await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toHaveCount(0);
  await expect(page.locator('[data-knowledge-desktop-tool-panel]')).toHaveCount(0);
}

function rgbDistance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function pixelLuminance(rgb: readonly number[]): number {
  const channels = rgb.map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

async function analyzeFamilyPixelDifference({
  family,
  targetRgb,
  enabled,
  disabled,
  graphSnapshot,
  rendererOriginOffset,
  coordinateFrame,
}: {
  family: PixelEvidence['family'];
  targetRgb: PixelEvidence['targetRgb'];
  enabled: Buffer;
  disabled: Buffer;
  graphSnapshot: Snapshot;
  rendererOriginOffset: { x: number; y: number };
  coordinateFrame: PixelEvidence['traceability']['coordinateFrame'];
}): Promise<PixelEvidence> {
  const enabledRaw = await sharp(enabled).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const disabledRaw = await sharp(disabled).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(enabledRaw.info).toEqual(disabledRaw.info);
  const deltas: number[] = [];
  let contrastTotal = 0;
  for (let index = 0; index < enabledRaw.data.length; index += 3) {
    const on = [enabledRaw.data[index], enabledRaw.data[index + 1], enabledRaw.data[index + 2]];
    const off = [disabledRaw.data[index], disabledRaw.data[index + 1], disabledRaw.data[index + 2]];
    const delta = rgbDistance(on, off);
    if (delta < 8 || rgbDistance(on, targetRgb) + 4 >= rgbDistance(off, targetRgb)) continue;
    deltas.push(delta);
    const onLuminance = pixelLuminance(on);
    const offLuminance = pixelLuminance(off);
    contrastTotal += (Math.max(onLuminance, offLuminance) + 0.05)
      / (Math.min(onLuminance, offLuminance) + 0.05);
  }
  const sortedDeltas = [...deltas].sort((left, right) => left - right);
  const pixelCount = enabledRaw.info.width * enabledRaw.info.height;
  const traceCandidates = graphSnapshot.canonicalEdges
    .filter((edge) => edge.family === family && graphSnapshot.visibleLineIds.includes(edge.id))
    .flatMap((edge) => {
      const projectedTrace = graphSnapshot.edgeTraces?.find((candidate) => candidate.id === edge.id);
      if (!projectedTrace || projectedTrace.points.length < 2) return [];
      const distance = projectedTrace.points.slice(1).reduce((sum, point, index) => (
        sum + Math.hypot(
          point.x - projectedTrace.points[index].x,
          point.y - projectedTrace.points[index].y,
        )
      ), 0);
      return distance >= 80 ? [{ edge, projectedTrace, distance }] : [];
    })
    .sort((left, right) => left.distance - right.distance || left.edge.id.localeCompare(right.edge.id));
  const corridorSampleCount = 28;
  const canvasBackgroundRgb = [237, 245, 250] as const;
  const directionMarkerRgb = [249, 115, 22] as const;
  const traceMeasurements = traceCandidates.map((trace) => {
    const coveredSamples: boolean[] = [];
    let corridorTargetPixelCount = 0;
    let targetMarkerPixelCount = 0;
    for (let sampleIndex = 0; sampleIndex < corridorSampleCount; sampleIndex += 1) {
      const tracePointIndex = Math.round(
        (0.12 + (sampleIndex / (corridorSampleCount - 1)) * 0.76)
        * (trace.projectedTrace.points.length - 1)
      );
      const { x: centerX, y: centerY } = trace.projectedTrace.points[tracePointIndex];
      let covered = false;
      for (let y = Math.max(0, Math.floor(centerY - 9)); y <= Math.min(enabledRaw.info.height - 1, Math.ceil(centerY + 9)); y += 1) {
        for (let x = Math.max(0, Math.floor(centerX - 9)); x <= Math.min(enabledRaw.info.width - 1, Math.ceil(centerX + 9)); x += 1) {
          const offset = (y * enabledRaw.info.width + x) * 3;
          const on = [enabledRaw.data[offset], enabledRaw.data[offset + 1], enabledRaw.data[offset + 2]];
          const off = [disabledRaw.data[offset], disabledRaw.data[offset + 1], disabledRaw.data[offset + 2]];
          const contrast = (Math.max(pixelLuminance(on), pixelLuminance(canvasBackgroundRgb)) + 0.05)
            / (Math.min(pixelLuminance(on), pixelLuminance(canvasBackgroundRgb)) + 0.05);
          if (
            rgbDistance(on, off) >= 8
            && rgbDistance(on, targetRgb) + 4 < rgbDistance(off, targetRgb)
            && contrast >= 1.1
          ) {
            covered = true;
            corridorTargetPixelCount += 1;
          }
        }
      }
      coveredSamples.push(covered);
    }
    const targetPoint = trace.projectedTrace.points.at(-1)!;
    for (let y = Math.max(0, Math.floor(targetPoint.y - 24)); y <= Math.min(enabledRaw.info.height - 1, Math.ceil(targetPoint.y + 24)); y += 1) {
      for (let x = Math.max(0, Math.floor(targetPoint.x - 24)); x <= Math.min(enabledRaw.info.width - 1, Math.ceil(targetPoint.x + 24)); x += 1) {
        const distance = Math.hypot(x - targetPoint.x, y - targetPoint.y);
        if (distance < 8 || distance > 24) continue;
        const offset = (y * enabledRaw.info.width + x) * 3;
        const on = [enabledRaw.data[offset], enabledRaw.data[offset + 1], enabledRaw.data[offset + 2]];
        const contrast = (Math.max(pixelLuminance(on), pixelLuminance(canvasBackgroundRgb)) + 0.05)
          / (Math.min(pixelLuminance(on), pixelLuminance(canvasBackgroundRgb)) + 0.05);
        if (rgbDistance(on, directionMarkerRgb) <= 85 && contrast >= 1.25) targetMarkerPixelCount += 1;
      }
    }
    let longestContinuousCovered = 0;
    let currentContinuousCovered = 0;
    coveredSamples.forEach((covered) => {
      currentContinuousCovered = covered ? currentContinuousCovered + 1 : 0;
      longestContinuousCovered = Math.max(longestContinuousCovered, currentContinuousCovered);
    });
    return {
      trace,
      coveredSamples,
      corridorTargetPixelCount,
      targetMarkerPixelCount,
      longestContinuousCovered,
    };
  }).sort((left, right) => (
    right.coveredSamples.filter(Boolean).length - left.coveredSamples.filter(Boolean).length
    || right.corridorTargetPixelCount - left.corridorTargetPixelCount
    || right.trace.distance - left.trace.distance
    || left.trace.edge.id.localeCompare(right.trace.edge.id)
  ));
  const measurement = traceMeasurements[0];
  const trace = measurement?.trace;
  expect(trace, `${family} projected trace candidate`).toBeDefined();
  const coveredSamples = measurement?.coveredSamples ?? [];
  const corridorTargetPixelCount = measurement?.corridorTargetPixelCount ?? 0;
  const targetMarkerPixelCount = measurement?.targetMarkerPixelCount ?? 0;
  const longestContinuousCovered = measurement?.longestContinuousCovered ?? 0;
  const projectedPoints = trace?.projectedTrace.points ?? [];
  return {
    family,
    targetRgb,
    changedTargetPixelCount: deltas.length,
    changedTargetCoverageRatio: deltas.length / pixelCount,
    meanRgbDelta: deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length),
    p95RgbDelta: sortedDeltas[Math.max(0, Math.ceil(sortedDeltas.length * 0.95) - 1)] ?? 0,
    meanContrastRatio: contrastTotal / Math.max(1, deltas.length),
    traceability: {
      edgeId: trace?.edge.id ?? '',
      sourceId: trace?.edge.sourceId ?? '',
      targetId: trace?.edge.targetId ?? '',
      corridorSampleCount,
      coveredSampleCount: coveredSamples.filter(Boolean).length,
      coveredSampleRatio: coveredSamples.filter(Boolean).length / corridorSampleCount,
      longestContinuousCoveredRatio: longestContinuousCovered / corridorSampleCount,
      corridorTargetPixelCount,
      targetMarkerPixelCount,
      rendererOriginOffset,
      coordinateFrame,
      rendererPixelSize: { width: enabledRaw.info.width, height: enabledRaw.info.height },
      projectedBounds: {
        minX: Math.min(...projectedPoints.map((point) => point.x), Number.POSITIVE_INFINITY),
        minY: Math.min(...projectedPoints.map((point) => point.y), Number.POSITIVE_INFINITY),
        maxX: Math.max(...projectedPoints.map((point) => point.x), Number.NEGATIVE_INFINITY),
        maxY: Math.max(...projectedPoints.map((point) => point.y), Number.NEGATIVE_INFINITY),
      },
    },
  };
}

async function captureFamilyPixelEvidence(
  page: Page,
  family: PixelEvidence['family'],
  targetRgb: PixelEvidence['targetRgb'],
): Promise<PixelEvidence> {
  await closeEvidenceOverlays(page);
  await expect.poll(async () => {
    const current = await snapshot(page);
    const familyEdgeIds = current.canonicalEdges
      .filter((edge) => edge.family === family)
      .map((edge) => edge.id);
    return familyEdgeIds.length > 0
      && familyEdgeIds.every((edgeId) => current.visibleLineIds.includes(edgeId));
  }).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.waitForTimeout(100);
  const enabledSnapshot = await snapshot(page);
  const enabledFamilyEdgeIds = enabledSnapshot.canonicalEdges
    .filter((edge) => edge.family === family)
    .map((edge) => edge.id);
  const renderer = page.locator(`[data-knowledge-graph-renderer="${enabledSnapshot.renderMode}"]`).first();
  await expect(renderer).toBeVisible();
  const rendererBounds = await renderer.boundingBox();
  expect(rendererBounds, `${family} renderer bounds`).not.toBeNull();
  const rendererOriginOffset = {
    x: rendererBounds?.x ?? 0,
    y: rendererBounds?.y ?? 0,
  };
  const enabled = await renderer.screenshot();
  const familyControl = page.locator(`[data-knowledge-relation-family="${family}"]`);
  await familyControl.click();
  await expect.poll(async () => (await snapshot(page)).canonicalEdges.filter((edge) => edge.family === family).length)
    .toBe(0);
  await expect.poll(async () => {
    const current = await snapshot(page);
    return enabledFamilyEdgeIds.every((edgeId) => !current.visibleLineIds.includes(edgeId));
  }).toBe(true);
  await page.waitForTimeout(100);
  const disabled = await renderer.screenshot();
  await mkdir(join(repoRoot, 'artifacts/knowledge-graph-task-7-4/traceability'), { recursive: true });
  await writeFile(
    join(repoRoot, `artifacts/knowledge-graph-task-7-4/traceability/${family}-enabled.png`),
    enabled,
  );
  await writeFile(
    join(repoRoot, `artifacts/knowledge-graph-task-7-4/traceability/${family}-disabled.png`),
    disabled,
  );
  await familyControl.click();
  await expect.poll(async () => (await snapshot(page)).canonicalEdges.filter((edge) => edge.family === family).length)
    .toBeGreaterThan(0);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const evidence = await analyzeFamilyPixelDifference({
    family,
    targetRgb,
    enabled,
    disabled,
    graphSnapshot: enabledSnapshot,
    rendererOriginOffset,
    coordinateFrame: 'raw',
  });
  expect(evidence.changedTargetPixelCount, `${family} screenshot target pixels`).toBeGreaterThanOrEqual(160);
  expect(evidence.changedTargetCoverageRatio, `${family} screenshot target coverage`).toBeGreaterThanOrEqual(0.00008);
  expect(evidence.meanRgbDelta, `${family} screenshot mean RGB delta`).toBeGreaterThanOrEqual(10);
  expect(evidence.p95RgbDelta, `${family} screenshot p95 RGB delta`).toBeGreaterThanOrEqual(18);
  expect(evidence.meanContrastRatio, `${family} screenshot mean contrast`).toBeGreaterThanOrEqual(1.03);
  const traceThresholds = family === 'association'
    ? { targetPixels: 60, sampleCoverage: 0.1, continuousCoverage: 0.07 }
    : { targetPixels: 120, sampleCoverage: 0.7, continuousCoverage: 0.5 };
  expect(
    evidence.traceability.corridorTargetPixelCount,
    `${family} projected corridor target pixels ${JSON.stringify(evidence.traceability)}`,
  )
    .toBeGreaterThanOrEqual(traceThresholds.targetPixels);
  expect(evidence.traceability.coveredSampleRatio, `${family} projected corridor sample coverage`)
    .toBeGreaterThanOrEqual(traceThresholds.sampleCoverage);
  expect(evidence.traceability.longestContinuousCoveredRatio, `${family} projected corridor continuity`)
    .toBeGreaterThanOrEqual(traceThresholds.continuousCoverage);
  if (family === 'post-requisite') {
    expect(evidence.traceability.targetMarkerPixelCount, `${family} target arrow pixels`)
      .toBeGreaterThanOrEqual(24);
  }
  return evidence;
}

async function installFixtureRoutes(page: Page, fixture: Fixture): Promise<void> {
  const nodeById = new Map(fixture.expansionPayload.nodes.map((node) => [node.id, node]));
  await page.route('**/api/knowledge/graph?*', async (route) => {
    const body = route.request().url().includes('mode=expansion') ? fixture.expansionPayload : fixture.rootPayload;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/knowledge/nodes/*', async (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '');
    const node = nodeById.get(id);
    await route.fulfill({
      status: node ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(node ? { ...node, resources: [], relatedNodes: [] } : { error: 'not found' }),
    });
  });
}

async function sampleRound(page: Page, renderer: '2D' | '3D', round: number): Promise<RoundEvidence> {
  const raw = await page.evaluate(async () => {
    const intervalsMs: number[] = [];
    const markerCounts: number[] = [];
    const longTasks: Array<{ name: string; startTime: number; duration: number }> = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration,
      });
    });
    observer.observe({ type: 'longtask', buffered: false });
    const startedAt = performance.now();
    let previous = startedAt;
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervalsMs.push(now - previous);
        previous = now;
        const current = (window as Window & { __knowledgeGraphTask74Snapshot?: Snapshot }).__knowledgeGraphTask74Snapshot;
        markerCounts.push(current?.markerCount ?? -1);
        if (now - startedAt >= 10_000) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    observer.takeRecords().forEach((entry) => longTasks.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration }));
    observer.disconnect();
    return { intervalsMs, markerCounts, longTasks };
  });
  const current = await snapshot(page);
  const labelOverlapPairs = rectangleOverlapPairs(current.labelBounds);
  const labelRatioDenominator = current.labelBounds.length;
  const markerMaximum = Math.max(...raw.markerCounts);
  const metrics = {
    nodeOverlapCount: circleOverlapCount(current.bodyBounds),
    labelOverlapPairs,
    labelCount: current.labelBounds.length,
    labelRatioDenominator,
    labelPairRatio: visibleLabelOverlapRatio(labelOverlapPairs, current.labelBounds.length),
    declaredCount: current.viewportCoverage.declared,
    bodyCount: current.viewportCoverage.body,
    eligibleCount: current.viewportCoverage.eligible,
    deferredCount: current.viewportCoverage.deferred,
    visibleLineCount: current.viewportCoverage.visibleLine,
    markerMaximum,
    ambientWithinBudget: raw.markerCounts.every((count) => count <= 11),
    p95IntervalMs: p95(raw.intervalsMs),
    longTasksAbove100ms: raw.longTasks.filter((entry) => entry.duration > 100).length,
  };
  expect(metrics.nodeOverlapCount, `${renderer} round ${round} node overlap`).toBe(0);
  expect(metrics.labelRatioDenominator, `${renderer} round ${round} label ratio denominator`).toBeGreaterThan(0);
  expect(metrics.bodyCount, `${renderer} round ${round} body coverage`).toBe(current.bodyBounds.length);
  expect(metrics.labelCount, `${renderer} round ${round} label coverage`).toBe(current.labelBounds.length);
  expect(metrics.labelCount + metrics.deferredCount, `${renderer} round ${round} label accounting`)
    .toBe(metrics.eligibleCount);
  expect(current.bodyIds, `${renderer} round ${round} body identities`)
    .toEqual(current.bodyBounds.map((bound) => bound.id).sort());
  expect(current.labelIds, `${renderer} round ${round} label identities`)
    .toEqual(current.labelBounds.map((bound) => bound.id).sort());
  expect(current.visibleLineIds, `${renderer} round ${round} visible line identities`)
    .toHaveLength(metrics.visibleLineCount);
  expect(metrics.labelPairRatio, `${renderer} round ${round} label overlap ratio`).toBeLessThanOrEqual(0.05);
  expect(metrics.markerMaximum, `${renderer} round ${round} ambient+corridor marker budget`).toBeLessThanOrEqual(11);
  expect(metrics.ambientWithinBudget, `${renderer} round ${round} marker budget conformance`).toBe(true);
  if (!devServerFallback) {
    expect(metrics.p95IntervalMs, `${renderer} round ${round} p95 rAF interval`).toBeLessThan(24);
    expect(metrics.longTasksAbove100ms, `${renderer} round ${round} long tasks`).toBe(0);
  }
  return { renderer, round, ...raw, metrics, snapshot: current };
}

test('checked-in Task 7.4 fixtures preserve reviewer-selected semantics and exact bytes', async () => {
  const manifest = await readJson<{ fixtures: Array<{ path: string; byteLength: number; exactBytesSha256: string }> }>(join(fixtureRoot, 'manifest.json'));
  for (const entry of manifest.fixtures) {
    const bytes = await readFile(join(fixtureRoot, entry.path));
    expect(bytes.byteLength).toBe(entry.byteLength);
    expect(sha256(bytes)).toBe(entry.exactBytesSha256);
  }
  const fixture = await readJson<Fixture>(join(fixtureRoot, 'largest-domain.json'));
  const cases = await readJson<Cases>(join(fixtureRoot, 'cases.json'));
  expect(fixture.selection).toMatchObject({ domainName: '状态空间', nodeCount: 131, internalAssociationRelationCount: 2606 });
  expect(fixture.selection.viewportCoverageMinimums).toEqual({
    '2D': { body: 40, label: 15 },
    '3D': { body: 100, label: 15 },
  });
  expect(cases.cases.lessons.map((lesson) => [lesson.id, lesson.cardOrder.length > 0, lesson.exactBytesSha256.length])).toEqual([
    ['lesson-1-1', true, 64], ['lesson-5-3', true, 64],
  ]);
  expect(cases.cases.densestAssociation).toMatchObject({ origin: 'runtime', selectedNodeId: '极点配置_9_b5578c51', expectedVisibleCap: 24 });
  expect(cases.cases.densestAssociation.candidateEdgeIds.length).toBeGreaterThanOrEqual(24);
  expect(cases.cases.corridor).toMatchObject({ origin: 'runtime', selectedNodeId: '状态_9_279b716f' });
  expect(cases.cases.corridor.directPostRequisiteEdgeIds.length).toBeGreaterThanOrEqual(3);
  expect(cases.cases.corridor).toMatchObject({ expectedNodeBoundary: 41, expectedEdgeBoundary: 96 });
  expect(cases.cases.reciprocalScc.origin).toBe('synthetic-task-7-4');
  expect(cases.cases.reciprocalScc.links.map((link) => [link.sourceId, link.targetId])).toEqual([
    ['task-7-4-scc-a', 'task-7-4-scc-b'], ['task-7-4-scc-b', 'task-7-4-scc-a'],
  ]);
  expect(cases.cases.noOrder).toMatchObject({ origin: 'runtime', domainName: '课程全景', activeLessonId: null, orderSource: 'none' });
  expect(cases.cases.noOrder.nodeIds.length).toBeGreaterThan(0);
  expect(cases.cases.crossDomain).toMatchObject({
    origin: 'runtime',
    relation: { sourceId: '阻尼比_3_b849784e', targetId: '超调量_3_fc3f5b17', relationType: 'leads_to' },
  });
});

test('label overlap ratio rejects 2 overlapping pairs among 21 visible labels', () => {
  expect(visibleLabelOverlapRatio(2, 21)).toBeCloseTo(0.0952, 4);
  expect(visibleLabelOverlapRatio(2, 21)).toBeGreaterThan(0.05);
});

test('ambient flow pauses when the tab is hidden and resumes on return', async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await readJson<Fixture>(join(fixtureRoot, 'largest-domain.json'));
  await installFixtureRoutes(page, fixture);
  await page.goto('/knowledge?qa=task-7-4-performance', { waitUntil: 'domcontentloaded' });
  const rootId = fixture.rootPayload.nodes[0].id;
  await expect(page.locator(`[data-knowledge-node-control="${rootId}"]`)).toBeAttached();
  await activateNode(page, rootId);
  await expect.poll(async () => (await snapshot(page)).markerCount).toBe(8);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await snapshot(page)).markerCount).toBe(0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await snapshot(page)).markerCount).toBe(8);
});

test('production Chromium passes six independent Task 7.4 performance rounds', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const fixture = await readJson<Fixture>(join(fixtureRoot, 'largest-domain.json'));
  const cases = await readJson<Cases>(join(fixtureRoot, 'cases.json'));
  const manifestBytes = await readFile(join(fixtureRoot, 'manifest.json'));
  await installFixtureRoutes(page, fixture);
  await page.goto('/knowledge?qa=task-7-4-performance', { waitUntil: 'domcontentloaded' });
  const rootId = fixture.rootPayload.nodes[0].id;
  await expect(page.locator(`[data-knowledge-node-control="${rootId}"]`)).toBeAttached();
  await activateNode(page, rootId);
  await expect.poll(async () => (await snapshot(page)).visibleNodeIds.length).toBe(132);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);

  const initialCoverage: Partial<Record<'2D' | '3D', Snapshot['viewportCoverage']>> = {};
  const initial2D = await snapshot(page);
  initialCoverage['2D'] = initial2D.viewportCoverage;
  expect(initial2D.viewportCoverage.declared).toBe(initial2D.visibleNodeIds.length);
  expect(initial2D.viewportCoverage.declared).toBe(132);
  expect(initial2D.viewportCoverage.visibleLine).toBeLessThanOrEqual(32);
  expect(initial2D.viewportCoverage.body).toBe(initial2D.viewportCoverage.declared);
  expect(initial2D.viewportCoverage.label + initial2D.viewportCoverage.deferred).toBe(initial2D.viewportCoverage.eligible);
  const coldStartupIdentity = {
    visibleNodeIds: initial2D.visibleNodeIds,
    bodyIds: initial2D.bodyIds,
    labelIds: initial2D.labelIds,
    visibleLineIds: initial2D.visibleLineIds,
  };
  await page.locator('[data-knowledge-return-root="true"]').click();
  await expect(page.locator(`[data-knowledge-node-control="${rootId}"]`)).toBeAttached();
  await activateNode(page, rootId);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);
  const reentered2D = await snapshot(page);
  expect({
    visibleNodeIds: reentered2D.visibleNodeIds,
    bodyIds: reentered2D.bodyIds,
    labelIds: reentered2D.labelIds,
    visibleLineIds: reentered2D.visibleLineIds,
  }).toEqual(coldStartupIdentity);

  await activateNode(page, cases.cases.densestAssociation.selectedNodeId);
  await expect.poll(async () => (await snapshot(page)).canonicalEdges.filter((edge) => edge.family === 'association').length).toBe(24);
  await activateNode(page, cases.cases.corridor.selectedNodeId);
  await expect.poll(async () => (await snapshot(page)).markerCount).toBe(8);
  await expect.poll(async () => (await snapshot(page)).corridorIds.nodeIds.length).toBe(41);
  await expect.poll(async () => (await snapshot(page)).corridorIds.edgeIds.length).toBe(96);
  await page.waitForTimeout(2_000);

  const resilienceRounds: Array<{
    round: number;
    selectedNodeId: string;
    nodeIds: string[];
    edgeIds: string[];
    twoDimensionalLineIds: string[];
    threeDimensionalLineIds: string[];
  }> = [];
  const selectedIdentity = await snapshot(page);
  expect(selectedIdentity.viewportCoverage.visibleLine).toBe(29);
  await switchRenderer(page, '3D');
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);
  await switchRenderer(page, '2D');
  await expect.poll(async () => (await snapshot(page)).labelIds.length)
    .toBeGreaterThanOrEqual(fixture.selection.viewportCoverageMinimums['2D'].label);
  await expect.poll(async () => (await snapshot(page)).labelIds)
    .toContain(cases.cases.corridor.selectedNodeId);
  for (let round = 1; round <= 3; round += 1) {
    await closeEvidenceOverlays(page);
    await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
      .toHaveAttribute('data-knowledge-selected-node-id', cases.cases.corridor.selectedNodeId);
    await switchRenderer(page, '3D');
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);
    await expect.poll(async () => (await snapshot(page)).labelIds.length)
      .toBeGreaterThanOrEqual(fixture.selection.viewportCoverageMinimums['3D'].label);
    await expect.poll(async () => (await snapshot(page)).labelIds)
      .toContain(cases.cases.corridor.selectedNodeId);
    const threeDimensional = await snapshot(page);
    await switchRenderer(page, '2D');
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
    await expect.poll(async () => (await snapshot(page)).labelIds.length)
      .toBeGreaterThanOrEqual(fixture.selection.viewportCoverageMinimums['2D'].label);
    await expect.poll(async () => (await snapshot(page)).labelIds)
      .toContain(cases.cases.corridor.selectedNodeId);
    const twoDimensional = await snapshot(page);
    expect(threeDimensional.visibleNodeIds).toEqual(selectedIdentity.visibleNodeIds);
    expect(twoDimensional.visibleNodeIds).toEqual(selectedIdentity.visibleNodeIds);
    expect(threeDimensional.labelIds.length)
      .toBeGreaterThanOrEqual(fixture.selection.viewportCoverageMinimums['3D'].label);
    expect(twoDimensional.labelIds.length)
      .toBeGreaterThanOrEqual(fixture.selection.viewportCoverageMinimums['2D'].label);
    expect(threeDimensional.labelIds).toContain(cases.cases.corridor.selectedNodeId);
    expect(twoDimensional.labelIds).toContain(cases.cases.corridor.selectedNodeId);
    expect(threeDimensional.canonicalEdges).toEqual(twoDimensional.canonicalEdges);
    expect(threeDimensional.corridorIds).toEqual(twoDimensional.corridorIds);
    const renderer = page.locator('[data-knowledge-graph-renderer="2D"]');
    const rendererBox = await renderer.boundingBox();
    if (!rendererBox) throw new Error('2D renderer bounds unavailable for blank-canvas dismissal.');
    await page.mouse.click(rendererBox.x + rendererBox.width - 12, rendererBox.y + rendererBox.height - 56);
    await expect(page.locator('[data-knowledge-canvas-primary="true"]')).toHaveAttribute('data-knowledge-selected-node-id', '');
    await activateNode(page, cases.cases.corridor.selectedNodeId);
    await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toBeVisible();
    await expect(page.locator('[data-knowledge-canvas-primary="true"]'))
      .toHaveAttribute('data-knowledge-selected-node-id', cases.cases.corridor.selectedNodeId);
    const reselected = await snapshot(page);
    expect(reselected.visibleNodeIds).toEqual(selectedIdentity.visibleNodeIds);
    expect(reselected.corridorIds).toEqual(selectedIdentity.corridorIds);
    expect(page.isClosed()).toBe(false);
    resilienceRounds.push({
      round,
      selectedNodeId: cases.cases.corridor.selectedNodeId,
      nodeIds: reselected.visibleNodeIds,
      edgeIds: reselected.corridorIds.edgeIds,
      twoDimensionalLineIds: twoDimensional.visibleLineIds,
      threeDimensionalLineIds: threeDimensional.visibleLineIds,
    });
  }
  expect(pageErrors).toEqual([]);

  const rounds: RoundEvidence[] = [];
  const parity: Record<'2D' | '3D', {
    visibleNodeIds: string[];
    bodyIds: string[];
    labelIds: string[];
    visibleLineIds: string[];
    canonicalEdges: Snapshot['canonicalEdges'];
    corridorIds: Snapshot['corridorIds'];
    markerCount: number;
  } | null> = { '2D': null, '3D': null };
  for (const renderer of ['2D', '3D'] as const) {
    if (renderer === '3D') {
      await switchRenderer(page, '3D');
      await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
      await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);
      await expect.poll(async () => (await snapshot(page)).viewportCoverage.visibleLine).toBeGreaterThan(0);
      initialCoverage['3D'] = (await snapshot(page)).viewportCoverage;
    }
    const current = await snapshot(page);
    parity[renderer] = {
      visibleNodeIds: current.visibleNodeIds,
      bodyIds: current.bodyIds,
      labelIds: current.labelIds,
      visibleLineIds: current.visibleLineIds,
      canonicalEdges: current.canonicalEdges,
      corridorIds: current.corridorIds,
      markerCount: current.markerCount,
    };
    for (let round = 1; round <= 3; round += 1) rounds.push(await sampleRound(page, renderer, round));
  }
  expect(parity['3D']?.visibleNodeIds).toEqual(parity['2D']?.visibleNodeIds);
  expect(parity['3D']?.bodyIds).toEqual(parity['2D']?.bodyIds);
  expect(parity['3D']?.visibleLineIds).toEqual(parity['2D']?.visibleLineIds);
  expect(parity['3D']?.canonicalEdges).toEqual(parity['2D']?.canonicalEdges);
  expect(parity['3D']?.corridorIds).toEqual(parity['2D']?.corridorIds);
  expect(parity['3D']?.markerCount).toEqual(parity['2D']?.markerCount);
  await switchRenderer(page, '2D');
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBe(132);
  await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBe(24);
  await page.waitForTimeout(2_000);
  const settledReturn2D = await snapshot(page);
  expect({
    visibleNodeIds: settledReturn2D.visibleNodeIds,
    bodyIds: settledReturn2D.bodyIds,
    labelIds: settledReturn2D.labelIds,
    visibleLineIds: settledReturn2D.visibleLineIds,
    canonicalEdges: settledReturn2D.canonicalEdges,
    corridorIds: settledReturn2D.corridorIds,
    markerCount: settledReturn2D.markerCount,
  }).toEqual(parity['2D']);

  await page.unrouteAll({ behavior: 'wait' });
  const caseEvidenceRoot = join(repoRoot, 'artifacts/knowledge-graph-task-7-4/cases');
  await mkdir(caseEvidenceRoot, { recursive: true });
  const representativeCases: Array<{
    caseId: string;
    screenshotPath: string;
    screenshotSha256: string;
    snapshot: Snapshot;
    assertions: Record<string, unknown>;
  }> = [];
  const captureCase = async ({
    caseId,
    domainId,
    lessonId,
    selectedNodeId,
    renderMode = '2D',
    minimumCoverage,
    pixelFamilies,
    assertions,
  }: {
    caseId: string;
    domainId: string;
    lessonId?: string;
    selectedNodeId?: string;
    renderMode?: '2D' | '3D';
    minimumCoverage: { body: number; label: number; visibleLine: number };
    pixelFamilies?: Array<{ family: PixelEvidence['family']; targetRgb: PixelEvidence['targetRgb'] }>;
    assertions: () => Promise<Record<string, unknown>>;
  }) => {
    await page.goto(`/knowledge?qa=task-7-4-performance${lessonId ? `&lessonId=${lessonId}` : ''}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator(`[data-knowledge-node-control="${domainId}"]`)).toBeAttached();
    await activateNode(page, domainId);
    await expect.poll(async () => {
      const current = await snapshot(page);
      return current.viewportCoverage.body === current.viewportCoverage.declared;
    }).toBe(true);
    if (renderMode === '3D') {
      await switchRenderer(page, '3D');
      await expect.poll(async () => {
        const current = await snapshot(page);
        return current.viewportCoverage.body === current.viewportCoverage.declared;
      }).toBe(true);
    }
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.declared).toBeGreaterThan(1);
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBeGreaterThanOrEqual(minimumCoverage.body);
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBeGreaterThanOrEqual(minimumCoverage.label);
    if (!selectedNodeId) {
      await expect.poll(async () => (await snapshot(page)).viewportCoverage.visibleLine)
        .toBeGreaterThanOrEqual(minimumCoverage.visibleLine);
    }
    if (selectedNodeId) {
      await activateNode(page, selectedNodeId);
      await expect.poll(async () => page.locator('[data-knowledge-selected-node-id]').getAttribute('data-knowledge-selected-node-id'))
        .toBe(selectedNodeId);
      await expect.poll(async () => (await snapshot(page)).viewportCoverage.visibleLine)
        .toBeGreaterThanOrEqual(minimumCoverage.visibleLine);
    }
    const caseAssertions = await assertions();
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.body).toBeGreaterThan(1);
    await expect.poll(async () => (await snapshot(page)).viewportCoverage.label).toBeGreaterThan(1);
    await page.evaluate((id) => {
      document.querySelector('[data-task-7-4-case-id]')?.remove();
      const badge = document.createElement('div');
      badge.dataset.task74CaseId = id;
      badge.setAttribute('data-task-7-4-case-id', id);
      badge.textContent = `Task 7.4 · ${id}`;
      Object.assign(badge.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
        padding: '8px 12px', borderRadius: '6px', color: '#fff', background: '#07142f',
        font: '600 13px system-ui', letterSpacing: '0.02em',
      });
      document.body.appendChild(badge);
    }, caseId);
    await closeEvidenceOverlays(page);
    const pixelEvidence: PixelEvidence[] = [];
    for (const { family, targetRgb } of pixelFamilies ?? []) {
      pixelEvidence.push(await captureFamilyPixelEvidence(page, family, targetRgb));
    }
    const screenshotPath = join(caseEvidenceRoot, `${caseId}.png`);
    await page.screenshot({ path: screenshotPath });
    const screenshotBytes = await readFile(screenshotPath);
    const caseSnapshot = await snapshot(page);
    expect(caseSnapshot.viewportCoverage.body).toBeGreaterThanOrEqual(minimumCoverage.body);
    expect(caseSnapshot.viewportCoverage.label).toBeGreaterThanOrEqual(minimumCoverage.label);
    expect(caseSnapshot.viewportCoverage.visibleLine).toBeGreaterThanOrEqual(minimumCoverage.visibleLine);
    representativeCases.push({
      caseId,
      screenshotPath: `artifacts/knowledge-graph-task-7-4/cases/${caseId}.png`,
      screenshotSha256: sha256(screenshotBytes),
      snapshot: caseSnapshot,
      assertions: { ...caseAssertions, ...(pixelEvidence.length > 0 ? { pixelEvidence } : {}) },
    });
  };

  await captureCase({
    caseId: 'lesson-1-1', domainId: 'chapter-node:课程全景', lessonId: '1-1', renderMode: '3D',
    minimumCoverage: { body: 18, label: 18, visibleLine: 0 },
    assertions: async () => ({
      activeLessonId: await page.locator('[data-knowledge-active-lesson-id]').getAttribute('data-knowledge-active-lesson-id'),
      cardOrderCount: Number(await page.locator('[data-knowledge-lesson-card-order-count]').getAttribute('data-knowledge-lesson-card-order-count')),
    }),
  });
  expect(representativeCases.at(-1)?.assertions).toMatchObject({ activeLessonId: '1-1' });
  expect(Number(representativeCases.at(-1)?.assertions.cardOrderCount)).toBeGreaterThan(0);

  await captureCase({
    caseId: 'lesson-5-3', domainId: 'chapter-node:知识边界与方法迁移层', lessonId: '5-3',
    minimumCoverage: { body: 38, label: 18, visibleLine: 20 },
    assertions: async () => ({
      activeLessonId: await page.locator('[data-knowledge-active-lesson-id]').getAttribute('data-knowledge-active-lesson-id'),
      cardOrderCount: Number(await page.locator('[data-knowledge-lesson-card-order-count]').getAttribute('data-knowledge-lesson-card-order-count')),
      visiblePostSkeletonEdges: (await snapshot(page)).canonicalEdges
        .filter((edge) => edge.family === 'post-requisite').length,
    }),
  });
  expect(representativeCases.at(-1)?.assertions).toMatchObject({ activeLessonId: '5-3' });
  expect(Number(representativeCases.at(-1)?.assertions.cardOrderCount)).toBeGreaterThan(0);
  expect(Number(representativeCases.at(-1)?.assertions.visiblePostSkeletonEdges)).toBeGreaterThan(0);
  expect(Number(representativeCases.at(-1)?.assertions.visiblePostSkeletonEdges))
    .toBeLessThanOrEqual(representativeCases.at(-1)?.snapshot.visibleNodeIds.length ?? 0);

  await captureCase({
    caseId: 'densest-association', domainId: 'chapter-node:状态空间',
    selectedNodeId: cases.cases.densestAssociation.selectedNodeId,
    renderMode: '3D',
    minimumCoverage: { body: 32, label: 10, visibleLine: 24 },
    pixelFamilies: [
      { family: 'association', targetRgb: [180, 83, 9] },
      { family: 'post-requisite', targetRgb: [15, 61, 102] },
    ],
    assertions: async () => ({
      associationEdges: (await snapshot(page)).canonicalEdges.filter((edge) => edge.family === 'association').length,
    }),
  });
  expect(representativeCases.at(-1)?.assertions).toMatchObject({ associationEdges: 24 });

  const scc = cases.cases.reciprocalScc;
  const sccDomainId = 'chapter-node:Task 7.4 SCC';
  const sccNodes = scc.nodes.map((node, index) => ({
    ...node, nodeType: 'THEORY', description: node.name,
    positionX: index === 0 ? -48 : 48, positionY: 0, positionZ: 0,
    chapterName: 'Task 7.4 SCC', expansion: { state: 'leaf' },
  }));
  const sccRoot = {
    id: sccDomainId, name: 'Task 7.4 SCC', nodeType: 'THEORY', description: 'Task 7.4 reciprocal SCC',
    positionX: 0, positionY: 0, positionZ: 1, chapterName: 'Task 7.4 SCC', expansion: { state: 'expandable' },
  };
  const sccGraphVersion = 'task-7-4-scc-v1';
  await installFixtureRoutes(page, {
    selection: { viewportCoverageMinimums: { '2D': { body: 2, label: 2 }, '3D': { body: 2, label: 2 } } },
    graphVersion: sccGraphVersion,
    rootPayload: {
      mode: 'root', graphVersion: sccGraphVersion, shardKey: `${sccGraphVersion}:shard:root:chapters`,
      nodes: [sccRoot], links: [], source: 'fixture', truncated: { nodes: false, links: false, membershipLinks: false },
      rootCatalog: sccNodes.map((node) => ({ nodeId: node.id, nodeName: node.name, nodeType: node.nodeType, domainId: sccDomainId, chapterName: 'Task 7.4 SCC' })),
    },
    expansionPayload: {
      mode: 'expansion', domainId: sccDomainId, graphVersion: sccGraphVersion,
      shardKey: `${sccGraphVersion}:shard:expansion:${sccDomainId}`, nodes: [sccRoot, ...sccNodes],
      links: scc.links.map((link) => ({ ...link, relation: 'prerequisite', relationType: 'prerequisite' })),
      source: 'fixture', truncated: { nodes: false, links: false, membershipLinks: false, corridorLinks: false },
    },
  } as Fixture);
  await captureCase({
    caseId: 'reciprocal-scc', domainId: sccDomainId, selectedNodeId: scc.nodes[0].id,
    minimumCoverage: { body: 3, label: 3, visibleLine: 2 },
    assertions: async () => ({ reciprocalEdges: (await snapshot(page)).canonicalEdges.length }),
  });
  expect(representativeCases.at(-1)?.assertions).toMatchObject({ reciprocalEdges: 2 });
  await page.unrouteAll({ behavior: 'wait' });

  await captureCase({
    caseId: 'no-order-source', domainId: 'chapter-node:课程全景',
    minimumCoverage: { body: 18, label: 5, visibleLine: 0 },
    assertions: async () => ({
      activeLessonId: await page.locator('[data-knowledge-active-lesson-id]').getAttribute('data-knowledge-active-lesson-id'),
      teachingOrderSource: await page.locator('[data-knowledge-teaching-order-source]').getAttribute('data-knowledge-teaching-order-source'),
    }),
  });
  expect(representativeCases.at(-1)?.assertions).toMatchObject({ activeLessonId: '', teachingOrderSource: 'post-only' });

  await captureCase({
    caseId: 'cross-domain', domainId: 'chapter-node:时域分析',
    selectedNodeId: cases.cases.crossDomain.relation.sourceId,
    renderMode: '3D',
    minimumCoverage: { body: 94, label: 22, visibleLine: 1 },
    pixelFamilies: [{ family: 'association', targetRgb: [180, 83, 9] }],
    assertions: async () => ({
      adjacentDomainNavigationCount: await page.locator('[data-knowledge-corridor-adjacent-navigation="true"]').count(),
      corridorEdgeCount: (await snapshot(page)).corridorIds.edgeIds.length,
    }),
  });
  expect(Number(representativeCases.at(-1)?.assertions.adjacentDomainNavigationCount)).toBeGreaterThan(0);

  const hardware = {
    hostname: hostname(),
    platform: platform(),
    architecture: process.arch,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
  };
  const evidence = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    environment: {
      chromiumVersion: await (browser as Browser).version(),
      hardware,
      hardwareStableId: sha256(JSON.stringify(hardware)),
      os: { platform: platform(), release: release(), architecture: process.arch },
      headed: process.env.PLAYWRIGHT_HEADED === '1',
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      cpuThrottling: false,
      availableMemoryBytesAtCapture: freemem(),
      limitation: '电源状态与后台负载无法由此自动化测试可靠证明；结果仅代表记录环境。',
    },
    formulas: {
      nodeOverlap: 'circle center distance < radius sum - 0.5 CSS px',
      labelPairRatio: 'unique intersecting visible-label pairs / visible rendered labels',
      p95Interval: 'nearest-rank(sorted all requestAnimationFrame intervals, 0.95)',
      longTask: 'PerformanceObserver longtask duration > 100 ms',
      relationPixels: 'family-enabled screenshot pixels closer to the predefined family RGB than the family-disabled screenshot',
      relationTraceability: '28 source-to-target projection-corridor samples with local target-color and contrast coverage; directed target annulus verifies independent arrow pixels',
    },
    thresholds: {
      nodeOverlapCount: 0,
      labelPairRatioMaximum: 0.05,
      markerMaximum: 11,
      p95IntervalMsMaximumExclusive: 24,
      longTasksAbove100ms: 0,
      relationPixels: {
        changedTargetPixelCountMinimum: 160,
        changedTargetCoverageRatioMinimum: 0.00008,
        meanRgbDeltaMinimum: 10,
        p95RgbDeltaMinimum: 18,
        meanContrastRatioMinimum: 1.03,
        corridorTargetPixelCountMinimum: 120,
        corridorSampleCoverageMinimum: 0.7,
        longestContinuousCoverageMinimum: 0.5,
        directedTargetArrowPixelMinimum: 24,
      },
    },
    fixture: { manifestExactBytesSha256: sha256(manifestBytes), graphVersion: fixture.graphVersion, selection: fixture.selection },
    initialCoverage,
    rounds,
    resilienceRounds,
    parity,
    representativeCases,
    manualReadability: {
      status: 'pending-independent-acceptance',
      note: '本自动化未伪造人工观察；教学可读性仍需独立人员依据真实页面或截图验收。',
    },
  };
  await mkdir(join(repoRoot, 'artifacts/knowledge-graph-task-7-4'), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
});
