#!/usr/bin/env tsx
/**
 * Owner sampling decision 1 (2026-08-25): handout layered-exercise sections
 * are excluded from teaching atoms (NON_TEACHING) but join the exercise
 * binding channel as their own exercise resources. Each "**练习 N：**" block
 * inside a handout's layered-exercise section is one question with the
 * reference judgement as the answer.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
const ROOT = process.cwd();
const HANDOUT_DIR = 'course-content/authoring/lessons';
const OUT_DIR = 'course-content/authoring/knowledge/formal-resource-remediation/resource-layer/handout-exercises';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';

function writeDeterministicJson(filePath: string, value: unknown): 'created' | 'skipped' {
  const target = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, bytes);
  return 'created';
}

interface ParsedExercise {
  readonly unit: string;
  readonly index: number;
  readonly title: string;
  readonly stem: string;
  readonly answer: string;
}

function parseLayeredExercises(unit: string, markdown: string): readonly ParsedExercise[] {
  const lines = markdown.split('\n');
  const sectionStarts: [number, number][] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const h2 = /^##\s+(.*)$/u.exec(lines[i].trim());
    if (h2 && /分层练习/u.test(h2[1] ?? '')) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^##\s+/u.test(lines[j].trim())) { end = j; break; }
      }
      sectionStarts.push([i + 1, end]);
    }
  }
  const exercises: { title: string; stem: string; answer: string }[] = [];
  for (const [start, end] of sectionStarts) {
    const body = lines.slice(start, end);
    const blocks: { title: string; lines: string[] }[] = [];
    let current: { title: string; lines: string[] } | null = null;
    for (const line of body) {
      const trimmed = line.trim();
      const sub = /^###\s+(?:\d+[\.\d]*\s*)?(.+)$/u.exec(trimmed);
      const boldStart = /^\*\*练习\s*\d+：(.+)\*\*\s*$/u.exec(trimmed);
      if (sub) {
        if (current) blocks.push(current);
        current = { title: sub[1] ?? '', lines: [] };
      } else if (boldStart) {
        if (current) blocks.push(current);
        current = { title: boldStart[1] ?? '', lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) blocks.push(current);
    for (const block of blocks) {
      const splitAt = block.lines.findIndex((line) => /^参考判断[:：]|^参考要点[:：]|^参考答案[:：]/u.test(line.trim()));
      const stem = (splitAt >= 0 ? block.lines.slice(0, splitAt) : block.lines).join('\n').trim();
      const answer = splitAt >= 0 ? block.lines.slice(splitAt).join('\n').trim() : '';
      if (stem.length > 0) exercises.push({ title: block.title, stem, answer });
    }
  }
  return exercises.map((exercise, i) => ({ unit, index: i + 1, ...exercise }));
}

async function main(): Promise<void> {
  const allocation = JSON.parse(readFileSync(path.join(ROOT, ALLOCATION_PATH), 'utf8')) as { allocationHash: string };
  const units = readdirSync(path.join(ROOT, HANDOUT_DIR)).sort();
  const records: ResourceProcessingRecord[] = [];
  const atoms: unknown[] = [];
  const exclusions: { unit: string; reason: string }[] = [];
  const parsedAll: { unit: string; questionId: string; prompt: string; answerPreview: string }[] = [];
  for (const unit of units) {
    const handoutPath = path.join(HANDOUT_DIR, unit, 'design', `${unit}-handout.md`);
    if (!existsSync(path.join(ROOT, handoutPath))) continue;
    const markdown = readFileSync(path.join(ROOT, handoutPath), 'utf8');
    const exercises = parseLayeredExercises(unit, markdown);
    const resourceId = `handout-exercises-${unit}`;
    if (exercises.length === 0) {
      exclusions.push({ unit, reason: 'no layered-exercise blocks with reference answers' });
      continue;
    }
    const sourceSha = createHash('sha256').update(markdown).digest('hex');
    const exerciseAtoms = exercises.map((exercise) => {
      const questionId = `${unit}/layered/${exercise.index}`;
      const stemSha = createHash('sha256').update(exercise.stem).digest('hex');
      return {
        atomId: `atom-${projectionDigest({ resourceId, kind: 'handout-exercise', questionId, stemSha }).slice(0, 24)}`,
        resourceId,
        questionId,
        title: exercise.title,
        stemSha256: stemSha,
        answerDigest: exercise.answer ? createHash('sha256').update(exercise.answer).digest('hex') : null,
        hasReferenceAnswer: exercise.answer.length > 0,
        originLocator: `${handoutPath}#分层练习-${exercise.index}`,
        disposition: 'BOUND' as const,
      };
    });
    for (const atom of exerciseAtoms) atoms.push(atom);
    for (const exercise of exercises) {
      parsedAll.push({ unit, questionId: `${unit}/layered/${exercise.index}`, prompt: `${exercise.title}：${exercise.stem.slice(0, 120)}`, answerPreview: exercise.answer.slice(0, 60) });
    }
    records.push({
      contract: 'resource-processing-record/v1',
      recordId: `rec-${projectionDigest({ resourceId, sourceSha }).slice(0, 24)}`,
      allocationHash: allocation.allocationHash,
      resourceId,
      resourceSubtype: 'handout-exercise',
      origin: 'ACTIVE_BASELINE',
      sourceIdentity: `content:${sourceSha}`,
      externalInputId: null,
      processorIdentity: 'handout-exercise-processor/v1',
      validatorIdentity: 'remediation-validator/v1',
      atomOutputIds: exerciseAtoms.map((atom) => atom.atomId),
      mappingOutputIds: [],
      anchorOutputIds: exerciseAtoms.map((atom) => atom.originLocator),
      launchOutputIds: exerciseAtoms.map((atom) => atom.originLocator),
      disposition: 'INCLUDED',
      failureCodes: [],
      limitations: ['layered exercises are excluded from teaching atoms by owner decision 1 but join the exercise binding channel'],
      outputManifestHash: projectionDigest({ resourceId, atomIds: exerciseAtoms.map((atom) => atom.atomId) }),
    });
  }
  const summary = {
    contract: 'remediation-handout-exercise-run/v1',
    allocationHash: allocation.allocationHash,
    resourceCount: records.length,
    excludedUnits: exclusions.length,
    atomCount: atoms.length,
    runHash: projectionDigest({ records: records.map((record) => record.recordId), atoms: atoms.length }),
  };
  const states = {
    records: writeDeterministicJson(`${OUT_DIR}/handout-exercise-processing-records.json`, records),
    atoms: writeDeterministicJson(`${OUT_DIR}/handout-exercise-atoms.json`, atoms),
    exclusions: writeDeterministicJson(`${OUT_DIR}/handout-exercise-exclusions.json`, exclusions),
    parsed: writeDeterministicJson(`${OUT_DIR}/handout-exercise-parsed.json`, parsedAll),
    summary: writeDeterministicJson(`${OUT_DIR}/handout-exercise-run-summary.json`, summary),
  };
  console.log(JSON.stringify({ ...summary, states }, null, 2));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
