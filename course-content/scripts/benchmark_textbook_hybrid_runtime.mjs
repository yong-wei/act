#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '../..');
const RETRIEVAL_ROOT = path.join(REPO_ROOT, 'src/lib/textbook-retrieval');
const MEMORY_BUDGET_BYTES = 150 * 1024 * 1024;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_TRACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const UNIT_ID_PATTERN = /^textbook-unit:[^\s/]+\/[^\s]+$/u;
const QUERY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/u;

const HELP = `Usage:
  node --expose-gc --import tsx course-content/scripts/benchmark_textbook_hybrid_runtime.mjs memory \\
    --index-dir <dir> [--runs 5] --output <json>
  node --expose-gc --import tsx course-content/scripts/benchmark_textbook_hybrid_runtime.mjs latency \\
    --index-dir <dir> --benchmark <jsonl> --split-file <json> \\
    --embedding-model <model> --rerank-model <model> [--concurrency 1,4,8] \\
    --embedding-timeout <ms> --rerank-timeout <ms> --output <json>
  node --import tsx course-content/scripts/benchmark_textbook_hybrid_runtime.mjs acceptance \\
    --index-dir <dir> --benchmark <jsonl> --split-file <json> \\
    --benchmark-lock <json> --locked-config <json> --selection-report <json> \\
    --output <json>

Commands:
  memory   Measure fresh-process resident memory after loading a real index.
  latency  Measure all tuning queries without reading acceptance query content.
  acceptance  Run the locked acceptance split through the real retrieval runtime.

Options:
  --help   Show this help.
`;

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`);
  return value;
}

function positiveInteger(value, name) {
  if (!/^[1-9][0-9]*$/u.test(String(value))) fail(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(`${name} is too large`);
  return parsed;
}

function parseArgs(argv, allowed, required) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || token === '--') fail(`unexpected argument: ${token}`);
    const name = token.slice(2);
    if (!allowed.has(name)) fail(`unknown option: --${name}`);
    if (Object.hasOwn(result, name)) fail(`duplicate option: --${name}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`missing value for --${name}`);
    result[name] = value;
    index += 1;
  }
  for (const name of required) {
    if (!Object.hasOwn(result, name)) fail(`missing required option: --${name}`);
  }
  return result;
}

function parseJson(bytes, name) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return fail(`${name} is not valid JSON`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalHash(value) {
  return sha256(Buffer.from(canonicalJson(value), 'utf8'));
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(fraction * ordered.length) - 1];
}

function memoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  };
}

function forceGc(count) {
  if (typeof globalThis.gc !== 'function') {
    fail('global.gc is unavailable; run Node with --expose-gc');
  }
  for (let index = 0; index < count; index += 1) globalThis.gc();
}

async function atomicWrite(output, report) {
  const resolved = path.resolve(output);
  await mkdir(path.dirname(resolved), { recursive: true });
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporary, resolved);
}

async function importRetrieval() {
  const [loader, retrieval, clients] = await Promise.all([
    import(pathToFileURL(path.join(RETRIEVAL_ROOT, 'loader.ts')).href),
    import(pathToFileURL(path.join(RETRIEVAL_ROOT, 'retrieval.ts')).href),
    import(pathToFileURL(path.join(RETRIEVAL_ROOT, 'clients.ts')).href),
  ]);
  return { ...loader, ...retrieval, ...clients };
}

