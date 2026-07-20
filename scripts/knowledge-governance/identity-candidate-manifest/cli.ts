#!/usr/bin/env node
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { canonicalJson, normalizeText, taggedDigest } from '../input-inventory/normalize';
import { buildIdentityCandidateManifest } from './manifest';
import type { IdentityCandidateInput, InventoryManifest, Json } from './types';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJsonFile<T>(filePath: string): Promise<{ value: T; digest: string }> {
  const normalized = normalizeText(await readFile(filePath));
  return {
    value: JSON.parse(normalized) as T,
    digest: taggedDigest('repository-text-file/v1', Buffer.from(normalized, 'utf8')),
  };
}

async function main(): Promise<void> {
  const inventoryPath = option('--inventory');
  const inputPath = option('--input');
  if (!inventoryPath || !inputPath) throw new Error('usage: --inventory <manifest.json> --input <identity-input.json>');
  const [inventory, input] = await Promise.all([
    readJsonFile<InventoryManifest>(inventoryPath),
    readJsonFile<IdentityCandidateInput>(inputPath),
  ]);
  const manifest = buildIdentityCandidateManifest({
    inventory: inventory.value,
    input: input.value,
    inventoryFileDigest: inventory.digest,
  });
  const schema = JSON.parse(await readFile(path.join(import.meta.dirname, 'manifest.schema.json'), 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(manifest)) throw new Error(`manifest schema validation failed: ${JSON.stringify(validate.errors)}`);
  process.stdout.write(canonicalJson(manifest as Json));
  if (manifest.readiness !== true && !process.argv.includes('--allow-blocked')) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
