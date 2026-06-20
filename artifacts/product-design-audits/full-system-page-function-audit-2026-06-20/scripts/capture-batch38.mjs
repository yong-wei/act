import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createPrismaClient } from '../../../../scripts/lib/prisma-client.mjs';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:3100';
const root = path.resolve('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20');
const screenshotDir = path.join(root, 'screenshots/73-function-state-flows-batch38');
const manifestPath = path.join(root, 'screenshots/function-state-flows-batch38-manifest.json');
const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 844 };

const accounts = {
  student: { account: 'demo', password: 'DemoStudent@Just2026!' },
  teacher: { account: '201300000012', password: 'zyw1983@Just' },
};

const results = [];
const routeResponses = [];
const apiChecks = [];
const optionalActions = [];
const nativeDialogs = [];
const cleanup = [];
const errors = [];
const ignoredErrors = [];
let browser = null;
let fixtures = {
  publicPlaylistId: '',
  publicPlaylistTitle: '',
  selectedNodeId: '',
  selectedNodeName: '',
  auditPlaylistTitle: '',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordError(action, error, url = '') {
  errors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

function recordIgnoredError(action, error, url = '') {
  ignoredErrors.push({ action, message: error instanceof Error ? error.message : String(error), url });
}

async function resolveFixtures() {
  const prisma = createPrismaClient();
  try {
    const [plan, graph] = await Promise.all([
      prisma.lessonPlan.findFirst({
        where: { isPublic: true },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { items: true } } },
      }),
      fetch(`${baseUrl}/api/knowledge/graph`).then((response) => response.json()).catch(() => null),
    ]);
    const node = graph?.nodes?.find?.((item) => item?.id && item?.name) ?? null;
    fixtures = {
      publicPlaylistId: plan?.id ?? '',
      publicPlaylistTitle: plan?.title ?? '',
      publicPlaylistItemCount: plan?._count?.items ?? 0,
      selectedNodeId: node?.id ?? '',
      selectedNodeName: node?.name ?? '',
      auditPlaylistTitle: `PD Batch38 审计课程流 ${Date.now()}`,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupAuditPlaylist() {
  if (!fixtures.auditPlaylistTitle) return;
  const prisma = createPrismaClient();
  try {
    const deleted = await prisma.lessonPlan.deleteMany({
      where: { title: fixtures.auditPlaylistTitle },
    });
    cleanup.push({ action: 'delete audit-created public playlist', title: fixtures.auditPlaylistTitle, count: deleted.count });
  } catch (error) {
    recordIgnoredError('cleanup audit playlist', error, fixtures.auditPlaylistTitle);
  } finally {
    await prisma.$disconnect();
  }
}

async function login(page, role) {
  const account = accounts[role];
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  await page.locator('input[name="account"], input[type="text"], input').first().fill(account.account);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.password);
  await page.locator('input[name="password"], input[type="password"]').first().press('Enter');
  await sleep(2400);
}

async function gotoStable(page, route, waitMs = 2800) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch((error) => {
    recordError(`goto ${route}`, error, page.url());
    return null;
  });
  await sleep(waitMs);
  routeResponses.push({
    route,
    status: response?.status?.() ?? null,
    requestedUrl: `${baseUrl}${route}`,
    finalUrl: page.url(),
    responseUrl: response?.url?.() ?? '',
  });
  return response;
}

function summarizeJson(body) {
  if (Array.isArray(body)) {
    return {
      type: 'array',
      count: body.length,
      sample: body.slice(0, 3).map((item) => ({
        id: item?.id,
        name: item?.name,
        title: item?.title,
        nodeType: item?.nodeType,
        itemCount: item?._count?.items,
      })),
    };
  }
  if (!body || typeof body !== 'object') return { type: typeof body };
  return {
    keys: Object.keys(body).slice(0, 24),
    nodeCount: body.nodes?.length,
    linkCount: body.links?.length,
    source: body.source,
    sampleText: JSON.stringify(body).slice(0, 1400),
  };
}

async function apiCheck(page, route, label) {
  const response = await page.request.get(`${baseUrl}${route}`).catch((error) => {
    recordError(`api ${label}`, error, route);
    return null;
  });
  if (!response) return null;
  const contentType = response.headers()['content-type'] || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json().catch((error) => {
      recordIgnoredError(`api json parse ${label}`, error, route);
      return null;
    });
  } else {
    body = await response.text().catch(() => '');
  }
  const entry = {
    label,
    route,
    status: response.status(),
    ok: response.ok(),
    contentType,
    summary: typeof body === 'string' ? { sampleText: body.slice(0, 1000) } : summarizeJson(body),
  };
  apiChecks.push(entry);
  return body;
}

