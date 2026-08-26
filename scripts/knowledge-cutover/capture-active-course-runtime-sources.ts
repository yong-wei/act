#!/usr/bin/env tsx
/**
 * Capture only the active-course JSON sources needed for atomic re-binding.
 * Content comes from the mounted production Runtime and is verified against
 * the previously sealed Runtime manifest before it enters the candidate.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const OBLIGATIONS = `${CANDIDATE_ROOT}/active-baseline/baseline-continuity-obligations.json`;
const RUNTIME_OBSERVATION = `${CANDIDATE_ROOT}/active-baseline/production-runtime-observation.json`;
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/production-active-course-sources.json`;
const PUBLISHER_ENV = '/Users/YW/.config/act/publisher-env.zsh';
const PRODUCTION_HOST = 'root@121.40.124.135';
const PRODUCTION_CONTAINER = 'act-obe-app';

interface ObligationArtifact {
  readonly baselineHash: string;
  readonly entries: readonly { readonly resourceId: string; readonly obligation: string }[];
}

interface RuntimeObservation {
  readonly activeRelease: { readonly releaseId: string; readonly manifestSha256: string };
  readonly manifest: { readonly files: readonly { readonly path: string; readonly sha256: string }[] };
}

interface RemoteSource {
  readonly path: string;
  readonly sha256: string;
  readonly contentBase64: string;
}

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8')) as T;
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite divergent production source capture ${relativePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function activeRuntimePath(resourceId: string): string | null {
  const step = /^act:step:([^:]+):[^:]+$/u.exec(resourceId);
  if (step) return `lessons/${step[1]}/interactive-manifest.json`;
  const lesson = /^act:lesson:([^:]+)$/u.exec(resourceId);
  return lesson ? `lessons/${lesson[1]}/lesson.json` : null;
}

function readRemoteSources(paths: readonly string[]): RemoteSource[] {
  const encodedPaths = Buffer.from(JSON.stringify(paths)).toString('base64');
  const remoteProgram = [
    'const fs=require("node:fs/promises");',
    'const crypto=require("node:crypto");',
    `const paths=JSON.parse(Buffer.from("${encodedPaths}","base64").toString("utf8"));`,
    'const hash=(b)=>crypto.createHash("sha256").update(b).digest("hex");',
    'async function main(){const root="/app/course-content/runtime";const files=[];for(const p of paths){if(!/^lessons\\/[^/]+\\/(lesson|interactive-manifest)\\.json$/.test(p))throw new Error("unsafe path");const b=await fs.readFile(root+"/"+p);files.push({path:p,sha256:hash(b),contentBase64:b.toString("base64")});}process.stdout.write(JSON.stringify(files));}',
    'main().catch((error)=>{console.error(error.stack||String(error));process.exit(1);});',
  ].join('');
  const encodedProgram = Buffer.from(remoteProgram).toString('base64');
  const command = [
    `source ${PUBLISHER_ENV} >/dev/null`,
    `printf %s ${encodedProgram} | ssh -o BatchMode=yes -o UserKnownHostsFile=\"$ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE\" ${PRODUCTION_HOST} "base64 -d | podman exec -i ${PRODUCTION_CONTAINER} node -"`,
  ].join('; ');
  return JSON.parse(execFileSync('/bin/zsh', ['-lc', command], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })) as RemoteSource[];
}

function main(): void {
  const outputPath = argValue('--out', DEFAULT_OUTPUT);
  const obligations = readJson<ObligationArtifact>(OBLIGATIONS);
  const observation = readJson<RuntimeObservation>(RUNTIME_OBSERVATION);
  const paths = [...new Set(obligations.entries
    .filter((entry) => entry.obligation === 'FORMAL_TEACHING')
    .map((entry) => activeRuntimePath(entry.resourceId))
    .filter((value): value is string => value !== null))].sort();
  const expectedByPath = new Map(observation.manifest.files.map((file) => [file.path, file.sha256]));
  const files = readRemoteSources(paths).sort((left, right) => left.path.localeCompare(right.path));
  if (files.length !== paths.length || new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error('production source capture is incomplete or repeats a path');
  }
  for (const file of files) {
    const content = Buffer.from(file.contentBase64, 'base64');
    if (sha256(content) !== file.sha256 || expectedByPath.get(file.path) !== file.sha256) {
      throw new Error(`production source capture drift for ${file.path}`);
    }
    JSON.parse(content.toString('utf8'));
  }
  const body = {
    contract: 'production-active-course-source-capture/v1' as const,
    baselineHash: obligations.baselineHash,
    activeRelease: observation.activeRelease,
    files,
  };
  const artifact = { ...body, sourceHash: sha256(JSON.stringify(body)) };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({ outputPath, state, sourceHash: artifact.sourceHash, fileCount: files.length }, null, 2)}\n`);
}

main();
