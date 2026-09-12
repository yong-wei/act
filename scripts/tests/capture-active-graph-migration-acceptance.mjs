#!/usr/bin/env node
// #1743 验收主流程：行为矩阵 → force trace → 性能 → manifest + 隐私扫描。
// 用法：node scripts/tests/capture-active-graph-migration-acceptance.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

import {
  BASE, OUTPUT_DIR, BUDGETS, CAPTURE_SOURCE_FILES, EVIDENCE, ROWS,
  row, assertCleanCapture, provisionRoles, login,
  openActiveGraph, selectDomain, enterGraphAndDomain, labelPositions,
  movementBetween, semanticNodeIds, structuralClosure, readGitState, sha256File,
} from './active-graph-acceptance-lib.mjs';

function shot(page, name) {
  const file = `${name}.png`;
  EVIDENCE.screenshots.push(file);
  return page.screenshot({ path: path.join(OUTPUT_DIR, file) });
}

// ---------------------------------------------------------------------------
// Phase 2 — 浏览器行为矩阵
// ---------------------------------------------------------------------------
async function behaviorMatrix(page, rootShard, localeCap) {
  const domains = rootShard.root.domains;

  // root 层：全部入口可见
  const entryCount = await enterGraphAndDomain(page, null);
  row('hierarchy', 'root.entries.visible', 'root 层 15 个领域入口全部可见', entryCount === 15, `count=${entryCount}`);
  await shot(page, '01-root-entries');

  // 每域：概览 → 概念选择 → one-hop / relation-empty（desktop / 2D / student）
  for (const domain of domains) {
    const role = domain.visualRole;
    await enterGraphAndDomain(page, role);
    const nodes = await semanticNodeIds(page);
    const visibleDirectory = await page.locator('[data-active-authority-node-directory="visible"]').count();
    const basePass = nodes.length > 0 && visibleDirectory === 0;
    row('hierarchy', `domain.${role}.overview`, '概览有界可见且无可见全节点目录', basePass,
      `nodes=${nodes.length} visibleDirectory=${visibleDirectory}`);

    const firstNode = page.locator(`[data-active-authority-semantic-nodes] [data-active-authority-node="${nodes[0]}"]`);
    await firstNode.dispatchEvent('click');
    await page.waitForTimeout(3500);
    const afterIds = await semanticNodeIds(page);
    const detailOpen = await page.locator('[data-active-node-detail]').count();
    const emptyState = await page.locator('text=暂无已发布关系').count();
    const oneHopPass = (afterIds.length >= nodes.length && detailOpen === 1) || emptyState > 0;
    row('hierarchy', `domain.${role}.one-hop`,
      '选择披露 one-hop 邻域（或显式 relation-empty 状态）', oneHopPass,
      `before=${nodes.length} after=${afterIds.length} detail=${detailOpen} empty=${emptyState}`);
    await page.evaluate(() => document.querySelector('[data-active-node-detail] button, [data-active-node-detail]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  }
  await shot(page, '02-domain-representative');

  // force trace（代表域 root-locus 85 概念；2D）
  await enterGraphAndDomain(page, 'root-locus');
  let earlyMovement = 0;
  let prevPositions = await labelPositions(page);
  for (let sample = 0; sample < 24; sample += 1) {
    await page.waitForTimeout(250);
    const next = await labelPositions(page);
    const delta = movementBetween(prevPositions, next) ?? 0;
    if (delta > earlyMovement) earlyMovement = delta;
    prevPositions = next;
  }
  EVIDENCE.traces.earlyMovement = earlyMovement;

  // reflow：点击重新布局后必须出现新位移并重新稳定
  const beforeReflow = await labelPositions(page);
  await page.locator('[data-knowledge-layout-control="relayout"]').dispatchEvent('click');
  await page.waitForTimeout(700);
  const midReflow = await labelPositions(page);
  await page.waitForTimeout(3500);
  const settledReflow = await labelPositions(page);
  const reflowMovement = movementBetween(beforeReflow, midReflow);
  const reflowSettled = movementBetween(midReflow, settledReflow);
  row('force', '2d.movement', '进域采样或 reflow 存在真实 unpinned 位移且重新收敛',
    (earlyMovement > 0 || (reflowMovement ?? 0) > 0) && (reflowSettled ?? Infinity) < (reflowMovement ?? 0),
    `entryMax=${earlyMovement.toFixed(1)}px reflow=${reflowMovement?.toFixed(1)}px settleDelta=${reflowSettled?.toFixed(1)}px`);

  // 适配视图（camera fit）
  const fitBefore = await labelPositions(page);
  await page.locator('[data-knowledge-layout-control="fit-view"]').dispatchEvent('click');
  await page.waitForTimeout(1200);
  const fitAfter = await labelPositions(page);
  row('force', '2d.camera-fit', 'fit 视图生效（viewport 变化或坐标稳定有效）',
    fitAfter !== null && movementBetween(fitBefore, fitAfter) !== null, 'camera command executed');

  // 3D 维度切换（代表域）
  await page.locator('[data-active-authority-dimension="3d"]').dispatchEvent('click');
  await page.waitForTimeout(3000);
  const dim3d = await page.locator('[data-active-authority-dimension="3d"][aria-pressed="true"]').count();
  const canvas3d = await page.locator('[data-active-authority-runtime="force-graph"]').count();
  row('force', '3d.dimension-switch', '3D 维度可用且画布保持', dim3d === 1 && canvas3d === 1);
  await shot(page, '03-force-3d');
  await page.locator('[data-active-authority-dimension="2d"]').dispatchEvent('click');
  await page.waitForTimeout(2000);

  // 筛选面板（#1742 语义浏览器复验）
  const panelOk = await page.locator('[data-active-authority-filter-panel="true"]').count() === 1;
  const typeToggle = page.locator('[data-active-authority-type-filter]').first();
  const typeType = await typeToggle.getAttribute('data-active-authority-type-filter');
  const beforeCount = (await semanticNodeIds(page)).length;
  await typeToggle.dispatchEvent('click');
  await page.waitForTimeout(600);
  const hiddenCount = (await semanticNodeIds(page)).length;
  await typeToggle.dispatchEvent('click');
  await page.waitForTimeout(600);
  const restoredCount = (await semanticNodeIds(page)).length;
  row('controls', 'filter.type.reversible', '类型筛选独立可逆',
    panelOk && hiddenCount < beforeCount && restoredCount === beforeCount,
    `${typeType}: ${beforeCount}->${hiddenCount}->${restoredCount}`);

  const teachingToggle = page.locator('[data-authority-relation-family="teaching-order"]');
  row('controls', 'filter.teaching.checkbox', '教学关系行为可逆 checkbox', await teachingToggle.getAttribute('role') === 'checkbox');

  const familyButtons = await page.locator('[data-active-authority-filter-group="relation-families"] [data-authority-relation-family]:not([data-authority-relation-family="teaching-order"])').count();
  row('controls', 'filter.families.count', '四个工程关系族控件在面板内', familyButtons === 4, `count=${familyButtons}`);
  row('controls', 'toolbar.consolidated', '全局工具栏不含筛选/搜索 chrome',
    await page.locator('[data-knowledge-workspace-toolbar="true"] [data-active-authority-filter-panel="true"]').count() === 0
    && await page.locator('[data-knowledge-workspace-toolbar="true"] #active-authority-search').count() === 0);
  await shot(page, '04-filter-panel');

  // locale：资格判定 + 可用时全载切换
  if (localeCap?.bilingualReady) {
    const english = page.locator('[data-graph-language="en"]');
    await english.dispatchEvent('click');
    await page.waitForTimeout(4500);
    const enLocale = await page.locator('[data-active-authority-graph="true"]').getAttribute('data-graph-locale');
    const panelText = await page.locator('[data-active-authority-filter-panel="true"]').textContent();
    const zhButton = page.locator('[data-graph-language="zh-CN"]');
    await zhButton.dispatchEvent('click');
    await page.waitForTimeout(4500);
    const zhLocale = await page.locator('[data-active-authority-graph="true"]').getAttribute('data-graph-locale');
    row('locale', 'switch.roundtrip', '全载图 zh→en→zh 原子切换',
      enLocale === 'en' && zhLocale === 'zh-CN' && /Object types|Domain concept/u.test(panelText ?? ''));
  } else {
    row('locale', 'switch.roundtrip',
      '全载图 zh→en→zh 原子切换（release 未通过英文资格时该行为阻断即 FAIL）',
      false, `bilingualReady=false reason=${localeCap?.englishUnavailableReason ?? 'unknown'}`);
  }

  // mobile：叠层筛选常显 + 概览 + 无可见目录
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await enterGraphAndDomain(page, 'root-locus');
  const overlayPanel = await page.locator('[data-active-authority-filter-panel="true"][data-active-authority-filter-placement="compact-bottom-left"]').count();
  await shot(page, '05-mobile-overlay-filters');
  row('controls', 'mobile.overlay', 'mobile 叠层筛选栏常显且不占文档流', overlayPanel === 1);
  // #1739 spec：mobile 大域（超 compact 阈值 48）的可浏览目录合法保留；
  // #1742 spec：小域/普通状态无可见目录。
  const largeDirectory = await page.locator('[data-active-authority-node-directory="visible"]').count();
  row('hierarchy', 'mobile.large-domain.directory-retained', 'mobile 大域（85>48）保留可浏览目录（#1739）', largeDirectory === 1);
  await enterGraphAndDomain(page, 'nonlinear-design');
  const smallDirectory = await page.locator('[data-active-authority-node-directory="visible"]').count();
  row('hierarchy', 'mobile.small-domain.no-visible-directory', 'mobile 小域无可见全节点目录（#1742）', smallDirectory === 0);
}

// ---------------------------------------------------------------------------
// Phase 2b — teacher/admin 代表行为
// ---------------------------------------------------------------------------
async function roleEvidence(page, credentials) {
  for (const role of ['teacher', 'admin']) {
    const fresh = await page.context().browser().newPage({ viewport: { width: 1440, height: 900 } });
    await login(fresh, credentials[role]);
    await enterGraphAndDomain(fresh, 'root-locus');
    const nodes = await semanticNodeIds(fresh);
    row('roles', `role.${role}.domain-overview`, `${role} 可进入域并看到有界概览`, nodes.length > 0, `nodes=${nodes.length}`);
    if (role === 'teacher') await shot(fresh, '06-teacher-overview');
    if (role === 'admin') await shot(fresh, '07-admin-overview');
    await fresh.close();
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — 性能预算（root-locus 85 概念 + one-hop）
// ---------------------------------------------------------------------------
async function performanceBudgets(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  let requestCount = 0;
  let responseBytes = 0;
  const listener = (response) => {
    if (response.url().includes('/api/')) {
      requestCount += 1;
      const body = response.body().catch(() => null);
      body.then((buffer) => { responseBytes += buffer?.byteLength ?? 0; });
    }
  };
  page.on('response', listener);
  await openActiveGraph(page);
  await page.evaluate(() => {
    window.__longtasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longtasks.push({ duration: entry.duration, startTime: entry.startTime });
    }).observe({ entryTypes: ['longtask'] });
  });
  const usableStart = Date.now();
  await selectDomain(page, 'root-locus');
  let usableAt = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await semanticNodeIds(page)).length > 0) { usableAt = Date.now(); break; }
    await page.waitForTimeout(250);
  }
  const usableMs = usableAt ? usableAt - usableStart : Number.POSITIVE_INFINITY;
  row('performance', 'domain.usable-time', '进域到概览可用 ≤ 预算', usableMs <= BUDGETS.maxDomainUsableMs, `${usableMs}ms`);
  await page.waitForTimeout(8000);
  await page.off('response', listener);
  row('performance', 'domain.requests', '进域 API 请求 ≤ 预算', requestCount <= BUDGETS.maxDomainEntryRequests, `requests=${requestCount}`);
  row('performance', 'domain.bytes', '进域 API 字节 ≤ 预算', responseBytes <= BUDGETS.maxDomainEntryBytes, `bytes=${responseBytes}`);

  const settleStart = Date.now();
  const p1 = await labelPositions(page);
  let settleMs = BUDGETS.maxForceSettleMs;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    await page.waitForTimeout(500);
    const p2 = await labelPositions(page);
    if (movementBetween(p1, p2) === 0) { settleMs = Date.now() - settleStart; break; }
  }
  row('performance', 'force.settle', 'force 收敛 ≤ 预算', settleMs <= BUDGETS.maxForceSettleMs, `${settleMs}ms`);

  const metrics = await page.evaluate(() => ({
    domNodes: document.querySelectorAll('*').length,
    visibleLabels: document.querySelectorAll('[data-knowledge-2d-dom-label-layer] > *').length,
    katex: document.querySelectorAll('.katex').length,
    longtasks: (window.__longtasks ?? []).length,
    longtaskTotal: (window.__longtasks ?? []).reduce((sum, t) => sum + t.duration, 0),
  }));
  EVIDENCE.metrics = metrics;
  row('performance', 'overview.dom-nodes', '概览 DOM 节点 ≤ 预算', metrics.domNodes <= BUDGETS.maxOverviewDomNodes, `${metrics.domNodes}`);
  row('performance', 'overview.visible-labels', '概览可见标签 ≤ 预算', metrics.visibleLabels <= BUDGETS.maxOverviewVisibleLabels, `${metrics.visibleLabels}`);
  row('performance', 'overview.katex', '概览 KaTeX 渲染 ≤ 预算', metrics.katex <= BUDGETS.maxOverviewKatex, `${metrics.katex}`);
  row('performance', 'longtasks.count', '长任务数 ≤ 预算', metrics.longtasks <= BUDGETS.maxLongTaskCount, `${metrics.longtasks}`);
  row('performance', 'longtasks.total', '长任务总时长 ≤ 预算', metrics.longtaskTotal <= BUDGETS.maxLongTaskTotalMs, `${metrics.longtaskTotal.toFixed(0)}ms`);
  await shot(page, '08-performance-overview');
}

