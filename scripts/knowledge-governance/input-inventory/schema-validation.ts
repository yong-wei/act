import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { Prisma } from '@prisma/client';
import type { Registry } from './registry';
import type { Drift, Json } from './types';

const JSON_SELECTOR = /^\$(?:(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|\*))|(?:\[\*\]))*$/u;

function databaseFields(registry: Registry): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const source of registry.database_sources) {
    const fields = source.fields as Record<string, string[]> | undefined;
    for (const [table, values] of Object.entries(fields ?? {})) {
      const current = result.get(table) ?? new Set<string>();
      for (const field of values) current.add(field);
      result.set(table, current);
    }
  }
  return result;
}

function validateJoin(join: string, models: Map<string, Set<string>>, declared: Map<string, Set<string>>, scope: string, drift: Drift[]): void {
  const match = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*(?:\[\*\])?(?:\.[A-Za-z][A-Za-z0-9]*(?:\[\*\])?)*) -> ([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*(?:\[\*\])?(?:\.[A-Za-z][A-Za-z0-9]*(?:\[\*\])?)*)$/u.exec(join);
  if (!match) { drift.push({ code: 'INVALID_JOIN_SYNTAX', scope, observed: join }); return; }
  for (const [table, rawField] of [[match[1]!, match[2]!], [match[3]!, match[4]!]]) {
    const field = rawField.split('.')[0]!.replace(/\[\*\]$/u, '');
    if (!models.get(table)?.has(field)) drift.push({ code: 'DMMF_JOIN_ENDPOINT_MISSING', scope, observed: `${table}.${field}` });
    if (!declared.get(table)?.has(field)) drift.push({ code: 'DECLARED_JOIN_ENDPOINT_MISSING', scope, observed: `${table}.${field}` });
  }
}

async function symbolExists(root: string, locator: string): Promise<boolean> {
  const separator = locator.lastIndexOf('#');
  const file = separator < 1 ? locator : locator.slice(0, separator);
  const symbol = separator < 1 ? null : locator.slice(separator + 1);
  try {
    const text = await readFile(path.join(root, file), 'utf8');
    if (!symbol) return true;
    if (file.endsWith('.prisma')) {
      const [model, field] = symbol.split('.');
      return new RegExp(`model\\s+${model}\\s*\\{[\\s\\S]*?\\b${field}\\b`, 'u').test(text);
    }
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      let found = false;
      const visit = (node: ts.Node): void => {
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name?.text === symbol) found = true;
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === symbol) found = true;
        ts.forEachChild(node, visit);
      };
      visit(ast);
      if (found) return true;
      const [container, member] = symbol.split('.');
      return Boolean(member && text.includes(container!) && new RegExp(`\\b${member}\\b`, 'u').test(text));
    }
    return text.includes(symbol);
  } catch { return false; }
}

