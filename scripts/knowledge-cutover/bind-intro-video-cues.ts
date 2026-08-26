#!/usr/bin/env tsx
/**
 * Intro-video cue → canonical-node bindings using the same modality-
 * independent term-overlap model as the spoken-audio segments (label hit =
 * 2, description hit = 1, threshold ≥ 2, top-3, no handout intermediary).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const CROSSWALK_PATH = `${REMEDIATION_ROOT}/20260823-asr-batch/crosswalk-v037.json`;
const ATOMS_PATH = `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-atoms.json`;
const OUT_PATH = `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-node-bindings.json`;

interface CrosswalkEntry { readonly domain: string; readonly label: string; readonly description?: string }
interface CueAtom { readonly atomId: string; readonly resourceId: string; readonly cueIndex: number; readonly text: string }

/** Extract Chinese terminology (≥3 chars) from crosswalk labels for overlap scoring. */
function terminologyFromCrosswalk(entries: Record<string, CrosswalkEntry>): { terms: Map<string, { canonicalId: string; weight: number }[]>; labels: Map<string, string[]> } {
  const terms = new Map<string, { canonicalId: string; weight: number }[]>();
  const labels = new Map<string, string[]>();
  for (const [canonicalId, entry] of Object.entries(entries)) {
    const labelTerms = new Set((entry.label ?? '').match(/[\u4e00-\u9fffA-Za-z]{3,}/gu) ?? []);
    for (const term of labelTerms) {
      const bucket = terms.get(term) ?? [];
      bucket.push({ canonicalId, weight: 2 });
      terms.set(term, bucket);
    }
    labels.set(canonicalId, [...labelTerms]);
  }
  return { terms, labels };
}

function scoreCue(text: string, terms: Map<string, { canonicalId: string; weight: number }[]>): { canonicalId: string; score: number }[] {
  const scores = new Map<string, number>();
  const seen = new Set<string>();
  for (const term of terms.keys()) {
    if (seen.has(term)) continue;
    seen.add(term);
    if (text.includes(term)) {
      for (const hit of terms.get(term) ?? []) {
        scores.set(hit.canonicalId, (scores.get(hit.canonicalId) ?? 0) + hit.weight);
      }
    }
  }
  return [...scores.entries()]
    .map(([canonicalId, score]) => ({ canonicalId, score }))
    .sort((left, right) => (right.score - left.score) || (left.canonicalId < right.canonicalId ? -1 : 1))
    .slice(0, 3)
    .filter((hit) => hit.score >= 2);
}

function main(): void {
  const crosswalk = JSON.parse(readFileSync(path.join(ROOT, CROSSWALK_PATH), 'utf8')) as { entries: Record<string, CrosswalkEntry> };
  const atoms = JSON.parse(readFileSync(path.join(ROOT, ATOMS_PATH), 'utf8')) as CueAtom[];
  const { terms } = terminologyFromCrosswalk(crosswalk.entries);
  const rows: { atomId: string; resourceId: string; cueIndex: number; canonicalId: string; score: number; evidence: string }[] = [];
  let boundCues = 0;
  for (const atom of atoms) {
    const hits = scoreCue(atom.text, terms);
    if (hits.length > 0) boundCues += 1;
    for (const hit of hits) {
      rows.push({ atomId: atom.atomId, resourceId: atom.resourceId, cueIndex: atom.cueIndex, canonicalId: hit.canonicalId, score: hit.score, evidence: 'term-overlap-binding-model:modality-independent' });
    }
  }
  const output = {
    contract: 'remediation-intro-video-node-bindings/v1',
    bindingModel: 'modality-independent: cue-to-node term overlap, no handout intermediary (same model as spoken audio)',
    totalCues: atoms.length,
    boundCues,
    bindingRowCount: rows.length,
    bindingsHash: projectionDigest({ rows: rows.map((row) => [row.atomId, row.canonicalId, row.score]) }),
    rows,
  };
  const target = path.join(ROOT, OUT_PATH);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(output, null, 1)}\n`);
  if (existsSync(target) && !readFileSync(target).equals(bytes)) throw new Error('refusing to overwrite diverging binding artifact');
  if (!existsSync(target)) writeFileSync(target, bytes);
  console.log(JSON.stringify({ totalCues: output.totalCues, boundCues, bindingRowCount: rows.length, bindingsHash: output.bindingsHash }, null, 2));
}

main();
