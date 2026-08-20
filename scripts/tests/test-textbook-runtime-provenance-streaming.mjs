import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadTextbookResourceSet, textbookBookIds } from '../release/textbook-resource-set.mjs';

const root = process.cwd();
const resourceSetId = loadTextbookResourceSet().resourceSetId;
const helperPath = path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const revision = 'a'.repeat(40);
const appRevision = 'b'.repeat(40);
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-v2-streaming-'));
const runtimeRoot = path.join(fixtureRoot, 'runtime');
const indexRoot = path.join(fixtureRoot, 'index');
const imageTar = path.join(fixtureRoot, 'image.tar');
const sidecar = `${imageTar}.provenance.json`;

const runtimeBooks = textbookBookIds();
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
          resourceSetId,
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
    '--app-revision', appRevision,
    '--output', sidecar,
  ]);
  assert.equal(writeSidecarResult.status, 0, writeSidecarResult.stderr);
  const sidecarPayload = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  assert.equal(sidecarPayload.appRevision, appRevision);
  assert.equal(sidecarPayload.runtimeSourceRevision, revision);
  assert.equal(sidecarPayload.indexSourceRevision, revision);
  assert.notEqual(sidecarPayload.appRevision, sidecarPayload.runtimeSourceRevision);
  assert.match(sidecarPayload.imageTarSha256, /^[0-9a-f]{64}$/u);

  const verifyImageResult = run('verify-image', [
    '--image-tar', imageTar,
    '--sidecar', sidecar,
  ]);
  assert.equal(verifyImageResult.status, 0, verifyImageResult.stderr);

  const remoteProjectRoot = path.join(fixtureRoot, 'remote-project');
  const remoteReleaseDir = path.join(remoteProjectRoot, 'scripts');
  const remoteConfigDir = path.join(remoteProjectRoot, 'course-content', 'config');
  const remoteHelperPath = path.join(remoteReleaseDir, 'textbook-runtime-v2-provenance.mjs');
  fs.mkdirSync(remoteReleaseDir, { recursive: true });
  fs.mkdirSync(remoteConfigDir, { recursive: true });
  fs.copyFileSync(helperPath, remoteHelperPath);
  fs.copyFileSync(
    path.join(root, 'scripts', 'release', 'textbook-resource-set.mjs'),
    path.join(remoteReleaseDir, 'textbook-resource-set.mjs'),
  );
  fs.copyFileSync(
    path.join(root, 'course-content', 'config', 'textbook-resource-set.json'),
    path.join(remoteConfigDir, 'textbook-resource-set.json'),
  );
  const remoteVerifyRuntimeResult = spawnSync(process.execPath, [
    remoteHelperPath,
    'verify-runtime',
    '--runtime-root', runtimeRoot,
    '--index-dir', indexRoot,
    '--sidecar', sidecar,
  ], {
    cwd: remoteProjectRoot,
    encoding: 'utf8',
  });
  assert.equal(
    remoteVerifyRuntimeResult.status,
    0,
    remoteVerifyRuntimeResult.stderr,
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('textbook runtime provenance streaming test passed\n');
