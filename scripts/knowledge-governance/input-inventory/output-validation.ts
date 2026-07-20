import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020, { type AnySchema, type ErrorObject } from 'ajv/dist/2020';
import type { Json } from './types';

function safeError(error: ErrorObject): string {
  const location = error.instancePath || '/';
  return `${location} ${error.keyword} (${error.schemaPath})`;
}

export function assertManifestSchemaValue(schema: AnySchema, manifest: Json): void {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true, validateFormats: false });
  const validate = ajv.compile(schema);
  if (validate(manifest)) return;
  const errors = (validate.errors ?? []).map(safeError).join('; ');
  throw new Error(`manifest schema validation failed: ${errors}`);
}

export async function assertManifestSchema(root: string, manifest: Json): Promise<void> {
  const schema = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/manifest.schema.json'), 'utf8')) as AnySchema;
  assertManifestSchemaValue(schema, manifest);
}
