#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serializeDeterministic } from '../../src/lib/architecture-census/serialize.ts';
import {
  GRAPH_IDS,
  createGraphManifest,
  createGraphMeasurementReceipt,
  dependencyEdges,
  discoverEntrypoints,
  graphDefinition,
  graphManifestHash,
  parsePeakRssBytes,
  parseTscFilePaths,
  readGitIdentity,
  tscErrorCount,
  validateEntrypointClassification,
  validateGraphDefinitions,
  validateProductionBoundaries,
  type GraphFailure,
  type GraphId,
  type GraphMeasurementReceipt,
  type GraphSourceFile,
} from './contracts.ts';

type CacheMode = 'cold' | 'warm';
type Selection = GraphId | 'production' | 'all';
const TSC_STATUS_MARKER = '__ACT_TYPESCRIPT_GRAPH_TSC_STATUS__';

interface CompilerRun {
  readonly status: number;
  readonly output: string;
  readonly durationMs: number;
  readonly peakRssBytes: number | null;
}

interface RunOptions {
  readonly cacheMode: CacheMode;
  readonly fixtureProbe: boolean;
}

function parseOptions(): RunOptions & { selection: Selection } {
  const args = process.argv.slice(2);
  const graphArgument = args.find((arg) => arg === '--graph' || arg.startsWith('--graph='));
  const graphIndex = args.indexOf('--graph');
  const rawSelection = graphArgument?.startsWith('--graph=')
    ? graphArgument.slice('--graph='.length)
    : graphIndex >= 0 ? args[graphIndex + 1] ?? 'production' : 'production';
  if (![...GRAPH_IDS, 'production', 'all'].includes(rawSelection as Selection)) {
    throw new Error(`unknown-typescript-graph-selection:${rawSelection}`);
  }
  const cacheArgument = args.find((arg) => arg === '--cache' || arg.startsWith('--cache='));
  const cacheIndex = args.indexOf('--cache');
  const rawCache = cacheArgument?.startsWith('--cache=')
    ? cacheArgument.slice('--cache='.length)
    : cacheIndex >= 0 ? args[cacheIndex + 1] ?? 'warm' : 'warm';
  if (rawCache !== 'cold' && rawCache !== 'warm') throw new Error(`unknown-typescript-graph-cache:${rawCache}`);
  return {
    selection: rawSelection as Selection,
    cacheMode: rawCache,
    fixtureProbe: args.includes('--fixture-probe'),
  };
}

function selectedGraphs(selection: Selection): GraphId[] {
  if (selection === 'production') return ['web', 'worker'];
  if (selection === 'all') return [...GRAPH_IDS];
  return [selection];
}

function runCompiler(repoRoot: string, configPath: string, cacheMode: CacheMode, buildInfoPath: string, timed: boolean): CompilerRun {
  const compilerPath = join(repoRoot, 'node_modules/typescript/bin/tsc');
  const compilerArgs = ['-p', configPath, '--noEmit', '--pretty', 'false', '--listFiles'];
  if (cacheMode === 'cold') {
    compilerArgs.push('--incremental', 'false');
  } else {
    compilerArgs.push('--incremental', 'true', '--tsBuildInfoFile', buildInfoPath);
  }
  const timePath = '/usr/bin/time';
  const timeArgs = process.platform === 'darwin' ? ['-l'] : ['-v'];
  const useMeasurementWrapper = timed && existsSync(timePath) && existsSync('/bin/sh');
  const command = useMeasurementWrapper ? timePath : process.execPath;
  const args = useMeasurementWrapper
    ? [
        ...timeArgs,
        '/bin/sh',
        '-c',
        `"$@"; printf '\\n${TSC_STATUS_MARKER}%s\\n' "$?"`,
        'act-typescript-graph',
        process.execPath,
        compilerPath,
        ...compilerArgs,
      ]
    : [compilerPath, ...compilerArgs];
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: process.env,
  });
  const durationMs = Date.now() - startedAt;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;
  const compilerStatus = output.match(new RegExp(`${TSC_STATUS_MARKER}(\\d+)`, 'u'));
  return {
    status: compilerStatus ? Number(compilerStatus[1]) : result.status ?? 1,
    output,
    durationMs,
    peakRssBytes: parsePeakRssBytes(output),
  };
}

function sourceFiles(repoRoot: string, paths: readonly string[]): GraphSourceFile[] {
  return paths.flatMap((path) => {
    const fullPath = join(repoRoot, path);
    if (!existsSync(fullPath)) return [];
    return [{ path, content: readFileSync(fullPath, 'utf8') }];
  });
}

function writeImmutable(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') !== content) throw new Error(`immutable-artifact-conflict:${path}`);
    return;
  }
  writeFileSync(path, content, { flag: 'wx' });
}

function failureKey(failure: GraphFailure): string {
  return `${failure.code}:${failure.identity}:${failure.graph ?? ''}`;
}

function uniqueFailures(failures: readonly GraphFailure[]): GraphFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = failureKey(failure);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fixtureErrorDetected(output: string, repoRoot: string, fixturePath: string): boolean {
  const absolutePath = join(repoRoot, fixturePath);
  return output.includes(fixturePath) || output.includes(absolutePath);
}

function writeArtifacts(repoRoot: string, manifest: ReturnType<typeof createGraphManifest>, receipt: GraphMeasurementReceipt): void {
  const outputRoot = process.env.TS_GRAPH_RECEIPT_DIR ?? join(repoRoot, '.logs/typescript-graphs');
  const manifestHash = graphManifestHash(manifest);
  writeImmutable(join(outputRoot, 'manifests', `${manifest.graph}-${manifestHash}.json`), serializeDeterministic(manifest));
  writeImmutable(join(outputRoot, 'receipts', `${receipt.receiptId}.json`), `${JSON.stringify(receipt)}\n`);
}

