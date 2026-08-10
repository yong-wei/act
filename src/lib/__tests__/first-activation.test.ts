import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  executeFirstActivation,
  migrateLegacyFirstActivationJournal,
  readFirstActivationJournal,
  rollbackCommittedFirstActivation,
} from '../knowledge-cutover/first-activation';
import { activationCanonicalJson } from '../versioned-knowledge-activation/hash';

const roots: string[] = [];
const hash = 'a'.repeat(64);

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function makePlan() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-first-activation-'));
  roots.push(root);
  const componentPaths = [
    ['authority', 'authority/current.json', 'snapshotId', 'snapshotHash'],
    ['projection', 'projection/current.json', 'projectionId', 'projectionHash'],
    ['prerequisite', 'prerequisite/current.json', 'publicationId', 'publicationHash'],
    ['consumer-activation', 'consumer/current.json', 'activationId', 'activationHash'],
  ] as const;
  const steps = componentPaths.map(([component, relative, idField, hashField]) => {
    const pointerPath = path.join(root, relative);
    const target = { component, id: `${component}-id`, hash };
    return {
      component,
      pointerPath,
      target,
      activate: () => {
        mkdirSync(path.dirname(pointerPath), { recursive: true });
        writeFileSync(
          pointerPath,
          `${JSON.stringify({ [idField]: target.id, [hashField]: target.hash })}\n`,
          'utf8',
        );
      },
    };
  });
  return {
    repoRoot: root,
    steps,
    journalPath: path.join(root, 'journals', 'first.json'),
    lockPath: path.join(root, 'locks', 'first.lock'),
  };
}

describe('all-ABSENT first activation protocol', () => {
  it('commits in fixed order and can compensate the exact first activation back to absent', () => {
    const plan = makePlan();
    const journal = executeFirstActivation({
      ...plan,
      transactionId: 'first-test',
      createdAt: '2026-08-10T00:00:00.000Z',
    });

    expect(journal.status).toBe('COMMITTED');
    expect(plan.steps.every((step) => existsSync(step.pointerPath))).toBe(true);
    expect(journal.steps.map((step) => step.pointer.path)).toEqual([
      'authority/current.json',
      'projection/current.json',
      'prerequisite/current.json',
      'consumer/current.json',
    ]);
    expect(readFileSync(plan.journalPath, 'utf8')).not.toContain(plan.repoRoot);

    const rolledBack = rollbackCommittedFirstActivation(plan);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(plan.steps.some((step) => existsSync(step.pointerPath))).toBe(false);
    expect(readFirstActivationJournal(plan.journalPath).journalHash).toBe(rolledBack.journalHash);
  });

  it('compensates only steps already started when an activation boundary fails', () => {
    const plan = makePlan();

    expect(() => executeFirstActivation({
      ...plan,
      beforeActivate: (component) => {
        if (component === 'projection') throw new Error('injected-projection-boundary-failure');
      },
    })).toThrow('injected-projection-boundary-failure');

    expect(plan.steps.some((step) => existsSync(step.pointerPath))).toBe(false);
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('ROLLED_BACK');
  });

  it('fails closed when a started write leaves a mismatched identity', () => {
    const plan = makePlan();
    const projection = plan.steps[1]!;
    projection.activate = () => {
      mkdirSync(path.dirname(projection.pointerPath), { recursive: true });
      writeFileSync(
        projection.pointerPath,
        `${JSON.stringify({ projectionId: 'wrong', projectionHash: hash })}\n`,
        'utf8',
      );
    };

    expect(() => executeFirstActivation(plan)).toThrow(/post-write identity mismatch.*compensation failed: rollback drift/u);
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('ROLLBACK_FAILED');
    expect(existsSync(projection.pointerPath)).toBe(true);
  });

  it('migrates the legacy journal without retaining its local root and preserves rollback', () => {
    const plan = makePlan();
    for (const step of plan.steps) step.activate();
    const legacyBody = {
      contract: 'actkg-to-act-first-activation-journal/v1',
      transactionId: 'legacy-first-test',
      repoRoot: plan.repoRoot,
      createdAt: '2026-08-10T00:00:00.000Z',
      status: 'COMMITTED' as const,
      prestate: 'ALL_POINTERS_ABSENT' as const,
      steps: plan.steps.map((step) => ({
        component: step.component,
        pointerPath: step.pointerPath,
        target: step.target,
        status: 'APPLIED' as const,
      })),
      failure: null,
    };
    mkdirSync(path.dirname(plan.journalPath), { recursive: true });
    writeFileSync(
      plan.journalPath,
      `${JSON.stringify({
        ...legacyBody,
        journalHash: createHash('sha256').update(activationCanonicalJson(legacyBody)).digest('hex'),
      }, null, 2)}\n`,
      'utf8',
    );

    const receipt = migrateLegacyFirstActivationJournal({
      ...plan,
      migratedAt: '2026-08-10T01:00:00.000Z',
    });
    expect(receipt.legacyJournalHash).not.toBe(receipt.journalHash);
    expect(readFileSync(plan.journalPath, 'utf8')).not.toContain(plan.repoRoot);
    expect(readFirstActivationJournal(plan.journalPath).contract)
      .toBe('actkg-to-act-first-activation-journal/v2');

    const rolledBack = rollbackCommittedFirstActivation(plan);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(plan.steps.some((step) => existsSync(step.pointerPath))).toBe(false);
  });

  it('reuses a repo-relative journal after moving the repository root', () => {
    const source = makePlan();
    executeFirstActivation(source);
    const destination = makePlan();
    for (const step of destination.steps) step.activate();
    mkdirSync(path.dirname(destination.journalPath), { recursive: true });
    writeFileSync(
      destination.journalPath,
      readFileSync(source.journalPath, 'utf8'),
      'utf8',
    );

    const rolledBack = rollbackCommittedFirstActivation(destination);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(destination.steps.some((step) => existsSync(step.pointerPath))).toBe(false);
  });

  it('fails closed when a pointer path crosses a symbolic link', () => {
    const plan = makePlan();
    const outside = mkdtempSync(path.join(tmpdir(), 'act-first-activation-outside-'));
    roots.push(outside);
    symlinkSync(outside, path.join(plan.repoRoot, 'authority'));

    expect(() => executeFirstActivation(plan)).toThrow(/symbolic link/u);
    expect(existsSync(plan.journalPath)).toBe(false);
  });
});
