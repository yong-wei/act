#!/usr/bin/env node
// Verify that a built runtime release closure actually carries every asset the
// sealed learning-content manifest promises (#2045). Presence + sha256 equality
// against the final release manifest, so a release built without the external
// bundle (or resumed from an incomplete artifact) fails closed before activation.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const releaseManifestPath = arg('--release-manifest');
const learningManifestPath = arg('--learning-manifest');
if (!releaseManifestPath || !learningManifestPath || !existsSync(releaseManifestPath) || !existsSync(learningManifestPath)) {
  process.stderr.write('usage: check-release-learning-content-closure --release-manifest <v2 release manifest.json> --learning-manifest <authority-learning-content-manifest.json>\n');
  process.exit(1);
}

const failures = [];
const release = JSON.parse(readFileSync(releaseManifestPath, 'utf8'));
if (release.schemaVersion !== 'act-runtime-release.v2' || !Array.isArray(release.files)) {
  process.stderr.write('release manifest is not an act-runtime-release.v2 file listing\n');
  process.exit(1);
}
const releaseFiles = new Map(release.files.map((file) => [file.path, file.sha256]));
const learning = JSON.parse(readFileSync(learningManifestPath, 'utf8'));
if (learning.contract !== 'act-authority-learning-content-manifest/v2' || !Array.isArray(learning.nodes)) {
  process.stderr.write('learning manifest is not a v2 authority learning-content manifest\n');
  process.exit(1);
}

const CARD_PREFIX = 'knowledge/cards/authority/nodes/';
const INFOGRAPH_PREFIX = 'knowledge/infographs/authority/nodes/';
const MANIFEST_PATH = 'knowledge/authority-learning-content-manifest.json';
const shaEqual = (releaseSha, expectedSha) => releaseSha === expectedSha;

const bundledLearning = releaseFiles.get(MANIFEST_PATH);
if (!bundledLearning) failures.push('closure-missing:learning-content-manifest');
else if (bundledLearning !== createHash('sha256').update(readFileSync(learningManifestPath)).digest('hex')) {
  failures.push('closure-drift:learning-content-manifest');
}

const listedCards = new Set();
const listedInfographs = new Set();
for (const node of learning.nodes) {
  const cardPath = `${CARD_PREFIX}${node.safeId}.md`;
  listedCards.add(cardPath);
  const cardSha = releaseFiles.get(cardPath);
  if (!cardSha) failures.push(`closure-missing-card:${node.safeId}`);
  else if (node.card?.state === 'available' && !shaEqual(cardSha, node.card.sha256)) failures.push(`closure-card-hash:${node.safeId}`);
  if (node.infograph?.state === 'missing') {
    if (releaseFiles.has(`${INFOGRAPH_PREFIX}${node.safeId}.png`)) failures.push(`closure-unexpected-infograph:${node.safeId}`);
  } else {
    const infographPath = `${INFOGRAPH_PREFIX}${node.safeId}.png`;
    listedInfographs.add(infographPath);
    const infographSha = releaseFiles.get(infographPath);
    if (!infographSha) failures.push(`closure-missing-infograph:${node.safeId}`);
    else if (node.infograph?.state === 'available' && !shaEqual(infographSha, node.infograph.sha256)) failures.push(`closure-infograph-hash:${node.safeId}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`learning-content release closure failed:\n${failures.slice(0, 40).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`ok closure nodes=${learning.nodes.length} cards=${listedCards.size} infographs=${listedInfographs.size}\n`);
