#!/usr/bin/env tsx
/**
 * Task 11.6 (#1515): replay evidence. A deterministic clean replay reruns the
 * end-to-end seal over the sealed corpus (every identity must recompute and
 * no artifact may diverge), and a bounded single-input incremental replay
 * exercises the allocation-rebind path over the real ASR records and hotword
 * manifests: only allocation-bound fields move, every content field stays
 * byte-identical. Timing, reuse, invalidation, and semantic hashes recorded.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  rebindHotwordManifestsToAllocation,
  rebindProcessingRecordsToAllocation,
} from '@/lib/formal-resource-remediation/envelope';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const ASR_BATCH = `${REMEDIATION_ROOT}/20260823-asr-batch`;
const SEAL_SCRIPT = 'scripts/knowledge-cutover/seal-remediation-handoff.ts';
const OUT_PATH = `${REMEDIATION_ROOT}/replay-evidence.json`;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, filePath), 'utf8')) as T;
}

function fileSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(path.join(ROOT, filePath))).digest('hex');
}

async function main(): Promise<void> {
  // 1. Deterministic clean replay: rerun the end-to-end seal script. It must
  // pass all checks and skip both writes (artifacts identical).
  const cleanStart = performance.now();
  const { stdout } = await execFileAsync('tsx', [SEAL_SCRIPT], { cwd: ROOT });
  const cleanDurationMs = Math.round(performance.now() - cleanStart);
  const sealOutput = JSON.parse(stdout.slice(stdout.indexOf('{'))) as {
    state: string;
    checks: { name: string; passed: boolean }[];
    allPassed: boolean;
    handoff: { handoffId: string; state: string };
    reportState: string;
  };
  if (!sealOutput.allPassed) throw new Error('clean replay failed a check');
  if (sealOutput.handoff.state !== 'skipped' || sealOutput.reportState !== 'skipped') {
    throw new Error('clean replay diverged from the sealed artifacts');
  }

  // 2. Bounded single-input incremental replay: move the real ASR records and
  // hotword manifests to a hypothetical successor allocation. Only the
  // allocation-bound fields may change.
  const NEW_ALLOCATION_HASH = projectionDigest({ replay: 'incremental-allocation-rebind', successorOf: '92fe43d66a8e0b668edeeebc6b7eac20652c0387aae8ef5d3c5489c4daefbbfd' });
  const asrRecords = readJson<ResourceProcessingRecord[]>(`${ASR_BATCH}/asr-processing-records.json`);
  const hotwordManifests = readJson<Parameters<typeof rebindHotwordManifestsToAllocation>[0][number][]>(`${ASR_BATCH}/hotword-manifests.json`);
  const incrementalStart = performance.now();
  const reboundRecords = rebindProcessingRecordsToAllocation(asrRecords, NEW_ALLOCATION_HASH);
  const reboundManifests = rebindHotwordManifestsToAllocation(hotwordManifests, NEW_ALLOCATION_HASH, (manifest, allocationHash) => projectionDigest({
    allocationHash,
    resourceId: manifest.resourceId,
    sourceResourceId: manifest.sourceResourceId,
    sourceContentSha256: manifest.sourceContentSha256,
    locale: manifest.locale,
    extractorVersion: manifest.extractorVersion,
    extractorConfigDigest: manifest.extractorConfigDigest,
    terminologyRegistryId: manifest.terminologyRegistryId,
    entries: manifest.entries,
    exclusions: manifest.exclusions,
  }));
  const incrementalDurationMs = Math.round(performance.now() - incrementalStart);

  const recordContentStable = reboundRecords.every((record, index) => {
    const before = { ...asrRecords[index] } as Record<string, unknown>;
    const after = { ...record } as Record<string, unknown>;
    delete before.allocationHash;
    delete after.allocationHash;
    return JSON.stringify(before) === JSON.stringify(after) && record.allocationHash === NEW_ALLOCATION_HASH;
  });
  const manifestContentStable = reboundManifests.every((manifest, index) => {
    const before = { ...hotwordManifests[index] } as Record<string, unknown>;
    const after = { ...manifest } as Record<string, unknown>;
    for (const key of ['allocationHash', 'manifestHash', 'manifestId']) {
      delete before[key];
      delete after[key];
    }
    return JSON.stringify(before) === JSON.stringify(after)
      && manifest.allocationHash === NEW_ALLOCATION_HASH
      && manifest.manifestId === `hw-${manifest.manifestHash.slice(0, 24)}`
      && manifest.manifestHash !== hotwordManifests[index].manifestHash;
  });
  const recordIdsReused = reboundRecords.every((record, index) => record.recordId === asrRecords[index].recordId);

  const semanticHashes = {
    allocationHash: '92fe43d66a8e0b668edeeebc6b7eac20652c0387aae8ef5d3c5489c4daefbbfd',
    handoffHash: readJson<{ handoffHash: string }>(`${REMEDIATION_ROOT}/remediation-handoff.json`).handoffHash,
    envelopeHash: readJson<{ envelopeHash: string }>(`${REMEDIATION_ROOT}/resource-envelope.json`).envelopeHash,
    projectionHash: readJson<{ projectionHash: string }>(`${REMEDIATION_ROOT}/teaching-projection/projection.json`).projectionHash,
    totalClosureReceiptSha256: fileSha256(`${REMEDIATION_ROOT}/total-closure-receipt.json`),
  };

  const report = {
    contract: 'remediation-replay-evidence/v1',
    sealedAt: '2026-08-25',
    cleanReplay: {
      command: `tsx ${SEAL_SCRIPT}`,
      durationMs: cleanDurationMs,
      checksPassed: sealOutput.checks.length,
      writes: 'skipped (handoff and report byte-identical to the sealed artifacts)',
      derivedState: sealOutput.state,
    },
    incrementalReplay: {
      scenario: 'single-input allocation rebind over the real ASR corpus',
      inputs: { asrRecords: asrRecords.length, hotwordManifests: hotwordManifests.length },
      durationMs: incrementalDurationMs,
      invalidation: {
        changedFields: { records: ['allocationHash'], manifests: ['allocationHash', 'manifestHash', 'manifestId'] },
        recordContentStable,
        manifestContentStable,
      },
      reuse: { recordIdsReused, allRecordsReused: recordIdsReused && reboundRecords.length === asrRecords.length },
    },
    semanticHashes,
  };
  if (!recordContentStable || !manifestContentStable || !recordIdsReused) {
    throw new Error('incremental replay changed fields outside the allocation binding');
  }
  const target = path.join(ROOT, OUT_PATH);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ cleanReplayMs: cleanDurationMs, incrementalReplayMs: incrementalDurationMs, checksPassed: sealOutput.checks.length, bounded: recordContentStable && manifestContentStable }, null, 2));
}

main().catch((error: unknown): void => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
