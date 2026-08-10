import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  executeFirstActivation,
  migrateLegacyFirstActivationJournal,
  recoverInterruptedFirstActivation,
  repairMigratedFirstActivationJournal,
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

function writeInterruptedJournal(
  plan: ReturnType<typeof makePlan>,
  input: {
    status: 'PREPARED' | 'ROLLING_BACK';
    stepStatuses: Array<'PENDING' | 'STARTED' | 'APPLIED' | 'ROLLED_BACK'>;
    failure?: string | null;
  },
): void {
  const body = {
    contract: 'actkg-to-act-first-activation-journal/v2' as const,
    transactionId: 'interrupted-first-test',
    createdAt: '2026-08-10T00:00:00.000Z',
    status: input.status,
    prestate: 'ALL_POINTERS_ABSENT' as const,
    steps: plan.steps.map((step, index) => ({
      component: step.component,
      pointer: {
        kind: 'repo-relative' as const,
        path: path.relative(plan.repoRoot, step.pointerPath).split(path.sep).join('/'),
      },
      target: step.target,
      status: input.stepStatuses[index]!,
    })),
    failure: input.failure ?? null,
  };
  mkdirSync(path.dirname(plan.journalPath), { recursive: true });
  writeFileSync(
    plan.journalPath,
    `${JSON.stringify({
      ...body,
      journalHash: createHash('sha256').update(activationCanonicalJson(body)).digest('hex'),
    }, null, 2)}\n`,
    'utf8',
  );
}

