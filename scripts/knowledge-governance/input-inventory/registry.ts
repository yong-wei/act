import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { compareCodePoints, normalizePath, normalizeText, sortUnique } from './normalize';
import type { Drift, Json } from './types';

export interface RepositorySource {
  id: string;
  item_kind: string;
  identity_namespace: string;
  include?: string[];
  exclude?: string[];
  index_path?: string;
  required_number_range?: [number, number];
  missing: 'fail' | 'record';
  static_discovery?: Record<string, unknown>;
}

export interface Registry {
  schema_version: string;
  registry_id: string;
  normalization_profile: string;
  algorithm_version: string;
  anchor_record_contract: Record<string, unknown>;
  instructional_source_role_matrix: Record<string, { sources: Array<string | Record<string, unknown>> }>;
  repository_sources: RepositorySource[];
  database_snapshot: Record<string, unknown>;
  database_sources: Array<Record<string, unknown>>;
  evidence_deduplication_contract: Record<string, unknown>;
  decoder_common_contract: Record<string, unknown>;
  decoder_contracts: Record<string, Record<string, unknown>>;
  field_decoders: Array<Record<string, unknown>>;
  closed_namespaces: string[];
  expected_inventory?: Record<string, unknown>;
}

export async function loadRegistry(root: string, registryPath: string): Promise<Registry> {
  const bytes = await readFile(path.join(root, normalizePath(registryPath)));
  const value = parse(normalizeText(bytes), { uniqueKeys: true, strict: true }) as Registry;
  const required = ['schema_version', 'registry_id', 'repository_sources', 'database_sources', 'decoder_contracts', 'field_decoders', 'closed_namespaces'];
  for (const key of required) if (!(key in value)) throw new Error(`registry missing key: ${key}`);
  if (!Array.isArray(value.repository_sources) || !Array.isArray(value.database_sources)) throw new Error('registry source collections must be arrays');
  return value;
}

async function walk(root: string, relative = ''): Promise<{ files: string[]; symlinks: string[] }> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const output = { files: [] as string[], symlinks: [] as string[] };
  for (const entry of entries.sort((a, b) => compareCodePoints(a.name, b.name))) {
    if (relative === '' && ['.git', 'node_modules', '.next'].includes(entry.name)) continue;
    const child = normalizePath(path.posix.join(relative, entry.name));
    if (entry.isSymbolicLink()) output.symlinks.push(child);
    else if (entry.isDirectory()) {
      const nested = await walk(root, child);
      output.files.push(...nested.files); output.symlinks.push(...nested.symlinks);
    } else if (entry.isFile()) output.files.push(child);
  }
  return output;
}

