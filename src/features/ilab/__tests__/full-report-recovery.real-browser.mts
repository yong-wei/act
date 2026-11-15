import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { chromium, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import type { CourseSessionRecoveryPayload } from '@/features/simulations/course-artifact-upload';

config({ path: '.env.local', quiet: true });
const origin = process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3001';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
assert(process.env.VESSEL_REPORT_RECOVERY_ID, 'Set VESSEL_REPORT_RECOVERY_ID to a completed local QA report');
const report = await prisma.virtualSimulationReport.findUniqueOrThrow({
  where: { id: process.env.VESSEL_REPORT_RECOVERY_ID }, include: { user: true },
});
assert(report.user.name?.includes('夹具'), 'Only an existing synthetic QA account may be used');
assert(report.clientRef && ['cruise', 'container', 'drilling'].includes(report.experimentKey));
const oldCredentials = { employeeNumber: report.user.employeeNumber, passwordHash: report.user.passwordHash };
const oldOrigins = new Set((await prisma.ilabExperimentRun.findMany({ where: { userId: report.userId }, select: { id: true } })).map((run) => run.id));
const employeeNumber = `QA-FULL-RECOVERY-${randomUUID()}`;
const password = randomBytes(24).toString('base64url');
const experimentKey = { cruise: 'cruise-comfort', container: 'container-voyage', drilling: 'drilling-dp' }[report.experimentKey]!;
const base = `account:${report.userId}:${experimentKey}:${report.experimentVersion}`;
const scopeKey = `${base}:round:${report.clientRef}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1801, height: 867 } });
await context.addInitScript(({ key, value }) => { localStorage.setItem(key, value); },
  { key: `act-vessel-course-round:${base}`, value: scopeKey });
const page = await context.newPage();
page.setDefaultTimeout(60000);
let chunks = 0;
const loadedRunIds = new Set<string>();
let recovery: CourseSessionRecoveryPayload | null = null;
let recoveryBytes = 0;
page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/ilab/experiment-runs/') && url.searchParams.has('chunkIndex')) {
    chunks++; loadedRunIds.add(url.pathname.split('/').at(-1)!);
  }
});

async function waitForSavedReport() {
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const saved = await page.evaluate(async (scope) => {
      if (!(await indexedDB.databases()).some((db) => db.name === 'act-vessel-experiment-v2')) return false;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('act-vessel-experiment-v2');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const draft = await new Promise<{ reportClientRef?: string } | undefined>((resolve, reject) => {
        const request = db.transaction('drafts').objectStore('drafts').get(scope);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      db.close(); return Boolean(draft?.reportClientRef);
    }, scopeKey);
    if (saved) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Full report recovery did not finish within the local QA timeout');
}

try {
  await prisma.user.update({ where: { id: report.userId }, data: { employeeNumber, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(JSON.stringify({ phase: 'full-report-recovery', course: report.experimentKey }));
  const recoveryResponse = page.waitForResponse((response) => response.ok()
    && new URL(response.url()).pathname === '/api/ilab/course-session-recovery'
    && new URL(response.url()).searchParams.get('reportClientRef') === report.clientRef).then((response) => response.url());
  await page.goto(`${origin}/login?callbackUrl=${encodeURIComponent(`/simulations/${report.experimentKey}?graphics=webgl`)}`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('学号/工号').fill(employeeNumber);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/simulations/${report.experimentKey}`, { waitUntil: 'domcontentloaded' });
  const responseText = await (await context.request.get(await recoveryResponse)).text();
  recoveryBytes = Buffer.byteLength(responseText);
  recovery = (JSON.parse(responseText) as { recovery: CourseSessionRecoveryPayload }).recovery;
  console.log(JSON.stringify({ phase: 'recovery-headers', bytes: recoveryBytes, runs: recovery.runs.length }));
  await waitForSavedReport();
  const payload = recovery as CourseSessionRecoveryPayload | null;
  assert(payload && (payload.archivedRuns?.length ?? 0) >= 20);
  assert.equal(payload.runs.length, 0, 'Completed histories must restore summaries without sampling');
  assert(recoveryBytes < 8 * 1024 * 1024);
  assert.equal(chunks, 0, 'Entering a completed report must not download historical runs');
  await page.getByRole('tab', { name: '评估', exact: true }).click();
  await page.getByLabel('本机实验轮次', { exact: true }).waitFor();
  const selector = page.getByLabel(report.experimentKey === 'drilling' ? '三通道独立验证运行' : '分析运行记录', { exact: true });
  await expect(selector).toBeVisible({ timeout: 60000 });
  await expect.poll(() => selector.locator('option').count(), { timeout: 60000 }).toBeGreaterThan(20);
  assert.equal(chunks, 0, 'Opening the existing workbench must not prefetch archive curves');
  const available = await selector.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  const representative = payload.archivedRuns!.filter((run) => available.includes(run.id) && run.sampleCount >= 20)
    .sort((left, right) => left.sampleCount - right.sampleCount)[0];
  assert(representative, 'The original workbench must list archived runs');
  await selector.selectOption(representative.id);
  const header = await (await context.request.get(`${origin}/api/ilab/experiment-runs/${representative.id}?recovery=1`)).json();
  await expect.poll(async () => page.evaluate(async (runId) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('act-vessel-experiment-v2'); request.onsuccess = () => resolve(request.result); });
    const row = await new Promise<{ traceLength: number } | undefined>((resolve) => {
      const request = db.transaction('runs').objectStore('runs').get(runId); request.onsuccess = () => resolve(request.result);
    });
    db.close(); return row?.traceLength ?? 0;
  }, representative.id), { timeout: 120000 }).toBe(header.traceManifest.controlCount);
  const stored = await page.evaluate(async (runId) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('act-vessel-experiment-v2'); request.onsuccess = () => resolve(request.result); });
    const row = await new Promise<{ checkpoint: string; nativeSampleCount: number; fineSampleCount: number }>((resolve) => {
      const request = db.transaction('runs').objectStore('runs').get(runId); request.onsuccess = () => resolve(request.result);
    });
    const count = await new Promise<number>((resolve) => { const request = db.transaction('runs').objectStore('runs').count(); request.onsuccess = () => resolve(request.result); });
    db.close(); return { ...row, count };
  }, representative.id);
  assert.equal(stored.count, 1);
  assert.equal(stored.checkpoint, header.checkpoint);
  if (report.experimentKey === 'drilling') assert.equal(header.configuration.waveTableProfile, undefined);
  assert.equal(stored.nativeSampleCount, header.traceManifest.nativeCount);
  assert.equal(stored.fineSampleCount ?? 0, header.traceManifest.fineCount ?? 0);
  assert.deepEqual([...loadedRunIds], [representative.id]);
  const selectedChunks = chunks;
  chunks = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: '评估', exact: true }).click();
  await expect(page.getByLabel('本机实验轮次', { exact: true })).toBeEnabled({ timeout: 60000 });
  assert.equal(chunks, 0, 'A cached representative run must not be downloaded again');
  console.log(JSON.stringify({ status: 'passed', course: report.experimentKey, archivedRuns: payload.archivedRuns!.length,
    recoveryHeaderBytes: recoveryBytes, initialChunkRequests: 0, selectedRuns: stored.count,
    selectedRunChunkRequests: selectedChunks, hotChunkRequests: chunks, checkpointExact: true }));
} catch (error) {
  console.log(JSON.stringify({ phase: 'full-report-recovery-failed', course: report.experimentKey,
    chunks, recoveryHeaderBytes: recoveryBytes, message: (await page.locator('body').innerText()).slice(-1800) }));
  throw error;
} finally {
  await context.close(); await browser.close();
  await prisma.user.update({ where: { id: report.userId }, data: oldCredentials });
  const added = (await prisma.ilabExperimentRun.findMany({ where: { userId: report.userId }, select: { id: true } }))
    .filter((run) => !oldOrigins.has(run.id)).map((run) => run.id);
  await prisma.ilabExperimentRun.deleteMany({ where: { id: { in: added } } });
  await prisma.$disconnect();
}