async function domAudit(page) {
  return await page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el) => (
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.getAttribute?.('alt') ||
      text(el) ||
      ''
    ).trim();
    const visible = (el) => !(
      el.hidden ||
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    );
    const active = document.activeElement;
    const controls = [...document.querySelectorAll('button, [role="button"], a[href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: name(el),
      type: el.getAttribute('type') || '',
      href: el.getAttribute('href') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      hidden: !visible(el),
    }));
    const alerts = [...document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')]
      .map((el) => ({ role: el.getAttribute('role') || '', live: el.getAttribute('aria-live') || '', text: text(el) }))
      .filter((item) => item.text);
    const graphics = [...document.querySelectorAll('svg, canvas')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      name: name(el),
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
    }));
    const bodyText = text(document.body).slice(0, 18000);
    return {
      title: document.title,
      url: location.href,
      h1: [...document.querySelectorAll('h1')].map(text).filter(Boolean).slice(0, 10),
      h2: [...document.querySelectorAll('h2, h3')].map(text).filter(Boolean).slice(0, 40),
      activeElement: {
        tag: active?.tagName?.toLowerCase() || '',
        type: active?.getAttribute?.('type') || '',
        role: active?.getAttribute?.('role') || '',
        name: name(active),
      },
      controls,
      alerts,
      unnamedControls: controls.filter((item) => !item.hidden && !item.name && ['button', 'a'].includes(item.tag)).length,
      graphicsCount: graphics.length,
      unnamedGraphics: graphics.filter((item) => !item.name && item.ariaHidden !== 'true').length,
      bodyText,
    };
  });
}

async function focusTrail(page, count = 10) {
  const trail = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab').catch((error) => recordIgnoredError('tab focus', error, page.url()));
    await sleep(90);
    const item = await page.evaluate(() => {
      const el = document.activeElement;
      const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        tag: el?.tagName?.toLowerCase() || '',
        type: el?.getAttribute?.('type') || '',
        role: el?.getAttribute?.('role') || '',
        name: el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || text(el) || el?.getAttribute?.('placeholder') || '',
        href: el?.getAttribute?.('href') || '',
      };
    });
    trail.push({ index: index + 1, ...item });
  }
  return trail;
}

function summarizeAudit(audit) {
  const body = audit.bodyText;
  return {
    h1: audit.h1,
    h2: audit.h2,
    url: audit.url,
    activeElement: audit.activeElement,
    firstControls: audit.controls.filter((item) => !item.hidden && !item.disabled).slice(0, 36),
    alerts: audit.alerts,
    unnamedControls: audit.unnamedControls,
    graphicsCount: audit.graphicsCount,
    unnamedGraphics: audit.unnamedGraphics,
    hits: {
      knowledgeGraph: /知识图谱|知识资源|知识关系|关系筛选|关系图例/.test(body),
      graphSearch: /关键词搜索|知识图谱搜索|搜索词已启用/.test(body),
      selectedNode: /当前知识图谱选中节点|相关资源|学习目标|资源/.test(body),
      playlists: /课程播放列表|创建新课程流|开始上课/.test(body),
      playlistBuilder: /知识库|课程编排|保存课程流|从左侧添加知识点开始编排/.test(body),
      playlistItem: /讲授|测验|讨论|分钟/.test(body),
      adminRedirect: /admin\/lesson-plans|教案|Lesson/.test(body),
      nativeDialog: nativeDialogs.length > 0,
      liveRegion: audit.alerts.length > 0,
    },
  };
}

async function capture(page, fileName, label, notes = {}) {
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = await fs.stat(filePath);
  const audit = await domAudit(page);
  const a11yPath = filePath.replace(/\.png$/, '.a11y.json');
  await fs.writeFile(a11yPath, JSON.stringify({ accessibilitySnapshotUnavailable: true, audit }, null, 2));
  const url = audit.url.startsWith('http') ? new URL(audit.url) : null;
  results.push({
    step: results.length + 1,
    label,
    route: url ? url.pathname + url.search : audit.url,
    screenshot: path.relative(root, filePath),
    screenshotBytes: stat.size,
    a11y: path.relative(root, a11yPath),
    notes,
    auditSummary: summarizeAudit(audit),
  });
}

async function clickRole(page, role, name, actionLabel, waitMs = 1200) {
  const locator = page.getByRole(role, { name }).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', url: page.url() });
  await sleep(waitMs);
  return true;
}

