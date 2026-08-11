#!/usr/bin/env tsx

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  recoverInterruptedFirstActivation,
  type FirstActivationJournal,
} from '../../src/lib/knowledge-cutover/first-activation';

const RECOVERY_RECEIPT_CONTRACT =
  'actkg-to-act-first-activation-recovery/v1' as const;

type RecoveryCliArgs = {
  repoRoot: string;
  journalPath: string;
  lockPath: string;
};

function fail(message: string): never {
  throw new Error(`first-activation recovery: ${message}`);
}

function parseArgs(argv: readonly string[]): RecoveryCliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    if (values.has(key)) fail(`duplicate option ${key}`);
    values.set(key, value);
  }

  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) fail(`missing ${key}`);
    return value;
  };

  const supported = new Set(['--repo-root', '--journal', '--lock']);
  for (const key of values.keys()) {
    if (!supported.has(key)) fail(`unknown option ${key}`);
  }

  return {
    repoRoot: path.resolve(required('--repo-root')),
    journalPath: path.resolve(required('--journal')),
    lockPath: path.resolve(required('--lock')),
  };
}

function recoveryReceipt(journal: FirstActivationJournal) {
  return {
    contract: RECOVERY_RECEIPT_CONTRACT,
    action: 'recover-interrupted-first-activation',
    transactionId: journal.transactionId,
    journalHash: journal.journalHash,
    steps: journal.steps.map((step) => ({
      component: step.component,
      status: step.status,
    })),
  };
}

function redactOperatorPaths(message: string, args?: RecoveryCliArgs): string {
  if (!args) return message;
  return [args.repoRoot, args.journalPath, args.lockPath].reduce(
    (redacted, value) => redacted.split(value).join('<operator-path>'),
    message,
  );
}

function main(): void {
  let args: RecoveryCliArgs | undefined;
  try {
    args = parseArgs(process.argv.slice(2));
    const journal = recoverInterruptedFirstActivation(args);
    const receipt = recoveryReceipt(journal);
    process.stdout.write(`${JSON.stringify({
      transactionId: journal.transactionId,
      status: journal.status,
      receipt,
    }, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${redactOperatorPaths(message, args)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
