#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = (code) => failures.push(code);

function readJson(relative) {
  return JSON.parse(readFileSync(join(root, relative), 'utf8'));
}

function sha256File(relative) {
  return createHash('sha256').update(readFileSync(join(root, relative))).digest('hex');
}

function gitFiles(prefix) {
  const out = execFileSync('git', ['ls-files', prefix], { cwd: root, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((path) => path.slice(prefix.length).replace(/^\//, ''));
}

const manifestRel = 'course-content/runtime/knowledge/authority-learning-content-manifest.json';
if (!existsSync(join(root, manifestRel))) fail('manifest-missing');
const manifest = existsSync(join(root, manifestRel)) ? readJson(manifestRel) : { nodes: [] };
if (manifest.contract !== 'act-authority-learning-content-manifest/v2') fail(`manifest-contract:${manifest.contract}`);

const overlay = readJson('course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json');
if (manifest.teachingProjectionId !== overlay.projectionId || manifest.teachingProjectionHash !== overlay.projectionHash) {
  fail('manifest-envelope-mismatch');
}

const sidecarRel = `course-content/runtime/knowledge/teaching-projection/domain-fragments/releases/${overlay.projectionId}/inspector-sidecar.json`;
if (!existsSync(join(root, sidecarRel))) fail('sidecar-missing');
const sidecar = existsSync(join(root, sidecarRel)) ? readJson(sidecarRel) : {};
if (
  sidecar.envelopeProjectionId !== overlay.projectionId
  || sidecar.envelopeProjectionHash !== overlay.projectionHash
) fail('sidecar-envelope-mismatch');

const catalog = readJson('course-content/runtime/knowledge/authority-domain-catalog/catalog.json');
const graphIds = new Set(catalog.memberships.map((row) => row.canonicalId));
const trackedCards = new Set(gitFiles('course-content/runtime/knowledge/cards/authority/nodes'));
const trackedInfographs = new Set(gitFiles('course-content/runtime/knowledge/infographs/authority/nodes'));
const seen = new Set();
const seenSafe = new Set();
for (const node of manifest.nodes || []) {
  if (seen.has(node.canonicalId)) fail(`duplicate:${node.canonicalId}`);
  seen.add(node.canonicalId);
  if (seenSafe.has(node.safeId)) fail(`duplicate-safeId:${node.safeId}`);
  seenSafe.add(node.safeId);
  if (!graphIds.has(node.canonicalId)) fail(`unmapped:${node.canonicalId}`);
  const cardName = `${node.safeId}.md`;
  const infographName = `${node.safeId}.png`;
  trackedCards.delete(cardName);
  trackedInfographs.delete(infographName);
  const cardRel = `course-content/runtime/knowledge/cards/authority/nodes/${cardName}`;
  const infographRel = `course-content/runtime/knowledge/infographs/authority/nodes/${infographName}`;
  if (!existsSync(join(root, cardRel))) fail(`missing-card:${cardName}`);
  if (!existsSync(join(root, infographRel))) fail(`missing-infograph:${infographName}`);
  if (node.card?.state === 'available' && sha256File(cardRel) !== node.card.sha256) fail(`card-hash:${cardName}`);
  if (node.infograph?.state === 'available' && sha256File(infographRel) !== node.infograph.sha256) fail(`infograph-hash:${infographName}`);
}
for (const leftover of trackedCards) fail(`tracked-card-not-in-manifest:${leftover}`);
for (const leftover of trackedInfographs) fail(`tracked-infograph-not-in-manifest:${leftover}`);

const release = join(root, 'course-content/runtime/knowledge/projection/releases', sidecar.courseProjectionId);
const resources = readFileSync(join(release, 'resources.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const bindings = readFileSync(join(release, 'bindings.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const boundIds = new Set(bindings.map((row) => row.resourceId));
const inventory = resources.filter((row) => boundIds.has(row.resourceId));
for (const binding of bindings) {
  if (!graphIds.has(binding.canonicalId)) fail(`orphan-binding-target:${binding.canonicalId}`);
}
for (const resource of inventory) {
  const title = typeof resource.title === 'string' ? resource.title.trim() : '';
  const derived = /^act:(audio|video|handout|exercise|card|simulation|lesson):/.test(resource.resourceId);
  if (!title && !derived) fail(`empty-title:${resource.resourceId}`);
}
if (inventory.length === 0) fail('empty-bound-inventory');

if (failures.length > 0) {
  process.stderr.write(`${failures.slice(0, 40).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`ok v2Nodes=${manifest.nodes.length} boundResources=${inventory.length} sidecar=${sidecar.courseProjectionId}\n`);
