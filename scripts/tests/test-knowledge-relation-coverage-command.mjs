import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-relation-coverage-'));
const nodesPath = path.join(tempDir, 'nodes.json');
const relationsPath = path.join(tempDir, 'relations.jsonl');
const commandPath = path.join(root, 'scripts/knowledge/check-runtime-relation-coverage.ts');

fs.writeFileSync(nodesPath, JSON.stringify([
  { id: 'node-a' },
  { id: 'node-b' },
]));

function runChecker(content) {
  fs.writeFileSync(relationsPath, content);
  return spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules/tsx/dist/cli.mjs'),
      commandPath,
      '--relations',
      relationsPath,
      '--nodes',
      nodesPath,
    ],
    { cwd: root, encoding: 'utf8' }
  );
}

function assertBlockingCode(content, code) {
  const result = runChecker(content);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.diagnostics.some((item) => item.code === code && item.blocking === true), true);
}

try {
  const valid = runChecker(`${JSON.stringify({
    id: 'relation-1',
    source_id: 'node-a',
    target_id: 'node-b',
    relation_type: 'related',
  })}\n`);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  const validReport = JSON.parse(valid.stdout);
  assert.equal(validReport.ok, true);
  assert.equal(validReport.counts.parsedRelations, 1);
  assert.equal(validReport.stageAgreement, true);

  const malformed = runChecker('{"id":\n');
  assert.equal(malformed.status, 1, malformed.stderr || malformed.stdout);
  const malformedReport = JSON.parse(malformed.stdout);
  assert.equal(malformedReport.ok, false);
  assert.equal(
    malformedReport.diagnostics.some((item) => (
      item.code === 'MALFORMED_RELATION_JSONL'
      && item.blocking === true
      && item.line === 1
    )),
    true
  );

  assertBlockingCode(`${JSON.stringify({
    id: 'unknown-type',
    source_id: 'node-a',
    target_id: 'node-b',
    relation_type: 'not_registered',
  })}\n`, 'UNKNOWN_RELATION_TYPE');

  assertBlockingCode([
    { id: 'duplicate-id', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' },
    { id: 'duplicate-id', source_id: 'node-b', target_id: 'node-a', relation_type: 'related' },
  ].map((row) => JSON.stringify(row)).join('\n'), 'DUPLICATE_RELATION_ID');

  assertBlockingCode([
    { id: 'child-a-b', source_id: 'node-a', target_id: 'node-b', relation_type: 'contains' },
    { id: 'child-b-a', source_id: 'node-b', target_id: 'node-a', relation_type: 'contains' },
  ].map((row) => JSON.stringify(row)).join('\n'), 'REVERSE_CHILD_RELATION');

  console.log('knowledge relation coverage command test passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
