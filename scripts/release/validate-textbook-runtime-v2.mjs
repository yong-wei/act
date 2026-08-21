#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import {
  inspectTextbookRetrievalIndex,
  inspectTextbookRuntimeV2,
  TEXTBOOK_V2_REQUIRED_FILES,
} from './textbook-runtime-v2-provenance.mjs';
import {
  loadTextbookResourceSet,
  TEXTBOOK_RESOURCE_SET_PATH,
  textbookBookIds,
} from './textbook-resource-set.mjs';

export {
  TEXTBOOK_RESOURCE_SET_PATH,
  TEXTBOOK_V2_REQUIRED_FILES,
  textbookBookIds,
};

function parseArgs(argv) {
  let runtimeRoot = 'course-content/runtime/resources/textbooks-v2';
  let filesOnly = false;
  let expectedSourceRevision;
  let indexDir;
  let assetsRoot;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--runtime-root') {
      runtimeRoot = argv[++index];
    } else if (argv[index] === '--expected-source-revision') {
      expectedSourceRevision = argv[++index];
    } else if (argv[index] === '--index-dir') {
      indexDir = argv[++index];
    } else if (argv[index] === '--assets-root') {
      assetsRoot = argv[++index];
    } else if (argv[index] === '--files-only') {
      filesOnly = true;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return {
    runtimeRoot: path.resolve(runtimeRoot),
    filesOnly,
    expectedSourceRevision,
    indexDir: path.resolve(
      indexDir ?? path.join(path.dirname(runtimeRoot), 'textbook-hybrid-retrieval', 'bge-m3'),
    ),
    assetsRoot: assetsRoot ? path.resolve(assetsRoot) : undefined,
  };
}

function validateRecords(runtimeRoot) {
  const bookIds = textbookBookIds();
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
    ...bookIds.flatMap((bookId) => [
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
  if (summary.runtimeDirectories !== bookIds.length || summary.failures?.length !== 0) {
    throw new Error('textbook-v2-schema-validation-summary-invalid');
  }
  return summary;
}

function validateClosure(runtimeRoot) {
  const bookIds = textbookBookIds();
  const validatorPath = path.resolve(
    'course-content/scripts/validate_written_textbook_runtime_v2.py',
  );
  const validatorArgs = [
    validatorPath,
    ...bookIds.flatMap((bookId) => [
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
  if (summary.runtimeDirectories !== bookIds.length || summary.failures?.length !== 0) {
    throw new Error('textbook-v2-closure-validation-summary-invalid');
  }
  return summary;
}

function validateIndex(runtimeRoot, indexDir, expectedSourceRevision) {
  const pythonResult = spawnSync('python3', [
    path.resolve('course-content/scripts/textbook_hybrid_retrieval.py'),
    'verify-index',
    '--runtime-root',
    runtimeRoot,
    '--index-dir',
    indexDir,
    '--resource-set',
    TEXTBOOK_RESOURCE_SET_PATH,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (pythonResult.status !== 0) {
    process.stderr.write(pythonResult.stderr || 'textbook retrieval index verification failed\n');
    throw new Error(`textbook-retrieval-index-validation-failed:${pythonResult.status ?? 'signal'}`);
  }
  const schemaResult = spawnSync(process.execPath, [
    path.resolve('course-content/scripts/validate_textbook_hybrid_retrieval.mjs'),
    '--index-dir',
    indexDir,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (schemaResult.status !== 0) {
    process.stderr.write(schemaResult.stderr || schemaResult.stdout);
    throw new Error(`textbook-retrieval-schema-validation-failed:${schemaResult.status ?? 'signal'}`);
  }
  const verified = JSON.parse(pythonResult.stdout);
  if (verified.sourceRevision !== expectedSourceRevision) {
    throw new Error(
      `textbook-retrieval-source-revision-mismatch:expected=${expectedSourceRevision} actual=${verified.sourceRevision}`,
    );
  }
  return verified;
}

function main() {
  const {
    runtimeRoot,
    filesOnly,
    expectedSourceRevision,
    indexDir,
    assetsRoot,
  } = parseArgs(process.argv.slice(2));
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, {
    expectedSourceRevision,
    assetsRoot,
  });
  const index = filesOnly
    ? null
    : inspectTextbookRetrievalIndex(indexDir, {
      expectedSourceRevision: runtime.authoringSourceRevision,
      expectedResourceSetId: runtime.resourceSetId ?? undefined,
      expectedBookIds: runtime.provenanceGeneration === 'v2' ? runtime.bookIds : undefined,
    });
  const validation = filesOnly ? null : validateRecords(runtimeRoot);
  const closureValidation = filesOnly ? null : validateClosure(runtimeRoot);
  const indexValidation = filesOnly
    ? null
    : validateIndex(runtimeRoot, indexDir, runtime.authoringSourceRevision);
  const bookIds = textbookBookIds();
  process.stdout.write(`${JSON.stringify({
    runtimeRoot,
    bookIds,
    requiredFiles: TEXTBOOK_V2_REQUIRED_FILES,
    sourceRevision: runtime.authoringSourceRevision,
    authoringSourceRevision: runtime.authoringSourceRevision,
    provenanceGeneration: runtime.provenanceGeneration,
    resourceSetId: runtime.resourceSetId,
    runtimeDigest: runtime.runtimeDigest,
    inputDigest: runtime.inputDigest,
    runtimeFileCount: runtime.fileCount,
    mediaFileCount: runtime.mediaFileCount,
    indexRoot: filesOnly ? null : indexDir,
    indexDigest: index?.indexDigest ?? null,
    indexFiles: index?.fileCount ?? null,
    indexResourceSetId: index?.resourceSetId ?? null,
    indexWindows: indexValidation?.windows ?? null,
    resourceSetId: loadTextbookResourceSet().resourceSetId,
    runtimeDirectories: bookIds.length,
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
