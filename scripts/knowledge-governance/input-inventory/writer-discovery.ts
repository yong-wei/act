import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { compareCodePoints, normalizePath, sortUnique } from './normalize';
import { matchGlob, type Registry } from './registry';
import type { Drift } from './types';

const MUTATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

export interface WriterTarget { model: string; operation: string; nested_relation: string | null }
export interface WriterEvidence { path: string; mutations: string[]; dynamic_raw: boolean; targets: WriterTarget[]; calls: string[]; imports: Record<string, string> }

function accessParts(node: ts.Expression): string[] | null {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) {
    const parent = accessParts(node.expression);
    return parent ? [...parent, node.name.text] : null;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
    const parent = accessParts(node.expression);
    return parent ? [...parent, node.argumentExpression.text] : null;
  }
  return null;
}

export function discoverWritersInSource(file: string, text: string, includeNonWriter = false): WriterEvidence | null {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aliases = new Map<string, string>();
  const clients = new Set(['prisma', 'tx', 'transaction']);
  const mutations = new Set<string>();
  let dynamicRaw = false;
  const calls = new Set<string>();
  const imports: Record<string, string> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
      const specifier = node.moduleSpecifier.text;
      if (node.importClause.name) imports[node.importClause.name.text] = specifier;
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) imports[element.name.text] = specifier;
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && /^(tx|transaction|client|prisma)$/iu.test(node.name.text)) clients.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const parts = accessParts(node.initializer);
      if (parts && parts.length >= 2 && clients.has(parts[0]!)) aliases.set(node.name.text, parts[1]!);
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      const parts = accessParts(node.initializer);
      if (parts && clients.has(parts[0]!)) for (const element of node.name.elements) if (ts.isIdentifier(element.name)) aliases.set(element.name.text, element.propertyName?.getText(ast) ?? element.name.text);
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) calls.add(node.expression.text);
      const parts = accessParts(node.expression);
      if (parts) {
        const mutation = parts.at(-1)!;
        if (parts.length >= 3 && clients.has(parts[0]!) && MUTATIONS.has(mutation)) mutations.add(`${parts[1]}.${mutation}`);
        else if (parts.length >= 2 && aliases.has(parts[0]!) && MUTATIONS.has(mutation)) mutations.add(`${aliases.get(parts[0]!)}.${mutation}`);
        if (MUTATIONS.has(mutation)) {
          const nestedVisit = (child: ts.Node): void => {
            if (ts.isPropertyAssignment(child)) {
              const name = child.name.getText(ast).replace(/^['"]|['"]$/gu, '');
              if (['knowledgeNodes', 'knowledgeNode', 'knowledgeLinks', 'links', 'learningFacts', 'lessonItems'].includes(name)) mutations.add(`nested.${name}`);
            }
            ts.forEachChild(child, nestedVisit);
          };
          node.arguments.forEach(nestedVisit);
        }
        if ((parts.at(-1) === '$executeRaw' || parts.at(-1) === '$queryRaw') && !ts.isTaggedTemplateExpression(node.parent)) {
          const argument = node.arguments[0];
          if (argument && !ts.isNoSubstitutionTemplateLiteral(argument) && !ts.isStringLiteral(argument)) dynamicRaw = true;
          mutations.add(`raw.${parts.at(-1)}`);
        }
      }
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const parts = accessParts(node.tag);
      if (parts && ['$executeRaw', '$queryRaw'].includes(parts.at(-1)!)) mutations.add(`raw.${parts.at(-1)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const mutationList = sortUnique([...mutations]);
  const targets = mutationList.map((mutation): WriterTarget => mutation.startsWith('nested.')
    ? { model: 'nested', operation: 'relation_mutation', nested_relation: mutation.slice('nested.'.length) }
    : { model: mutation.split('.')[0]!, operation: mutation.split('.')[1] ?? 'unknown', nested_relation: null });
  return mutations.size || dynamicRaw || includeNonWriter ? { path: normalizePath(file), mutations: mutationList, dynamic_raw: dynamicRaw, targets, calls: sortUnique([...calls]), imports } : null;
}

async function walkCode(root: string, relative: string): Promise<string[]> {
  const output: string[] = [];
  try {
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => compareCodePoints(a.name, b.name))) {
      const child = normalizePath(path.posix.join(relative, entry.name));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) output.push(...await walkCode(root, child));
      else if (/\.(?:ts|tsx|js|mjs|cjs)$/u.test(entry.name)) output.push(child);
    }
  } catch { /* declared roots can be absent in synthetic fixtures */ }
  return output;
}

export async function discoverWriters(root: string, registry: Registry): Promise<{ evidence: WriterEvidence[]; drift: Drift[] }> {
  const source = registry.repository_sources.find((item) => item.id === 'knowledge-direct-writers');
  if (!source) return { evidence: [], drift: [{ code: 'WRITER_CONTRACT_MISSING', scope: 'knowledge-direct-writers' }] };
  const staticDiscovery = source.static_discovery as { roots?: string[]; exclude?: string[] } | undefined;
  const mutationTargets = (source.static_discovery as { prisma_mutations?: string[] } | undefined)?.prisma_mutations ?? [];
  const allowedDelegates = new Set(mutationTargets.map((target) => target.split('.')[0]!).map((model) => `${model[0]!.toLowerCase()}${model.slice(1)}`));
  const files = (await Promise.all((staticDiscovery?.roots ?? ['src', 'scripts', 'course-content']).map((rootPath) => walkCode(root, rootPath)))).flat();
  const analyses: WriterEvidence[] = [];
  for (const file of files) {
    if ((staticDiscovery?.exclude ?? []).some((glob) => matchGlob(file, glob))) continue;
    const text = await readFile(path.join(root, file), 'utf8');
    const found = discoverWritersInSource(file, text, true);
    if (found) {
      const rawTargetPattern = new RegExp(`\\b(?:${mutationTargets.map((target) => target.split('.')[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'u');
      const filtered = found.mutations.filter((mutation) => (mutation.startsWith('raw.') && (found.dynamic_raw || rawTargetPattern.test(text))) || mutation.startsWith('nested.') || allowedDelegates.has(mutation.split('.')[0]!));
      const targets = found.targets.filter((target) => filtered.includes(target.nested_relation ? `nested.${target.nested_relation}` : `${target.model}.${target.operation}`));
      analyses.push({ ...found, mutations: filtered, targets });
    }
  }
  const byPath = new Map(analyses.map((item) => [item.path, item]));
  const resolveImport = (from: string, specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`].find((candidate) => byPath.has(candidate)) ?? null;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of analyses) for (const call of item.calls) {
      const imported = item.imports[call];
      const targetPath = imported ? resolveImport(item.path, imported) : null;
      const target = targetPath ? byPath.get(targetPath) : null;
      if (target && target.mutations.length && !item.mutations.length) {
        item.mutations = [`producer:${target.path}`]; item.targets = target.targets; changed = true;
      }
    }
  }
  const evidence = analyses.filter((item) => item.mutations.length || item.dynamic_raw);
  evidence.sort((a, b) => compareCodePoints(a.path, b.path));
  const declared = new Set(source.include ?? []);
  const discovered = new Set(evidence.map((item) => item.path));
  const drift: Drift[] = [];
  for (const file of sortUnique([...discovered].filter((item) => !declared.has(item)))) drift.push({ code: 'DISCOVERED_WRITER_UNDECLARED', scope: file });
  for (const file of sortUnique([...declared].filter((item) => !discovered.has(item)))) drift.push({ code: 'DECLARED_WRITER_NOT_DISCOVERED', scope: file });
  for (const item of evidence.filter((entry) => entry.dynamic_raw)) drift.push({ code: 'DYNAMIC_RAW_SQL_UNRESOLVED', scope: item.path });
  return { evidence, drift };
}
