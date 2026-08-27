#!/usr/bin/env tsx
/**
 * Capture the production-active Runtime Release v2 as immutable, read-only
 * review input.  This is intentionally separate from selector activation:
 * it reads the mounted manifest and active receipt only, then persists a
 * local evidence artifact whose complete file inventory can be classified.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/production-runtime-observation.json`;
const PUBLISHER_ENV = '/Users/YW/.config/act/publisher-env.zsh';
const PRODUCTION_HOST = 'root@121.40.124.135';
const PRODUCTION_CONTAINER = 'act-obe-app';

interface RuntimeManifestFile {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly contentType: string | null;
}

interface RemoteRuntimeObservation {
  readonly contract: 'active-runtime-manifest-observation-source/v2';
  readonly runtimeRoot: '/app/course-content/runtime';
  readonly activeReceipt: {
    readonly wireSha256: string;
    readonly schemaVersion: string;
    readonly selection: {
      readonly schemaVersion: string;
      readonly generation: number;
      readonly releaseId: string;
      readonly manifestSha256: string;
      readonly treeSha256: string;
    };
    readonly healthCheck: string;
  };
  readonly manifest: {
    readonly path: '.act-runtime-release.v2.json' | '.act-runtime-release.v1.json';
    readonly wireSha256: string;
    readonly schemaVersion: string;
    readonly releaseId: string;
    readonly sourceRevision: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
    readonly fileCount: number;
    readonly totalBytes: number;
    readonly files: readonly RuntimeManifestFile[];
  };
}

interface ActiveRuntimeObservation {
  readonly contract: 'active-runtime-manifest-observation/v2';
  readonly capturedAt: string;
  readonly source: {
    readonly kind: 'production-read-only';
    readonly container: typeof PRODUCTION_CONTAINER;
    readonly runtimeRoot: '/app/course-content/runtime';
  };
  readonly activeRelease: {
    readonly releaseId: string;
    readonly sourceRevision: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
    readonly activeReceiptHash: string;
    readonly lifecycleGeneration: number;
  };
  readonly manifest: RemoteRuntimeObservation['manifest'];
  readonly sourceHash: string;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireDigest(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 digest`);
  }
}

function requireSafeRuntimePath(value: unknown): asserts value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.startsWith('/')
    || value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('runtime manifest contains an unsafe file path');
  }
}

function assertRemoteObservation(value: unknown): asserts value is RemoteRuntimeObservation {
  if (!value || typeof value !== 'object') throw new Error('production runtime observation is not an object');
  const source = value as Partial<RemoteRuntimeObservation>;
  if (source.contract !== 'active-runtime-manifest-observation-source/v2') {
    throw new Error('production runtime observation contract is invalid');
  }
  if (source.runtimeRoot !== '/app/course-content/runtime') {
    throw new Error('production runtime observation has an unexpected runtime root');
  }
  const { activeReceipt, manifest } = source;
  if (!activeReceipt || !manifest) throw new Error('production runtime observation is incomplete');
  requireDigest(activeReceipt.wireSha256, 'active receipt wireSha256');
  if (
    activeReceipt.schemaVersion !== 'runtime-release-active-receipt.v1'
    || activeReceipt.healthCheck !== 'readyz'
    || activeReceipt.selection?.schemaVersion !== 'runtime-release-selection.v1'
    || !Number.isInteger(activeReceipt.selection.generation)
    || activeReceipt.selection.generation < 1
  ) {
    throw new Error('production active runtime receipt is invalid');
  }
  requireDigest(activeReceipt.selection.manifestSha256, 'active receipt manifestSha256');
  requireDigest(activeReceipt.selection.treeSha256, 'active receipt treeSha256');
  if (!activeReceipt.selection.releaseId) throw new Error('production active runtime release id is missing');
  if (
    (manifest.path !== '.act-runtime-release.v2.json' && manifest.path !== '.act-runtime-release.v1.json')
    || !manifest.releaseId
    || typeof manifest.sourceRevision !== 'string'
    || !/^[a-f0-9]{40}$/u.test(manifest.sourceRevision)
    || !Number.isInteger(manifest.fileCount)
    || manifest.fileCount < 1
    || !Number.isInteger(manifest.totalBytes)
    || manifest.totalBytes < 0
    || !Array.isArray(manifest.files)
    || manifest.files.length !== manifest.fileCount
  ) {
    throw new Error('production runtime manifest is invalid');
  }
  requireDigest(manifest.wireSha256, 'runtime manifest wireSha256');
  requireDigest(manifest.manifestSha256, 'runtime manifest manifestSha256');
  requireDigest(manifest.treeSha256, 'runtime manifest treeSha256');
  if (
    activeReceipt.selection.releaseId !== manifest.releaseId
    || activeReceipt.selection.manifestSha256 !== manifest.manifestSha256
    || activeReceipt.selection.treeSha256 !== manifest.treeSha256
  ) {
    throw new Error('production active receipt does not match the mounted runtime manifest');
  }
  const paths = new Set<string>();
  for (const file of manifest.files) {
    requireSafeRuntimePath(file.path);
    requireDigest(file.sha256, `runtime file ${file.path} sha256`);
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0) {
      throw new Error(`runtime file ${file.path} has an invalid size`);
    }
    if (file.contentType !== null && typeof file.contentType !== 'string') {
      throw new Error(`runtime file ${file.path} has an invalid content type`);
    }
    if (paths.has(file.path)) throw new Error(`runtime manifest repeats ${file.path}`);
    paths.add(file.path);
  }
}

function remoteProgram(): string {
  return [
    'const fs=require("node:fs/promises");',
    'const crypto=require("node:crypto");',
    'const sha=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    'async function readJson(file){const wire=await fs.readFile(file);return {wireSha256:sha(wire),value:JSON.parse(wire.toString("utf8"))};}',
    'async function main(){',
    'const root="/app/course-content/runtime";',
    'let manifest=null;',
    'for(const path of [".act-runtime-release.v2.json",".act-runtime-release.v1.json"]){',
    'try{const parsed=await readJson(root+"/"+path);const value=parsed.value;manifest={path,wireSha256:parsed.wireSha256,schemaVersion:value.schemaVersion,releaseId:value.releaseId,sourceRevision:value.sourceRevision,manifestSha256:value.manifestSha256,treeSha256:value.treeSha256,fileCount:value.fileCount,totalBytes:value.totalBytes,files:Array.isArray(value.files)?value.files.map((file)=>({path:file.path,sha256:file.sha256,sizeBytes:file.sizeBytes,contentType:file.contentType??null})):[]};break;}catch(error){if(error&&error.code==="ENOENT")continue;throw error;}',
    '}',
    'if(!manifest)throw new Error("active runtime manifest is missing");',
    'const receipt=await readJson("/app/act-runtime-state/act-runtime-active-receipt.json");',
    'const value=receipt.value;',
    'const activeReceipt={wireSha256:receipt.wireSha256,schemaVersion:value.schemaVersion,selection:value.selection,healthCheck:value.healthCheck};',
    'process.stdout.write(JSON.stringify({contract:"active-runtime-manifest-observation-source/v2",runtimeRoot:root,activeReceipt,manifest}));',
    '}',
    'main().catch((error)=>{console.error(error.stack||String(error));process.exit(1);});',
  ].join('');
}

function readProductionObservation(): RemoteRuntimeObservation {
  const encodedProgram = Buffer.from(remoteProgram()).toString('base64');
  const command = [
    `source ${PUBLISHER_ENV} >/dev/null`,
    `printf %s ${encodedProgram} | ssh -o BatchMode=yes -o UserKnownHostsFile=\"$ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE\" ${PRODUCTION_HOST} "base64 -d | podman exec -i ${PRODUCTION_CONTAINER} node -"`,
  ].join('; ');
  const output = execFileSync('/bin/zsh', ['-lc', command], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const value = JSON.parse(output) as unknown;
  assertRemoteObservation(value);
  return value;
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) {
      throw new Error(`refusing to overwrite diverging runtime observation ${relativePath}`);
    }
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function existingCapturedAt(relativePath: string): string | null {
  const target = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
  if (!existsSync(target)) return null;
  const value = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;
  if (
    value.contract !== 'active-runtime-manifest-observation/v2'
    || typeof value.capturedAt !== 'string'
    || Number.isNaN(Date.parse(value.capturedAt))
  ) {
    throw new Error(`existing runtime observation ${relativePath} is invalid`);
  }
  return value.capturedAt;
}

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function main(): void {
  const outputPath = argValue('--out', DEFAULT_OUTPUT);
  const remote = readProductionObservation();
  // Replays over the same mounted Runtime must verify the immutable first
  // capture instead of manufacturing a fresh timestamp and false drift.
  const capturedAt = existingCapturedAt(outputPath) ?? new Date().toISOString();
  const observationWithoutHash = {
    contract: 'active-runtime-manifest-observation/v2' as const,
    capturedAt,
    source: {
      kind: 'production-read-only' as const,
      container: PRODUCTION_CONTAINER,
      runtimeRoot: remote.runtimeRoot,
    },
    activeRelease: {
      releaseId: remote.activeReceipt.selection.releaseId,
      sourceRevision: remote.manifest.sourceRevision,
      manifestSha256: remote.activeReceipt.selection.manifestSha256,
      treeSha256: remote.activeReceipt.selection.treeSha256,
      activeReceiptHash: remote.activeReceipt.wireSha256,
      lifecycleGeneration: remote.activeReceipt.selection.generation,
    },
    manifest: remote.manifest,
  };
  const observation: ActiveRuntimeObservation = {
    ...observationWithoutHash,
    sourceHash: sha256(JSON.stringify(observationWithoutHash)),
  };
  const state = immutableWrite(outputPath, observation);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    sourceHash: observation.sourceHash,
    activeRelease: observation.activeRelease,
    manifestPath: observation.manifest.path,
    fileCount: observation.manifest.fileCount,
  }, null, 2)}\n`);
}

main();
