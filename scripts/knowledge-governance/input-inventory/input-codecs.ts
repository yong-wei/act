import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { matchGlob, type Registry } from './registry';
import { normalizePath, normalizeText, sortUnique, taggedDigest } from './normalize';
import type { Drift, Json } from './types';

export interface InputLocation {
  path: string;
  source_root: 'isolated-worktree' | 'main-worktree';
  filesystem_root: string;
  capture_revision: string;
  vcs_state: 'tracked' | 'staged-added' | 'ignored' | 'untracked';
  absence_reason?: string;
  isolated_path_state?: 'symbolic-link';
  replacement_target_source_root?: 'main-worktree';
  replacement_target_path?: string;
  replacement_target_type?: 'regular-file';
}

export interface FileObservation extends InputLocation {
  state: 'observed' | 'invalid';
  codec: string;
  media_type: string;
  size: number;
  raw_digest: string;
  normalized_digest?: string;
  error_code?: string;
  error_detail?: string;
  content_bytes?: Buffer;
}

function listed(root: string, args: string[]): Set<string> {
  const result = spawnSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed while classifying inventory inputs`);
  return new Set(result.stdout.toString('utf8').split('\0').filter(Boolean).map(normalizePath));
}

function states(root: string): Map<string, InputLocation['vcs_state']> {
  const output = new Map<string, InputLocation['vcs_state']>();
  for (const item of listed(root, ['ls-files', '-z'])) output.set(item, 'staged-added');
  for (const item of listed(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'])) output.set(item, 'ignored');
  for (const item of listed(root, ['ls-files', '--others', '--exclude-standard', '-z'])) output.set(item, 'untracked');
  return output;
}

interface CodecRule {
  id: string;
  media_type: string;
  include: string[];
  kind: 'text' | 'binary';
  disposition: 'observed' | 'invalid-unclassified';
  signature?: 'png' | 'pdf';
}

function codecRules(registry: Registry): CodecRule[] {
  const contract = registry.repository_codec_contract;
  const rules = contract?.codecs;
  if (!contract || contract.unknown_codec !== 'invalid' || !Array.isArray(rules)) throw new Error('registry repository_codec_contract must be closed and reject unknown codecs');
  return rules.map((item) => {
    const rule = item as Record<string, unknown>;
    if (typeof rule.id !== 'string' || typeof rule.media_type !== 'string' || !Array.isArray(rule.include) || !['text', 'binary'].includes(String(rule.kind))) throw new Error('invalid repository codec rule');
    if (rule.disposition !== undefined && !['observed', 'invalid-unclassified'].includes(String(rule.disposition))) throw new Error('invalid repository codec disposition');
    return { id: rule.id, media_type: rule.media_type, include: rule.include.map(String), kind: rule.kind as 'text' | 'binary', disposition: (rule.disposition ?? 'observed') as CodecRule['disposition'], signature: rule.signature as CodecRule['signature'] };
  });
}

function signatureValid(bytes: Buffer, signature: CodecRule['signature']): boolean {
  if (signature === 'png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (signature === 'pdf') return bytes.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'));
  return true;
}

export async function observeInput(location: InputLocation, registry: Registry, drift: Drift[], trackedBlob?: Buffer | null): Promise<FileObservation> {
  const logicalPath = normalizePath(location.path);
  let bytes: Buffer;
  try {
    if (location.vcs_state === 'tracked') {
      if (trackedBlob === null) throw Object.assign(new Error('tracked revision blob unavailable'), { code: 'GIT_BLOB_UNAVAILABLE' });
      if (trackedBlob !== undefined) bytes = trackedBlob;
      else {
        const result = spawnSync('git', ['show', `${location.capture_revision}:${logicalPath}`], { cwd: location.filesystem_root, encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
        if (result.status !== 0) throw Object.assign(new Error('tracked revision blob unavailable'), { code: 'GIT_BLOB_UNAVAILABLE' });
        bytes = result.stdout;
      }
    } else bytes = await readFile(path.join(location.filesystem_root, logicalPath));
  }
  catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    const detail = `input read failed (${errorCode})`;
    drift.push({ code: 'INPUT_READ_FAILED', scope: logicalPath, observed: location.source_root, detail });
    return { ...location, path: logicalPath, state: 'invalid', codec: 'unreadable', media_type: 'application/octet-stream', size: 0, raw_digest: taggedDigest('unreadable-input/v1', `${location.source_root}:${logicalPath}`), error_code: 'INPUT_READ_FAILED', error_detail: detail };
  }
  const rawDigest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const matches = codecRules(registry).filter((rule) => rule.include.some((glob) => matchGlob(logicalPath, glob)));
  if (matches.length !== 1) {
    const code = matches.length === 0 ? 'UNKNOWN_INPUT_CODEC' : 'AMBIGUOUS_INPUT_CODEC';
    drift.push({ code, scope: logicalPath, expected: 1, observed: matches.map((rule) => rule.id) });
    return { ...location, path: logicalPath, state: 'invalid', codec: matches.length === 0 ? 'unknown' : matches.map((rule) => rule.id).join('+'), media_type: 'application/octet-stream', size: bytes.byteLength, raw_digest: rawDigest, error_code: code };
  }
  const codec = matches[0]!;
  if (codec.disposition === 'invalid-unclassified') {
    drift.push({ code: 'UNCLASSIFIED_INPUT_CODEC', scope: logicalPath, expected: 'semantic repository input', observed: codec.id });
    return { ...location, path: logicalPath, state: 'invalid', codec: codec.id, media_type: codec.media_type, size: bytes.byteLength, raw_digest: rawDigest, error_code: 'UNCLASSIFIED_INPUT_CODEC' };
  }
  if (!signatureValid(bytes, codec.signature)) {
    drift.push({ code: 'INVALID_MEDIA_SIGNATURE', scope: logicalPath, expected: codec.signature!, observed: rawDigest });
    return { ...location, path: logicalPath, state: 'invalid', codec: codec.id, media_type: codec.media_type, size: bytes.byteLength, raw_digest: rawDigest, error_code: 'INVALID_MEDIA_SIGNATURE' };
  }
  if (codec.kind === 'binary') return { ...location, path: logicalPath, state: 'observed', codec: codec.id, media_type: codec.media_type, size: bytes.byteLength, raw_digest: rawDigest, content_bytes: bytes };
  try {
    const normalized = normalizeText(bytes);
    return { ...location, path: logicalPath, state: 'observed', codec: codec.id, media_type: codec.media_type, size: bytes.byteLength, raw_digest: rawDigest, normalized_digest: taggedDigest('repository-text-file/v1', normalized), content_bytes: bytes };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    drift.push({ code: 'TEXT_NORMALIZATION_FAILED', scope: logicalPath, observed: rawDigest, detail });
    return { ...location, path: logicalPath, state: 'invalid', codec: codec.id, media_type: codec.media_type, size: bytes.byteLength, raw_digest: rawDigest, error_code: 'TEXT_NORMALIZATION_FAILED', error_detail: detail };
  }
}

export function parseGitBatchBlobs(paths: string[], output: Buffer): Map<string, Buffer | null> {
  const ordered = sortUnique(paths.map(normalizePath));
  const blobs = new Map<string, Buffer | null>();
  let offset = 0;
  for (const relative of ordered) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('truncated git cat-file batch header');
    const header = output.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    if (header.endsWith(' missing')) { blobs.set(relative, null); continue; }
    const match = /^[0-9a-f]{40,64} blob (\d+)$/u.exec(header);
    if (!match) throw new Error('invalid git cat-file batch header');
    const size = Number(match[1]);
    if (!Number.isSafeInteger(size) || size < 0 || offset + size >= output.length) throw new Error('truncated git cat-file batch blob');
    blobs.set(relative, Buffer.from(output.subarray(offset, offset + size)));
    offset += size + 1;
    if (output[offset - 1] !== 0x0a) throw new Error('invalid git cat-file batch blob delimiter');
  }
  if (offset !== output.length) throw new Error('unexpected trailing git cat-file batch output');
  return blobs;
}

function trackedBlobs(root: string, revision: string, paths: string[]): Map<string, Buffer | null> {
  const ordered = sortUnique(paths.map(normalizePath));
  const blobs = new Map<string, Buffer | null>();
  for (let offset = 0; offset < ordered.length; offset += 128) {
    const chunk = ordered.slice(offset, offset + 128);
    const specs = chunk.map((relative) => `${revision}:${relative}`);
    const result = spawnSync('git', ['cat-file', '--batch'], { cwd: root, input: Buffer.from(`${specs.join('\n')}\n`), encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
    if (result.status !== 0) { chunk.forEach((relative) => blobs.set(relative, null)); continue; }
    try { for (const [relative, bytes] of parseGitBatchBlobs(chunk, result.stdout)) blobs.set(relative, bytes); }
    catch { chunk.forEach((relative) => blobs.set(relative, null)); }
  }
  return blobs;
}

export async function collectInputObservations(input: {
  isolatedRoot: string;
  isolatedRevision: string;
  isolatedPaths: string[];
  mainRoot?: string;
  mainRevision?: string;
  mainPaths?: string[];
  isolatedSymlinkReplacements?: string[];
}, registry: Registry, drift: Drift[]): Promise<FileObservation[]> {
  const isolatedPaths = new Set(input.isolatedPaths.map(normalizePath));
  const symlinkReplacements = new Set((input.isolatedSymlinkReplacements ?? []).map(normalizePath));
  const isolatedStates = states(input.isolatedRoot);
  const isolatedRevisionBlobs = trackedBlobs(input.isolatedRoot, input.isolatedRevision, [...isolatedPaths]);
  const locations: InputLocation[] = sortUnique([...isolatedPaths]).map((relative) => ({ path: relative, source_root: 'isolated-worktree', filesystem_root: input.isolatedRoot, capture_revision: input.isolatedRevision, vcs_state: isolatedRevisionBlobs.get(relative) !== null ? 'tracked' : isolatedStates.get(relative) ?? 'untracked' }));
  const blobCaches = new Map<string, Map<string, Buffer | null>>([[`${input.isolatedRoot}\0${input.isolatedRevision}`, isolatedRevisionBlobs]]);
  if (input.mainRoot && input.mainRevision) {
    const mainStates = states(input.mainRoot);
    const mainPaths = sortUnique((input.mainPaths ?? []).map(normalizePath));
    const mainRevisionBlobs = trackedBlobs(input.mainRoot, input.mainRevision, mainPaths);
    blobCaches.set(`${input.mainRoot}\0${input.mainRevision}`, mainRevisionBlobs);
    for (const relative of mainPaths) locations.push({
      path: relative,
      source_root: 'main-worktree',
      filesystem_root: input.mainRoot,
      capture_revision: input.mainRevision,
      vcs_state: mainRevisionBlobs.get(relative) !== null ? 'tracked' : mainStates.get(relative) ?? 'untracked',
      ...(symlinkReplacements.has(relative)
        ? {
            absence_reason: 'ISOLATED_SYMLINK_REPLACED_BY_AUTHORIZED_MAIN_WORKTREE_SAME_PATH_REGULAR_FILE',
            isolated_path_state: 'symbolic-link',
            replacement_target_source_root: 'main-worktree',
            replacement_target_path: relative,
            replacement_target_type: 'regular-file',
          }
        : isolatedPaths.has(relative) ? {} : { absence_reason: 'NOT_PRESENT_IN_ISOLATED_WORKTREE' }),
    });
  }
  const observedWithDrift: Array<{ observation: FileObservation; drift: Drift[] }> = [];
  for (const location of locations) {
    const observationDrift: Drift[] = [];
    const cache = blobCaches.get(`${location.filesystem_root}\0${location.capture_revision}`);
    observedWithDrift.push({ observation: await observeInput(location, registry, observationDrift, cache ? cache.get(location.path) ?? null : undefined), drift: observationDrift });
  }
  const observations = observedWithDrift.map((item) => item.observation);
  const byPath = new Map<string, FileObservation[]>();
  for (const observation of observations) byPath.set(observation.path, [...(byPath.get(observation.path) ?? []), observation]);
  for (const [relative, records] of byPath) {
    const isolated = records.find((item) => item.source_root === 'isolated-worktree');
    const main = records.find((item) => item.source_root === 'main-worktree');
    if (isolated && main && isolated.raw_digest !== main.raw_digest) drift.push({ code: 'SAME_PATH_CONTENT_DRIFT', scope: relative, expected: { source_root: isolated.source_root, raw_digest: isolated.raw_digest }, observed: { source_root: main.source_root, raw_digest: main.raw_digest } });
  }
  const retained = observations.filter((record) => {
    if (record.source_root !== 'main-worktree') return true;
    const isolated = byPath.get(record.path)?.find((item) => item.source_root === 'isolated-worktree');
    return !isolated || isolated.raw_digest !== record.raw_digest;
  });
  const retainedKeys = new Set(retained.map((item) => `${item.source_root}:${item.path}`));
  for (const item of observedWithDrift) if (retainedKeys.has(`${item.observation.source_root}:${item.observation.path}`)) drift.push(...item.drift);
  return retained;
}

export function observationDigest(observation: FileObservation): string {
  return observation.normalized_digest ?? observation.raw_digest;
}

export function publicObservation(observation: FileObservation): Record<string, Json> {
  const { filesystem_root: _filesystemRoot, content_bytes: _contentBytes, ...result } = observation;
  return result as unknown as Record<string, Json>;
}
