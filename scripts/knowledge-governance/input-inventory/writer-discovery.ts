import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { compareCodePoints, normalizePath, sortUnique } from './normalize';
import { matchGlob, type Registry } from './registry';
import type { Drift } from './types';

const MUTATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const CLIENT_NAME = /^(?:prisma|db|tx|transaction|client)$/iu;
const RAW_METHODS = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);

export interface WriterTarget { model: string; operation: string; nested_relation: string | null }
export interface WriterCallPath { symbols: string[]; target: WriterTarget }
export interface WriterEvidence {
  path: string;
  mutations: string[];
  dynamic_raw: boolean;
  targets: WriterTarget[];
  calls: string[];
  imports: Record<string, string>;
  call_paths: WriterCallPath[];
}

interface SinkContract { model: string; delegate: string; fields: Set<string>; allFields: boolean; tableNames: Set<string> }
interface SymbolNode { id: string; file: string; node: ts.SourceFile | ts.FunctionLikeDeclaration; calls: Set<string>; sinks: WriterTarget[]; unresolvedRaw: boolean }
interface PrismaModel { model: string; delegate: string; relations: Map<string, string> }

function accessParts(node: ts.Expression): string[] | null {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) {
    const parent = accessParts(node.expression);
    return parent ? [...parent, node.name.text] : null;
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression && (ts.isStringLiteral(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))) {
    const parent = accessParts(node.expression);
    return parent ? [...parent, node.argumentExpression.text] : null;
  }
  return null;
}

function lowerCamel(value: string): string { return `${value[0]?.toLowerCase() ?? ''}${value.slice(1)}`; }
function snake(value: string): string { return value.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase(); }
function targetKey(target: WriterTarget): string { return `${target.model}\u0000${target.operation}\u0000${target.nested_relation ?? ''}`; }
function compareTargets(a: WriterTarget, b: WriterTarget): number { return compareCodePoints(targetKey(a), targetKey(b)); }

function contractsFrom(targets: string[]): SinkContract[] {
  const byModel = new Map<string, SinkContract>();
  for (const value of targets) {
    const [model, field] = value.split('.', 2);
    if (!model) continue;
    const current = byModel.get(model) ?? {
      model,
      delegate: lowerCamel(model),
      fields: new Set<string>(),
      allFields: false,
      tableNames: new Set([model.toLowerCase(), lowerCamel(model).toLowerCase(), snake(model)]),
    };
    if (field) current.fields.add(field); else current.allFields = true;
    byModel.set(model, current);
  }
  return [...byModel.values()].sort((a, b) => compareCodePoints(a.model, b.model));
}

async function loadPrismaModels(root: string, contracts: SinkContract[]): Promise<Map<string, PrismaModel>> {
  let schema = '';
  try { schema = await readFile(path.join(root, 'prisma/schema.prisma'), 'utf8'); } catch {
    return new Map(contracts.map((item) => [item.delegate, { model: item.model, delegate: item.delegate, relations: new Map() }]));
  }
  const blocks = [...schema.matchAll(/^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gmu)];
  const names = new Set(blocks.map((match) => match[1]!));
  const output = new Map<string, PrismaModel>();
  for (const block of blocks) {
    const model = block[1]!; const relations = new Map<string, string>();
    for (const line of block[2]!.split('\n')) {
      const field = line.trim().match(/^(\w+)\s+(\w+)(?:\[\]|\?)?(?:\s|$)/u);
      if (field && names.has(field[2]!)) relations.set(field[1]!, field[2]!);
    }
    const mapped = block[2]!.match(/@@map\(["']([^"']+)["']\)/u)?.[1];
    const contract = contracts.find((item) => item.model === model);
    if (contract && mapped) contract.tableNames.add(mapped.toLowerCase());
    output.set(lowerCamel(model), { model, delegate: lowerCamel(model), relations });
  }
  return output;
}

function propertyNames(node: ts.Node, output = new Set<string>()): Set<string> {
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isMethodDeclaration(node)) {
    const name = node.name;
    if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))) output.add(name.text);
  }
  ts.forEachChild(node, (child) => { propertyNames(child, output); });
  return output;
}