export async function validateRegistrySchema(root: string, registry: Registry): Promise<Drift[]> {
  const drift: Drift[] = [];
  const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, new Set(model.fields.map((field) => field.name))]));
  const modelDefinitions = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  const declared = databaseFields(registry);
  for (const source of registry.database_sources) {
    const tables = source.tables as string[] ?? [];
    const fields = source.fields as Record<string, string[]> ?? {};
    for (const table of tables) if (!models.has(table)) drift.push({ code: 'DMMF_TABLE_MISSING', scope: String(source.id), observed: table });
    for (const [table, values] of Object.entries(fields)) for (const field of values) if (!models.get(table)?.has(field)) drift.push({ code: 'DMMF_FIELD_MISSING', scope: String(source.id), observed: `${table}.${field}` });
    for (const [field, selectors] of Object.entries((source.json_selectors as Record<string, string[]>) ?? {})) {
      const [table, column] = field.split('.');
      if (!models.get(table!)?.has(column!)) drift.push({ code: 'DMMF_SELECTOR_SOURCE_MISSING', scope: String(source.id), observed: field });
      for (const selector of selectors) if (!JSON_SELECTOR.test(selector)) drift.push({ code: 'SELECTOR_OUTSIDE_CLOSED_LANGUAGE', scope: field, observed: selector });
    }
    for (const selector of source.logical_selectors as string[] ?? []) {
      const match = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)\[\*\]\.([A-Za-z][A-Za-z0-9]*)$/u.exec(selector);
      if (!match) { drift.push({ code: 'INVALID_LOGICAL_SELECTOR', scope: String(source.id), observed: selector }); continue; }
      const relation = modelDefinitions.get(match[1]!)?.fields.find((field) => field.name === match[2] && field.kind === 'object');
      if (!relation) { drift.push({ code: 'DMMF_LOGICAL_RELATION_MISSING', scope: String(source.id), observed: `${match[1]}.${match[2]}` }); continue; }
      if (!models.get(relation.type)?.has(match[3]!)) drift.push({ code: 'DMMF_LOGICAL_TARGET_MISSING', scope: String(source.id), observed: `${relation.type}.${match[3]}` });
    }
  }
  const namespaces = new Set(registry.closed_namespaces);
  for (const decoder of registry.field_decoders) {
    const sourceField = String(decoder.source_field ?? '');
    const [table, field] = sourceField.split('.');
    if (!models.get(table!)?.has(field!)) drift.push({ code: 'FIELD_DECODER_DMMF_SOURCE_MISSING', scope: sourceField });
    if (!declared.get(table!)?.has(field!)) drift.push({ code: 'FIELD_DECODER_UNDECLARED_SOURCE', scope: sourceField });
    if (!namespaces.has(String(decoder.identity_namespace))) drift.push({ code: 'UNKNOWN_NAMESPACE', scope: sourceField, observed: String(decoder.identity_namespace) });
    if (decoder.json_decoder && !registry.decoder_contracts[String(decoder.json_decoder)]) drift.push({ code: 'UNKNOWN_DECODER', scope: sourceField, observed: String(decoder.json_decoder) });
    if (decoder.parent_join) validateJoin(String(decoder.parent_join), models, declared, sourceField, drift);
  }
  for (const [id, decoder] of Object.entries(registry.decoder_contracts)) {
    const selectors = [
      ...(decoder.selectors as string[] ?? []),
      ...(decoder.reference_selectors as string[] ?? []),
      ...(decoder.discriminator_selectors as string[] ?? []),
      ...(typeof decoder.payload_selector === 'string' ? [decoder.payload_selector] : []),
    ];
    if (selectors.length === 0 && !decoder.item_decoder) drift.push({ code: 'DECODER_EMPTY_SELECTORS', scope: id });
    for (const selector of selectors) if (!JSON_SELECTOR.test(selector)) drift.push({ code: 'SELECTOR_OUTSIDE_CLOSED_LANGUAGE', scope: id, observed: selector });
    const namespaceValues = [decoder.reference_namespace, ...Object.values((decoder.namespace_by_field as Record<string, string>) ?? {}), ...Object.values((decoder.field_namespace_overrides as Record<string, string>) ?? {}), ...Object.values((decoder.discriminator_namespaces as Record<string, string>) ?? {})].filter((value): value is string => typeof value === 'string');
    if (namespaceValues.length === 0 && !decoder.item_decoder && !decoder.payload_decoder) drift.push({ code: 'DECODER_NAMESPACE_MISSING', scope: id });
    for (const namespace of namespaceValues) if (!namespaces.has(namespace)) drift.push({ code: 'UNKNOWN_NAMESPACE', scope: id, observed: namespace });
    if (decoder.parent_join) validateJoin(String(decoder.parent_join), models, declared, id, drift);
    for (const join of (decoder.source_joins as string[] ?? [])) validateJoin(join, models, declared, id, drift);
    for (const child of [decoder.item_decoder, decoder.payload_decoder].filter(Boolean)) if (!registry.decoder_contracts[String(child)]) drift.push({ code: 'UNKNOWN_DECODER', scope: id, observed: String(child) });
    const sources = Array.isArray(decoder.schema_source) ? decoder.schema_source : [decoder.schema_source];
    for (const source of sources) if (typeof source !== 'string' || !await symbolExists(root, source)) drift.push({ code: 'SCHEMA_SOURCE_UNRESOLVED', scope: id, observed: String(source) });
  }
  return drift;
}

export function validateOutputPrivacy(value: Json): Drift[] {
  const drift: Drift[] = [];
  const forbidden = new Set(['userid', 'userids', 'row', 'rows', 'payload', 'rawrowdigest', 'rowdigest', 'sourceinputdigest', 'identity', 'domain', 'relation', 'binding', 'candidate', 'assignment', 'uniquesemanticname', 'domainmembership', 'relationapproval', 'resourcebindingapproval']);
  const visit = (item: Json, pointer: string): void => {
    if (Array.isArray(item)) item.forEach((child, index) => visit(child, `${pointer}/${index}`));
    else if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      if (forbidden.has(key.replaceAll('_', '').toLowerCase())) drift.push({ code: 'PROHIBITED_OUTPUT_FIELD', scope: `${pointer}/${key}` });
      visit(child, `${pointer}/${key}`);
    }
  };
  visit(value, '');
  return drift;
}
