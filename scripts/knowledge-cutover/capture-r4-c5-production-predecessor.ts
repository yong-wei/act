#!/usr/bin/env tsx
/**
 * Capture the complete live predecessor for the r4 coordinated cutover.
 * This is read-only evidence: Authority remains a host pointer while the five
 * Runtime selectors are part of the active immutable blob view.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLISHER_ENV = '/Users/YW/.config/act/publisher-env.zsh';
const HOST = 'root@121.40.124.135';
const DEFAULT_OUT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5/production-predecessor.json';

type Wire = { readonly sha256: string; readonly value: unknown };

type RuntimeLifecycleIdentity = {
  readonly schemaVersion: 'runtime-blob-release-identity.v1';
  readonly releaseId: string;
  readonly manifestVersion: 'act-runtime-release.v2';
  readonly manifestSha256: string;
  readonly manifestWireSha256: string;
  readonly manifestWireSizeBytes: number;
  readonly treeSha256: string;
};

const RUNTIME_LIFECYCLE_IDENTITY_KEYS = [
  'schemaVersion', 'releaseId', 'manifestVersion', 'manifestSha256',
  'manifestWireSha256', 'manifestWireSizeBytes', 'treeSha256',
] as const;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(message: string): never {
  throw new Error(`capture-r4-c5-production-predecessor: ${message}`);
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a path`);
  return value;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function exactKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (actual.join('\u0000') !== [...keys].sort().join('\u0000')) fail(`${label} has an unexpected shape`);
  return value as Record<string, unknown>;
}

function requireDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail(`${label} must be a SHA-256 digest`);
}

function requireRuntimeLifecycleIdentity(value: unknown, label: string): RuntimeLifecycleIdentity {
  const identity = exactKeys(value, RUNTIME_LIFECYCLE_IDENTITY_KEYS, label);
  if (identity.schemaVersion !== 'runtime-blob-release-identity.v1'
    || identity.manifestVersion !== 'act-runtime-release.v2'
    || typeof identity.releaseId !== 'string'
    || !identity.releaseId.startsWith('runtime-')
    || !Number.isInteger(identity.manifestWireSizeBytes)
    || (identity.manifestWireSizeBytes as number) < 1) {
    fail(`${label} is not a valid Runtime lifecycle identity`);
  }
  requireDigest(identity.manifestSha256, `${label}.manifestSha256`);
  requireDigest(identity.manifestWireSha256, `${label}.manifestWireSha256`);
  requireDigest(identity.treeSha256, `${label}.treeSha256`);
  return identity as RuntimeLifecycleIdentity;
}

function remoteProgram(): string {
  return [
    'const fs=require("node:fs/promises");const cp=require("node:child_process");const crypto=require("node:crypto");',
    'const sha=(v)=>crypto.createHash("sha256").update(v).digest("hex");',
    'async function read(p){const w=await fs.readFile(p);return {sha256:sha(w),value:JSON.parse(w.toString("utf8"))};}',
    'async function main(){const root="/home/projects/act";const view=root+"/data/runtime/blob-views/current/knowledge";',
    'const lifecycle=JSON.parse(cp.execFileSync("python3",[root+"/scripts/runtime-release/runtime-blob-release-lifecycle.py","inspect","--state-dir",root+"/data/runtime"],{encoding:"utf8"}));',
    'const activeReceipt=await read(root+"/data/runtime/act-runtime-active-receipt.json");const selectors={authority:await read(root+"/course-content/authoring/knowledge/authority/current.json"),projection:await read(view+"/projection/current.json"),prerequisite:await read(view+"/prerequisites/current.json"),catalog:await read(view+"/authority-domain-catalog/current.json"),shards:await read(view+"/authority-domain-shards/current.json"),consumerActivation:await read(view+"/consumer-activation/current.json")};',
    'let transaction=null;try{transaction=await read(root+"/course-content/authoring/knowledge/authority/production-cutover-transactions/current.json");}catch(e){if(e&&e.code!=="ENOENT")throw e;}',
    'process.stdout.write(JSON.stringify({lifecycle,activeReceipt,selectors,transaction}));}',
    'main().catch((e)=>{console.error(e.stack||String(e));process.exit(1);});',
  ].join('');
}

function readRemote(): { lifecycle: Record<string, unknown>; activeReceipt: Wire; selectors: Record<string, Wire>; transaction: Wire | null } {
  const encoded = Buffer.from(remoteProgram()).toString('base64');
  const command = [
    `source ${PUBLISHER_ENV} >/dev/null`,
    `printf %s ${encoded} | ssh -o BatchMode=yes -o UserKnownHostsFile=\"$ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE\" -o StrictHostKeyChecking=yes ${HOST} 'base64 -d | node -'`,
  ].join('; ');
  const output = execFileSync('/bin/zsh', ['-lc', command], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const value = JSON.parse(output) as { lifecycle: Record<string, unknown>; activeReceipt: Wire; selectors: Record<string, Wire>; transaction: Wire | null };
  if (!value || !value.lifecycle || !value.activeReceipt || !value.selectors) fail('remote observation is incomplete');
  return value;
}

function validate(
  value: { lifecycle: Record<string, unknown>; activeReceipt: Wire; selectors: Record<string, Wire>; transaction: Wire | null },
  allowStagedDesired: boolean,
) {
  const lifecycle = exactKeys(value.lifecycle, [
    'active', 'desired', 'generation', 'publishing', 'retained', 'rollback', 'schemaVersion', 'transactionId',
  ], 'Runtime lifecycle');
  if (lifecycle.schemaVersion !== 'runtime-blob-release-lifecycle.v2'
    || typeof lifecycle.transactionId !== 'string'
    || !/^[a-f0-9]{32}$/u.test(lifecycle.transactionId)
    || !Array.isArray(lifecycle.publishing)
    || !Array.isArray(lifecycle.retained)) {
    fail('Runtime lifecycle is invalid');
  }
  const active = requireRuntimeLifecycleIdentity(lifecycle.active, 'lifecycle.active');
  if (!Number.isInteger(lifecycle.generation) || (lifecycle.generation as number) < 1) fail('lifecycle generation is invalid');
  if (lifecycle.publishing === undefined || (!allowStagedDesired && lifecycle.desired !== null)) {
    fail('Runtime lifecycle is not idle');
  }
  if (allowStagedDesired && lifecycle.desired !== null) {
    requireRuntimeLifecycleIdentity(lifecycle.desired, 'lifecycle.desired');
  }
  requireDigest(value.activeReceipt.sha256, 'active Runtime receipt');
  const receipt = exactKeys(value.activeReceipt.value, ['healthCheck', 'schemaVersion', 'selection'], 'active Runtime receipt');
  const selection = exactKeys(receipt.selection, ['generation', 'manifestSha256', 'releaseId', 'schemaVersion', 'treeSha256'], 'active Runtime selection');
  if (receipt.schemaVersion !== 'runtime-release-active-receipt.v1' || receipt.healthCheck !== 'readyz'
    || selection.schemaVersion !== 'runtime-release-selection.v1'
    || selection.releaseId !== active.releaseId
    || selection.manifestSha256 !== active.manifestSha256
    || selection.treeSha256 !== active.treeSha256
    || !Number.isInteger(selection.generation)) fail('active Runtime receipt does not match lifecycle identity');
  if (value.transaction !== null) fail('a production authority transaction is already present');
  const authority = exactKeys(value.selectors.authority?.value, ['activationReceiptId', 'activatedAt', 'contract', 'releaseId', 'releaseSetId', 'snapshotHash', 'snapshotId'], 'Authority current');
  if (authority.contract !== 'actkg-engineering-authority-current/v1' || authority.releaseId !== 'ctr:release:control-theory-engineering-v0.22') {
    fail('Authority current is not the expected v0.22 predecessor');
  }
  for (const [name, wire] of Object.entries(value.selectors)) {
    requireDigest(wire?.sha256, `${name} selector wire`);
    if (!wire?.value || typeof wire.value !== 'object') fail(`${name} selector is invalid`);
    const releaseId = (wire.value as Record<string, unknown>).releaseId
      ?? (wire.value as Record<string, unknown>).authorityReleaseId;
    if (name !== 'consumerActivation' && releaseId !== 'ctr:release:control-theory-engineering-v0.22') {
      fail(`${name} selector is not bound to v0.22`);
    }
  }
  const consumer = value.selectors.consumerActivation.value as Record<string, unknown>;
  if (consumer.activationId !== 'v022-cutover-9c4b2c1c2c97-1ab3029ae058') fail('consumer selector is not the captured v0.22 predecessor');
}

function immutableWrite(out: string, value: unknown): void {
  const target = path.resolve(ROOT, out);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(bytes)) fail(`refusing to overwrite ${out}`);
  if (!existsSync(target)) writeFileSync(target, bytes);
}

function main(): void {
  fail('Runtime lifecycle inspect 已退役。知识合同通过后请使用 npm run runtime:activate');
  const out = argument('--out', DEFAULT_OUT);
  const allowStagedDesired = flag('--allow-staged-desired');
  const remote = readRemote();
  validate(remote, allowStagedDesired);
  const active = requireRuntimeLifecycleIdentity(remote.lifecycle.active, 'lifecycle.active');
  const result = {
    contract: 'r4-production-predecessor-observation/v1',
    capturedAt: new Date().toISOString(),
    runtime: {
      ...active,
      activeReceiptHash: remote.activeReceipt.sha256,
      lifecycleGeneration: remote.lifecycle.generation,
    },
    stagedDesired: remote.lifecycle.desired,
    lifecycle: remote.lifecycle,
    selectors: remote.selectors,
    observationHash: '',
  };
  const { observationHash: ignored, ...hashInput } = result;
  void ignored;
  immutableWrite(out, { ...result, observationHash: sha256(JSON.stringify(hashInput)) });
  process.stdout.write(`${path.resolve(ROOT, out)}\n`);
}

main();