function resolvedPropertyNames(node: ts.Node, checker: ts.TypeChecker, output = new Set<string>(), seen = new Set<ts.Symbol>()): Set<string> {
  propertyNames(node, output);
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current)) {
      const symbol = aliasSymbol(checker, current);
      if (symbol && !seen.has(symbol)) {
        seen.add(symbol);
        for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
          propertyNames(declaration.initializer, output);
          visit(declaration.initializer);
        }
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return output;
}

function nestedTargets(
  node: ts.Node,
  currentModel: string,
  operation: string,
  models: Map<string, PrismaModel>,
  contracts: SinkContract[],
  checker: ts.TypeChecker,
  output: WriterTarget[],
  seen = new Set<ts.Symbol>(),
): void {
  if (ts.isIdentifier(node)) {
    const symbol = aliasSymbol(checker, node);
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) nestedTargets(declaration.initializer, currentModel, operation, models, contracts, checker, output, seen);
    }
    return;
  }
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    const name = node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : '';
    const contract = contracts.find((item) => item.model === currentModel);
    if (contract?.fields.has(name)) output.push({ model: currentModel, operation, nested_relation: name });
    const relationModel = [...models.values()].find((item) => item.model === currentModel)?.relations.get(name);
    const child = ts.isPropertyAssignment(node) ? node.initializer : node.name;
    nestedTargets(child, relationModel ?? currentModel, operation, models, contracts, checker, output, seen);
    return;
  }
  ts.forEachChild(node, (child) => { nestedTargets(child, currentModel, operation, models, contracts, checker, output, seen); });
}

function sqlText(expression: ts.Expression, checker?: ts.TypeChecker, seen = new Set<ts.Symbol>()): string | null {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isTemplateExpression(expression)) return [expression.head.text, ...expression.templateSpans.map((span) => ` ? ${span.literal.text}`)].join('');
  if (ts.isTaggedTemplateExpression(expression)) return sqlText(expression.template, checker, seen);
  if (ts.isCallExpression(expression) && accessParts(expression.expression)?.at(-1) === 'sql' && expression.arguments[0]) return sqlText(expression.arguments[0], checker, seen);
  if (checker && ts.isIdentifier(expression)) {
    let symbol = checker.getSymbolAtLocation(expression);
    if (symbol?.flags && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol);
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      for (const declaration of symbol.declarations ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
          const resolved = sqlText(declaration.initializer, checker, seen);
          if (resolved !== null) return resolved;
        }
      }
    }
  }
  return null;
}

