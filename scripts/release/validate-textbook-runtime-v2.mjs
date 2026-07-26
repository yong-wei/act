#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const TEXTBOOK_V2_BOOK_IDS = [
  'control-encyclopedia',
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-7th',
  'hu-shousong-auto-control-8th',
  'hu-shousong-exercise-analysis-3rd',
  'liu-sheng-auto-control-2015',
];

export const TEXTBOOK_V2_REQUIRED_FILES = [
  'manifest.json',
  'navigation.json',
  'units.jsonl',
  'anchors.jsonl',
  'windows.jsonl',
  'anomalies.jsonl',
  'samples.jsonl',
];

function parseArgs(argv) {
  let runtimeRoot = 'course-content/runtime/resources/textbooks-v2';
  let filesOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--runtime-root') {
      runtimeRoot = argv[++index];
    } else if (argv[index] === '--files-only') {
      filesOnly = true;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return { runtimeRoot: path.resolve(runtimeRoot), filesOnly };
}

function assertExactRuntimeFiles(runtimeRoot) {
  const actualBookIds = fs.readdirSync(runtimeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedBookIds = [...TEXTBOOK_V2_BOOK_IDS].sort();
  if (JSON.stringify(actualBookIds) !== JSON.stringify(expectedBookIds)) {
    throw new Error(
      `textbook-v2-book-set-mismatch: expected=${expectedBookIds.join(',')} actual=${actualBookIds.join(',')}`,
    );
  }

  for (const bookId of TEXTBOOK_V2_BOOK_IDS) {
    const bookRoot = path.join(runtimeRoot, bookId);
    for (const fileName of TEXTBOOK_V2_REQUIRED_FILES) {
      const filePath = path.join(bookRoot, fileName);
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`textbook-v2-runtime-file-invalid:${bookId}/${fileName}`);
      }
    }
  }
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

function main() {
  const { runtimeRoot, filesOnly } = parseArgs(process.argv.slice(2));
  assertExactRuntimeFiles(runtimeRoot);
  const validation = filesOnly ? null : validateRecords(runtimeRoot);
  process.stdout.write(`${JSON.stringify({
    runtimeRoot,
    bookIds: TEXTBOOK_V2_BOOK_IDS,
    requiredFiles: TEXTBOOK_V2_REQUIRED_FILES,
    runtimeDirectories: TEXTBOOK_V2_BOOK_IDS.length,
    recordsValidated: validation?.recordsValidated ?? null,
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