async function memoryChild(argv) {
  const args = parseArgs(argv, new Set(['index-dir', 'run']), ['index-dir', 'run']);
  const run = positiveInteger(args.run, '--run');
  const { loadTextbookRetrievalIndex, closeTextbookRetrievalIndex } =
    await importRetrieval();
  forceGc(2);
  const baseline = memoryUsage();
  let index = await loadTextbookRetrievalIndex(args['index-dir']);
  forceGc(3);
  const loaded = memoryUsage();
  const resourceUsage = process.resourceUsage();
  const result = {
    recordType: 'textbook-hybrid-runtime-memory-run',
    run,
    manifestHash: index.manifestHash,
    model: index.manifest.model,
    dimension: index.manifest.observedDimension,
    baseline,
    loaded,
    delta: Object.fromEntries(
      Object.keys(loaded).map((key) => [key, loaded[key] - baseline[key]]),
    ),
    resourceUsage: {
      maxRSSKiB: resourceUsage.maxRSS,
      maxRSSBytes: resourceUsage.maxRSS * 1024,
    },
    loaderStats: index.stats,
  };
  await closeTextbookRetrievalIndex(index);
  index = undefined;
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function spawnMemoryRun(indexDir, run) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--expose-gc',
      '--import',
      'tsx',
      SCRIPT_PATH,
      '__memory-child',
      '--index-dir',
      indexDir,
      '--run',
      String(run),
    ], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(
          `memory child ${run} failed (${signal ?? code}): ${stderr.trim() || 'no stderr'}`,
        ));
        return;
      }
      try {
        const value = JSON.parse(stdout);
        if (
          !isRecord(value)
          || value.recordType !== 'textbook-hybrid-runtime-memory-run'
          || value.run !== run
          || !SHA256_PATTERN.test(value.manifestHash)
        ) fail(`memory child ${run} returned an invalid report`);
        resolve(value);
      } catch (error) {
        reject(new Error(`memory child ${run} returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function runMemory(argv) {
  const args = parseArgs(
    argv,
    new Set(['index-dir', 'runs', 'output']),
    ['index-dir', 'output'],
  );
  const runs = args.runs === undefined ? 5 : positiveInteger(args.runs, '--runs');
  const rounds = [];
  for (let run = 1; run <= runs; run += 1) {
    rounds.push(await spawnMemoryRun(args['index-dir'], run));
  }
  const identity = rounds[0];
  if (rounds.some((round) =>
    round.manifestHash !== identity.manifestHash
    || round.model !== identity.model
    || round.dimension !== identity.dimension)) {
    fail('index identity changed between memory runs');
  }
  const deltas = rounds.map((round) => round.delta.rss);
  const report = {
    recordType: 'textbook-hybrid-runtime-memory-benchmark',
    manifestHash: identity.manifestHash,
    model: identity.model,
    dimension: identity.dimension,
    runs: rounds,
    rssDeltaBytes: {
      max: Math.max(...deltas),
      p95: percentile(deltas, 0.95),
    },
    maxRssDeltaBytes: Math.max(...deltas),
    p95RssDeltaBytes: percentile(deltas, 0.95),
    budgetBytes: MEMORY_BUDGET_BYTES,
    passed: deltas.every((delta) => delta <= MEMORY_BUDGET_BYTES),
  };
  await atomicWrite(args.output, report);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.passed) process.exitCode = 1;
}

function validateBenchmarkRow(value, lineNumber) {
  const expectedKeys = [
    'schemaVersion', 'queryId', 'query', 'category', 'language',
    'acceptableUnitIds', 'preferredUnitId', 'sourceBookIds', 'rationale',
    'labelingVersion',
    ...(Object.hasOwn(value ?? {}, 'fragmentAnchorIds') ? ['fragmentAnchorIds'] : []),
  ];
  if (
    !isRecord(value)
    || !exactKeys(value, expectedKeys)
    || value.schemaVersion !== 'textbook-retrieval-benchmark-entry.v1'
    || typeof value.queryId !== 'string'
    || !QUERY_ID_PATTERN.test(value.queryId)
    || typeof value.query !== 'string'
    || !value.query.trim()
    || typeof value.category !== 'string'
    || !value.category
    || typeof value.language !== 'string'
    || !value.language
    || !Array.isArray(value.acceptableUnitIds)
    || value.acceptableUnitIds.length === 0
    || value.acceptableUnitIds.some((id) =>
      typeof id !== 'string' || !UNIT_ID_PATTERN.test(id))
    || typeof value.preferredUnitId !== 'string'
    || !value.acceptableUnitIds.includes(value.preferredUnitId)
    || !Array.isArray(value.sourceBookIds)
    || value.sourceBookIds.length === 0
    || value.sourceBookIds.some((id) => typeof id !== 'string' || !id)
    || typeof value.rationale !== 'string'
    || !value.rationale
    || typeof value.labelingVersion !== 'string'
    || !value.labelingVersion
    || (
      value.fragmentAnchorIds !== undefined
      && (
        !Array.isArray(value.fragmentAnchorIds)
        || value.fragmentAnchorIds.length === 0
        || value.fragmentAnchorIds.some((id) =>
          typeof id !== 'string'
          || !/^textbook-unit:[^\s#]+\/[^\s#]+#[A-Za-z0-9._:-]+$/u.test(id))
      )
    )
  ) fail(`benchmark line ${lineNumber} has an invalid shape`);
  return value;
}

async function loadTuningQueries(benchmarkPath, splitPath) {
  const [benchmarkBytes, splitBytes] = await Promise.all([
    readFile(benchmarkPath),
    readFile(splitPath),
  ]);
  const split = parseJson(splitBytes, 'split file');
  if (
    !isRecord(split)
    || !exactKeys(split, [
      'schemaVersion', 'strategy', 'lockedAt', 'tuningQueryIds',
      'acceptanceQueryIds',
    ])
    || split.schemaVersion !== 'textbook-retrieval-benchmark-split.v1'
    || !Array.isArray(split.tuningQueryIds)
    || split.tuningQueryIds.length === 0
    || !Array.isArray(split.acceptanceQueryIds)
    || split.acceptanceQueryIds.length === 0
  ) fail('split file shape is invalid');
  const tuningIds = split.tuningQueryIds;
  const acceptanceIds = new Set(split.acceptanceQueryIds);
  if (
    new Set(tuningIds).size !== tuningIds.length
    || tuningIds.some((id) => typeof id !== 'string' || !QUERY_ID_PATTERN.test(id))
    || split.acceptanceQueryIds.some((id) =>
      typeof id !== 'string' || !QUERY_ID_PATTERN.test(id))
    || tuningIds.some((id) => acceptanceIds.has(id))
  ) fail('tuning query IDs contain duplicates, invalid IDs, or acceptance IDs');

  const tuningSet = new Set(tuningIds);
  const rows = new Map();
  const lines = benchmarkBytes.toString('utf8').split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const queryIdMatch = /"queryId"\s*:\s*"([a-z0-9][a-z0-9-]{0,199})"/u.exec(line);
    if (!queryIdMatch) fail(`benchmark line ${index + 1} has no valid queryId`);
    if (!tuningSet.has(queryIdMatch[1])) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      fail(`benchmark line ${index + 1} is not valid JSON`);
    }
    const row = validateBenchmarkRow(parsed, index + 1);
    if (rows.has(row.queryId)) fail(`duplicate benchmark queryId: ${row.queryId}`);
    rows.set(row.queryId, row);
  });
  if (acceptanceIds.size === 0) fail('split acceptance query IDs are missing');
  const tuning = tuningIds.map((id) => {
    const row = rows.get(id);
    if (!row) fail(`tuning query ID does not resolve: ${id}`);
    return { queryId: id, query: row.query };
  });
  return {
    tuning,
    benchmarkHash: sha256(benchmarkBytes),
    splitHash: sha256(splitBytes),
  };
}

function validateSplit(split) {
  if (
    !isRecord(split)
    || !exactKeys(split, [
      'schemaVersion', 'strategy', 'lockedAt', 'tuningQueryIds',
      'acceptanceQueryIds',
    ])
    || split.schemaVersion !== 'textbook-retrieval-benchmark-split.v1'
    || !Array.isArray(split.tuningQueryIds)
    || split.tuningQueryIds.length === 0
    || !Array.isArray(split.acceptanceQueryIds)
    || split.acceptanceQueryIds.length === 0
  ) fail('split file shape is invalid');
  const allIds = [...split.tuningQueryIds, ...split.acceptanceQueryIds];
  if (
    new Set(allIds).size !== allIds.length
    || allIds.some((id) => typeof id !== 'string' || !QUERY_ID_PATTERN.test(id))
  ) fail('split query IDs contain duplicates or invalid IDs');
  return split;
}

function validateBenchmarkLock(lock, benchmarkHash, splitHash, split, benchmarkIds) {
  if (
    !isRecord(lock)
    || lock.recordType !== 'benchmark-lock'
    || lock.lockVersion !== 'textbook-hybrid-retrieval-benchmark-lock.v1'
    || lock.benchmarkHash !== benchmarkHash
    || lock.splitHash !== splitHash
    || lock.queryCount !== benchmarkIds.length
    || lock.tuningQueryCount !== split.tuningQueryIds.length
    || lock.acceptanceQueryCount !== split.acceptanceQueryIds.length
    || lock.tuningQueryIdsHash !== canonicalHash(split.tuningQueryIds)
    || lock.acceptanceQueryIdsHash !== canonicalHash(split.acceptanceQueryIds)
  ) fail('benchmark lock does not match benchmark inputs');
}

function loadAcceptanceRows(benchmarkBytes, split) {
  const acceptanceSet = new Set(split.acceptanceQueryIds);
  const benchmarkIds = [];
  const rows = new Map();
  const lines = benchmarkBytes.toString('utf8').split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const queryIdMatch = /"queryId"\s*:\s*"([a-z0-9][a-z0-9-]{0,199})"/u.exec(line);
    if (!queryIdMatch) fail(`benchmark line ${index + 1} has no valid queryId`);
    const queryId = queryIdMatch[1];
    if (benchmarkIds.includes(queryId)) fail(`duplicate benchmark queryId: ${queryId}`);
    benchmarkIds.push(queryId);
    if (!acceptanceSet.has(queryId)) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      fail(`acceptance benchmark line ${index + 1} is not valid JSON`);
    }
    const row = validateBenchmarkRow(parsed, index + 1);
    rows.set(queryId, row);
  });
  const splitIds = new Set([...split.tuningQueryIds, ...split.acceptanceQueryIds]);
  if (
    benchmarkIds.length !== splitIds.size
    || benchmarkIds.some((id) => !splitIds.has(id))
  ) fail('benchmark split inventory is invalid');
  return {
    benchmarkIds,
    acceptance: split.acceptanceQueryIds.map((queryId) => {
      const row = rows.get(queryId);
      if (!row) fail(`acceptance query ID does not resolve: ${queryId}`);
      return row;
    }),
  };
}

function validateLockedAcceptance(config, selection, hashes, index) {
  const runtime = config.runtimeAcceptance;
  if (
    !isRecord(config)
    || config.recordType !== 'textbook-hybrid-retrieval-config'
    || config.formatVersion !== 'textbook-hybrid-retrieval.v1'
    || config.locked !== true
    || !isRecord(runtime)
    || !exactKeys(runtime, [
      'runtimeEntry', 'topK', 'candidateCount', 'recallAt10Threshold',
      'knownFailureQueryId',
    ])
    || runtime.runtimeEntry
      !== 'src/lib/textbook-retrieval/retrieval.ts#retrieveTextbookHybrid'
    || runtime.topK !== 10
    || runtime.candidateCount !== 24
    || runtime.recallAt10Threshold !== 0.8
    || typeof runtime.knownFailureQueryId !== 'string'
    || !QUERY_ID_PATTERN.test(runtime.knownFailureQueryId)
    || config.embeddingTimeoutMs !== 1000
    || config.rerankTimeoutMs !== 2000
    || config.selectionReportHash !== hashes.selectionReportHash
    || config.benchmarkHash !== hashes.benchmarkHash
    || config.splitHash !== hashes.splitHash
    || config.benchmarkLockHash !== hashes.benchmarkLockHash
    || config.selectedIndexManifestHash !== index.manifestHash
    || config.selectedModel !== index.manifest.model
    || config.selectedObservedDimension !== index.manifest.observedDimension
    || config.selectedNormalizationVersion !== index.manifest.normalizationVersion
    || index.manifest.vectorNormalization !== 'l2'
    || selection.recordType !== 'selection-report'
    || selection.acceptanceEvaluated !== false
    || selection.benchmarkHash !== hashes.benchmarkHash
    || selection.splitHash !== hashes.splitHash
    || selection.benchmarkLockHash !== hashes.benchmarkLockHash
    || selection.selectedIndexManifestHash !== index.manifestHash
    || selection.selectedModel !== index.manifest.model
    || selection.selectedObservedDimension !== index.manifest.observedDimension
    || selection.selectedNormalizationVersion !== index.manifest.normalizationVersion
  ) fail('locked runtime acceptance configuration does not match inputs');
  return runtime;
}

function safeProviderFailures(diagnostics) {
  return diagnostics.map(({ stage, code, latencyMs, traceId }) => ({
    stage,
    code,
    latencyMs,
    ...(traceId && SAFE_TRACE_ID_PATTERN.test(traceId) ? { traceId } : {}),
  }));
}

export async function runAcceptance(argv, retrievalOverride) {
  const args = parseArgs(
    argv,
    new Set([
      'index-dir', 'benchmark', 'split-file', 'benchmark-lock',
      'locked-config', 'selection-report', 'output',
    ]),
    [
      'index-dir', 'benchmark', 'split-file', 'benchmark-lock',
      'locked-config', 'selection-report', 'output',
    ],
  );
  const [
    benchmarkBytes,
    splitBytes,
    benchmarkLockBytes,
    configBytes,
    selectionBytes,
  ] = await Promise.all([
    readFile(args.benchmark),
    readFile(args['split-file']),
    readFile(args['benchmark-lock']),
    readFile(args['locked-config']),
    readFile(args['selection-report']),
  ]);
  const split = validateSplit(parseJson(splitBytes, 'split file'));
  const benchmarkLock = parseJson(benchmarkLockBytes, 'benchmark lock');
  const config = parseJson(configBytes, 'locked config');
  const selection = parseJson(selectionBytes, 'selection report');
  const { benchmarkIds, acceptance } = loadAcceptanceRows(benchmarkBytes, split);
  const hashes = {
    benchmarkHash: sha256(benchmarkBytes),
    splitHash: sha256(splitBytes),
    benchmarkLockHash: canonicalHash(benchmarkLock),
    benchmarkLockFileHash: sha256(benchmarkLockBytes),
    configHash: sha256(configBytes),
    selectionReportHash: sha256(selectionBytes),
  };
  validateBenchmarkLock(
    benchmarkLock,
    hashes.benchmarkHash,
    hashes.splitHash,
    split,
    benchmarkIds,
  );
  process.env.NODE_ENV = 'development';
  const retrieval = retrievalOverride ?? await importRetrieval();
  const index = await retrieval.loadTextbookRetrievalIndex(args['index-dir']);
  try {
    const runtime = validateLockedAcceptance(config, selection, hashes, index);
    if (!split.acceptanceQueryIds.includes(runtime.knownFailureQueryId)) {
      fail('known failure query is not in the acceptance split');
    }
    const indexedWindows = new Map(index.windows.map((window) => [window.id, window]));
    const queries = [];
    for (const benchmarkRow of acceptance) {
      const sample = { traceIds: [] };
      const embeddingClient = new TimedEmbeddingClient(
        new retrieval.SiliconFlowTextbookEmbeddingClient(),
        sample,
      );
      const rerankClient = new TimedRerankClient(
        new retrieval.SiliconFlowTextbookRerankClient(),
        sample,
      );
      const started = performance.now();
      try {
        const response = await retrieval.retrieveTextbookHybrid(benchmarkRow.query, {
          indexRoot: args['index-dir'],
          topK: runtime.topK,
          candidateCount: runtime.candidateCount,
          embeddingClient,
          embeddingTimeoutMs: config.embeddingTimeoutMs,
          rerankClient,
          rerankModel: config.rerankerModel,
          rerankTimeoutMs: config.rerankTimeoutMs,
        });
        const returned = response.results.map((result) => {
          const indexed = indexedWindows.get(result.windowId);
          const validResolution = indexed !== undefined
            && result.primaryUnitId === indexed.primaryUnitId
            && JSON.stringify(result.owningUnitIds)
              === JSON.stringify(indexed.owningUnitIds);
          return {
            windowId: result.windowId,
            primaryUnitId: result.primaryUnitId,
            owningUnitIds: result.owningUnitIds,
            validResolution,
          };
        });
        const returnedUnitIds = new Set(returned.flatMap((result) => [
          result.primaryUnitId,
          ...result.owningUnitIds,
        ]));
        const diagnostics = response.diagnostics ?? [];
        queries.push({
          queryId: benchmarkRow.queryId,
          hit: benchmarkRow.acceptableUnitIds.some((id) => returnedUnitIds.has(id)),
          outcome: diagnostics.length === 0 ? 'success' : 'fallback',
          providerFailures: safeProviderFailures(diagnostics),
          traceIds: sample.traceIds,
          latencyMs: elapsed(started),
          returned,
          validResolution: returned.length > 0
            && returned.length <= runtime.topK
            && returned.every((result) => result.validResolution),
        });
      } catch (error) {
        queries.push({
          queryId: benchmarkRow.queryId,
          hit: false,
          outcome: 'failed',
          providerFailures: [],
          traceIds: sample.traceIds,
          latencyMs: elapsed(started),
          returned: [],
          validResolution: false,
          errorCode: error?.name === 'TextbookRetrievalContractError'
            ? 'contract-error'
            : 'retrieval-error',
        });
      }
    }
    const hitsAt10 = queries.filter((query) => query.hit).length;
    const recallAt10 = hitsAt10 / queries.length;
    const knownFailure = queries.find(
      (query) => query.queryId === runtime.knownFailureQueryId,
    );
    const allResultsResolved = queries.every((query) => query.validResolution);
    const passed = recallAt10 >= runtime.recallAt10Threshold
      && knownFailure?.hit === true
      && allResultsResolved
      && queries.every((query) => query.outcome !== 'failed');
    const report = {
      recordType: 'textbook-hybrid-runtime-acceptance-report',
      formatVersion: 'textbook-hybrid-runtime-acceptance.v1',
      hashes: {
        config: hashes.configHash,
        benchmark: hashes.benchmarkHash,
        split: hashes.splitHash,
        benchmarkLock: hashes.benchmarkLockHash,
        benchmarkLockFile: hashes.benchmarkLockFileHash,
        selectionReport: hashes.selectionReportHash,
        indexManifest: index.manifestHash,
      },
      evaluatedQueries: queries.length,
      hitsAt10,
      recallAt10,
      threshold: runtime.recallAt10Threshold,
      knownFailureQueryId: runtime.knownFailureQueryId,
      knownFailureHit: knownFailure?.hit === true,
      allResultsResolved,
      queries,
      passed,
    };
    await atomicWrite(args.output, report);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.passed) process.exitCode = 1;
    return report;
  } finally {
    await retrieval.closeTextbookRetrievalIndex(index);
  }
}

class TimedEmbeddingClient {
  constructor(delegate, sample) {
    this.delegate = delegate;
    this.sample = sample;
  }

  async embed(request) {
    const started = performance.now();
    try {
      const response = await this.delegate.embed(request);
      this.sample.embedding = elapsed(started);
      recordTrace(this.sample, 'embedding', response.traceId);
      return response;
    } catch (error) {
      this.sample.embedding = elapsed(started);
      recordTrace(this.sample, 'embedding', error?.traceId);
      throw error;
    }
  }
}

class TimedRerankClient {
  constructor(delegate, sample) {
    this.delegate = delegate;
    this.sample = sample;
  }

  async rerank(request) {
    const started = performance.now();
    try {
      const response = await this.delegate.rerank(request);
      this.sample.rerank = elapsed(started);
      recordTrace(this.sample, 'rerank', response.traceId);
      return response;
    } catch (error) {
      this.sample.rerank = elapsed(started);
      recordTrace(this.sample, 'rerank', error?.traceId);
      throw error;
    }
  }
}

function elapsed(started) {
  return Math.max(0, Math.round((performance.now() - started) * 1000) / 1000);
}

function recordTrace(sample, stage, traceId) {
  if (traceId === undefined) return;
  if (typeof traceId !== 'string' || !SAFE_TRACE_ID_PATTERN.test(traceId)) {
    fail(`${stage} provider returned an unsafe trace ID`);
  }
  sample.traceIds.push({ stage, traceId });
}

async function mapConcurrent(items, concurrency, operation) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      output[index] = await operation(items[index]);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  ));
  return output;
}

function stageStats(samples, stage) {
  const values = samples
    .map((sample) => sample[stage])
    .filter((value) => typeof value === 'number');
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
  };
}

async function runLatency(argv) {
  const args = parseArgs(
    argv,
    new Set([
      'index-dir', 'benchmark', 'split-file', 'embedding-model',
      'rerank-model', 'concurrency', 'embedding-timeout', 'rerank-timeout',
      'output',
    ]),
    [
      'index-dir', 'benchmark', 'split-file', 'embedding-model',
      'rerank-model', 'embedding-timeout', 'rerank-timeout', 'output',
    ],
  );
  const concurrency = (args.concurrency ?? '1,4,8').split(',')
    .map((value) => positiveInteger(value, '--concurrency'));
  if (new Set(concurrency).size !== concurrency.length) {
    fail('--concurrency must not contain duplicates');
  }
  const embeddingTimeoutMs = positiveInteger(
    args['embedding-timeout'],
    '--embedding-timeout',
  );
  const rerankTimeoutMs = positiveInteger(args['rerank-timeout'], '--rerank-timeout');
  const models = {
    embedding: nonEmptyString(args['embedding-model'], '--embedding-model'),
    rerank: nonEmptyString(args['rerank-model'], '--rerank-model'),
  };
  const { tuning, benchmarkHash, splitHash } = await loadTuningQueries(
    args.benchmark,
    args['split-file'],
  );
  process.env.NODE_ENV = 'development';
  const retrieval = await importRetrieval();
  const index = await retrieval.loadTextbookRetrievalIndex(args['index-dir']);
  if (index.manifest.model !== models.embedding) {
    await retrieval.closeTextbookRetrievalIndex(index);
    fail('--embedding-model does not match the loaded index manifest');
  }

  const levels = [];
  for (const level of concurrency) {
    const samples = await mapConcurrent(tuning, level, async ({ queryId, query }) => {
      const sample = { queryId, traceIds: [] };
      const embeddingClient = new TimedEmbeddingClient(
        new retrieval.SiliconFlowTextbookEmbeddingClient(),
        sample,
      );
      const rerankClient = new TimedRerankClient(
        new retrieval.SiliconFlowTextbookRerankClient(),
        sample,
      );
      const started = performance.now();
      try {
        const response = await retrieval.retrieveTextbookHybrid(query, {
          indexRoot: args['index-dir'],
          topK: 10,
          candidateCount: 24,
          embeddingClient,
          embeddingTimeoutMs,
          rerankClient,
          rerankModel: models.rerank,
          rerankTimeoutMs,
        });
        sample.total = elapsed(started);
        const diagnostics = response.diagnostics ?? [];
        const unitIds = response.results.flatMap((result) => result.owningUnitIds);
        const validResults = response.results.length > 0
          && unitIds.length > 0
          && unitIds.every((id) => UNIT_ID_PATTERN.test(id));
        return {
          queryId,
          totalMs: sample.total,
          embeddingMs: sample.embedding ?? null,
          rerankMs: sample.rerank ?? null,
          outcome: diagnostics.length === 0 ? 'success' : 'fallback',
          providerFailures: diagnostics.map(({ stage, code, latencyMs, traceId }) => ({
            stage,
            code,
            latencyMs,
            ...(traceId && SAFE_TRACE_ID_PATTERN.test(traceId) ? { traceId } : {}),
          })),
          traceIds: sample.traceIds,
          returnedCount: response.results.length,
          returnedUnitIds: unitIds,
          validResults,
        };
      } catch (error) {
        return {
          queryId,
          totalMs: elapsed(started),
          embeddingMs: sample.embedding ?? null,
          rerankMs: sample.rerank ?? null,
          outcome: 'failed',
          providerFailures: [],
          traceIds: sample.traceIds,
          returnedCount: 0,
          returnedUnitIds: [],
          validResults: false,
          errorCode: error?.name === 'TextbookRetrievalContractError'
            ? 'contract-error'
            : 'retrieval-error',
        };
      }
    });
    const timingSamples = samples.map((sample) => ({
      total: sample.totalMs,
      embedding: sample.embeddingMs,
      rerank: sample.rerankMs,
    }));
    const counts = {
      success: samples.filter((sample) => sample.outcome === 'success').length,
      fallback: samples.filter((sample) => sample.outcome === 'fallback').length,
      failed: samples.filter((sample) => sample.outcome === 'failed').length,
      providerFailures: samples.reduce(
        (total, sample) => total + sample.providerFailures.length,
        0,
      ),
      traces: samples.reduce((total, sample) => total + sample.traceIds.length, 0),
    };
    levels.push({
      concurrency: level,
      timing: {
        total: stageStats(timingSamples, 'total'),
        embedding: stageStats(timingSamples, 'embedding'),
        rerank: stageStats(timingSamples, 'rerank'),
      },
      counts,
      queries: samples,
      passed: samples.every((sample) =>
        sample.outcome !== 'failed' && sample.validResults),
    });
  }
  await retrieval.closeTextbookRetrievalIndex(index);
  const worstTotalP95Ms = Math.max(...levels.map((level) => level.timing.total.p95Ms));
  const backgroundWaitLimitMs = Math.ceil((1.5 * worstTotalP95Ms) / 100) * 100;
  const report = {
    recordType: 'textbook-hybrid-runtime-latency-benchmark',
    manifestHash: index.manifestHash,
    benchmarkHash,
    splitHash,
    models,
    tuningQueryCount: tuning.length,
    concurrency: levels,
    backgroundWaitLimitMs,
    backgroundWaitLimitFormula: 'ceil(1.5 * worstTotalP95Ms / 100) * 100',
    worstTotalP95Ms,
    passed: levels.every((level) => level.passed),
  };
  await atomicWrite(args.output, report);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.passed) process.exitCode = 1;
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (command === '--help' || command === '-h' || command === undefined) {
    process.stdout.write(HELP);
    return;
  }
  if (command === '__memory-child') return memoryChild(argv);
  if (command === 'memory') return runMemory(argv);
  if (command === 'latency') return runLatency(argv);
  if (command === 'acceptance') return runAcceptance(argv);
  fail(`unknown command: ${command}`);
}

if (path.resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`benchmark_textbook_hybrid_runtime: ${error.message}\n`);
    process.exitCode = 1;
  });
}
