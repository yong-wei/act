#!/usr/bin/env tsx
/**
 * Task family 6 (#1515): run the exercise processor over every captured
 * course runtime manifest. One atom per activity card with a reference
 * answer; open-ended cards resolve to explicit per-card exclusions.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import {
  discoverExerciseCards,
  exerciseOutputManifestHash,
  processInteractiveManifestExercises,
  type InteractiveManifestShape,
} from '@/lib/formal-resource-remediation/processors/interactive-manifest';

const ROOT = process.cwd();
const MANIFEST_DIR = 'course-content/runtime/lessons';
const OUT_DIR = 'course-content/authoring/knowledge/formal-resource-remediation/resource-layer/exercises';
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

function main(): void {
  const allocation = JSON.parse(readFileSync(absolute(ALLOCATION_PATH), 'utf8')) as { allocationHash: string };
  const unitNames = readdirSync(absolute(MANIFEST_DIR)).filter((name) => name.endsWith('.json') === false).sort();
  const records: ResourceProcessingRecord[] = [];
  const atoms: unknown[] = [];
  const answerDigests: unknown[] = [];
  const excludedCards: { unit: string; cardId: string; reason: string }[] = [];
  let cardTotal = 0;
  for (const unit of unitNames) {
    const manifestPath = `${MANIFEST_DIR}/${unit}/interactive-manifest.json`;
    if (!existsSync(absolute(manifestPath))) continue;
    const manifest = JSON.parse(readFileSync(absolute(manifestPath), 'utf8')) as InteractiveManifestShape;
    const cards = discoverExerciseCards(manifest, manifestPath);
    cardTotal += cards.length;
    const resourceId = `exercises-${manifest.lesson_id}`;
    const result = processInteractiveManifestExercises({ resourceId, manifestPath, cards });
    for (const atom of result.atoms) atoms.push(atom);
    for (const digest of result.answerDigests) answerDigests.push(digest);
    for (const excluded of result.excludedCards) excludedCards.push({ unit: manifest.lesson_id, ...excluded });
    const manifestSha = createHash('sha256').update(readFileSync(absolute(manifestPath))).digest('hex');
    records.push({
      contract: 'resource-processing-record/v1',
      recordId: `rec-${projectionDigest({ resourceId, sourceSha: manifestSha }).slice(0, 24)}`,
      allocationHash: allocation.allocationHash,
      resourceId,
      resourceSubtype: 'exercise',
      origin: 'ACTIVE_BASELINE',
      sourceIdentity: `content:${manifestSha}`,
      externalInputId: null,
      processorIdentity: 'exercise-processor/v2-interactive-manifest',
      validatorIdentity: 'remediation-validator/v1',
      atomOutputIds: result.atoms.map((atom) => atom.atomId),
      mappingOutputIds: [],
      anchorOutputIds: result.atoms.map((atom) => atom.originLocator),
      launchOutputIds: result.atoms.map((atom) => atom.originLocator),
      disposition: result.atoms.length > 0 ? 'INCLUDED' : 'EXCLUDED',
      failureCodes: result.atoms.length > 0 ? [] : ['ambiguous-mapping'],
      limitations: result.excludedCards.map((card) => `${card.cardId}: ${card.reason}`),
      outputManifestHash: exerciseOutputManifestHash(result),
    });
  }
  const summary = {
    contract: 'remediation-exercise-run/v1',
    allocationHash: allocation.allocationHash,
    manifestCount: records.length,
    cardTotal,
    atomCount: atoms.length,
    excludedCardCount: excludedCards.length,
    runHash: projectionDigest({ records: records.map((record) => record.recordId), atoms: atoms.length, excluded: excludedCards.length }),
  };
  const states = {
    records: writeDeterministicJson(`${OUT_DIR}/exercise-processing-records.json`, records),
    atoms: writeDeterministicJson(`${OUT_DIR}/exercise-atoms.json`, atoms),
    answerDigests: writeDeterministicJson(`${OUT_DIR}/exercise-answer-digests.json`, answerDigests),
    exclusions: writeDeterministicJson(`${OUT_DIR}/exercise-exclusions.json`, excludedCards),
    summary: writeDeterministicJson(`${OUT_DIR}/exercise-run-summary.json`, summary),
  };
  console.log(JSON.stringify({ ...summary, states }, null, 2));
}

main();
