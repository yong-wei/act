// Replays the normal evidence, recovery and report APIs using private QA identities.
// Generate first-step native fixtures with generate-load-fixtures.mts before running.
import http from 'node:http';
import https from 'node:https';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { gzip, gunzipSync, brotliDecompressSync } from 'node:zlib';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { canonicalJson } from '../../src/lib/student-model-artifact-contract/index.ts';
import { createHash } from 'node:crypto';
import { prepareDirectLoadPacket, decodeDirectLoadObject } from './direct-evidence-load.mjs';

const option = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
mkdirSync('.logs', { recursive: true });
const origin = option('--origin', 'http://127.0.0.1:1892');
const identityFile = option('--identities', '.tmp/load-identities-local.json');
const count = Number(option('--concurrency', '7'));
const durationS = Number(option('--seconds', '300'));
const timeScale = Number(option('--time-scale', '1'));
const label = option('--label', `n${count}-${Date.now()}`);
const evidenceTransport = option('--transport', 'legacy');
const behavior = option('--behavior', 'fixed');
const traceEncoding = option('--trace-encoding', 'server');
assert(['legacy', 'oss'].includes(evidenceTransport));
assert(['fixed', 'normal', 'classroom'].includes(behavior));
assert(behavior !== 'classroom' || (evidenceTransport === 'oss' && ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)),
  'Use the local test environment for concentrated classroom saves');
assert(['server', 'legacy', 'columns-v1'].includes(traceEncoding));
const previewFile = option('--previews', '.tmp/load-fixture-previews.json');
const browserPreviews = evidenceTransport === 'oss' ? JSON.parse(readFileSync(previewFile)) : undefined;
const fixtureRoot = option('--fixtures', '.tmp/load-fixtures');
const revision = option('--revision', 'unspecified');
const runtimeVersion = option('--runtime-version', 'unrecorded-development');
const fixtureKeys = [
  'destroyer',
  'lng',
  'container',
  'cruise',
  'drilling',
  'icebreaker',
  'dredger',
];
const identities = JSON.parse(readFileSync(identityFile)).identities.slice(0, count);
assert.equal(identities.length, count);
assert(durationS > 0 && count >= 1 && count <= 250 && timeScale > 0);
const fixtures = new Map(
  fixtureKeys.map((key) => [
    key,
    JSON.parse(gunzipSync(readFileSync(`${fixtureRoot}/${key}.json.gz`))),
  ]),
);
if (browserPreviews) {
  const digest = createHash('sha256');
  for (const key of fixtureKeys) digest.update(key).update(readFileSync(`${fixtureRoot}/${key}.json.gz`));
  assert.equal(browserPreviews.inputDigest, digest.digest('hex'), 'Frozen input and derived previews must match');
}
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: Math.max(32, count * 2) });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Math.max(32, count * 2) });
const compress = promisify(gzip);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();
const journal = `.logs/load-${label}.jsonl`,
  receipt = `.logs/load-${label}.json`;
const events = [],
  errors = [],
  states = [];
const downloadIntervals = new Map();
const classroom = { localWindowS: durationS, ordinaryEvidenceRequests: 0, platformSaveMs: [], submitted: 0, recovered: 0 };
let startedAt = 0,
  stopAt = 0,
  abort = false;
const cpuStart = process.cpuUsage();

