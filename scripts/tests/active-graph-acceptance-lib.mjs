#!/usr/bin/env node
// #1743 verify-active-authority-graph-parity：第三次新版图谱迁移的封闭验收 capture。
// 产出 exact-revision manifest（分母全行 + 结果 + hash 绑定 + 性能预算判定）。
// 任一阻断行 FAIL 即非零退出；本脚本不实现产品行为、不允许豁免。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const BASE = process.env.ACT_ACCEPTANCE_BASE_URL ?? 'http://localhost:3002';
const OUTPUT_DIR = path.join(
  repoRoot,
  process.env.ACT_ACCEPTANCE_OUTPUT_DIR ?? 'artifacts/active-graph-migration-acceptance-v037',
);

// 阻断性能预算（宽松产品预算，机器类随 manifest 记录）。
const BUDGETS = {
  maxDomainEntryRequests: 14,
  maxDomainEntryBytes: 3 * 1024 * 1024,
  maxDomainUsableMs: 9000,
  maxLongTaskCount: 24,
  maxLongTaskTotalMs: 4000,
  maxForceSettleMs: 16000,
  maxOverviewDomNodes: 5000,
  maxOverviewVisibleLabels: 140,
  maxOverviewKatex: 8,
  maxOneHopKatex: 24,
};

// hash 绑定的活动图谱源面：这些文件任何变化都会使证据失效（需重跑 capture）。
const CAPTURE_SOURCE_FILES = [
  'src/features/knowledge/active-authority-graph.tsx',
  'src/features/knowledge/active-authority-graph-i18n.ts',
  'src/features/knowledge/active-authority-runtime-view.tsx',
  'src/features/knowledge/active-authority-filter-panel.tsx',
  'src/features/knowledge/active-authority-presentation.ts',
  'src/features/knowledge/active-authority-shard-store.ts',
  'src/features/knowledge/authority-graph-view-model.ts',
  'src/features/knowledge/knowledge-graph-workspace.tsx',
  'src/features/knowledge/graph/knowledge-graph-runtime-canvas.tsx',
  'src/features/knowledge/graph/use-knowledge-graph-runtime-layout.ts',
  'src/features/knowledge/graph/layout-state.ts',
  'src/features/knowledge/graph/force-lifecycle.ts',
  'src/features/knowledge/graph/label-policy.ts',
  'src/lib/authority-locale-readiness/graph-interface-catalog.ts',
  'src/lib/authority-domain-shards/teaching.ts',
  'src/app/api/knowledge/shards/active/route.ts',
];

const ROWS = [];
const EVIDENCE = { screenshots: [], traces: {}, metrics: {} };
let captureRevision = null;

