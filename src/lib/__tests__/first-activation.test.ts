import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

const fsReadFailure = vi.hoisted(() => ({ path: null as string | null }));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      const [filePath] = args;
      if (fsReadFailure.path !== null && String(filePath) === fsReadFailure.path) {
        fsReadFailure.path = null;
        throw new Error('injected-initial-journal-read-failure');
      }
      return actual.readFileSync(...args);
    },
  };
});

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

function writePointer(
  step: ReturnType<typeof makePlan>['steps'][number],
  identity: { id: string; hash: string },
): void {
  const fields = {
    authority: ['snapshotId', 'snapshotHash'],
    projection: ['projectionId', 'projectionHash'],
    prerequisite: ['publicationId', 'publicationHash'],
    'consumer-activation': ['activationId', 'activationHash'],
  } as const;
  const [idField, hashField] = fields[step.component];
  mkdirSync(path.dirname(step.pointerPath), { recursive: true });
  writeFileSync(
    step.pointerPath,
    `${JSON.stringify({ [idField]: identity.id, [hashField]: identity.hash })}\n`,
    'utf8',
  );
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

function runRecoveryCli(args: readonly string[]) {
  const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
  const cliPath = path.resolve(
    process.cwd(),
    'scripts/knowledge-cutover/recover-actkg-to-act-first-activation.ts',
  );
  return spawnSync(process.execPath, [tsxCli, cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
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

  it('refuses every existing pointer before creating a journal, including matching identities', () => {
    for (const existingIdentity of ['target', 'different'] as const) {
      for (const pointerIndex of [0, 1, 2, 3]) {
        const plan = makePlan();
        const existingStep = plan.steps[pointerIndex]!;
        const pointerBytes = {
          id: existingIdentity === 'target'
            ? existingStep.target.id
            : `${existingStep.component}-existing-id`,
          hash: existingIdentity === 'target' ? hash : 'b'.repeat(64),
        };
        writePointer(existingStep, pointerBytes);
        const beforePointer = readFileSync(existingStep.pointerPath, 'utf8');
        let activationCalls = 0;
        existingStep.activate = () => {
          activationCalls += 1;
        };

        expect(() => executeFirstActivation(plan)).toThrow(
          `first activation requires absent pointer: ${existingStep.component}`,
        );
        expect(activationCalls).toBe(0);
        expect(existsSync(plan.journalPath)).toBe(false);
        expect(readFileSync(existingStep.pointerPath, 'utf8')).toBe(beforePointer);
        expect(plan.steps.filter((step) => existsSync(step.pointerPath))).toHaveLength(1);
      }
    }
  });

  it('does not activate or compensate when the initial journal write fails', () => {
    const plan = makePlan();
    const journalParent = path.join(plan.repoRoot, 'journal-parent');
    writeFileSync(journalParent, 'not-a-directory', 'utf8');
    plan.journalPath = path.join(journalParent, 'first.json');
    let activationCalls = 0;
    for (const step of plan.steps) {
      step.activate = () => {
        activationCalls += 1;
      };
    }

    expect(() => executeFirstActivation(plan)).toThrow(/initial journal write failed/u);
    expect(activationCalls).toBe(0);
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
    expect(existsSync(plan.journalPath)).toBe(false);
  });

  it('does not activate or compensate when the initial journal write cannot be confirmed', () => {
    const plan = makePlan();
    let activationCalls = 0;
    for (const step of plan.steps) {
      step.activate = () => {
        activationCalls += 1;
      };
    }
    fsReadFailure.path = plan.journalPath;

    try {
      expect(() => executeFirstActivation(plan)).toThrow(
        /initial journal write could not be confirmed/u,
      );
    } finally {
      fsReadFailure.path = null;
    }

    expect(activationCalls).toBe(0);
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
    expect(readFirstActivationJournal(plan.journalPath).status).toBe('PREPARED');
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

  it('provides an explicit recovery CLI without echoing operator paths', () => {
    const plan = makePlan();
    plan.steps[0]!.activate();
    writeInterruptedJournal(plan, {
      status: 'PREPARED',
      stepStatuses: ['STARTED', 'PENDING', 'PENDING', 'PENDING'],
    });

    const result = runRecoveryCli([
      '--repo-root', plan.repoRoot,
      '--journal', plan.journalPath,
      '--lock', plan.lockPath,
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain(plan.repoRoot);
    const output = JSON.parse(result.stdout) as {
      transactionId: string;
      status: string;
      receipt: {
        contract: string;
        action: string;
        transactionId: string;
        journalHash: string;
        steps: Array<{ component: string; status: string }>;
      };
    };
    expect(output.transactionId).toBe('interrupted-first-test');
    expect(output.status).toBe('ROLLED_BACK');
    expect(output.receipt).toMatchObject({
      contract: 'actkg-to-act-first-activation-recovery/v1',
      action: 'recover-interrupted-first-activation',
      transactionId: 'interrupted-first-test',
    });
    expect(output.receipt.journalHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(output.receipt.steps.every((step) => step.status === 'ROLLED_BACK')).toBe(true);
    expect(plan.steps.every((step) => !existsSync(step.pointerPath))).toBe(true);
    expect(existsSync(plan.lockPath)).toBe(false);
  });

  it('rejects COMMITTED journals and stale locks without changing either', () => {
    const committed = makePlan();
    executeFirstActivation(committed);
    const committedBefore = readFileSync(committed.journalPath, 'utf8');
    const committedResult = runRecoveryCli([
      '--repo-root', committed.repoRoot,
      '--journal', committed.journalPath,
      '--lock', committed.lockPath,
    ]);
    expect(committedResult.status).not.toBe(0);
    expect(`${committedResult.stdout}${committedResult.stderr}`).toContain('COMMITTED');
    expect(`${committedResult.stdout}${committedResult.stderr}`).not.toContain(committed.repoRoot);
    expect(readFileSync(committed.journalPath, 'utf8')).toBe(committedBefore);
    expect(committed.steps.every((step) => existsSync(step.pointerPath))).toBe(true);

    const interrupted = makePlan();
    interrupted.steps[0]!.activate();
    writeInterruptedJournal(interrupted, {
      status: 'PREPARED',
      stepStatuses: ['STARTED', 'PENDING', 'PENDING', 'PENDING'],
    });
    mkdirSync(path.dirname(interrupted.lockPath), { recursive: true });
    writeFileSync(interrupted.lockPath, 'operator-owned-lock\n', 'utf8');
    const interruptedBefore = readFileSync(interrupted.journalPath, 'utf8');
    const staleLockResult = runRecoveryCli([
      '--repo-root', interrupted.repoRoot,
      '--journal', interrupted.journalPath,
      '--lock', interrupted.lockPath,
    ]);
    expect(staleLockResult.status).not.toBe(0);
    expect(`${staleLockResult.stdout}${staleLockResult.stderr}`).toContain(
      'another first-activation transaction is already running',
    );
    expect(readFileSync(interrupted.journalPath, 'utf8')).toBe(interruptedBefore);
    expect(existsSync(interrupted.lockPath)).toBe(true);
    expect(existsSync(interrupted.steps[0]!.pointerPath)).toBe(true);
  });

  it('requires explicit repository, journal, and lock arguments', () => {
    const missingRoot = runRecoveryCli([]);
    expect(missingRoot.status).not.toBe(0);
    expect(missingRoot.stderr).toContain('missing --repo-root');

    const plan = makePlan();
    const missingLock = runRecoveryCli([
      '--repo-root', plan.repoRoot,
      '--journal', plan.journalPath,
    ]);
    expect(missingLock.status).not.toBe(0);
    expect(missingLock.stderr).toContain('missing --lock');
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
    const workerPath = path.join(plan.repoRoot, 'first-activation-sigkill-worker.ts');
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
    writeFileSync(workerPath, childScript, 'utf8');
    const child = spawn(
      process.execPath,
      [path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), workerPath],
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
