#!/usr/bin/env tsx
/**
 * Declare the successor resource delta after reopening the sealed baseline.
 *
 * An empty delta is valid only when the predecessor and successor Authority
 * semantic surfaces are byte-identical. Localized presentation changes alone
 * therefore reuse the formal-resource baseline; any semantic drift requires
 * explicit NEW or CHANGED resource inputs and can never be inferred from a
 * workspace or an OSS listing.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildCombinedDenominator,
  buildExplicitDelta,
  type ExplicitDeltaInput,
} from '@/lib/latest-authority-oss-cutover/denominator';
import type { ActiveBaseline } from '@/lib/latest-authority-oss-cutover/contracts';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const DEFAULT_BASELINE = `${CANDIDATE_ROOT}/active-baseline/active-baseline-classification.json`;
const DEFAULT_CAPTURE = `${CANDIDATE_ROOT}/authority-capture/authority-capture.json`;
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/explicit-successor-delta.json`;

const SEMANTIC_ARTIFACTS = [
  'release.json',
  'ctkg.schema.json',
  'component-releases.json',
  'act-projection.json',
  'domain-projection.json',
  'review-projection.json',
  'projection-link-metadata.jsonl',
] as const;

interface BaselineArtifact {
  readonly contract: 'active-runtime-baseline-classification/v1';
  readonly baseline: ActiveBaseline;
}

interface AuthorityCapture {
  readonly contract: 'authority-capture-receipt/v2';
  readonly captureHash: string;
  readonly bundleId: string;
  readonly bundleDigest: string;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readJson<T>(value: string): T {
  return JSON.parse(readFileSync(absolute(value), 'utf8')) as T;
}

function required(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index < 0 ? null : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing ${flag}`);
  return value;
}

function optional(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function readDeltaInputs(value: string | null): ExplicitDeltaInput[] {
  if (!value) return [];
  const parsed = readJson<unknown>(value);
  if (!Array.isArray(parsed)) throw new Error('--delta-inputs must be a JSON array');
  return parsed as ExplicitDeltaInput[];
}

function bundleArtifactHashes(bundleDir: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const artifact of SEMANTIC_ARTIFACTS) {
    const file = path.join(bundleDir, artifact);
    if (!existsSync(file)) throw new Error(`Authority bundle omits required semantic artifact ${artifact}`);
    result[artifact] = sha256(readFileSync(file));
  }
  return result;
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging successor delta ${relativePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function main(): void {
  const baselinePath = optional('--baseline', DEFAULT_BASELINE);
  const capturePath = optional('--capture', DEFAULT_CAPTURE);
  const predecessorBundle = required('--predecessor-bundle');
  const successorBundle = required('--successor-bundle');
  const outputPath = optional('--out', DEFAULT_OUTPUT);
  const deltaInputsPath = process.argv.includes('--delta-inputs') ? required('--delta-inputs') : null;
  const baseline = readJson<BaselineArtifact>(baselinePath);
  const capture = readJson<AuthorityCapture>(capturePath);
  if (baseline.contract !== 'active-runtime-baseline-classification/v1' || !/^[a-f0-9]{64}$/u.test(baseline.baseline.baselineHash)) {
    throw new Error('baseline artifact is invalid');
  }
  if (capture.contract !== 'authority-capture-receipt/v2' || !/^[a-f0-9]{64}$/u.test(capture.captureHash)) {
    throw new Error('Authority capture is invalid');
  }
  const predecessor = bundleArtifactHashes(absolute(predecessorBundle));
  const successor = bundleArtifactHashes(absolute(successorBundle));
  const changedSemanticArtifacts = SEMANTIC_ARTIFACTS.filter((artifact) => predecessor[artifact] !== successor[artifact]);
  const orderedInputs = readDeltaInputs(deltaInputsPath);
  if (changedSemanticArtifacts.length > 0 && orderedInputs.length === 0) {
    throw new Error(`Authority semantic artifacts changed; an explicit resource delta is required: ${changedSemanticArtifacts.join(', ')}`);
  }
  const delta = buildExplicitDelta(orderedInputs);
  const denominator = buildCombinedDenominator(baseline.baseline, delta);
  const artifact = {
    contract: 'successor-resource-delta-declaration/v1',
    baselineHash: baseline.baseline.baselineHash,
    authorityCaptureHash: capture.captureHash,
    authority: {
      successorBundleId: capture.bundleId,
      successorBundleDigest: capture.bundleDigest,
      semanticSurface: {
        artifacts: SEMANTIC_ARTIFACTS.map((artifact) => ({
          artifact,
          predecessorSha256: predecessor[artifact],
          successorSha256: successor[artifact],
          unchanged: predecessor[artifact] === successor[artifact],
        })),
        changedSemanticArtifacts,
      },
    },
    orderedInputs: delta.orderedInputs,
    deltaHash: delta.deltaHash,
    combinedDenominator: denominator,
    classification: changedSemanticArtifacts.length === 0 && orderedInputs.length === 0
      ? 'EMPTY_SEMANTIC_DELTA'
      : 'EXPLICIT_RESOURCE_DELTA',
  };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    baselineHash: artifact.baselineHash,
    deltaHash: artifact.deltaHash,
    denominatorHash: artifact.combinedDenominator.denominatorHash,
    classification: artifact.classification,
    changedSemanticArtifacts,
    inputCount: artifact.orderedInputs.length,
  }, null, 2)}\n`);
}

main();
