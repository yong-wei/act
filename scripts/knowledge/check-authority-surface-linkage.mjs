#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

const overlay = readJson('course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json');
const sidecarRel = `course-content/runtime/knowledge/teaching-projection/domain-fragments/releases/${overlay.projectionId}/inspector-sidecar.json`;
if (!existsSync(join(root, sidecarRel))) fail('sidecar-missing');
const sidecar = existsSync(join(root, sidecarRel)) ? readJson(sidecarRel) : {};
if (sidecar.envelopeProjectionId !== overlay.projectionId || sidecar.envelopeProjectionHash !== overlay.projectionHash) {
  fail('sidecar-envelope-mismatch');
}

const catalog = readJson('course-content/runtime/knowledge/authority-domain-catalog/catalog.json');
const graphIds = new Set(catalog.memberships.map((row) => row.canonicalId));
const cardDirRel = 'course-content/runtime/knowledge/cards/authority/nodes';
const infographDirRel = 'course-content/runtime/knowledge/infographs/authority/nodes';
const cardDir = join(root, cardDirRel);
const infographDir = join(root, infographDirRel);
const cardFiles = existsSync(cardDir) ? readdirSync(cardDir).filter((name) => name.endsWith('.md')) : [];
const infographFiles = new Set(existsSync(infographDir) ? readdirSync(infographDir).filter((name) => name.endsWith('.png')) : []);
const seen = new Set();
for (const name of cardFiles) {
  const text = readFileSync(join(cardDir, name), 'utf8');
  const entity = text.match(/^authority_entity_id:\s*["']?([^"'\r\n]+)/m)?.[1]?.trim();
  if (!entity) fail(`missing-entity:${name}`);
  else if (seen.has(entity)) fail(`duplicate-entity:${entity}`);
  else if (!graphIds.has(entity)) fail(`unmapped-card:${entity}`);
  else seen.add(entity);
  const stem = name.slice(0, -3);
  if (!infographFiles.delete(`${stem}.png`)) fail(`missing-infograph:${stem}`);
}
for (const leftover of infographFiles) fail(`unmapped-infograph:${leftover}`);

if (!sidecar.courseProjectionId) fail('sidecar-course-missing');
else {
  const release = join(root, 'course-content/runtime/knowledge/projection/releases', sidecar.courseProjectionId);
  const resources = readFileSync(join(release, 'resources.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const bindings = readFileSync(join(release, 'bindings.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const boundIds = new Set(bindings.map((row) => row.resourceId));
  for (const binding of bindings) {
    if (!graphIds.has(binding.canonicalId)) fail(`orphan-binding-target:${binding.canonicalId}`);
    if (!boundIds.has(binding.resourceId)) fail(`binding-without-resource:${binding.resourceId}`);
  }
  const inventory = resources.filter((row) => boundIds.has(row.resourceId));
  for (const resource of inventory) {
    const title = typeof resource.title === 'string' ? resource.title.trim() : '';
    const derived = /^act:(audio|video|handout|exercise|card|simulation|lesson):/.test(resource.resourceId);
    if (!title && !derived) fail(`empty-title:${resource.resourceId}`);
  }
  if (inventory.length === 0) fail('empty-bound-inventory');
  const unbound = resources.filter((row) => !boundIds.has(row.resourceId)).map((row) => row.resourceId);
  if (unbound.length > 0) {
    process.stdout.write(`inspector-inventory bound=${inventory.length}; unpublished-unbound=${unbound.length}\n`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.slice(0, 40).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`ok diskCards=${cardFiles.length} sidecar=${sidecar.courseProjectionId}\n`);
