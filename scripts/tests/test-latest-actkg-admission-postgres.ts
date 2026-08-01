/**
 * Real PostgreSQL integration for Issue #1179 admission.
 *
 * The fixture paths are deliberately explicit: this test never invents a
 * binding, chain receipt, or fake in-memory database.  Set
 * ACTKG_ADMISSION_BINDING and ACTKG_ADMISSION_CHAIN_RECEIPT to the staged
 * intake artifacts before running it.  ACTKG_POSTGRES_REQUIRED=1 turns an
 * unavailable PostgreSQL service into a hard failure.
 */
import 'dotenv/config';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { actkgPostgresSkipExitCode } from '../actkg-release/actkg-postgres-harness-policy';
import {
  admitLatestActkgAggregate,
  createIsolatedAdmissionDatabase,
} from '../knowledge-cutover/admit-latest-actkg-aggregate';

const root = process.cwd();
const bindingPath = process.env.ACTKG_ADMISSION_BINDING;
const chainReceiptPath = process.env.ACTKG_ADMISSION_CHAIN_RECEIPT;
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl || !bindingPath || !chainReceiptPath) {
  const reason = !sourceUrl ? 'DATABASE_URL unavailable' : 'admission fixture paths unavailable';
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') throw new Error(reason);
  console.log(JSON.stringify({ status: 'DEFERRED', reason }));
  process.exit(actkgPostgresSkipExitCode(false));
}

async function main(): Promise<void> {
  const captureRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  assert.match(captureRevision, /^[a-f0-9]{40}$/u);
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'actkg-admission-pg-'));
  const outputRoot = path.join(tempRoot, 'admission');
  const isolated = await createIsolatedAdmissionDatabase(root);
  try {
    const result = await admitLatestActkgAggregate({
      repoRoot: root,
      bindingPath,
      chainReceiptPath,
      outputRoot,
      captureRevision,
      captureRoot: root,
      db: isolated.db,
    });
    assert.equal(result.status, 'PASS');
    assert.ok(result.deltaReceipts.length > 0);
    assert.equal(result.gates.PRODUCTION_SELECTOR_CHANGE, 0);
    assert.equal(result.gates.GRAPH_RAG_SELECTOR_CHANGE, 0);
    assert.equal(result.gates.CANONICAL_LEARNING_FACT_WRITER_FENCE_CHANGE, 0);
    console.log(JSON.stringify({
      status: result.status,
      mode: isolated.mode,
      candidates: result.candidates,
      deltaReceipts: result.deltaReceipts.map((receipt) => receipt.persisted.receiptId),
    }));
  } finally {
    await isolated.cleanup();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
