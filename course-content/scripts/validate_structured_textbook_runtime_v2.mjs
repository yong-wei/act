#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';

function parseArgs(argv) {
  const roots = [];
  let schemaPath = 'course-content/contracts/structured-textbook-runtime-v2.schema.json';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--schema') {
      schemaPath = argv[++index];
    } else if (argv[index] === '--runtime-dir') {
      roots.push(argv[++index]);
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  if (roots.length === 0) {
    throw new Error('at least one --runtime-dir is required');
  }
  return { roots, schemaPath };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function recordsForRuntime(runtimeDir) {
  return [
    readJson(path.join(runtimeDir, 'manifest.json')),
    readJson(path.join(runtimeDir, 'navigation.json')),
    ...readJsonl(path.join(runtimeDir, 'units.jsonl')),
    ...readJsonl(path.join(runtimeDir, 'anchors.jsonl')),
    ...readJsonl(path.join(runtimeDir, 'windows.jsonl')),
    ...readJsonl(path.join(runtimeDir, 'anomalies.jsonl')),
    ...readJsonl(path.join(runtimeDir, 'samples.jsonl')),
  ];
}

function main() {
  const { roots, schemaPath } = parseArgs(process.argv.slice(2));
  const schema = readJson(schemaPath);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  let validated = 0;
  const failures = [];
  for (const runtimeDir of roots) {
    for (const record of recordsForRuntime(runtimeDir)) {
      validated += 1;
      if (!validate(record)) {
        failures.push({
          runtimeDir,
          recordType: record.recordType ?? '<missing>',
          id: record.id ?? record.bookId ?? '<missing>',
          errors: validate.errors,
        });
      }
    }
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: schema.title,
    runtimeDirectories: roots.length,
    recordsValidated: validated,
    failures,
  }, null, 2)}\n`);
  return failures.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
