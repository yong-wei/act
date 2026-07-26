#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import {
  inspectTextbookRuntimeV2,
  TEXTBOOK_V2_BOOK_IDS,
  TEXTBOOK_V2_REQUIRED_FILES,
} from './textbook-runtime-v2-provenance.mjs';

export { TEXTBOOK_V2_BOOK_IDS, TEXTBOOK_V2_REQUIRED_FILES };

function parseArgs(argv) {
  let runtimeRoot = 'course-content/runtime/resources/textbooks-v2';
  let filesOnly = false;
  let expectedSourceRevision;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--runtime-root') {
      runtimeRoot = argv[++index];
    } else if (argv[index] === '--expected-source-revision') {
      expectedSourceRevision = argv[++index];
    } else if (argv[index] === '--files-only') {
      filesOnly = true;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return { runtimeRoot: path.resolve(runtimeRoot), filesOnly, expectedSourceRevision };
}

function validateRecords(runtimeRoot) {
  const validatorPath = path.resolve(
    'course-content/scripts/validate_structured_textbook_runtime_v2.mjs',
  );
  const schemaPath = path.resolve(
    'course-content/contracts/structured-textbook-runtime-v2.schema.json',
  );
  const validatorArgs = [
    validatorPath,
    '--schema',
    schemaPath,
    ...TEXTBOOK_V2_BOOK_IDS.flatMap((bookId) => [
      '--runtime-dir',
      path.join(runtimeRoot, bookId),
    ]),
  ];
  const result = spawnSync(process.execPath, validatorArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    try {
      const failedSummary = JSON.parse(result.stdout);
      const failures = Array.isArray(failedSummary.failures) ? failedSummary.failures : [];
      process.stderr.write(`${JSON.stringify({
        runtimeDirectories: failedSummary.runtimeDirectories,
        recordsValidated: failedSummary.recordsValidated,
        failureCount: failures.length,
        failures: failures.slice(0, 20),
        failuresTruncated: failures.length > 20,
      }, null, 2)}\n`);
    } catch {
      process.stderr.write(result.stderr || 'textbook v2 validator failed without structured output\n');
    }
    throw new Error(`textbook-v2-schema-validation-failed:${result.status ?? 'signal'}`);
  }
  const summary = JSON.parse(result.stdout);
  if (summary.runtimeDirectories !== TEXTBOOK_V2_BOOK_IDS.length || summary.failures?.length !== 0) {
    throw new Error('textbook-v2-schema-validation-summary-invalid');
  }
  return summary;
}

function validateClosure(runtimeRoot) {
  const validatorPath = path.resolve(
    'course-content/scripts/validate_written_textbook_runtime_v2.py',
  );
  const validatorArgs = [
    validatorPath,
    ...TEXTBOOK_V2_BOOK_IDS.flatMap((bookId) => [
      '--runtime-dir',
      path.join(runtimeRoot, bookId),
    ]),
  ];
  const result = spawnSync('python3', validatorArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'textbook v2 closure validator failed without output\n');
    throw new Error(`textbook-v2-closure-validation-failed:${result.status ?? 'signal'}`);
  }
  const summary = JSON.parse(result.stdout);
  if (summary.runtimeDirectories !== TEXTBOOK_V2_BOOK_IDS.length || summary.failures?.length !== 0) {
    throw new Error('textbook-v2-closure-validation-summary-invalid');
  }
  return summary;
}

function main() {
  const { runtimeRoot, filesOnly, expectedSourceRevision } = parseArgs(process.argv.slice(2));
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, { expectedSourceRevision });
  const validation = filesOnly ? null : validateRecords(runtimeRoot);
  const closureValidation = filesOnly ? null : validateClosure(runtimeRoot);
  process.stdout.write(`${JSON.stringify({
    runtimeRoot,
    bookIds: TEXTBOOK_V2_BOOK_IDS,
    requiredFiles: TEXTBOOK_V2_REQUIRED_FILES,
    sourceRevision: runtime.sourceRevision,
    runtimeDigest: runtime.runtimeDigest,
    runtimeFileCount: runtime.fileCount,
    runtimeDirectories: TEXTBOOK_V2_BOOK_IDS.length,
    recordsValidated: validation?.recordsValidated ?? null,
    closureDirectoriesValidated: closureValidation?.runtimeDirectories ?? null,
    failures: validation?.failures ?? [],
    filesOnly,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