function classifySql(sql: string, contracts: SinkContract[]): { targets: WriterTarget[]; resolved: boolean } {
  const normalized = sql.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/--[^\n]*/gu, ' ').trim();
  const writes = [...normalized.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?)\s+(["`\[\]\w.]+)/giu)];
  if (writes.length) {
    const targets: WriterTarget[] = [];
    for (const match of writes) {
      const table = match[2]!.split('.').at(-1)!.replace(/["`\[\]]/gu, '').toLowerCase();
      const contract = contracts.find((item) => item.tableNames.has(table));
      if (contract) targets.push({ model: contract.model, operation: `raw_${match[1]!.split(/\s/u)[0]!.toLowerCase()}`, nested_relation: null });
    }
    return { targets, resolved: true };
  }
  if (/^(?:SELECT|WITH\b|EXPLAIN\b|SHOW\b|DESCRIBE\b|PRAGMA\b|VALUES\b)/iu.test(normalized) || /\bpg_(?:advisory|try_advisory)_/iu.test(normalized)) return { targets: [], resolved: true };
  return { targets: [], resolved: false };
}

/** Standalone lexical probe retained for focused syntax tests; repository closure uses TypeChecker below. */
export function discoverWritersInSource(file: string, text: string, includeNonWriter = false): WriterEvidence | null {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /x$/u.test(path.extname(file)) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const mutations = new Set<string>();
  let dynamicRaw = false;
  const aliases = new Map<string, string>();
  const clients = new Set(['prisma', 'db', 'tx', 'transaction', 'client']);
  const imports: Record<string, string> = {};
  const calls = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
      const specifier = node.moduleSpecifier.text;
      if (node.importClause.name) imports[node.importClause.name.text] = specifier;
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports[item.name.text] = specifier;
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && CLIENT_NAME.test(node.name.text)) clients.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const parts = accessParts(node.initializer);
      if (parts && parts.length >= 2 && parts.some((part) => clients.has(part))) aliases.set(node.name.text, parts.at(-1)!);
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && accessParts(node.initializer)?.some((part) => clients.has(part))) {
      for (const item of node.name.elements) if (ts.isIdentifier(item.name)) aliases.set(item.name.text, item.propertyName?.getText(ast).replace(/["']/gu, '') ?? item.name.text);
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) calls.add(node.expression.text);
      const parts = accessParts(node.expression);
      const operation = parts?.at(-1);
      if (parts && operation && MUTATIONS.has(operation)) {
        const model = aliases.get(parts[0]!) ?? (parts.slice(0, -2).some((part) => clients.has(part)) ? parts.at(-2) : null);
        if (model) mutations.add(`${model}.${operation}`);
        for (const name of propertyNames(node)) if (['knowledgeNodes', 'knowledgeNode', 'knowledgeLinks', 'links', 'learningFacts', 'lessonItems'].includes(name)) mutations.add(`nested.${name}`);
      }
      if (parts && operation && RAW_METHODS.has(operation)) {
        const sql = node.arguments[0] ? sqlText(node.arguments[0]) : null;
        if (sql === null) dynamicRaw = true;
        mutations.add(`raw.${operation}`);
      }
    }
    if (ts.isTaggedTemplateExpression(node) && RAW_METHODS.has(accessParts(node.tag)?.at(-1) ?? '')) mutations.add(`raw.${accessParts(node.tag)!.at(-1)}`);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const mutationList = sortUnique([...mutations]);
  const targets = mutationList.map((mutation): WriterTarget => mutation.startsWith('nested.')
    ? { model: 'nested', operation: 'relation_mutation', nested_relation: mutation.slice('nested.'.length) }
    : { model: mutation.split('.')[0]!, operation: mutation.split('.')[1] ?? 'unknown', nested_relation: null });
  return mutationList.length || dynamicRaw || includeNonWriter ? { path: normalizePath(file), mutations: mutationList, dynamic_raw: dynamicRaw, targets, calls: sortUnique([...calls]), imports, call_paths: [] } : null;
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
  } catch { /* synthetic roots may be absent */ }
  return output;
}

function functionName(node: ts.FunctionLikeDeclaration, source: ts.SourceFile): string {
  if (node.name && ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent) && ts.isIdentifier(node.parent.parent.name)) return `${node.parent.parent.name.text}.${node.name.getText(source)}`;
  if (node.name && ts.isMethodDeclaration(node) && ts.isClassLike(node.parent) && node.parent.name) return `${node.parent.name.text}.${node.name.getText(source)}`;
  if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name))) return node.name.text;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) return parent.name.text;
  if (ts.isCallExpression(parent)) return `${parent.expression.getText(source)}[callback:${parent.arguments.indexOf(node as ts.Expression)}]`;
  return '<anonymous>';
}

function isCallableImplementation(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)) && Boolean(node.body);
}

function declarationCallable(declaration: ts.Declaration): ts.FunctionLikeDeclaration | null {
  if (isCallableImplementation(declaration)) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) return declaration.initializer;
  if (ts.isPropertyAssignment(declaration) && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) return declaration.initializer;
  return null;
}

