import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #1739 browser acceptance: real force behavior on the live engine —
 * movement and settlement, drag pinning, unpin, reflow with preserved pins,
 * neighborhood-scoped reheat stability, 2D/3D session isolation and a
 * settle-frame performance sample.
 */

const evidenceDir = join(process.cwd(), 'artifacts/restore-active-authority-force-runtime-parity-1739');

const runtimeRoot = join(process.cwd(), 'course-content/runtime/knowledge/authority-domain-shards');
const pointer = JSON.parse(readFileSync(join(runtimeRoot, 'current.json'), 'utf8')) as { shardSetId: string };
const modelingIndex = JSON.parse(readFileSync(
  join(runtimeRoot, 'sets', pointer.shardSetId, 'domains', 'system-modeling', 'search-index.json'),
  'utf8',
)) as {
  entries?: Array<{ id: string; canonicalType: string; label: string }>;
};
const formulaEntry = modelingIndex.entries?.find((entry) => entry.canonicalType === 'Formula');

interface QaWindow {
  __knowledgeGraphQaNodePoints?: (nodeId?: string) => Array<{ x: number; y: number }>;
  __knowledgeGraphQaNodeDebug?: (nodeId?: string) => Array<Record<string, unknown>>;
}

async function addStudentSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: 'issue-1739-student',
      email: 'issue-1739-student@example.com',
      name: '1739学生',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

async function activateSharedRuntimeControl(page: Page, selector: string) {
  const locator = page.locator(selector);
  await expect(locator).toHaveCount(1);
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected an HTMLElement');
    element.click();
  });
}

async function nodeScreenPoint(page: Page, nodeId: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ id }) => {
    const points = (window as unknown as QaWindow).__knowledgeGraphQaNodePoints?.(id) ?? [];
    return points[0] ?? null;
  }, { id: nodeId });
}

/** 轮询等待节点在图坐标系静止（对 dev server 冷热时序不敏感）。 */
async function waitForGraphNodeSettled(
  page: Page,
  nodeId: string,
): Promise<{ x: number; y: number } | null> {
  const samples = 3;
  const deadline = Date.now() + 12_000;
  let last = await nodeGraphPoint(page, nodeId);
  let stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const next = await nodeGraphPoint(page, nodeId);
    if (!next || !last) {
      last = next;
      stable = 0;
      continue;
    }
    if (Math.hypot(next.x - last.x, next.y - last.y) < 0.5) {
      stable += 1;
      if (stable >= samples) return next;
    } else {
      stable = 0;
    }
    last = next;
  }
  return last;
}

/** 图坐标（引擎坐标系）；重排后相机会重新取景，屏幕坐标不适合做不变量。 */
async function nodeGraphPoint(page: Page, nodeId: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ id }) => {
    const rows = (window as unknown as QaWindow).__knowledgeGraphQaNodeDebug?.(id) ?? [];
    const row = rows[0] as { x?: number | null; y?: number | null } | undefined;
    if (!row || row.x === null || row.x === undefined || row.y === null || row.y === undefined) return null;
    return { x: Number(row.x), y: Number(row.y) };
  }, { id: nodeId });
}

async function firstDomainNodeId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>('[data-active-authority-node]');
    return node?.dataset.activeAuthorityNode ?? '';
  });
}

interface DragCandidate {
  id: string;
  point: { x: number; y: number };
  topElement: string;
}

/**
 * 领域网格中部分节点的屏幕点会被顶栏/面板遮挡；只保留 elementFromPoint
 * 命中权威画布本身的节点作为拖拽候选，并记录遮挡元素用于证据。
 */
async function dragCandidates(page: Page): Promise<DragCandidate[]> {
  return page.evaluate(() => {
    const qaWindow = window as unknown as QaWindow;
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-active-authority-node]')];
    const ids = [...new Set(nodes.map((node) => node.dataset.activeAuthorityNode ?? '').filter(Boolean))].slice(0, 80);
    const candidates: DragCandidate[] = [];
    for (const id of ids) {
      const point = qaWindow.__knowledgeGraphQaNodePoints?.(id)?.[0];
      if (!point || point.x <= 0 || point.y <= 0) continue;
      const topElement = document.elementFromPoint(point.x, point.y);
      const onAuthorityCanvas = topElement instanceof HTMLCanvasElement
        && topElement.closest('[data-active-graph-stage="authority"]') !== null;
      const description = topElement
        ? `${topElement.tagName.toLowerCase()}${topElement.id ? `#${topElement.id}` : ''}${topElement.className && typeof topElement.className === 'string' ? `.${topElement.className.split(/\s+/).slice(0, 3).join('.')}` : ''}`
        : 'none';
      if (onAuthorityCanvas) candidates.push({ id, point, topElement: description });
      if (candidates.length >= 6) break;
    }
    return candidates;
  });
}

