import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-relation-coverage-'));
const nodesPath = path.join(tempDir, 'nodes.json');
const relationsPath = path.join(tempDir, 'relations.jsonl');
const auditInputPath = path.join(tempDir, 'audit-input.json');
const commandPath = path.join(root, 'scripts/knowledge/check-runtime-relation-coverage.ts');

fs.writeFileSync(nodesPath, JSON.stringify([
  { id: 'node-a' },
  { id: 'node-b' },
]));

const validAuditInput = {
  schemaVersion: 1,
  orderSource: { relationIds: ['post-1'] },
  density: { selectedNodeId: 'node-a', visibleAssociationRelationIds: ['association-1'] },
  provenance: [{
    relationId: 'post-1', sourceId: 'node-a', targetId: 'node-b', canonicalType: 'leads_to',
  }],
  overlayTripleEligibility: [{
    relationId: 'post-1', sourceId: 'node-a', targetId: 'node-b', normalizedType: 'leads_to',
  }],
};

function runChecker(content, auditInput = validAuditInput) {
  fs.writeFileSync(relationsPath, content);
  fs.writeFileSync(auditInputPath, JSON.stringify(auditInput));
  return spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules/tsx/dist/cli.mjs'),
      commandPath,
      '--relations',
      relationsPath,
      '--nodes',
      nodesPath,
      '--audit-input',
      auditInputPath,
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

function assertAuditBlockingCode(content, auditInput, code) {
  const result = runChecker(content, auditInput);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.diagnostics.some((item) => item.code === code && item.blocking === true), true);
  assert.equal(
    report.contractCoverage.some((item) => item.failureCodes.includes(code) && item.status === 'blocked'),
    true
  );
}

try {
  const validRelations = [
    {
      id: 'post-1',
      source_id: 'node-a',
      target_id: 'node-b',
      relation_type: 'leads_to',
      sourceDocument: 'reviewed-order.md',
    },
    {
      id: 'association-1',
      source_id: 'node-a',
      target_id: 'node-b',
      relation_type: 'related',
      strength: 0.8,
    },
  ];
  const validContent = `${validRelations.map((row) => JSON.stringify(row)).join('\n')}\n`;
  const valid = runChecker(validContent);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  const validReport = JSON.parse(valid.stdout);
  assert.equal(validReport.ok, true);
  assert.equal(validReport.counts.parsedRelations, 2);
  assert.equal(validReport.stageAgreement, true);
  assert.deepEqual(
    validReport.contractCoverage.map((item) => item.id),
    [
      'direction',
      'malformed-input',
      'duplicate-id',
      'chapter-link-exclusion',
      'order-source',
      'density',
      'cycle',
      'provenance',
      'overlay-triple-eligibility',
      'unknown-type',
    ]
  );
  assert.equal(validReport.contractCoverage.every((item) => item.machineReadable === true), true);
  assert.equal(validReport.contractCoverage.every((item) => item.status === 'covered'), true);

  assertAuditBlockingCode(validContent, {
    ...validAuditInput,
    orderSource: { relationIds: ['association-1'] },
  }, 'ORDER_SOURCE_NOT_POST_REQUISITE');
  assertAuditBlockingCode(validContent, {
    ...validAuditInput,
    density: { selectedNodeId: 'node-a', visibleAssociationRelationIds: ['post-1'] },
  }, 'ASSOCIATION_DENSITY_MISMATCH');
  assertAuditBlockingCode(validContent, {
    ...validAuditInput,
    provenance: [{
      relationId: 'post-1', sourceId: 'node-b', targetId: 'node-a', canonicalType: 'leads_to',
    }],
  }, 'PROVENANCE_MISMATCH');
  assertAuditBlockingCode(validContent, {
    ...validAuditInput,
    overlayTripleEligibility: [{
      relationId: 'post-1', sourceId: 'node-a', targetId: 'node-b', normalizedType: 'related',
    }],
  }, 'OVERLAY_TRIPLE_INELIGIBLE');

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

  const realRuntime = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules/tsx/dist/cli.mjs'),
      commandPath,
      '--relations',
      path.join(root, 'course-content/runtime/knowledge/graph/relations.jsonl'),
      '--nodes',
      path.join(root, 'course-content/runtime/knowledge/graph/nodes.json'),
      '--audit-input',
      path.join(root, 'course-content/contracts/knowledge-relation-coverage-audit.json'),
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(realRuntime.status, 0, realRuntime.stderr || realRuntime.stdout);
  const realRuntimeReport = JSON.parse(realRuntime.stdout);
  assert.equal(realRuntimeReport.ok, true);
  assert.equal(realRuntimeReport.counts.parsedRelations, 16_571);

  console.log('knowledge relation coverage command test passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