function runGraph(repoRoot: string, graph: GraphId, options: RunOptions): GraphMeasurementReceipt {
  const definition = graphDefinition(graph);
  const identity = readGitIdentity(repoRoot);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'act-typescript-graph-'));
  const buildInfoPath = join(temporaryRoot, `${graph}.tsbuildinfo`);
  const fixtureFullPath = join(repoRoot, definition.fixturePath);
  const originalFixture = readFileSync(fixtureFullPath, 'utf8');
  const capturedAt = new Date().toISOString();
  let compilerRun: CompilerRun;
  let programFiles: string[] = [];
  let failures: GraphFailure[] = [];
  try {
    if (options.fixtureProbe) {
      const marker = `graph: '${graph}'`;
      const injected = originalFixture.replace(marker, `graph: 'invalid-${graph}'`);
      if (injected === originalFixture) throw new Error(`fixture-probe-marker-missing:${definition.fixturePath}`);
      writeFileSync(fixtureFullPath, injected);
    }
    if (options.cacheMode === 'warm') runCompiler(repoRoot, definition.configPath, options.cacheMode, buildInfoPath, false);
    compilerRun = runCompiler(repoRoot, definition.configPath, options.cacheMode, buildInfoPath, true);
    programFiles = parseTscFilePaths(compilerRun.output, repoRoot);
    const entries = discoverEntrypoints(repoRoot, programFiles);
    const manifest = createGraphManifest({
      repoRoot,
      graph,
      sourceCommit: identity.sourceCommit,
      sourceTree: identity.sourceTree,
      programFiles,
      entrypoints: entries,
    });
    const files = sourceFiles(repoRoot, programFiles);
    const edges = dependencyEdges(repoRoot, files, new Set(programFiles));
    failures = uniqueFailures([
      ...validateGraphDefinitions(repoRoot),
      ...validateEntrypointClassification(entries),
      ...validateProductionBoundaries(graph, files, edges),
    ]);
    const errorCount = tscErrorCount(compilerRun.output);
    if (!options.fixtureProbe && compilerRun.status !== 0) {
      failures.push({ code: errorCount > 0 ? 'tsc-type-errors' : 'tsc-process-failure', identity: `exit:${compilerRun.status}`, graph });
    }
    const probePassed = options.fixtureProbe && compilerRun.status !== 0 && compilerRun.output.includes(`invalid-${graph}`)
      && fixtureErrorDetected(compilerRun.output, repoRoot, definition.fixturePath);
    if (options.fixtureProbe && !probePassed) failures.push({ code: 'fixture-probe-not-detected', identity: definition.fixturePath, graph });
    const status = options.fixtureProbe
      ? (probePassed && failures.length === 0 ? 'passed' : 'failed')
      : (failures.length > 0 ? 'blocked' : compilerRun.status === 0 ? 'passed' : 'failed');
    const manifestHash = graphManifestHash(manifest);
    const receipt = createGraphMeasurementReceipt({
      graph,
      command: definition.command,
      scope: definition.scope,
      sourceCommit: identity.sourceCommit,
      sourceTree: identity.sourceTree,
      dirty: identity.dirty,
      manifestHash,
      fixturePath: definition.fixturePath,
      fixtureProbe: options.fixtureProbe,
      toolchain: {
        node: process.version,
        typescript: readFileSync(join(repoRoot, 'node_modules/typescript/package.json'), 'utf8').match(/"version"\s*:\s*"([^"]+)"/u)?.[1] ?? 'unknown',
      },
      platform: `${process.platform}-${process.arch}`,
      cacheMode: options.cacheMode,
      capturedAt,
      durationMs: compilerRun.durationMs,
      peakRssBytes: compilerRun.peakRssBytes,
      fileCount: programFiles.length,
      exitStatus: compilerRun.status,
      status,
      tscErrorCount: errorCount,
      boundaryFailureCount: failures.filter((failure) => failure.code.startsWith('production-to-') || failure.code.includes('-includes-')).length,
      failureCodes: [...new Set(failures.map((failure) => failure.code))].sort(),
    });
    writeArtifacts(repoRoot, manifest, receipt);
    console.log(JSON.stringify({ graph, cacheMode: options.cacheMode, fixtureProbe: options.fixtureProbe, status, receiptId: receipt.receiptId, manifestHash, fileCount: receipt.fileCount, durationMs: receipt.durationMs, peakRssBytes: receipt.peakRssBytes, failureCodes: receipt.failureCodes }));
    if (status !== 'passed') {
      const diagnostics = compilerRun.output.split(/\r?\n/u).filter((line) => /TS\d{4,5}\b/u.test(line)).slice(0, 20);
      if (diagnostics.length > 0) console.error(diagnostics.join('\n'));
      if (failures.length > 0) console.error(JSON.stringify(failures.slice(0, 30)));
    }
    return receipt;
  } finally {
    if (options.fixtureProbe) writeFileSync(fixtureFullPath, originalFixture);
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function main(): void {
  const repoRoot = process.cwd();
  const options = parseOptions();
  const receipts: GraphMeasurementReceipt[] = [];
  for (const graph of selectedGraphs(options.selection)) receipts.push(runGraph(repoRoot, graph, options));
  // Boundary findings are recorded on the receipt for qualification and
  // contract tests, but they must not turn a tsc-clean production command
  // into a failing process. The process status is reserved for the compiler
  // result (and for an undetected explicit fixture probe).
  if (receipts.some((receipt) => receipt.exitStatus !== 0 || (receipt.fixtureProbe && receipt.status !== 'passed'))) {
    process.exitCode = 1;
  }
}

main();