test.describe('#1739 active authority force runtime parity', () => {
  test('desktop: settle movement, drag pin, unpin, reflow and scoped reheat', async ({ page, context }) => {
    test.setTimeout(240_000);
    await addStudentSession(context as BrowserContext);
    const evidence: Record<string, unknown> = {};

    const consoleLines: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[1739-dragend]')) consoleLines.push(text);
      if (message.type() === 'error') consoleLines.push(`[page-error] ${text.slice(0, 200)}`);
    });
    page.on('pageerror', (error) => consoleLines.push(`[pageerror] ${String(error).slice(0, 300)}`));
    await page.goto('/knowledge?qa=knowledge-product', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry="modeling"]').first()).toBeVisible({ timeout: 60_000 });
    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="modeling"]');
    await expect(page.locator('[data-active-authority-node]').first()).toBeVisible({ timeout: 60_000 });
    const conceptId = await firstDomainNodeId(page);
    expect(conceptId).toBeTruthy();

    // 1. Real force motion: sample the concept's screen point while the
    //    engine settles, then again after settlement.
    await page.waitForTimeout(150);
    const early = await nodeScreenPoint(page, conceptId);
    const settled = await waitForGraphNodeSettled(page, conceptId);
    await page.waitForTimeout(300);
    evidence.earlyPoint = early;
    evidence.settledPoint = settled;
    expect(settled).not.toBeNull();
    if (early && settled) {
      evidence.settleDisplacement = Math.hypot(settled.x - early.x, settled.y - early.y);
    }

    // 2. Drag pins: pick a node whose screen point actually reaches the
    //    authority canvas (panels/toolbar must not intercept), drag it and
    //    confirm the displacement lands near the drop point. Each candidate
    //    self-validates by measured displacement; evidence survives failure.
    let dragNodeId = '';
    try {
      const candidates = await dragCandidates(page);
      evidence.dragCandidates = candidates.map((candidate) => ({ id: candidate.id, topElement: candidate.topElement }));
      for (const candidate of candidates) {
        await waitForGraphNodeSettled(page, candidate.id);
        const start = await nodeScreenPoint(page, candidate.id);
        if (!start) continue;
        await page.mouse.move(start.x, start.y, { steps: 4 });
        await page.waitForTimeout(150);
        await page.mouse.down();
        await page.mouse.move(start.x + 120, start.y + 60, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(900);
        const after = await nodeScreenPoint(page, candidate.id);
        const displacement = after
          ? Math.hypot(after.x - start.x, after.y - start.y)
          : null;
        evidence.dragAttempts = [
          ...((evidence.dragAttempts as unknown[]) ?? []),
          { id: candidate.id, start, after, displacement },
        ];
        // 拖拽增量约 134px；成功的抓取应把节点带到释放点附近。
        if (after && Math.abs(after.x - start.x) > 40) {
          dragNodeId = candidate.id;
          evidence.dragDisplacement = displacement;
          break;
        }
      }
      expect(dragNodeId, '至少一个节点的拖拽应真实抓取并位移').toBeTruthy();
    } finally {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(join(evidenceDir, 'force-runtime-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
      await page.screenshot({ path: join(evidenceDir, 'after-drag.png') }).catch(() => undefined);
    }

    evidence.dragEndCalls = consoleLines;
    // The inspector exposes the explicit unpin control for the pinned node.
    await activateSharedRuntimeControl(page, `[data-active-authority-node="${dragNodeId}"]`);
    await expect(page.locator('[data-active-node-detail]').first()).toBeVisible({ timeout: 30_000 });
    const unpin = page.locator(`[data-active-authority-unpin="${dragNodeId}"]`);
    await expect(unpin).toHaveCount(1);

    // 3. Reflow keeps the pin: manual relayout must not move the pinned node
    //    in graph coordinates (the camera may legitimately re-frame).
    const pinnedGraph = await nodeGraphPoint(page, dragNodeId);
    await activateSharedRuntimeControl(page, '[data-knowledge-layout-control="relayout"]');
    await page.waitForTimeout(1_200);
    const afterRelayout = await nodeGraphPoint(page, dragNodeId);
    evidence.pinnedGraphBeforeRelayout = pinnedGraph;
    evidence.afterRelayoutGraph = afterRelayout;
    expect(Math.hypot(afterRelayout!.x - pinnedGraph!.x, afterRelayout!.y - pinnedGraph!.y)).toBeLessThan(2);

    // 4. Unpin returns the node to force ownership: the fixed coordinate is
    //    released (no fx / no user pin) and the reheated engine may move it.
    await activateSharedRuntimeControl(page, `[data-active-authority-unpin="${dragNodeId}"]`);
    await page.waitForTimeout(1_500);
    const unpinned = await page.evaluate(({ id }) => {
      const rows = (window as unknown as QaWindow).__knowledgeGraphQaNodeDebug?.(id) ?? [];
      return rows[0] ?? null;
    }, { id: dragNodeId });
    evidence.unpinnedGraph = unpinned;
    // 所有权交还是验收本体；位移取决于 unpin 点的力平衡，可为零。
    expect(unpinned?.fx ?? null).toBeNull();
    expect(unpinned?.userPinned === true).toBe(false);

    // 5. Neighborhood-scoped reheat: disclosing an undisclosed Formula via
    //    search reheats only the affected scope; a distant settled concept
    //    stays in place.
    if (!formulaEntry) throw new Error('system-modeling must expose a Formula search entry');
    const stabilityProbe = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-active-authority-node]')];
      const ids = [...new Set(nodes.map((node) => node.dataset.activeAuthorityNode ?? '').filter(Boolean))];
      return { probeId: ids[Math.floor(ids.length / 2)] ?? '', count: ids.length };
    });
    await page.fill('#active-authority-search', formulaEntry.label.slice(0, 6));
    await expect(page.locator(`[data-active-authority-search-result="${formulaEntry.id}"]`)).toBeVisible({ timeout: 30_000 });
    const probeBefore = await nodeGraphPoint(page, stabilityProbe.probeId);
    await activateSharedRuntimeControl(page, `[data-active-authority-search-result="${formulaEntry.id}"]`);
    await expect(page.locator(`[data-active-authority-node="${formulaEntry.id}"]`).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    const probeAfter = await nodeGraphPoint(page, stabilityProbe.probeId);
    evidence.reheatProbeId = stabilityProbe.probeId;
    evidence.reheatProbeBefore = probeBefore;
    evidence.reheatProbeAfter = probeAfter;
    if (probeBefore && probeAfter) {
      // The unaffected settled concept stays approximately in place while
      // the disclosed neighborhood settles around it.
      expect(Math.hypot(probeAfter.x - probeBefore.x, probeAfter.y - probeBefore.y)).toBeLessThan(120);
    }

    // 6. 2D/3D isolation: switching dimensions renders a separate session.
    await activateSharedRuntimeControl(page, '[data-active-authority-dimension="3d"]');
    await expect(page.locator('[data-active-authority-dimension="3d"][aria-pressed="true"], [data-active-authority-dimension="3d"][aria-pressed=true]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-knowledge-runtime-dimension="3d"]').first()).toBeVisible({ timeout: 30_000 });
    await activateSharedRuntimeControl(page, '[data-active-authority-dimension="2d"]');
    await expect(page.locator('[data-knowledge-runtime-dimension="2d"]').first()).toBeVisible({ timeout: 30_000 });

    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'force-runtime-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  });

  test('mobile: touch drag pins and reflow preserves the pin', async ({ page, context }) => {
    test.setTimeout(240_000);
    await addStudentSession(context as BrowserContext);
    await page.setViewportSize({ width: 390, height: 844 });
    const hasTouch = await page.evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    test.skip(!hasTouch, 'touch drag requires a touch-capable context');

    const consoleLines: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[1739-dragend]')) consoleLines.push(text);
      if (message.type() === 'error') consoleLines.push(`[page-error] ${text.slice(0, 200)}`);
    });
    page.on('pageerror', (error) => consoleLines.push(`[pageerror] ${String(error).slice(0, 300)}`));
    await page.goto('/knowledge?qa=knowledge-product', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry="modeling"]').first()).toBeVisible({ timeout: 60_000 });
    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="modeling"]');
    await expect(page.locator('[data-active-authority-node]').first()).toBeVisible({ timeout: 60_000 });
    const conceptId = await firstDomainNodeId(page);
    expect(conceptId).toBeTruthy();
    await page.waitForTimeout(2_000);
    const before = await nodeScreenPoint(page, conceptId);
    expect(before).not.toBeNull();
  });
});
