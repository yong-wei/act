import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertDeclaredAuthoritativeSnapshotReceipt,
  computeDeclaredAuthoritativeSnapshotReceiptDigest,
  validateMaterializedDeclaredAuthoritativeSnapshotReceipt,
  validateDeclaredAuthoritativeSnapshotReceipt,
} from '../aggregate-governance/declared-authoritative-snapshot';

async function fixture(): Promise<Record<string, unknown>> {
  const source = await readFile(path.join(
    process.cwd(),
    'course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json',
  ), 'utf8');
  return JSON.parse(source) as Record<string, unknown>;
}

describe('declared authoritative snapshot receipt', () => {
  it('accepts the frozen #1117 candidate receipt and recomputes its digest', async () => {
    const receipt = await fixture();
    expect(validateDeclaredAuthoritativeSnapshotReceipt(receipt)).toMatchObject({ valid: true, errors: [] });
    expect(() => assertDeclaredAuthoritativeSnapshotReceipt(receipt)).not.toThrow();
    expect(computeDeclaredAuthoritativeSnapshotReceiptDigest(receipt)).toBe(receipt.receiptDigest);
    expect((receipt.deltaReceipts as Array<Record<string, unknown>>)).toHaveLength(6);
  });

  it.each([
    ['captureRevision', (receipt: Record<string, unknown>) => { receipt.captureRevision = 'f'.repeat(40); }],
    ['candidate bundle link', (receipt: Record<string, unknown>) => {
      const delta = (receipt.deltaReceipts as Array<Record<string, unknown>>)[5];
      delta.candidateBundleDigest = 'f'.repeat(64);
    }],
    ['selector invariant', (receipt: Record<string, unknown>) => { receipt.selectorsChanged = 1; }],
    ['violations', (receipt: Record<string, unknown>) => { receipt.violations = ['digest-drift']; }],
    ['receipt digest', (receipt: Record<string, unknown>) => { receipt.receiptDigest = '0'.repeat(64); }],
  ])('rejects tampering of %s', async (_field, mutate) => {
    const receipt = await fixture();
    mutate(receipt);
    const result = validateDeclaredAuthoritativeSnapshotReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(() => assertDeclaredAuthoritativeSnapshotReceipt(receipt)).toThrow(/rejected/u);
  });

  it('rejects rewritten role blockers even when the self digest is recomputed', async () => {
    const receipt = await fixture();
    const downstream = receipt.downstream as Record<string, unknown>;
    const roleContracts = downstream.roleContracts as Record<string, unknown>;
    roleContracts.blockedRoles = ['arbitrary-role'];
    receipt.receiptDigest = computeDeclaredAuthoritativeSnapshotReceiptDigest(receipt);

    const result = validateDeclaredAuthoritativeSnapshotReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.errors.join('; ')).toMatch(/immutable published value/u);
  });

  it('binds referenced bytes in a copied repository and rejects projection tampering', async () => {
    const receipt = await fixture();
    const sourceRoot = process.cwd();
    const copyRoot = await mkdtemp(path.join(tmpdir(), 'declared-snapshot-'));
    const bundleRoot = 'course-content/authoring/knowledge/issue-1117-v08-r3-chain/releases/control-theory-engineering-v0.8';
    const manifest = JSON.parse(
      await readFile(path.join(sourceRoot, bundleRoot, 'bundle-manifest.json'), 'utf8'),
    ) as { artifacts: Array<{ path: string; required: boolean }> };
    const requiredArtifacts = manifest.artifacts
      .filter((artifact) => artifact.required)
      .map((artifact) => path.posix.join(bundleRoot, artifact.path));
    const relativeFiles = [
      'course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json',
      (receipt.lock as Record<string, string>).path,
      (receipt.projection as Record<string, string>).path,
      (receipt.worklist as Record<string, string>).path,
      path.posix.join(bundleRoot, 'bundle-manifest.json'),
      ...requiredArtifacts,
    ];
    try {
      for (const relative of relativeFiles) {
        const target = path.join(copyRoot, relative);
        await mkdir(path.dirname(target), { recursive: true });
        await cp(path.join(sourceRoot, relative), target);
      }

      const valid = await validateMaterializedDeclaredAuthoritativeSnapshotReceipt(
        receipt,
        { repoRoot: copyRoot },
      );
      expect(valid.valid).toBe(true);
      expect(valid.checkedPaths).toContain((receipt.projection as Record<string, string>).path);

      const worklistPath = path.join(copyRoot, (receipt.worklist as Record<string, string>).path);
      const worklistJson = JSON.parse(await readFile(worklistPath, 'utf8')) as {
        items: Array<Record<string, unknown>>;
      };
      worklistJson.items[0]!.role = 'formal_objective';
      worklistJson.items[0]!.disposition = 'CURRENT';
      await writeFile(worklistPath, `${JSON.stringify(worklistJson, null, 2)}\n`);
      const semanticInjection = await validateMaterializedDeclaredAuthoritativeSnapshotReceipt(
        receipt,
        { repoRoot: copyRoot },
      );
      expect(semanticInjection.valid).toBe(false);
      expect(semanticInjection.errors.join('; ')).toMatch(/\.role is not allowed/u);
      await cp(path.join(sourceRoot, (receipt.worklist as Record<string, string>).path), worklistPath);

      const missingArtifact = path.join(copyRoot, bundleRoot, 'component-releases.json');
      await rm(missingArtifact);
      const missingRequired = await validateMaterializedDeclaredAuthoritativeSnapshotReceipt(
        receipt,
        { repoRoot: copyRoot },
      );
      expect(missingRequired.valid).toBe(false);
      expect(missingRequired.errors.join('; ')).toMatch(/component_manifest/u);
      await cp(path.join(sourceRoot, bundleRoot, 'component-releases.json'), missingArtifact);

      const projectionPath = path.join(copyRoot, (receipt.projection as Record<string, string>).path);
      const projectionBytes = await readFile(projectionPath);
      await writeFile(projectionPath, Buffer.concat([projectionBytes, Buffer.from(' ')]));
      const unchangedReceipt = JSON.parse(
        await readFile(path.join(copyRoot, relativeFiles[0]!), 'utf8'),
      ) as Record<string, unknown>;
      const rejected = await validateMaterializedDeclaredAuthoritativeSnapshotReceipt(
        unchangedReceipt,
        { repoRoot: copyRoot },
      );
      expect(rejected.valid).toBe(false);
      expect(rejected.errors.join('; ')).toMatch(/projection\.sha256/u);
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });
});