function aliasSymbol(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol?.flags && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

function hasClient(parts: string[], expression: ts.Expression, checker: ts.TypeChecker): boolean {
  if (parts.slice(0, -2).some((part) => CLIENT_NAME.test(part))) return true;
  const type = checker.typeToString(checker.getTypeAtLocation(expression));
  return /(?:PrismaClient|TransactionClient|Delegate)(?:<|\b)/u.test(type);
}

function canonicalPath(paths: string[][]): string[] | null {
  if (!paths.length) return null;
  paths.sort((a, b) => a.length - b.length || compareCodePoints(a.join('\u0000'), b.join('\u0000')));
  return paths[0]!;
}

export async function discoverWriters(root: string, registry: Registry): Promise<{ evidence: WriterEvidence[]; drift: Drift[] }> {
  const source = registry.repository_sources.find((item) => item.id === 'knowledge-direct-writers');
  if (!source) return { evidence: [], drift: [{ code: 'WRITER_CONTRACT_MISSING', scope: 'knowledge-direct-writers' }] };
  const staticDiscovery = source.static_discovery as { roots?: string[]; exclude?: string[]; prisma_mutations?: string[] } | undefined;
  const contracts = contractsFrom(staticDiscovery?.prisma_mutations ?? []);
  const prismaModels = await loadPrismaModels(root, contracts);
  const files = sortUnique((await Promise.all((staticDiscovery?.roots ?? ['src', 'scripts', 'course-content']).map((item) => walkCode(root, item)))).flat()
    .filter((file) => !(staticDiscovery?.exclude ?? []).some((glob) => matchGlob(file, glob))));
  const absoluteFiles = files.map((file) => path.join(root, file));
  const program = ts.createProgram({ rootNames: absoluteFiles, options: {
    allowJs: true, checkJs: false, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true, resolveJsonModule: true, baseUrl: root, paths: { '@/*': ['src/*'] },
  } });
  const checker = program.getTypeChecker();
  const nodes = new Map<string, SymbolNode>();
  const callableNodes = new Map<ts.FunctionLikeDeclaration, SymbolNode>();
  const declarationNodes = new Map<ts.Declaration, SymbolNode>();
  const methodCandidates = new Map<string, Array<{ node: SymbolNode; receiver: ts.Type }>>();
  const delegateAliases = new Map<ts.Symbol, SinkContract>();

  for (const file of files) {
    const sourceFile = program.getSourceFile(path.join(root, file));
    if (!sourceFile) continue;
    const moduleNode: SymbolNode = { id: `${file}#<module>`, file, node: sourceFile, calls: new Set(), sinks: [], unresolvedRaw: false };
    nodes.set(moduleNode.id, moduleNode);
    const visit = (syntax: ts.Node, owner: SymbolNode, prefix: string): void => {
      let current = owner;
      let currentPrefix = prefix;
      if (isCallableImplementation(syntax)) {
        const name = functionName(syntax, sourceFile);
        currentPrefix = prefix ? `${prefix}.${name}` : name;
        let id = `${file}#${currentPrefix}`;
        for (let suffix = 2; nodes.has(id); suffix += 1) id = `${file}#${currentPrefix}[${suffix}]`;
        current = { id, file, node: syntax, calls: new Set(), sinks: [], unresolvedRaw: false };
        nodes.set(id, current);
        callableNodes.set(syntax, current);
        if (syntax.name) for (const declaration of aliasSymbol(checker, syntax.name)?.declarations ?? []) declarationNodes.set(declaration, current);
        if ((ts.isArrowFunction(syntax) || ts.isFunctionExpression(syntax)) && (ts.isVariableDeclaration(syntax.parent) || ts.isPropertyAssignment(syntax.parent))) declarationNodes.set(syntax.parent, current);
        if (syntax.name && (ts.isMethodDeclaration(syntax) || ts.isGetAccessorDeclaration(syntax) || ts.isSetAccessorDeclaration(syntax))) {
          const receiverNode = ts.isClassLike(syntax.parent) ? syntax.parent : ts.isObjectLiteralExpression(syntax.parent) ? syntax.parent : null;
          if (receiverNode) {
            const receiver = checker.getTypeAtLocation(receiverNode);
            const list = methodCandidates.get(syntax.name.getText(sourceFile)) ?? [];
            list.push({ node: current, receiver }); methodCandidates.set(syntax.name.getText(sourceFile), list);
          }
        }
      }
      if (ts.isVariableDeclaration(syntax) && ts.isIdentifier(syntax.name) && syntax.initializer) {
        const parts = accessParts(syntax.initializer);
        const contract = parts ? contracts.find((item) => item.delegate === parts.at(-1) && hasClient([...parts, '_', '_'], syntax.initializer!, checker)) : null;
        const symbol = aliasSymbol(checker, syntax.name);
        if (contract && symbol) delegateAliases.set(symbol, contract);
      }
      if (ts.isVariableDeclaration(syntax) && ts.isObjectBindingPattern(syntax.name) && syntax.initializer) {
        const parts = accessParts(syntax.initializer);
        if (parts && (parts.some((part) => CLIENT_NAME.test(part)) || /(?:PrismaClient|TransactionClient)/u.test(checker.typeToString(checker.getTypeAtLocation(syntax.initializer))))) {
          for (const element of syntax.name.elements) if (ts.isIdentifier(element.name)) {
            const delegate = element.propertyName?.getText(sourceFile).replace(/["']/gu, '') ?? element.name.text;
            const contract = contracts.find((item) => item.delegate === delegate);
            const symbol = aliasSymbol(checker, element.name);
            if (contract && symbol) delegateAliases.set(symbol, contract);
          }
        }
      }
      ts.forEachChild(syntax, (child) => visit(child, current, currentPrefix));
    };
    visit(sourceFile, moduleNode, '');
  }

  const importsByFile = new Map<string, Record<string, string>>();
  for (const file of files) {
    const sourceFile = program.getSourceFile(path.join(root, file));
    if (!sourceFile) continue;
    const imports: Record<string, string> = {};
    for (const statement of sourceFile.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause) {
      if (statement.importClause.name) imports[statement.importClause.name.text] = statement.moduleSpecifier.text;
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports[item.name.text] = statement.moduleSpecifier.text;
    }
    importsByFile.set(file, imports);
    const ownerOf = (syntax: ts.Node): SymbolNode => {
      for (let current: ts.Node | undefined = syntax; current; current = current.parent) if (isCallableImplementation(current) && callableNodes.has(current)) return callableNodes.get(current)!;
      return nodes.get(`${file}#<module>`)!;
    };
    const visit = (syntax: ts.Node): void => {
      if (ts.isCallExpression(syntax)) {
        const owner = ownerOf(syntax);
        const expressionSymbol = aliasSymbol(checker, ts.isPropertyAccessExpression(syntax.expression) ? syntax.expression.name : syntax.expression);
        for (const declaration of expressionSymbol?.declarations ?? []) {
          const target = declarationNodes.get(declaration) ?? (declarationCallable(declaration) ? callableNodes.get(declarationCallable(declaration)!) : undefined);
          if (target) owner.calls.add(target.id);
        }
        if (ts.isPropertyAccessExpression(syntax.expression)) {
          const method = syntax.expression.name.text;
          const receiverType = checker.getTypeAtLocation(syntax.expression.expression);
          const declaredOnly = (expressionSymbol?.declarations ?? []).every((item) => ts.isMethodSignature(item) || ts.isPropertySignature(item) || !declarationCallable(item));
          if (declaredOnly) for (const candidate of methodCandidates.get(method) ?? []) {
            if (checker.isTypeAssignableTo(candidate.receiver, receiverType) || checker.isTypeAssignableTo(receiverType, candidate.receiver)) owner.calls.add(candidate.node.id);
          }
        }
        const parts = accessParts(syntax.expression);
        const operation = parts?.at(-1);
        if (parts && operation && MUTATIONS.has(operation)) {
          const parentModel = prismaModels.get(parts.at(-2) ?? '');
          const isDatabaseCall = Boolean(parentModel) && (hasClient(parts, syntax.expression, checker) || Boolean(checker.getResolvedSignature(syntax)));
          let contract = contracts.find((item) => item.delegate === parts.at(-2) && isDatabaseCall);
          const delegateExpression = ts.isPropertyAccessExpression(syntax.expression) || ts.isElementAccessExpression(syntax.expression) ? syntax.expression.expression : syntax.expression;
          if (!contract && parts.length === 2) contract = delegateAliases.get(aliasSymbol(checker, delegateExpression) as ts.Symbol);
          if (contract) {
            const names = resolvedPropertyNames(syntax, checker);
            if (contract.allFields || operation === 'delete' || operation === 'deleteMany' || [...contract.fields].some((field) => names.has(field))) owner.sinks.push({ model: contract.model, operation, nested_relation: contract.allFields ? null : [...contract.fields].find((field) => names.has(field)) ?? [...contract.fields][0] ?? null });
          }
          if (isDatabaseCall && parentModel) for (const argument of syntax.arguments) nestedTargets(argument, parentModel.model, operation, prismaModels, contracts, checker, owner.sinks);
        }
        if (parts && operation && RAW_METHODS.has(operation)) {
          const argument = syntax.arguments[0];
          const text = argument ? sqlText(argument, checker) : null;
          if (text === null) owner.unresolvedRaw = true;
          else {
            const result = classifySql(text, contracts);
            owner.sinks.push(...result.targets);
            if (!result.resolved) owner.unresolvedRaw = true;
          }
        }
        if (parts?.at(-1) === '$transaction') for (const argument of syntax.arguments) if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
          const target = callableNodes.get(argument); if (target) owner.calls.add(target.id);
        }
      }
      if (ts.isTaggedTemplateExpression(syntax)) {
        const parts = accessParts(syntax.tag);
        if (parts && RAW_METHODS.has(parts.at(-1)!)) {
          const owner = ownerOf(syntax);
          const result = classifySql(sqlText(syntax.template, checker) ?? '', contracts);
          owner.sinks.push(...result.targets); if (!result.resolved) owner.unresolvedRaw = true;
        }
      }
      ts.forEachChild(syntax, visit);
    };
    visit(sourceFile);
  }

  const sinkNodes = [...nodes.values()].filter((item) => item.sinks.length || item.unresolvedRaw);
  const reachable = (start: SymbolNode, sink: SymbolNode): string[] | null => {
    const queue: string[][] = [[start.id]]; const seen = new Set([start.id]); const paths: string[][] = [];
    while (queue.length) {
      const current = queue.shift()!; const id = current.at(-1)!;
      if (id === sink.id) { paths.push(current); continue; }
      for (const next of [...(nodes.get(id)?.calls ?? [])].sort(compareCodePoints)) if (!seen.has(next)) { seen.add(next); queue.push([...current, next]); }
    }
    return canonicalPath(paths);
  };
  const byFile = new Map<string, WriterEvidence>();
  for (const node of [...nodes.values()].sort((a, b) => compareCodePoints(a.id, b.id))) for (const sink of sinkNodes) {
    const symbols = reachable(node, sink); if (!symbols) continue;
    const evidence = byFile.get(node.file) ?? { path: node.file, mutations: [], dynamic_raw: false, targets: [], calls: [], imports: importsByFile.get(node.file) ?? {}, call_paths: [] };
    evidence.calls.push(...node.calls);
    evidence.dynamic_raw ||= sink.unresolvedRaw;
    for (const target of sink.sinks) evidence.call_paths.push({ symbols, target });
    if (sink.unresolvedRaw && !sink.sinks.length) evidence.call_paths.push({ symbols, target: { model: 'unresolved_raw_sql', operation: 'unknown', nested_relation: null } });
    byFile.set(node.file, evidence);
  }
  const evidence = [...byFile.values()].map((item) => {
    const pathMap = new Map(item.call_paths.map((entry) => [`${entry.symbols.join('\u0000')}\u0001${targetKey(entry.target)}`, entry]));
    item.call_paths = [...pathMap.values()].sort((a, b) => compareCodePoints(`${a.symbols.join('\u0000')}\u0001${targetKey(a.target)}`, `${b.symbols.join('\u0000')}\u0001${targetKey(b.target)}`));
    const targets = new Map(item.call_paths.filter((entry) => entry.target.model !== 'unresolved_raw_sql').map((entry) => [targetKey(entry.target), entry.target]));
    item.targets = [...targets.values()].sort(compareTargets);
    item.mutations = item.targets.map((target) => `${target.model}.${target.operation}${target.nested_relation ? `:${target.nested_relation}` : ''}`);
    item.calls = sortUnique(item.calls);
    return item;
  }).sort((a, b) => compareCodePoints(a.path, b.path));
  const declared = new Set(source.include ?? []); const discovered = new Set(evidence.map((item) => item.path)); const drift: Drift[] = [];
  for (const file of sortUnique([...discovered].filter((item) => !declared.has(item)))) drift.push({ code: 'DISCOVERED_WRITER_UNDECLARED', scope: file });
  for (const file of sortUnique([...declared].filter((item) => !discovered.has(item)))) drift.push({ code: 'DECLARED_WRITER_NOT_DISCOVERED', scope: file });
  for (const item of evidence.filter((entry) => entry.dynamic_raw)) drift.push({ code: 'DYNAMIC_RAW_SQL_UNRESOLVED', scope: item.path });
  return { evidence, drift };
}
