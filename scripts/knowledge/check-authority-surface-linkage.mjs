#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = (code) => failures.push(code);

function readJson(relative) {
  return JSON.parse(readFileSync(join(root, relative), 'utf8'));
}

function sha256(relative) {
  return createHash('sha256').update(readFileSync(join(root, relative))).digest('hex');
}

const manifest = readJson('course-content/runtime/knowledge/authority-learning-content-manifest.json');
if (manifest.contract !== 'act-authority-learning-content-manifest/v2') {
  fail(`manifest-contract:${manifest.contract}`);
}
const cardDir = join(root, 'course-content/runtime/knowledge/cards/authority/nodes');
const infographDir = join(root, 'course-content/runtime/knowledge/infographs/authority/nodes');
const cardFiles = new Set(readdirSync(cardDir).filter((name) => name.endsWith('.md')));
const infographFiles = new Set(readdirSync(infographDir).filter((name) => name.endsWith('.png')));
const catalog = readJson('course-content/runtime/knowledge/authority-domain-catalog/catalog.json');
const graphIds = new Set(catalog.memberships.map((row) => row.canonicalId));
const seen = new Set();
for (const node of manifest.nodes || []) {
  if (seen.has(node.canonicalId)) fail(`duplicate-canonical:${node.canonicalId}`);
  seen.add(node.canonicalId);
  if (!graphIds.has(node.canonicalId)) fail(`unmapped:${node.canonicalId}`);
  const cardName = `${node.safeId}.md`;
  const infographName = `${node.safeId}.png`;
  if (!cardFiles.delete(cardName)) fail(`missing-card-file:${cardName}`);
  if (!infographFiles.delete(infographName)) fail(`missing-infograph-file:${infographName}`);
  if (node.card?.state === 'available') {
    if (sha256(`course-content/runtime/knowledge/cards/authority/nodes/${cardName}`) !== node.card.sha256) {
      fail(`card-hash-drift:${cardName}`);
    }
  } else if (node.card?.state !== 'blocked') {
    fail(`card-unlinked:${node.canonicalId}`);
  }
  if (node.infograph?.state !== 'available' || sha256(`course-content/runtime/knowledge/infographs/authority/nodes/${infographName}`) !== node.infograph.sha256) {
    fail(`infograph-unlinked:${node.canonicalId}`);
  }
}
for (const leftover of cardFiles) fail(`card-not-in-manifest:${leftover}`);
for (const leftover of infographFiles) fail(`infograph-not-in-manifest:${leftover}`);

const pointer = readJson('course-content/runtime/knowledge/projection/current.json');
const release = join(root, 'course-content/runtime/knowledge/projection/releases', pointer.projectionId);
function readJsonl(name) {
  const text = readFileSync(join(release, name), 'utf8');
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
const resources = readJsonl('resources.jsonl');
const bindings = readJsonl('bindings.jsonl');
const boundIds = new Set(bindings.map((row) => row.resourceId));
const liveBindings = bindings.filter((row) => graphIds.has(row.canonicalId));
if (liveBindings.length === 0) fail('no-live-bindings');
for (const binding of bindings) {
  if (!graphIds.has(binding.canonicalId)) fail(`orphan-binding-target:${binding.canonicalId}`);
}
const inventory = resources.filter((row) => boundIds.has(row.resourceId));
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
process.stdout.write(`ok cards=${manifest.nodes.length} boundResources=${inventory.length} liveBindings=${liveBindings.length}\n`);