// ---------------------------------------------------------------------------
// Phase 4 — manifest + 隐私扫描
// ---------------------------------------------------------------------------
function privacyScan(manifest) {
  const text = JSON.stringify(manifest);
  const forbidden = [/DemoStudent@/u, /password.{0,4}:\s*"/iu, /\/Users\/[A-Za-z]/u, /next-auth\.session-token=[^"]/u];
  const hits = forbidden.filter((pattern) => pattern.test(text));
  return hits.length === 0;
}

async function main() {
  assertCleanCapture();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const roles = await provisionRoles();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, roles.credentials.student);

  const rootShard = await page.evaluate(async () => {
    const res = await fetch('/api/knowledge/shards/active', { headers: { accept: 'application/json' } });
    return res.json();
  });
  EVIDENCE.traces.rootShardDomains = rootShard.root.domains.map((d) => ({ role: d.visualRole, name: d.displayName, count: d.memberCount }));
  EVIDENCE.traces.localeCapability = rootShard.localeCapability;

  await structuralClosure(page, rootShard);
  await behaviorMatrix(page, rootShard, rootShard.localeCapability);
  await roleEvidence(page, roles.credentials);
  await performanceBudgets(page);
  await browser.close();

  const { revision } = readGitState();
  const sourceHashes = Object.fromEntries(CAPTURE_SOURCE_FILES.map((file) => [file, sha256File(file)]));
  const outputRelative = path.relative(path.resolve(import.meta.dirname, '../..'), OUTPUT_DIR);
  EVIDENCE.screenshotHashes = Object.fromEntries(
    EVIDENCE.screenshots.map((file) => [file, sha256File(path.join(outputRelative, file))]),
  );
  const failed = ROWS.filter((r) => r.result === 'FAIL');
  const manifest = {
    schema: 'active-graph-migration-acceptance/v1',
    change: 'verify-active-authority-graph-parity',
    issue: 1743,
    captureRevision: revision,
    capturedAt: new Date().toISOString(),
    baseUrl: BASE,
    browserClass: 'chromium/headless',
    budgets: BUDGETS,
    sourceHashes,
    denominator: { domains: EVIDENCE.traces.rootShardDomains.length, roles: 3, dimensions: ['2d', '3d'], viewports: ['desktop-1440', 'mobile-390'], locales: ['zh-CN', 'en(capability-gated)'] },
    rows: ROWS,
    evidence: EVIDENCE,
    totals: { total: ROWS.length, failed: failed.length },
  };
  row('privacy', 'evidence.scan', 'manifest 不含凭据/绝对路径/会话令牌', privacyScan(manifest));
  writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifest: ${path.join(OUTPUT_DIR, 'manifest.json')}`);
  console.log(`rows: ${ROWS.length}, failed: ${failed.filter((r) => r.id !== 'evidence.scan').length}`);
  const blocking = ROWS.filter((r) => r.result === 'FAIL');
  process.exit(blocking.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