async function waitForMarker(child: ReturnType<typeof spawn>, markerPath: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(markerPath)) return;
    if (child.exitCode !== null) {
      throw new Error(`first-activation child exited before marker: ${child.exitCode}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('first-activation child did not reach the pointer-write marker');
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
    expect(journal.steps.map((step) => step.status)).toEqual([
      'APPLIED',
      'APPLIED',
      'APPLIED',
      'APPLIED',
    ]);
    expect(readFirstActivationJournal(plan.journalPath).steps.every((step) => step.status === 'APPLIED'))
      .toBe(true);
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
    expect(rolledBack.steps.map((step) => step.status)).toEqual([
      'ROLLED_BACK',
      'ROLLED_BACK',
      'ROLLED_BACK',
      'ROLLED_BACK',
    ]);
    expect(readFirstActivationJournal(plan.journalPath).steps.every((step) => step.status === 'ROLLED_BACK'))
      .toBe(true);
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

  it('recovers each pointer-write crash window from a durable PREPARED journal', () => {
    for (let index = 0; index < 4; index += 1) {
      const plan = makePlan();
      for (let pointerIndex = 0; pointerIndex <= index; pointerIndex += 1) {
        plan.steps[pointerIndex]!.activate();
      }
      writeInterruptedJournal(plan, {
        status: 'PREPARED',
        stepStatuses: plan.steps.map((_, stepIndex) =>
          stepIndex < index
            ? 'APPLIED'
            : stepIndex === index
              ? 'STARTED'
              : 'PENDING'),
      });

      const recovered = recoverInterruptedFirstActivation(plan);
      expect(recovered.status).toBe('ROLLED_BACK');
      expect(recovered.steps.every((step) => step.status === 'ROLLED_BACK')).toBe(true);
      expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
    }
  });

  it('is re-entrant for a ROLLING_BACK journal whose pointers are already absent', () => {
    const plan = makePlan();
    writeInterruptedJournal(plan, {
      status: 'ROLLING_BACK',
      stepStatuses: ['ROLLED_BACK', 'ROLLED_BACK', 'ROLLED_BACK', 'ROLLED_BACK'],
    });

    const recovered = recoverInterruptedFirstActivation(plan);
    expect(recovered.status).toBe('ROLLED_BACK');
    expect(recovered.steps.every((step) => step.status === 'ROLLED_BACK')).toBe(true);
    expect(readFirstActivationJournal(plan.journalPath).journalHash).toBe(recovered.journalHash);
  });

  it('recovers a PREPARED journal with all pointers absent without activating anything', () => {
    const plan = makePlan();
    writeInterruptedJournal(plan, {
      status: 'PREPARED',
      stepStatuses: ['PENDING', 'PENDING', 'PENDING', 'PENDING'],
    });

    const recovered = recoverInterruptedFirstActivation(plan);
    expect(recovered.status).toBe('ROLLED_BACK');
    expect(recovered.steps.every((step) => step.status === 'ROLLED_BACK')).toBe(true);
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
  });

  it('stops reverse compensation at the first identity mismatch without continuing', () => {
    const plan = makePlan();
    for (const step of plan.steps) step.activate();
    const prerequisite = plan.steps[2]!;
    writeFileSync(
      prerequisite.pointerPath,
      JSON.stringify({ publicationId: 'wrong-publication', publicationHash: hash }),
      'utf8',
    );
    writeInterruptedJournal(plan, {
      status: 'ROLLING_BACK',
      stepStatuses: ['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED'],
    });

    expect(() => recoverInterruptedFirstActivation(plan)).toThrow('rollback drift at prerequisite');
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('ROLLING_BACK');
    expect(existsSync(plan.steps[3]!.pointerPath)).toBe(false);
    expect(existsSync(prerequisite.pointerPath)).toBe(true);
    expect(existsSync(plan.steps[1]!.pointerPath)).toBe(true);
    expect(existsSync(plan.steps[0]!.pointerPath)).toBe(true);
  });

  it('refuses execute when the transaction journal is non-terminal and preserves it', () => {
    const plan = makePlan();
    writeInterruptedJournal(plan, {
      status: 'PREPARED',
      stepStatuses: ['PENDING', 'PENDING', 'PENDING', 'PENDING'],
    });
    const before = readFileSync(plan.journalPath, 'utf8');

    expect(() => executeFirstActivation(plan)).toThrow(
      'first-activation journal already exists with status PREPARED',
    );
    expect(readFileSync(plan.journalPath, 'utf8')).toBe(before);
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
  });

  it('rejects recovery of a COMMITTED journal and leaves the active pointers intact', () => {
    const plan = makePlan();
    executeFirstActivation(plan);
    const before = readFileSync(plan.journalPath, 'utf8');

    expect(() => recoverInterruptedFirstActivation(plan)).toThrow(
      'cannot recover first activation from COMMITTED',
    );
    expect(readFileSync(plan.journalPath, 'utf8')).toBe(before);
    expect(plan.steps.every((step) => existsSync(step.pointerPath))).toBe(true);
  });

  it('recovers a real SIGKILL between pointer write and journal APPLIED write', async () => {
    const plan = makePlan();
    const markerPath = path.join(plan.repoRoot, 'pointer-written.marker');
    const modulePath = path.resolve(process.cwd(), 'src/lib/knowledge-cutover/first-activation.ts');
    const childScript = `
      import { mkdirSync, writeFileSync } from 'node:fs';
      import path from 'node:path';
      import { executeFirstActivation } from ${JSON.stringify(modulePath)};

      const input = JSON.parse(process.env.FIRST_ACTIVATION_CHILD_INPUT);
      const hash = 'a'.repeat(64);
      const definitions = [
        ['authority', 'authority/current.json', 'snapshotId', 'snapshotHash'],
        ['projection', 'projection/current.json', 'projectionId', 'projectionHash'],
        ['prerequisite', 'prerequisite/current.json', 'publicationId', 'publicationHash'],
        ['consumer-activation', 'consumer/current.json', 'activationId', 'activationHash'],
      ];
      const steps = definitions.map(([component, relative, idField, hashField]) => {
        const pointerPath = path.join(input.repoRoot, relative);
        const target = { component, id: component + '-id', hash };
        return {
          component,
          pointerPath,
          target,
          activate: () => {
            mkdirSync(path.dirname(pointerPath), { recursive: true });
            writeFileSync(pointerPath, JSON.stringify({ [idField]: target.id, [hashField]: target.hash }));
            writeFileSync(input.markerPath, 'pointer-written\\n');
            const blocker = new Int32Array(new SharedArrayBuffer(4));
            while (true) Atomics.wait(blocker, 0, 0, 1000);
          },
        };
      });
      executeFirstActivation({
        repoRoot: input.repoRoot,
        journalPath: input.journalPath,
        lockPath: input.lockPath,
        steps,
        transactionId: 'sigkill-first-test',
        createdAt: '2026-08-10T00:00:00.000Z',
      });
    `;
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', childScript],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          FIRST_ACTIVATION_CHILD_INPUT: JSON.stringify({
            repoRoot: plan.repoRoot,
            journalPath: plan.journalPath,
            lockPath: plan.lockPath,
            markerPath,
          }),
        },
        stdio: 'ignore',
      },
    );
    const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once('close', (code, signal) => resolve({ code, signal }));
    });

    await waitForMarker(child, markerPath);
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('PREPARED');
    expect(readFirstActivationJournal(plan.journalPath).steps[0]!.status).toBe('STARTED');
    expect(existsSync(plan.steps[0]!.pointerPath)).toBe(true);
    expect(child.kill('SIGKILL')).toBe(true);
    expect((await closed).signal).toBe('SIGKILL');
    expect(existsSync(plan.lockPath)).toBe(true);

    // Explicit operator action after verifying the child is dead. Recovery never
    // removes stale locks implicitly.
    rmSync(plan.lockPath);
    const recovered = recoverInterruptedFirstActivation(plan);
    expect(recovered.status).toBe('ROLLED_BACK');
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
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
        // Legacy v1 journals written by the buggy coordinator could retain
        // STARTED even though the terminal status was already COMMITTED.
        status: 'STARTED' as const,
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
    const migrated = readFirstActivationJournal(plan.journalPath);
    expect(migrated.contract).toBe('actkg-to-act-first-activation-journal/v2');
    expect(migrated.steps.every((step) => step.status === 'APPLIED')).toBe(true);

    const rolledBack = rollbackCommittedFirstActivation(plan);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(plan.steps.some((step) => existsSync(step.pointerPath))).toBe(false);
  });

  it('maps a terminal legacy rollback to four ROLLED_BACK steps', () => {
    const plan = makePlan();
    const legacyBody = {
      contract: 'actkg-to-act-first-activation-journal/v1',
      transactionId: 'legacy-rollback-test',
      repoRoot: plan.repoRoot,
      createdAt: '2026-08-10T00:00:00.000Z',
      status: 'ROLLED_BACK' as const,
      prestate: 'ALL_POINTERS_ABSENT' as const,
      steps: plan.steps.map((step) => ({
        component: step.component,
        pointerPath: step.pointerPath,
        target: step.target,
        status: 'STARTED' as const,
      })),
      failure: 'injected-failure',
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

    migrateLegacyFirstActivationJournal({
      ...plan,
      migratedAt: '2026-08-10T01:00:00.000Z',
    });
    const migrated = readFirstActivationJournal(plan.journalPath);
    expect(migrated.status).toBe('ROLLED_BACK');
    expect(migrated.steps.every((step) => step.status === 'ROLLED_BACK')).toBe(true);
  });

  it('repairs terminal v2 step states with before/after hashes and fails closed otherwise', () => {
    const plan = makePlan();
    executeFirstActivation(plan);

    const writeBrokenJournal = (status: 'COMMITTED' | 'ROLLED_BACK' | 'PREPARED') => {
      const current = JSON.parse(readFileSync(plan.journalPath, 'utf8')) as Record<string, unknown>;
      const { journalHash: _journalHash, ...body } = current;
      const broken = {
        ...body,
        status,
        steps: (body.steps as Array<Record<string, unknown>>).map((step) => ({
          ...step,
          status: 'STARTED',
        })),
      };
      writeFileSync(
        plan.journalPath,
        `${JSON.stringify({
          ...broken,
          journalHash: createHash('sha256').update(activationCanonicalJson(broken)).digest('hex'),
        }, null, 2)}\n`,
        'utf8',
      );
    };

    writeBrokenJournal('COMMITTED');
    const beforeCommit = readFirstActivationJournal(plan.journalPath);
    const committedReceipt = repairMigratedFirstActivationJournal(plan);
    expect(committedReceipt.beforeJournalHash).toBe(beforeCommit.journalHash);
    expect(committedReceipt.afterJournalHash).not.toBe(beforeCommit.journalHash);
    expect(readFirstActivationJournal(plan.journalPath).steps.every((step) => step.status === 'APPLIED'))
      .toBe(true);

    const rolledBack = rollbackCommittedFirstActivation(plan);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    writeBrokenJournal('ROLLED_BACK');
    const beforeRollback = readFirstActivationJournal(plan.journalPath);
    const rollbackReceipt = repairMigratedFirstActivationJournal(plan);
    expect(rollbackReceipt.beforeJournalHash).toBe(beforeRollback.journalHash);
    expect(rollbackReceipt.afterJournalHash).not.toBe(beforeRollback.journalHash);
    expect(readFirstActivationJournal(plan.journalPath).steps.every((step) => step.status === 'ROLLED_BACK'))
      .toBe(true);

    writeBrokenJournal('PREPARED');
    expect(() => repairMigratedFirstActivationJournal(plan)).toThrow(
      'cannot repair first-activation journal from PREPARED',
    );
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('PREPARED');
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