async function clickFirstVisibleButton(page, selector, actionLabel, waitMs = 1200) {
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    optionalActions.push({ action: actionLabel, status: 'not-found', selector, url: page.url() });
    return false;
  }
  await locator.click().catch((error) => recordIgnoredError(actionLabel, error, page.url()));
  optionalActions.push({ action: actionLabel, status: 'attempted', selector, url: page.url() });
  await sleep(waitMs);
  return true;
}

async function newPage(role, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', async (dialog) => {
    nativeDialogs.push({ type: dialog.type(), message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
  page.on('pageerror', (error) => recordError('pageerror', error, page.url()));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    recordIgnoredError('requestfailed', failure?.errorText || 'unknown', request.url());
  });
  await login(page, role);
  return { context, page };
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  await resolveFixtures();
  browser = await chromium.launch({ headless: true });

  const studentSession = await newPage('student', desktop);
  const studentPage = studentSession.page;
  await apiCheck(studentPage, '/api/auth/session', 'student auth session for batch38');
  await apiCheck(studentPage, '/api/knowledge/graph', 'knowledge graph data');
  await apiCheck(studentPage, '/api/knowledge/nodes', 'knowledge nodes');
  await apiCheck(studentPage, '/api/knowledge/playlists', 'public knowledge playlists');

  await gotoStable(studentPage, '/knowledge');
  await capture(studentPage, '01-student-knowledge-desktop-default.png', 'student knowledge graph desktop default', {
    expected: 'Knowledge graph should expose a usable map, search/filter tools, relationship counts, and graph canvas affordances.',
    focusTrail: await focusTrail(studentPage, 12),
    fixtures,
  });

  await clickRole(studentPage, 'button', '筛选', 'open desktop knowledge relation filters', 1200);
  await studentPage.getByLabel(/关键词搜索|知识图谱搜索/).first().fill('PID').catch((error) => recordIgnoredError('knowledge search PID', error, studentPage.url()));
  await sleep(1400);
  await capture(studentPage, '02-student-knowledge-search-filter.png', 'student knowledge graph search filter', {
    expected: 'Search should visibly narrow the graph and keep the active filter summary discoverable.',
  });

  if (fixtures.selectedNodeId) {
    await gotoStable(studentPage, `/knowledge?node=${encodeURIComponent(fixtures.selectedNodeId)}`, 3200);
  }
  await capture(studentPage, '03-student-knowledge-selected-node-url.png', 'student knowledge graph selected node via URL', {
    expected: 'Direct node links should select the node and reveal the node detail/resource/action panel.',
    selectedNode: { id: fixtures.selectedNodeId, name: fixtures.selectedNodeName },
  });

  await clickRole(studentPage, 'button', '布局', 'open desktop knowledge layout tool', 1000);
  await capture(studentPage, '04-student-knowledge-layout-tool.png', 'student knowledge graph layout tool', {
    expected: 'Layout controls should make 2D/3D, reset, pin, and focus behavior understandable without obscuring the graph.',
  });
  await studentSession.context.close();

  const playlistSession = await newPage('student', desktop);
  const playlistPage = playlistSession.page;
  await gotoStable(playlistPage, '/playlists');
  await capture(playlistPage, '05-student-playlists-list.png', 'student playlists list', {
    expected: 'Playlist list should show public lesson plans, authors, item counts, and a clear start-class action.',
    publicPlaylist: { id: fixtures.publicPlaylistId, title: fixtures.publicPlaylistTitle, itemCount: fixtures.publicPlaylistItemCount },
    focusTrail: await focusTrail(playlistPage, 10),
  });

  if (fixtures.publicPlaylistId) {
    await gotoStable(playlistPage, `/playlists/${fixtures.publicPlaylistId}/play`, 2800);
  }
  await capture(playlistPage, '06-student-playlist-play-redirect.png', 'student playlist play redirect', {
    expected: 'Starting a public playlist should open the classroom/player flow for that playlist, not a generic admin route.',
    publicPlaylist: { id: fixtures.publicPlaylistId, title: fixtures.publicPlaylistTitle },
  });

  await gotoStable(playlistPage, '/playlists/new');
  await capture(playlistPage, '07-student-playlist-builder-empty.png', 'student playlist builder empty', {
    expected: 'New playlist builder should show knowledge library, empty course composition, title/description fields, and save command.',
  });

  await clickRole(playlistPage, 'button', '保存课程流', 'save empty-title playlist', 800);
  await capture(playlistPage, '08-student-playlist-builder-empty-title-alert.png', 'student playlist builder empty title alert', {
    expected: 'Save without title should show an in-product validation message tied to the title field.',
    nativeDialogs: nativeDialogs.slice(),
  });

  await playlistPage.getByLabel('搜索知识点...').fill('PID').catch((error) => recordIgnoredError('playlist builder search PID', error, playlistPage.url()));
  await sleep(1200);
  await capture(playlistPage, '09-student-playlist-builder-search.png', 'student playlist builder search knowledge nodes', {
    expected: 'Knowledge node search should filter the left library while preserving the empty composition target.',
  });

  await clickFirstVisibleButton(playlistPage, 'div:has-text("PID") button, div:has-text("控制") button, [class*="bg-slate-800"] button', 'add first knowledge node to playlist', 1200);
  await capture(playlistPage, '10-student-playlist-builder-item-added.png', 'student playlist builder item added', {
    expected: 'Adding a node should create an ordered timeline item with mode, duration, move, and remove controls.',
  });

  await playlistPage.getByLabel('课程标题').fill(fixtures.auditPlaylistTitle);
  await playlistPage.getByLabel('课程描述').fill('Product Design Batch38 自动审计临时课程流，用于验证保存后的列表与数据关系。');
  await clickRole(playlistPage, 'button', '保存课程流', 'save populated playlist', 2600);
  await capture(playlistPage, '11-student-playlist-builder-after-save.png', 'student playlist builder after save redirect', {
    expected: 'Successful save should preserve added knowledge nodes or clearly explain why only metadata is saved.',
    createdTitle: fixtures.auditPlaylistTitle,
  });
  await playlistSession.context.close();

  const mobileKnowledgeSession = await newPage('student', mobile);
  const mobileKnowledgePage = mobileKnowledgeSession.page;
  await gotoStable(mobileKnowledgePage, '/knowledge');
  await capture(mobileKnowledgePage, '12-student-knowledge-mobile-default.png', 'student knowledge graph mobile default', {
    expected: 'Mobile knowledge graph should keep map, drawer tools, and selected-node actions reachable in the narrow viewport.',
    focusTrail: await focusTrail(mobileKnowledgePage, 10),
  });
  await clickRole(mobileKnowledgePage, 'button', '筛选', 'mobile knowledge open filter drawer', 1000);
  await capture(mobileKnowledgePage, '13-student-knowledge-mobile-filter-drawer.png', 'student knowledge graph mobile filter drawer', {
    expected: 'Mobile filter drawer should expose search, relation density, category, bloom, and reset actions without hiding the map state.',
  });
  await mobileKnowledgeSession.context.close();

  const mobilePlaylistSession = await newPage('student', mobile);
  const mobilePlaylistPage = mobilePlaylistSession.page;
  await gotoStable(mobilePlaylistPage, '/playlists/new');
  await capture(mobilePlaylistPage, '14-student-playlist-builder-mobile-empty.png', 'student playlist builder mobile empty', {
    expected: 'Mobile playlist builder should make both knowledge library and course composition reachable without vertical trap or overlapped save action.',
    focusTrail: await focusTrail(mobilePlaylistPage, 10),
  });
  await mobilePlaylistSession.context.close();

  const teacherSession = await newPage('teacher', desktop);
  const teacherPage = teacherSession.page;
  await gotoStable(teacherPage, '/knowledge');
  await capture(teacherPage, '15-teacher-knowledge-desktop-default.png', 'teacher knowledge graph desktop default', {
    expected: 'Teacher knowledge graph should match the product shell while supporting instruction planning and resource inspection.',
  });
  await teacherSession.context.close();

  await cleanupAuditPlaylist();

  const pngFiles = (await fs.readdir(screenshotDir)).filter((file) => file.endsWith('.png')).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    batch: 'function-state-flows-batch38',
    scope: 'Knowledge graph desktop/mobile search, selection, filter and layout tools; playlist list, new playlist builder validation/search/add/save, play redirect, and mobile builder state',
    fixtures,
    routeResponses,
    results,
    apiChecks,
    optionalActions,
    nativeDialogs,
    cleanup,
    errors,
    ignoredErrors,
    screenshotDir,
    pngFiles,
    summary: {
      resultCount: results.length,
      apiCheckCount: apiChecks.length,
      nativeDialogCount: nativeDialogs.length,
      cleanupCount: cleanup.length,
      errorCount: errors.length,
      ignoredErrorCount: ignoredErrors.length,
      pngCount: pngFiles.length,
    },
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    manifestPath,
    screenshotDir,
    results: results.length,
    apiChecks: apiChecks.length,
    nativeDialogs: nativeDialogs.length,
    cleanup: cleanup.length,
    errors: errors.length,
    ignoredErrors: ignoredErrors.length,
    pngCount: pngFiles.length,
  }, null, 2));
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
  });
