import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const helperPath = path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const revision = 'a'.repeat(40);
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-v2-streaming-'));
const runtimeRoot = path.join(fixtureRoot, 'runtime');
const indexRoot = path.join(fixtureRoot, 'index');
const imageTar = path.join(fixtureRoot, 'image.tar');
const sidecar = `${imageTar}.provenance.json`;

const runtimeBooks = [
  'control-encyclopedia',
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-7th',
  'hu-shousong-auto-control-8th',
  'hu-shousong-exercise-analysis-3rd',
  'liu-sheng-auto-control-2015',
];
const runtimeFiles = [
  'manifest.json',
  'navigation.json',
  'units.jsonl',
  'anchors.jsonl',
  'windows.jsonl',
  'anomalies.jsonl',
  'samples.jsonl',
];
const indexFiles = [
  'manifest.json',
  'windows.jsonl',
  'bodies.utf8',
  'vectors.f32',
  'lexical-terms.jsonl',
  'lexical-postings.bin',
  'build-report.json',
];

function run(command, args) {
  return spawnSync(process.execPath, [helperPath, command, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

try {
  assert.match(
    helperSource,
    /async function sha256FileStream\(filePath\)[\s\S]*fs\.createReadStream\(filePath\)/u,
    '镜像 tar 摘要必须使用流式读取',
  );
  assert.match(
    helperSource,
    /imageTarSha256:\s*await sha256FileStream\(imageTar\)/u,
    'write-sidecar 必须等待流式镜像 tar 摘要',
  );
  assert.match(
    helperSource,
    /const actual = await sha256FileStream\(/u,
    'verify-image 必须等待流式镜像 tar 摘要',
  );

  for (const bookId of runtimeBooks) {
    const bookRoot = path.join(runtimeRoot, bookId);
    fs.mkdirSync(bookRoot, { recursive: true });
    for (const fileName of runtimeFiles) {
      fs.writeFileSync(
        path.join(bookRoot, fileName),
        fileName === 'manifest.json'
          ? `${JSON.stringify({
            recordType: 'export-manifest',
            schemaVersion: 'structured-textbook-runtime.v2',
            sourceRevision: revision,
          })}\n`
          : '',
      );
    }
  }
  fs.writeFileSync(
    path.join(runtimeRoot, 'input-provenance.json'),
    `${JSON.stringify({
      schemaVersion: 'act.textbook-runtime-input-provenance.v1',
      sourceRevision: revision,
      inputDigest: 'b'.repeat(64),
      inputFileCount: 1,
    })}\n`,
  );

  fs.mkdirSync(indexRoot, { recursive: true });
  for (const fileName of indexFiles) {
    fs.writeFileSync(
      path.join(indexRoot, fileName),
      fileName === 'manifest.json'
        ? `${JSON.stringify({
          recordType: 'index-manifest',
          formatVersion: 'textbook-hybrid-retrieval.v1',
          sourceRevision: revision,
        })}\n`
        : '',
    );
  }

  fs.closeSync(fs.openSync(imageTar, 'w'));
  fs.truncateSync(imageTar, 2 ** 31);
  const writeSidecarResult = run('write-sidecar', [
    '--runtime-root', runtimeRoot,
    '--index-dir', indexRoot,
    '--image-tar', imageTar,
    '--app-revision', revision,
    '--output', sidecar,
  ]);
  assert.equal(writeSidecarResult.status, 0, writeSidecarResult.stderr);
  const sidecarPayload = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  assert.match(sidecarPayload.imageTarSha256, /^[0-9a-f]{64}$/u);

  const verifyImageResult = run('verify-image', [
    '--image-tar', imageTar,
    '--sidecar', sidecar,
  ]);
  assert.equal(verifyImageResult.status, 0, verifyImageResult.stderr);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('textbook runtime provenance streaming test passed\n');