function globRegex(glob: string): RegExp {
  const value = normalizePath(glob);
  let result = '^';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]!;
    if (char === '*') {
      if (value[i + 1] === '*') {
        i += 1;
        if (value[i + 1] === '/') { i += 1; result += '(?:.*/)?'; }
        else result += '.*';
      } else result += '[^/]*';
    } else if (char === '?') result += '[^/]';
    else result += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${result}$`, 'u');
}

export function matchGlob(file: string, glob: string): boolean {
  return globRegex(glob).test(normalizePath(file));
}

async function adrPaths(root: string, source: RepositorySource, drift: Drift[]): Promise<string[]> {
  if (!source.index_path || !source.required_number_range) return [];
  const text = normalizeText(await readFile(path.join(root, normalizePath(source.index_path))));
  const paths = [...text.matchAll(/\]\((\.\/)?(\d{4}[^)#]*\.md)(?:#[^)]+)?\)/gu)]
    .map((match) => normalizePath(path.posix.join(path.posix.dirname(source.index_path!), match[2]!)));
  const [start, end] = source.required_number_range;
  const byNumber = new Map<number, string[]>();
  for (const item of paths) {
    const number = Number(path.posix.basename(item).slice(0, 4));
    if (number >= start && number <= end) byNumber.set(number, [...(byNumber.get(number) ?? []), item]);
  }
  for (let number = start; number <= end; number += 1) {
    const found = byNumber.get(number) ?? [];
    if (found.length !== 1) drift.push({ code: 'ADR_INDEX_CARDINALITY', scope: source.id, expected: 1, observed: found.length, detail: String(number).padStart(4, '0') });
  }
  return sortUnique([...byNumber.values()].flat());
}

export async function enumerateRepository(root: string, registry: Registry, drift: Drift[]) {
  const walked = await walk(root);
  const files = walked.files;
  const records: Array<Record<string, Json>> = [];
  for (const source of registry.repository_sources) {
    const includes = [...(source.include ?? [])];
    const indexed = await adrPaths(root, source, drift);
    const hits = sortUnique([...files.filter((file) => includes.some((glob) => matchGlob(file, glob)) && !(source.exclude ?? []).some((glob) => matchGlob(file, glob))), ...indexed]);
    for (const symlink of walked.symlinks.filter((file) => includes.some((glob) => matchGlob(file, glob)))) drift.push({ code: 'SYMLINK_INPUT_REJECTED', scope: symlink });
    if (hits.length === 0) drift.push({ code: 'REPOSITORY_SOURCE_MISSING', scope: source.id, expected: source.missing, observed: 0 });
    const logicalInputs = includes.map((pattern) => {
      const patternHits = hits.filter((file) => matchGlob(file, pattern));
      if (patternHits.length === 0) drift.push({ code: 'DECLARED_INPUT_MISSING', scope: source.id, expected: pattern, observed: 0 });
      return { pattern, state: patternHits.length === 0 ? 'missing' : 'present', reason_code: patternHits.length === 0 ? 'NO_GLOB_HIT' : null, hit_count: patternHits.length };
    });
    records.push({ id: source.id, item_kind: source.item_kind, identity_namespace: source.identity_namespace, declared_patterns: includes, logical_inputs: logicalInputs, physical_paths: hits, hit_count: hits.length, missing_policy: source.missing });
  }
  const roles: Array<Record<string, Json>> = [];
  const classifications = new Map<string, string[]>();
  for (const [role, contract] of Object.entries(registry.instructional_source_role_matrix ?? {})) {
    if (!contract || !Array.isArray(contract.sources)) continue;
    const patterns = (contract.sources ?? []).flatMap((entry) => typeof entry === 'string' ? [entry] : typeof entry.include === 'string' ? [entry.include] : []);
    const hits = sortUnique((contract.sources ?? []).flatMap((entry) => {
      const include = typeof entry === 'string' ? entry : typeof entry.include === 'string' ? entry.include : null;
      const exclude = typeof entry === 'object' && typeof entry.exclude === 'string' ? entry.exclude : null;
      return include ? files.filter((file) => matchGlob(file, include) && !(exclude && matchGlob(file, exclude))) : [];
    }));
    for (const file of hits) classifications.set(file, [...(classifications.get(file) ?? []), role]);
    const rules = (contract.sources ?? []).map((entry) => {
      const rule = typeof entry === 'string'
        ? { pattern: entry, exclude: null, audience: null, derived: null }
        : { pattern: typeof entry.include === 'string' ? entry.include : null, exclude: typeof entry.exclude === 'string' ? entry.exclude : null, audience: typeof entry.audience === 'string' ? entry.audience : null, derived: typeof entry.derived === 'string' ? entry.derived : null };
      return { ...rule, hit_count: rule.pattern ? files.filter((file) => matchGlob(file, rule.pattern!) && !(rule.exclude && matchGlob(file, rule.exclude))).length : 0 };
    });
    roles.push({ role, declared_patterns: patterns, rules, physical_paths: sortUnique(hits), hit_count: hits.length });
  }
  const instructionalFiles = files.filter((file) => file.startsWith('course-content/authoring/') || file.startsWith('course-content/runtime/'));
  const unclassified = instructionalFiles.filter((file) => !classifications.has(file));
  const multiply = [...classifications].filter(([, values]) => values.length > 1).map(([file, values]) => ({ path: file, roles: sortUnique(values) }));
  return { sources: records, roles, unclassified: sortUnique(unclassified), multiply_classified: multiply };
}

export async function assertNoSymlinkInputs(root: string, paths: string[], drift: Drift[]): Promise<void> {
  for (const relative of paths) {
    const stat = await lstat(path.join(root, relative));
    if (stat.isSymbolicLink()) drift.push({ code: 'SYMLINK_INPUT_REJECTED', scope: relative });
  }
}