async function request(
  client,
  pathname,
  { method = 'GET', body, rawBody, contentType, binary = false, kind = 'read', expected = [200], discard = false } = {},
) {
  const url = new URL(pathname, origin);
  let bytes = Buffer.alloc(0);
  const headers = {
    'accept-encoding': 'gzip, br',
    'user-agent': `ACT-simulation-load/${label}`,
    ...(client && url.origin === new URL(origin).origin
      ? { cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
      : {}),
  };
  if (rawBody !== undefined) {
    bytes = rawBody;headers['content-type'] = contentType;headers['content-length'] = String(bytes.length);
  } else if (body !== undefined) {
    const plain = Buffer.from(JSON.stringify(body));
    const gzipBody =
      pathname.startsWith('/api/ilab/experiment-runs') ||
      pathname === '/api/ilab/experiment-reports';
    bytes = gzipBody ? await compress(plain) : plain;
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(bytes.length);
    if (gzipBody) headers['content-encoding'] = 'gzip';
  }
  const t0 = performance.now();
  let status = 0,
    download = 0,
    headerBytes = 0,
    responseHeaders = {};
  const result = await new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method,
        headers,
        agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
        timeout: 30000,
      },
      (res) => {
        status = res.statusCode;
        responseHeaders = res.headers;
        for (const line of res.headers['set-cookie'] ?? []) {
          const pair = line.split(';', 1)[0],
            equal = pair.indexOf('=');
          if (client && equal > 0) client.cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
        }
        const chunks = [];
        res.on('data', (chunk) => {
          download += chunk.length;
          if (!discard) chunks.push(chunk);
          if (startedAt) {
            const second = Math.floor((Date.now() - startedAt) / 1000);
            downloadIntervals.set(second, (downloadIntervals.get(second) ?? 0) + chunk.length);
          }
        });
        res.on('error', reject);
        res.on('end', () => {
          if (discard) return resolve(null);
          let value = Buffer.concat(chunks);
          try {
            if (res.headers['content-encoding'] === 'gzip') value = gunzipSync(value);
            if (res.headers['content-encoding'] === 'br') value = brotliDecompressSync(value);
            if (binary) return resolve(value);
            const text = value.toString();
            try {
              resolve(JSON.parse(text));
            } catch {
              resolve({ text });
            }
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (bytes.length) req.write(bytes);
    req.end();
    headerBytes = Buffer.byteLength(req._header ?? '');
  }).catch((error) => ({ transportError: error.message }));
  const event = {
    time: Date.now(),
    kind,
    status,
    ms: performance.now() - t0,
    up: bytes.length,
    down: download,
    requestHeaderBytes: headerBytes,
    host: url.hostname,
    path: url.pathname,
    encoding: responseHeaders['content-encoding'] ?? 'identity',
    ok: expected.includes(status) && !result?.transportError,
  };
  if (startedAt) {
    events.push(event);
    appendFileSync(journal, JSON.stringify(event) + '\n');
  }
  if (!event.ok) {
    const error = {
      kind,
      status,
      path: url.pathname,
      error: result?.error ?? result?.transportError ?? `Unexpected status ${status}`,
    };
    if (errors.length < 50) errors.push(error);
    throw Object.assign(new Error(`${kind}: ${error.error}`), { detail: error });
  }
  return { status, headers: responseHeaders, value: result };
}

async function login(identity, index) {
  const client = { ...identity, index, cookies: new Map(), completedRuns: [], progress: null };
  const csrf = (await request(client, '/api/auth/csrf')).value.csrfToken;
  // The credentials endpoint receives its normal form body, outside the measured window.
  const body = new URLSearchParams({
    csrfToken: csrf,
    email: identity.loginId,
    password: identity.password,
    json: 'true',
    redirect: 'false',
  }).toString();
  const url = new URL('/api/auth/callback/credentials', origin);
  await new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(
      url,
      {
        method: 'POST',
        agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
          cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
      },
      (res) => {
        for (const line of res.headers['set-cookie'] ?? []) {
          const [pair] = line.split(';', 1),
            i = pair.indexOf('=');
          client.cookies.set(pair.slice(0, i), pair.slice(i + 1));
        }
        res.resume();
        res.on('end', () => resolve());
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end(body);
  });
  const session = (await request(client, '/api/auth/session')).value;
  assert.equal(session.user?.id, identity.id);
  assert.equal(session.user?.role, 'STUDENT');
  client.fixture = fixtures.get(fixtureKeys[index % 7]);
  client.sessionPath =
    client.fixture.courseKey === 'destroyer'
      ? '/api/ilab/destroyer/session'
      : '/api/ilab/vessel/session';
  const round = (
    await request(client, client.sessionPath, {
      method: 'POST',
      body: {
        experimentKey: client.fixture.experimentKey,
        experimentVersion: client.fixture.courseVersion,
      },
      kind: 'round-open',
    })
  ).value;
  assert.equal(round.connected, true);
  assert.equal(round.userId, identity.id);
  assert.equal(round.uploadMode, 'local-only');
  client.originId = round.originId;
  client.reportClientRef = round.reportClientRef;
  assert(client.reportClientRef);
  return client;
}

async function verifyRecovery(client) {
  const params = new URLSearchParams({
    courseKey: client.fixture.courseKey,
    courseVersion: client.fixture.courseVersion,
    originId: client.originId,
    reportClientRef: client.reportClientRef,
    ...(evidenceTransport === 'oss' ? { format: 'references', traceEncoding: 'columns-v1' } : {}),
  });
  const saved = (
    await request(client, `/api/ilab/course-session-recovery?${params}`, { kind: 'recovery' })
  ).value;
  assert.equal(saved.userId, client.id);
  assert.equal(saved.authenticated, true);
  if (client.progress) {
    const row = [...(saved.recovery?.runs ?? []), ...(saved.recovery?.archivedRuns ?? [])].find(
      (run) => run.id === client.runRef,
    );
    assert(row, 'same run recovered');
    assert.equal(row.lastTimeS, client.progress.lastTimeS);
    const restored = row.checkpoint
      ? row
      : (
          await request(client, `/api/ilab/experiment-runs/${client.runRef}?recovery=1${evidenceTransport === 'oss' ? '&format=references&traceEncoding=columns-v1' : ''}`, {
            kind: 'selected-run-recovery',
          })
        ).value;
    if (restored.stateObjects) {
      const references = [restored.stateObjects.openingReference, restored.stateObjects.checkpointReference];
      const grants = (await request(client, `/api/ilab/experiment-runs/${client.runRef}/objects/downloads`,
        {method: 'POST', body: {references}, kind: 'download-authorize'})).value;
      for (const grant of grants.objects) {
        const downloaded = (await request(null, grant.url, {binary: true, kind: 'oss-state-download'})).value;
        const value = decodeDirectLoadObject(grant.reference, downloaded, gunzipSync);
        if (grant.reference === restored.stateObjects.checkpointReference) restored.checkpoint = value.checkpoint;
      }
      if (behavior === 'fixed') {
        const chunks = restored.traceManifest.references;
        for (let first=0;first<chunks.length;first+=32) {
          const authorizations = (await request(client, `/api/ilab/experiment-runs/${client.runRef}/objects/downloads`,
            {method:'POST',body:{references:chunks.slice(first,first+32)},kind:'download-authorize'})).value;
          for (let start=0;start<authorizations.objects.length;start+=4) await Promise.all(authorizations.objects.slice(start,start+4).map(async grant=>{
            const bytes=(await request(null,grant.url,{binary:true,kind:'oss-curve-download'})).value;
            const chunk=decodeDirectLoadObject(grant.reference,bytes,gunzipSync);assert.equal(chunk.runRef,client.runRef);
          }));
        }
      }
    }
    assert.equal(
      restored.checkpoint,
      client.checkpointExpected,
      'same native checkpoint recovered',
    );
    const counts = restored.uploadReceipt ?? restored.traceManifest;
    if (counts)
      for (const key of ['controlCount', 'nativeCount', 'fineCount'])
        assert.equal(counts[key] ?? 0, client.progress[key] ?? 0);
  }
  return saved;
}

async function packet(client, index, endIndex) {
  if (evidenceTransport === 'oss') return directPacket(client,index,endIndex);
  const sources = client.fixture.packets.slice(index, endIndex);
  const source = sources.at(-1);
  const opening = sources[0].requests.find((item) => item.path === '/api/ilab/experiment-runs');
  const closing = source.requests.find((item) => item.method === 'PUT');
  const items = [
    opening,
    ...sources.flatMap((row) => row.requests.filter((item) => item.path.includes('/chunks'))),
    closing,
  ];
  const pending = [];
  let receivedChunkCount = 0;
  for (const item of items) {
    if (item.path.includes('/chunks') && item.body.chunkIndex < receivedChunkCount) continue;
    const sourceRun = item.path.split('/')[4];
    const pathname = item.path.replace(sourceRun, client.runRef);
    let body = item.body;
    if (item.path === '/api/ilab/experiment-runs')
      body = {
        ...body,
        runRef: client.runRef,
        reportClientRef: client.reportClientRef,
        startedAtMs: client.runStartedAt,
        runtimeVersion,
      };
    else if (item.path.includes('/chunks')) body = { ...body, runRef: client.runRef };
    else body = { ...body, pendingChunks: pending };
    const response = await request(client, pathname, {
      method: item.method,
      body,
      kind: item.path.includes('/chunks')
        ? 'trace-stage'
        : item.method === 'PUT'
          ? 'checkpoint'
          : 'run-open',
    });
    if (item === opening) {
      receivedChunkCount = response.value.chunkCount;
      if (response.value.status !== 'running') {
        assert.equal(response.value.lastTimeS, source.endTimeS);
        client.progress = response.value;
        client.checkpointExpected = closing.body.checkpoint;
        if (!client.completedRuns.includes(client.runRef)) client.completedRuns.push(client.runRef);
        return;
      }
    }
    if (item.path.includes('/chunks')) {
      pending.push(response.value.reference);
      appendFileSync(
        `.tmp/load-${label}-references.jsonl`,
        JSON.stringify({ runRef: client.runRef, reference: response.value.reference }) + '\n',
        { mode: 0o600 },
      );
    }
    if (item.method === 'PUT') {
      client.progress = response.value;
      client.checkpointExpected = body.checkpoint;
      const checkpointValue = {
        schema: 'act.vessel-run-close.v1',
        ...body,
        appliedFinalInput: JSON.parse(body.checkpoint).input,
      };
      const checkpointHash = createHash('sha256')
        .update(canonicalJson(checkpointValue))
        .digest('hex');
      appendFileSync(
        `.tmp/load-${label}-references.jsonl`,
        JSON.stringify({
          runRef: client.runRef,
          kind: 'checkpoint',
          reference: `simulation-cas:file:sha256:${checkpointHash}`,
        }) + '\n',
        { mode: 0o600 },
      );
      for (const key of ['controlCount', 'nativeCount', 'fineCount'])
        assert.equal(response.value[key] ?? 0, body[key] ?? 0);
      assert.equal(response.value.lastTimeS, source.endTimeS);
      if (source.endTimeS === client.fixture.durationS) {
        assert.equal(response.value.status, 'completed');
        client.completedRuns.push(client.runRef);
      }
    }
  }
}

async function directPacket(client, index, endIndex) {
  const sources=client.fixture.packets.slice(index,endIndex);
  const closing=sources.at(-1).requests.find(item=>item.method==='PUT').body;
  if (!client.directOpening || client.directOpening.runRef!==client.runRef) {
    const opening = {
      ...sources[0].requests.find(item => item.path === '/api/ilab/experiment-runs').body,
      runRef: client.runRef,
      reportClientRef: client.reportClientRef,
      startedAtMs: client.runStartedAt,
      runtimeVersion,
    };
    const response = await request(client, '/api/ilab/experiment-runs', {
      method: 'POST', body: opening, kind: 'run-open',
    });
    assert.equal(response.value.transport, 'oss');
    client.directOpening = opening;
    client.progress = response.value;
  }
  if (client.progress.status!=='running') {
    assert.equal(client.progress.lastTimeS,closing.endTimeS);return;
  }
  const sourceChunks=sources.flatMap(source=>source.requests.filter(item=>item.path.includes('/chunks')).map(item=>item.body));
  const preview=browserPreviews.previews[client.fixture.courseKey][endIndex-1];
  const batchKey=`${client.runRef}:${endIndex}`;
  if (client.prepared?.key !== batchKey) {
    const progress = traceEncoding === 'server' ? client.progress : { ...client.progress, traceEncoding };
    client.prepared = { key: batchKey, value: prepareDirectLoadPacket(client.directOpening, progress, sourceChunks, closing, preview) };
  }
  const prepared=client.prepared.value;
  for (let first=0;first<prepared.objects.length;first+=16) {
    const batch=prepared.objects.slice(first,first+16);
    const grants=(await request(client,`/api/ilab/experiment-runs/${client.runRef}/objects`,
      {method:'POST',body:{objects:batch.map(object=>object.descriptor)},kind:'upload-authorize'})).value;
    const indexed=new Map(grants.objects.map(grant=>[grant.reference,grant]));
    for (let start=0;start<batch.length;start+=4) await Promise.all(batch.slice(start,start+4).map(async object=>{
      const grant=indexed.get(object.descriptor.reference);assert(grant);
      if (grant.confirmed) return;
      const form=new FormData();for (const [key,value] of Object.entries(grant.fields)) form.append(key,value);
      form.append('file',new Blob([object.body],{type:'application/gzip'}),'evidence.json.gz');
      const encoded=new Request(grant.url,{method:'POST',body:form});
      const response=await request(null,grant.url,{method:'POST',rawBody:Buffer.from(await encoded.arrayBuffer()),
        contentType:encoded.headers.get('content-type'),kind:'oss-upload',expected:[200,409]});
      if (response.status===409) assert(response.value.text?.includes('<Code>FileAlreadyExists</Code>'));
      appendFileSync(`.tmp/load-${label}-references.jsonl`,JSON.stringify({runRef:client.runRef,reference:object.descriptor.reference})+'\n',{mode:0o600});
    }));
  }
  const deferred = behavior === 'classroom';
  client.progress=(await request(client,`/api/ilab/experiment-runs/${client.runRef}${deferred ? '?defer=1' : ''}`,
    {method:'PUT',body:{...prepared.close,checkpointReference:prepared.checkpointReference},
      kind:deferred ? 'explicit-confirmation' : prepared.close.reason==='checkpoint'?'checkpoint':'formal-end'})).value;
  client.checkpointExpected=closing.checkpoint;
  assert.equal(client.progress.lastTimeS,closing.endTimeS);
  for (const key of ['controlCount','nativeCount','fineCount']) assert.equal(client.progress[key]??0,closing[key]??0);
  if (closing.endTimeS===client.fixture.durationS) {
    if (deferred) assert.equal(client.progress.evidenceStatus, 'pending');
    else assert.equal(client.progress.status,'completed');
    if (!client.completedRuns.includes(client.runRef)) client.completedRuns.push(client.runRef);
  }
}

async function draft(client, tick) {
  const body = {
    activeSeq: 1,
    seq: 1,
    readings: { prediction: `专用压力测试草稿 ${tick}` },
    courseState: { reportClientRef: client.reportClientRef,
      ...(behavior === 'normal' || behavior === 'classroom' ? { activeRunId: client.runRef, plannedRunId: client.runRef } : {}),
      ...(behavior === 'classroom' ? { platformSaveId: randomUUID() } : {}) },
  };
  await request(client, `${client.sessionPath}/${client.originId}`, {
    method: 'PATCH',
    body,
    kind: 'draft',
  });
}

async function saveReport(client) {
  const sections = Object.fromEntries(
    ['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].map(
      (key) => [key, '专用压力测试报告。仅引用已保存的第一步运行，其他学习任务尚未执行。'],
    ),
  );
  const context = {
    reportClientRef: client.reportClientRef,
    courseKey: client.fixture.courseKey,
    courseVersion: client.fixture.courseVersion,
  };
  const attempt = await request(client, '/api/ilab/experiment-reports', {
    method: 'POST',
    kind: 'step-submit',
    body: {
      ...context,
      attempt: {
        clientRef: randomUUID(),
        stepSequence: 1,
        runRefs: client.completedRuns.slice(-1),
        modelClientRefs: [],
        comparisonClientRefs: [],
        answers: {
          prediction: sections.problem,
          observation: '依据本人的第一步真实量测记录检查并发保存。',
          interpretation: '本记录用于软件压力测试，尚未完成课程的其他步骤。',
        },
        outcome: 'submitted',
        validationFeedback: null,
      },
    },
  });
  client.attemptStatus = attempt.value.status;
  const result = await request(client, '/api/ilab/experiment-reports', {
    method: 'POST',
    kind: 'report-save',
    body: {
      reportClientRef: client.reportClientRef,
      courseKey: client.fixture.courseKey,
      courseVersion: client.fixture.courseVersion,
      report: { action: 'save', sections, runRefs: client.completedRuns.slice(-6) },
    },
  });
  assert.equal(result.value.report?.status, 'draft');
  const incomplete = await request(client, '/api/ilab/experiment-reports', {
    method: 'POST',
    kind: 'incomplete-report-submit',
    expected: [400],
    body: {
      ...context,
      report: { action: 'submit', sections, runRefs: client.completedRuns.slice(-6) },
    },
  });
  assert(incomplete.value.error);
}

const quantile = (values, p) => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
function summary() {
  const elapsedS = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const groups = {};
  for (const kind of new Set(events.map((event) => event.kind))) {
    const rows = events.filter((event) => event.kind === kind);
    groups[kind] = {
      requests: rows.length,
      errors: rows.filter((row) => !row.ok).length,
      p50Ms: quantile(
        rows.map((row) => row.ms),
        0.5,
      ),
      p95Ms: quantile(
        rows.map((row) => row.ms),
        0.95,
      ),
      p99Ms: quantile(
        rows.map((row) => row.ms),
        0.99,
      ),
      uploadBytes: rows.reduce((n, row) => n + row.up, 0),
      downloadBytes: rows.reduce((n, row) => n + row.down, 0),
      statuses: Object.fromEntries(
        [...new Set(rows.map((row) => row.status))].map((code) => [
          code,
          rows.filter((row) => row.status === code).length,
        ]),
      ),
    };
  }
  const cpu = process.cpuUsage(cpuStart);
  return {
    schema: 'act.simulation-load.v1',
    label,
    origin,
    revision,
    runtimeVersion,
    evidenceTransport,
    traceEncoding,
    behavior,
    previewInputDigest: browserPreviews?.inputDigest,
    concurrency: count,
    configuredDurationS: durationS,
    timeScale,
    startedAt: new Date(startedAt || Date.now()).toISOString(),
    capturedAt: new Date().toISOString(),
    elapsedS,
    requests: events.length,
    rps: events.length / Math.max(elapsedS, 1),
    errors,
    stateFailures: states,
    groups,
    clientCpuSeconds: (cpu.user + cpu.system) / 1e6,
    eventLoopP95Ms: eventLoop.percentile(95) / 1e6,
    eventLoopMaximumMs: eventLoop.max / 1e6,
    clientRssBytes: process.memoryUsage().rss,
    uploadBytes: events.reduce((n, row) => n + row.up, 0),
    downloadBytes: events.reduce((n, row) => n + row.down, 0),
    byteScope: 'HTTP encoded entity bodies, excluding headers and TLS',
    externalIlabCalls: 0,
    aiProviderCalls: 0,
    ...(behavior === 'classroom' ? { classroom: { ...classroom, platformSaveP95Ms: quantile(classroom.platformSaveMs, .95) } } : {}),
  };
}

async function runClassroom(clients) {
  const ordinaryStart = events.length;
  // Frozen local runs represent browser work in this window. No cloud saves are scheduled here.
  await sleep(durationS * 1000);
  classroom.ordinaryEvidenceRequests = events.length - ordinaryStart;
  if (abort) return;
  const exercise = async (phase, work) => {
    await Promise.all(clients.filter(client => !client.classroomFailed).map(async client => {
      try { await work(client); }
      catch (error) {
        client.classroomFailed = true;
        states.push({ course: client.fixture.courseKey, phase, message: String(error.message).split('\n')[0].slice(0, 300) });
      }
    }));
  };
  await exercise('explicit-save', async client => {
    const began = Date.now();
    client.runRef = `00000000-0000-4000-8000-${randomBytes(6).toString('hex')}`;
    client.runStartedAt = startedAt;
    await directPacket(client, 0, client.fixture.packets.length);
    await draft(client, 1);
    classroom.platformSaveMs.push(Date.now() - began);
  });
  if (abort) return;
  await exercise('recover', async client => { await verifyRecovery(client); classroom.recovered++; });
  await exercise('submit', async client => { await saveReport(client); classroom.submitted++; });
}

const clients = [];
try {
  for (let index = 0; index < identities.length; index += 5)
    clients.push(
      ...(await Promise.all(
        identities.slice(index, index + 5).map((identity, i) => login(identity, index + i)),
      )),
    );
  startedAt = Date.now();
  stopAt = startedAt + durationS * 1000;
  const timer = setInterval(() => {
    const value = summary();
    writeFileSync(receipt, JSON.stringify(value, null, 2));
    if (existsSync('.tmp/load-stop')) abort = true;
    const recent = events.filter((event) => event.time > Date.now() - 60000);
    if (recent.length >= 30 && recent.filter((event) => !event.ok).length / recent.length > 0.05)
      abort = true;
  }, 10000);
  try {
    if (behavior === 'classroom') await runClassroom(clients);
    else {
      await Promise.all(
        clients.map(async (client) => {
          await sleep((client.index * 5000) / Math.max(count, 1));
          let tick = 0,
            packetIndex = 0,
            lastDraft = 0,
            lastRecovery = 0,
            lastPage = 0;
          while (Date.now() < stopAt && !abort) {
            const cycleStarted = Date.now();
            if (packetIndex === 0) {
              client.runRef = `00000000-0000-4000-8000-${randomBytes(6).toString('hex')}`;
              client.runStartedAt = Date.now();
            }
            if (behavior === 'normal' && packetIndex === 0) {
              await draft(client, tick);
              lastDraft = Date.now();
              await sleep(5000);
            }
            const desired = behavior === 'normal'
              ? Math.max(packetIndex+1, Math.floor(((Date.now()-client.runStartedAt)/1000*timeScale)/5))
              : packetIndex + Math.max(1, Math.round(timeScale));
            const endIndex = Math.min(
              desired,
              client.fixture.packets.length,
            );
            const previousTime =
              packetIndex === 0 ? 0 : client.fixture.packets[packetIndex - 1].endTimeS;
            const span = client.fixture.packets[endIndex - 1].endTimeS - previousTime;
            try {
              for (let attempt = 0; ; attempt++) {
                try {
                  await packet(client, packetIndex, endIndex);
                  break;
                } catch (error) {
                  const status = error.detail?.status;
                  if (attempt >= 2 || !(status === 0 || status >= 500)) throw error;
                  await sleep(500 * (attempt + 1));
                }
              }
              client.completedPackets = (client.completedPackets ?? 0) + endIndex - packetIndex;
              if (behavior === 'fixed' && Date.now() - lastDraft >= 15000) {
                await draft(client, tick);
                lastDraft = Date.now();
              }
              if (behavior === 'fixed' && Date.now() - lastRecovery >= 30000) {
                await verifyRecovery(client);
                lastRecovery = Date.now();
              }
              if (behavior === 'fixed' && Date.now() - lastPage >= 60000) {
                await request(client, `/simulations/${client.fixture.courseKey}`, {
                  kind: 'page-refresh',
                  discard: true,
                });
                lastPage = Date.now();
              }
              packetIndex = endIndex === client.fixture.packets.length ? 0 : endIndex;
              tick++;
            } catch (error) {
              states.push({
                course: client.fixture.courseKey,
                tick,
                message: String(error.message).split('\n')[0].slice(0, 300),
              });
              abort = true;
              break;
            }
            if (behavior === 'normal') {
              const remaining = packetIndex === 0 ? 0 : client.fixture.durationS/timeScale*1000-(Date.now()-client.runStartedAt);
              await sleep(packetIndex === 0 ? 0 : Math.min(5000,Math.max(0,remaining)));
            } else await sleep((span * 1000) / timeScale - (Date.now() - cycleStarted));
          }
        }),
      );
      if (!abort) {
        await Promise.all(
          clients.map(async (client) => {
            try {
              await verifyRecovery(client);
              await saveReport(client);
            } catch (error) {
              states.push({
                course: client.fixture.courseKey,
                phase: 'concentrated-save',
                message: String(error.message).split('\n')[0].slice(0, 300),
              });
            }
          }),
        );
      }
    }
  } finally {
    clearInterval(timer);
  }
} finally {
  eventLoop.disable();
  httpsAgent.destroy();
  httpAgent.destroy();
  const result = summary();
  result.clients = clients.map((client) => ({
    course: client.fixture.courseKey,
    completedPackets: client.completedPackets ?? 0,
    completedRuns: client.completedRuns.length,
    attemptStatus: client.attemptStatus ?? null,
  }));
  result.criteria = {
    maximumErrorRate: 0.01,
    readP95Ms: 1500,
    saveP95Ms: 1500,
    minimumPacingFraction: 0.8,
  };
  result.actualErrorRate = events.filter((event) => !event.ok).length / Math.max(events.length, 1);
  result.minimumPacingFraction = behavior === 'classroom' ? null : Math.min(
    ...result.clients.map(
      (client) => client.completedPackets / Math.max((durationS * timeScale) / 5, 1),
    ),
  );
  if (behavior === 'classroom') result.criteria.minimumPacingFraction = null;
  const paced = behavior === 'classroom' ? classroom.submitted === count && classroom.recovered === count
    : result.minimumPacingFraction >= 0.8;
  const slow = Object.entries(result.groups).some(([kind, row]) => (behavior !== 'classroom'
    || ['explicit-confirmation', 'recovery', 'selected-run-recovery', 'step-submit', 'report-save'].includes(kind)) && row.p95Ms > 1500);
  result.status =
    !startedAt ||
    abort ||
    states.length ||
    result.actualErrorRate > 0.01 ||
    slow ||
    !paced
      ? 'failed'
      : 'passed';
  result.correctnessAndPacingPassed =
    Boolean(startedAt) &&
    !abort &&
    states.length === 0 &&
    result.actualErrorRate <= 0.01 &&
    paced;
  result.latencyGoalPassed = !slow;
  result.downloadBodyBytesPerSecond = Array.from(
    { length: Math.ceil(result.elapsedS) },
    (_, second) => downloadIntervals.get(second) ?? 0,
  );
  writeFileSync(receipt, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      label,
      status: result.status,
      concurrency: count,
      elapsedS: result.elapsedS,
      requests: events.length,
      errors: errors.length,
      stateFailures: states.length,
      receipt,
    }),
  );
  if (result.status !== 'passed') process.exitCode = 1;
}
