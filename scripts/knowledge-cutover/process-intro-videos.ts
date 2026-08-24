#!/usr/bin/env tsx
/**
 * Task family 3 (#1515): run the intro-video processor over every released
 * intro video in the ACT runtime media directories, using the Videos
 * project's generated caption cues as the production script truth. The mp4
 * content hash is the resource identity (course-owner ruling 2026-08-24:
 * the released/OSS state is authoritative; a changed hash means a new
 * identity and an incremental rebinding).
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import {
  processIntroVideoResource,
  type GeneratedCaptionsModule,
  type IntroVideoInventoryEntry,
} from '@/lib/formal-resource-remediation/processors/intro-video';

const ROOT = process.cwd();
const MEDIA_ROOT = 'course-content/runtime/lessons';
const VIDEOS_PROJECT = '/Users/YW/Documents/Project/Videos';
const OUT_DIR = 'course-content/authoring/knowledge/formal-resource-remediation/resource-layer/intro-videos';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function writeDeterministicJson(filePath: string, value: unknown): 'created' | 'skipped' {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function probeDurationSeconds(filePath: string): number {
  const output = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', absolute(filePath),
  ], { encoding: 'utf8' });
  return Number.parseFloat(output.trim());
}

async function loadCaptions(unit: string): Promise<GeneratedCaptionsModule | null> {
  const modulePath = path.join(VIDEOS_PROJECT, 'src', 'projects', `lesson-${unit}`, 'assets', 'audio', 'captions.generated.ts');
  if (!existsSync(modulePath)) return null;
  const loaded = await import(modulePath) as GeneratedCaptionsModule;
  return loaded;
}

async function loadWiring(unit: string): Promise<{ INTRO_FRAMES?: number; OUTRO_FRAMES?: number; FPS?: number }> {
  const wiringPath = path.join(VIDEOS_PROJECT, 'src', 'projects', `lesson-${unit}`, 'captions.ts');
  if (!existsSync(wiringPath)) return {};
  return await import(wiringPath) as { INTRO_FRAMES?: number; OUTRO_FRAMES?: number; FPS?: number };
}

async function main(): Promise<void> {
  const allocation = JSON.parse(readFileSync(absolute(ALLOCATION_PATH), 'utf8')) as { allocationHash: string };
  const units = readdirSync(absolute(MEDIA_ROOT)).filter((name) => existsSync(absolute(`${MEDIA_ROOT}/${name}/media`))).sort();
  const records: ResourceProcessingRecord[] = [];
  const atoms: unknown[] = [];
  const inventory: { unit: string; videoPath: string; videoSha256: string; durationSeconds: number }[] = [];
  const exclusions: { unit: string; reason: string }[] = [];
  for (const unit of units) {
    const videoPath = `${MEDIA_ROOT}/${unit}/media/${unit}-intro-video.mp4`;
    const video: IntroVideoInventoryEntry | null = existsSync(absolute(videoPath))
      ? { unit, videoPath, videoSha256: sha256File(videoPath), durationSeconds: probeDurationSeconds(videoPath) }
      : null;
    if (video) inventory.push(video);
    const captions = await loadCaptions(unit);
    const wiring = await loadWiring(unit);
    const fps = wiring.FPS ?? 30;
    const introOffsetSeconds = (wiring.INTRO_FRAMES ?? 0) / fps;
    let durationClosureDeltaSeconds: number | null = null;
    if (video && captions?.captions?.length) {
      const narration = captions.narrationDurationSeconds ?? captions.captions[captions.captions.length - 1].end;
      const outro = (wiring.OUTRO_FRAMES ?? 0) / fps;
      durationClosureDeltaSeconds = Math.abs(video.durationSeconds - (narration + introOffsetSeconds + outro));
    }
    const result = processIntroVideoResource({ unit, video, captions, introOffsetSeconds, durationClosureDeltaSeconds });
    for (const atom of result.atoms) atoms.push(atom);
    if (result.excludedReason) exclusions.push({ unit, reason: result.excludedReason });
    records.push({
      contract: 'resource-processing-record/v1',
      recordId: `rec-${projectionDigest({ resourceId: result.resourceId, sourceSha: video?.videoSha256 ?? 'none' }).slice(0, 24)}`,
      allocationHash: allocation.allocationHash,
      resourceId: result.resourceId,
      resourceSubtype: 'intro-video',
      origin: 'ACTIVE_BASELINE',
      sourceIdentity: video ? `content:${video.videoSha256}` : 'content:none',
      externalInputId: video ? `videos:lesson-${unit}:released-intro-video` : null,
      processorIdentity: 'videos-importer/v1-released-state',
      validatorIdentity: 'remediation-validator/v1',
      atomOutputIds: result.atoms.map((atom) => atom.atomId),
      mappingOutputIds: [],
      anchorOutputIds: result.atoms.map((atom) => `${result.resourceId}#cue-${atom.cueIndex}`),
      launchOutputIds: result.atoms.map((atom) => `${result.resourceId}#cue-${atom.cueIndex}`),
      disposition: result.excludedReason ? 'EXCLUDED' : 'INCLUDED',
      failureCodes: result.excludedReason ? ['missing-source'] : [],
      limitations: result.limitations,
      outputManifestHash: result.outputManifestHash,
    });
  }
  const included = records.filter((record) => record.disposition === 'INCLUDED');
  if (included.length === 0) throw new Error('no intro video resolved to INCLUDED; refusing to seal an empty run');
  const summary = {
    contract: 'remediation-intro-video-run/v1',
    allocationHash: allocation.allocationHash,
    unitCount: records.length,
    includedCount: included.length,
    excludedCount: records.length - included.length,
    atomCount: atoms.length,
    runHash: projectionDigest({ records: records.map((record) => record.recordId), atoms: atoms.length }),
  };
  const states = {
    inventory: writeDeterministicJson(`${OUT_DIR}/intro-video-inventory.json`, inventory),
    records: writeDeterministicJson(`${OUT_DIR}/intro-video-processing-records.json`, records),
    atoms: writeDeterministicJson(`${OUT_DIR}/intro-video-atoms.json`, atoms),
    exclusions: writeDeterministicJson(`${OUT_DIR}/intro-video-exclusions.json`, exclusions),
    summary: writeDeterministicJson(`${OUT_DIR}/intro-video-run-summary.json`, summary),
  };
  console.log(JSON.stringify({ ...summary, states }, null, 2));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