function row(category, id, expectation, pass, detail = '') {
  ROWS.push({
    category, id, expectation,
    result: pass ? 'PASS' : 'FAIL',
    detail: detail.slice(0, 400),
    captureRevision,
  });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${category}] ${id}${detail ? ` — ${detail.slice(0, 120)}` : ''}`);
  return pass;
}

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function readGitState() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim();
  const porcelain = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot }).toString().trim();
  // 验收有效性的强绑定是 HEAD revision + CAPTURE_SOURCE_FILES hash；干净树
  // 判定排除本地运行态与工件目录（.wolf/ 由 OpenWolf hook 自动写回并 stage，
  // artifacts/ 为证据/报告目录），与既有 capture 的 allowedDirtyPrefixes 同例。
  const outputDirRelative = path.relative(repoRoot, OUTPUT_DIR);
  const dirty = porcelain
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      const rel = line.slice(3).trim();
      if (rel === outputDirRelative || rel.startsWith(`${outputDirRelative}/`)) return false;
      if (rel === '.wolf' || rel.startsWith('.wolf/')) return false;
      if (rel === 'artifacts' || rel.startsWith('artifacts/')) return false;
      return true;
    });
  return { revision, dirty };
}

function assertCleanCapture() {
  const { revision, dirty } = readGitState();
  if (dirty.length > 0) {
    throw new Error(`acceptance capture requires a clean Git worktree; commit or remove:\n${dirty.join('\n')}`);
  }
  captureRevision = revision;
}

async function provisionRoles() {
  const { provisionLocalKnowledgeWorkspaceQaAccounts } = await import('./knowledge-workspace-product-qa-accounts.mjs');
  const { accountByKey } = await import('../db/verified-test-accounts.mjs');
  const managed = await provisionLocalKnowledgeWorkspaceQaAccounts(BASE);
  return {
    managed: Boolean(managed),
    credentials: Object.fromEntries(
      ['student', 'teacher', 'admin'].map((role) => {
        const account = accountByKey(role);
        return [role, { account: account.loginId, password: account.password }];
      }),
    ),
  };
}

async function login(page, { account, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[name="account"]').fill(account);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/profile|cockpit|dashboard|teacher|admin/, { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function enterGraphAndDomain(page, visualRole) {
  await page.goto(`${BASE}/knowledge`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-active-authority-graph="true"]', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const entries = await page.locator('[data-authority-domain-entry]').all();
  if (visualRole) {
    const entry = page.locator(`[data-authority-domain-entry="${visualRole}"]`);
    await entry.waitFor({ state: 'visible', timeout: 15000 });
    await entry.dispatchEvent('click');
    await page.waitForTimeout(3500);
  }
  return entries.length;
}

async function labelPositions(page) {
  return page.evaluate(() => {
    const layer = document.querySelector('[data-knowledge-2d-dom-label-layer]');
    if (!layer) return null;
    return [...layer.children].map((el) => {
      const style = el.getAttribute('style') ?? '';
      const left = Number.parseFloat((style.match(/left:\s*([\d.]+)px/) ?? [])[1] ?? '0');
      const top = Number.parseFloat((style.match(/top:\s*([\d.]+)px/) ?? [])[1] ?? '0');
      return { left, top };
    });
  });
}

function movementBetween(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return null;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) {
    total += Math.abs(a[index].left - b[index].left) + Math.abs(a[index].top - b[index].top);
  }
  return total;
}

function semanticNodeIds(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-active-authority-semantic-nodes] [data-active-authority-node]')]
    .map((el) => el.getAttribute('data-active-authority-node')));
}

// ---------------------------------------------------------------------------
// Phase 1 — 结构闭合（student API 级，封闭 15 域分母）
// ---------------------------------------------------------------------------
async function structuralClosure(page, rootShard) {
  const domains = rootShard.root.domains;
  row('denominator', 'root.domains.count', 'root shard 恰好 15 个领域入口', domains.length === 15, `count=${domains.length}`);
  row('denominator', 'root.aggregate', 'root shard 含综合入口', rootShard.root.aggregate?.visualRole === 'aggregate');
  const localeCap = rootShard.localeCapability;
  row('locale', 'release.capability', '记录 release locale 资格（英文验收行按资格判定）', true,
    JSON.stringify(localeCap).slice(0, 200));

  for (const domain of domains) {
    const role = domain.visualRole;
    // default shard：有界同构概念列表，不返回异构完整域
    const def = await page.evaluate(async (r) => {
      const res = await fetch(`/api/knowledge/shards/active/domains/${r}`, { headers: { accept: 'application/json' } });
      return { status: res.status, body: await res.json() };
    }, role);
    const typeSet = new Set((def.body?.objects ?? []).map((o) => o.canonicalType));
    row('structure', `domain.${role}.default.bounded`,
      'default shard 200 且对象全部为 DomainConcept（无二级类型混入）',
      def.status === 200 && typeSet.size === 1 && typeSet.has('DomainConcept'),
      `objects=${def.body?.objects?.length ?? 0} types=${[...typeSet].join('|')}`);
    row('structure', `domain.${role}.default.coverage`,
      'default shard 携带 teachingCoverage', Boolean(def.body?.teachingCoverage));

    const first = def.body?.objects?.[0];
    if (!first) {
      row('structure', `domain.${role}.concept.path`, '至少一个概念可走闭合路径', false, 'no objects');
      continue;
    }

    // search：有界分页
    const needle = first.label.slice(0, 2);
    const search = await page.evaluate(async ({ r, q }) => {
      const res = await fetch(`/api/knowledge/shards/active/domains/${r}/search?q=${encodeURIComponent(q)}&limit=12`, { headers: { accept: 'application/json' } });
      return { status: res.status, body: await res.json() };
    }, { r: role, q: needle });
    row('structure', `domain.${role}.search.bounded`,
      'search 200 且单页 ≤ 12', search.status === 200 && (search.body?.hits?.length ?? 99) <= 12,
      `hits=${search.body?.hits?.length} total=${search.body?.total}`);

    // detail 闭合
    const detail = await page.evaluate(async (id) => {
      const res = await fetch(`/api/knowledge/shards/active/nodes/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
      return { status: res.status, body: await res.json() };
    }, first.id);
    row('structure', `domain.${role}.detail.identity`,
      'detail 200 且返回同对象身份', detail.status === 200 && detail.body?.node?.id === first.id);

    // neighborhood 闭合
    const nb = await page.evaluate(async (id) => {
      const res = await fetch(`/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
      return { status: res.status, body: await res.json() };
    }, first.id);
    row('structure', `domain.${role}.neighborhood.bounded`,
      'neighborhood 200 且对象 ≤ 32', nb.status === 200 && (nb.body?.objects?.length ?? 99) <= 32,
      `objects=${nb.body?.objects?.length}`);
  }
}

export {
  BASE, OUTPUT_DIR, BUDGETS, CAPTURE_SOURCE_FILES, ROWS, EVIDENCE,
  row, sha256File, assertCleanCapture, provisionRoles, login,
  enterGraphAndDomain, labelPositions, movementBetween, semanticNodeIds,
  structuralClosure, readGitState,
};
