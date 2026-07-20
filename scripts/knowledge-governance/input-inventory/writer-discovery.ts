import { readdir, readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { compareCodePoints, normalizePath, sortUnique } from './normalize';
import { matchGlob, type Registry } from './registry';
import type { Drift } from './types';

interface RevisionPipelineCommands { archive?: string; extract?: string; tempTag?: string }

async function materializeRevisionFiles(root: string, revision: string, directory: string, files: string[], commands: RevisionPipelineCommands = {}): Promise<void> {
  if (files.length === 0) return;
  const settle = (child: ReturnType<typeof spawn>): Promise<{ code: number | null; signal: NodeJS.Signals | null; error: Error | null; stderr: string }> => new Promise((resolve) => {
    const stderr: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    let processError: Error | null = null;
    child.once('error', (error) => { processError = error; });
    child.once('close', (code, signal) => resolve({ code, signal, error: processError, stderr: Buffer.concat(stderr).toString('utf8').trim() }));
  });
  for (let offset = 0; offset < files.length; offset += 128) {
    const chunk = files.slice(offset, offset + 128);
    const archive = spawn(commands.archive ?? 'git', ['archive', '--format=tar', revision, '--', ...chunk], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const extract = spawn(commands.extract ?? 'tar', ['-xf', '-', '-C', directory], { stdio: ['pipe', 'ignore', 'pipe'] });
    const archiveSettled = settle(archive);
    const extractSettled = settle(extract);
    let firstFailure: 'archive' | 'extract' | 'pipe' | null = null;
    let pipelineError: Error | null = null;
    let pipeTriggered = false;
    let archiveOutputEnded = false;
    const terminatePeer = (peer: ReturnType<typeof spawn>) => {
      if (peer.exitCode !== null || peer.signalCode !== null) return;
      peer.kill('SIGTERM');
      const timer = setTimeout(() => { if (peer.exitCode === null && peer.signalCode === null) peer.kill('SIGKILL'); }, 2_000);
      timer.unref();
    };
    const failPipe = (error: Error) => {
      pipelineError ??= error;
      pipeTriggered = true;
      terminatePeer(archive);
    };
    archive.stdout.once('end', () => { archiveOutputEnded = true; });
    archive.stdout.on('error', failPipe);
    extract.stdin.on('error', failPipe);
    archive.stdout.pipe(extract.stdin);
    archiveSettled.then((result) => { if (result.code !== 0 || result.signal || result.error) { if (!pipeTriggered) firstFailure ??= 'archive'; terminatePeer(extract); } });
    extractSettled.then((result) => {
      if (result.code !== 0 || result.signal || result.error) { firstFailure ??= 'extract'; terminatePeer(archive); }
      else if (!archiveOutputEnded && !archive.stdout.readableEnded) {
        const timer = setTimeout(() => {
          if (!archiveOutputEnded && !archive.stdout.readableEnded && archive.exitCode === null && archive.signalCode === null) failPipe(new Error('extract exited successfully before archive output ended'));
        }, 50);
        timer.unref();
      }
    });
    const [archiveResult, extractResult] = await Promise.all([archiveSettled, extractSettled]);
    if (!firstFailure && pipeTriggered) firstFailure = 'pipe';
    const failure = firstFailure === 'extract'
      ? { label: 'tar extract writer revision', result: extractResult }
      : firstFailure === 'pipe'
        ? { label: 'writer revision pipe', result: { code: null, signal: null, error: pipelineError, stderr: '' } }
      : archiveResult.code !== 0 || archiveResult.signal || archiveResult.error
      ? { label: 'git archive writer revision', result: archiveResult }
      : extractResult.code !== 0 || extractResult.signal || extractResult.error
        ? { label: 'tar extract writer revision', result: extractResult }
        : null;
    if (failure) throw new Error(`${failure.label} failed (${failure.result.signal ?? failure.result.code ?? failure.result.error?.name ?? 'stream'}): ${failure.result.stderr || failure.result.error?.message || 'no detail'}`);
  }
}

const MUTATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const NESTED_CREATE_OPERATIONS = new Set(['create', 'createMany', 'upsert', 'connectOrCreate']);
const CLIENT_NAME = /^(?:prisma|db|tx|transaction|client)$/iu;
const RAW_METHODS = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const ACTIVE_REVISION_RESOLVER_FILE = 'src/lib/data-governance/knowledge-truth-revision.ts';
const ACTIVE_REVISION_RESOLVER_EXPORT = 'resolveActiveKnowledgeRevision';

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

export async function validateLearningFactProducerContracts(root: string, registry: Registry, evidence: WriterEvidence[]): Promise<Drift[]> {
  const contract = registry.knowledge_truth_revision_contract;
  if (!contract) return [];
  const requiredFields = contract.learning_fact_fields;
  if (!Array.isArray(requiredFields) || !requiredFields.some((field) => String(field).endsWith('.knowledgeRevisionRef'))) {
    return [{ code: 'LEARNING_FACT_PRODUCER_CONTRACT_INVALID', scope: 'knowledge_truth_revision_contract.learning_fact_fields' }];
  }
  const producers = new Map<string, WriterCallPath[]>();
  for (const item of evidence) for (const callPath of item.call_paths) {
    if (callPath.target.model !== 'LearningFact' || !['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'connectOrCreate', 'raw_insert'].includes(callPath.target.operation)) continue;
    const sinkSymbol = callPath.symbols.at(-1);
    const producerPath = sinkSymbol?.split('#')[0];
    if (!producerPath) continue;
    producers.set(producerPath, [...(producers.get(producerPath) ?? []), callPath]);
  }
  const files = sortUnique([...producers.values()].flat().flatMap((callPath) => callPath.symbols.map((symbol) => symbol.split('#')[0]!))).map((file) => path.join(root, file));
  const program = ts.createProgram({ rootNames: files, options: { allowJs: true, checkJs: false, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler } });
  const checker = program.getTypeChecker();
  const drift: Drift[] = [];
  for (const [producerPath, producerCallPaths] of [...producers].sort(([left], [right]) => compareCodePoints(left, right))) {
    const scope = producerPath;
    const sourceFile = program.getSourceFile(path.join(root, producerPath));
    const contractPaths = requiredFields.map((field) => String(field).split('.').slice(1));
    const allowedPrefixes = new Set(((contract.producer_source_prefixes ?? []) as unknown[]).map(String));
    const proofs = sourceFile ? learningFactSinkProofs(sourceFile, checker, program, producerCallPaths.map((item) => item.symbols), contractPaths, allowedPrefixes) : [];
    for (const callPath of producerCallPaths.filter((item) => item.target.operation === 'raw_insert')) proofs.push({ sourcePresent: false, sourceNamespaced: false, revisionPresent: false, multipleRevisions: false, activeRevision: false, atomic: false });
    if (!proofs.length || proofs.some((proof) => !proof.sourcePresent)) drift.push({ code: 'LEARNING_FACT_PRODUCER_SOURCE_ID_MISSING', scope });
    else if (proofs.some((proof) => !proof.sourceNamespaced)) drift.push({ code: 'LEARNING_FACT_PRODUCER_SOURCE_NAMESPACE_UNRESOLVED', scope });
    if (!proofs.length || proofs.some((proof) => !proof.revisionPresent)) drift.push({ code: 'LEARNING_FACT_PRODUCER_KNOWLEDGE_REVISION_MISSING', scope });
    if (proofs.some((proof) => proof.multipleRevisions)) drift.push({ code: 'LEARNING_FACT_PRODUCER_MULTIPLE_REVISIONS_POSSIBLE', scope });
    if (proofs.some((proof) => proof.revisionPresent && !proof.multipleRevisions && !proof.activeRevision)) drift.push({ code: 'LEARNING_FACT_PRODUCER_ACTIVE_REVISION_UNRESOLVED', scope });
    if (!proofs.length || proofs.some((proof) => !proof.atomic)) drift.push({ code: 'LEARNING_FACT_PRODUCER_NON_ATOMIC', scope });
  }
  return drift;
}

interface LearningFactSinkProof { sourcePresent: boolean; sourceNamespaced: boolean; revisionPresent: boolean; multipleRevisions: boolean; activeRevision: boolean; atomic: boolean }

function resolvedExpression(node: ts.Expression, checker: ts.TypeChecker, seen = new Set<ts.Symbol>()): ts.Expression {
  if (ts.isIdentifier(node)) {
    const symbol = aliasSymbol(checker, node);
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return resolvedExpression(declaration.initializer, checker, seen);
      const callable = declaration && declarationCallable(declaration);
      if (callable?.body && ts.isBlock(callable.body)) {
        const returns = callable.body.statements.filter(ts.isReturnStatement).map((item) => item.expression).filter((item): item is ts.Expression => Boolean(item));
        if (returns.length === 1) return resolvedExpression(returns[0]!, checker, seen);
      }
    }
  }
  if (ts.isCallExpression(node)) {
    const symbol = aliasSymbol(checker, ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    const callable = declaration && declarationCallable(declaration);
    if (callable?.body && ts.isBlock(callable.body)) {
      const returns = callable.body.statements.filter(ts.isReturnStatement).map((item) => item.expression).filter((item): item is ts.Expression => Boolean(item));
      if (returns.length === 1) return resolvedExpression(returns[0]!, checker, seen);
    }
  }
  return node;
}

function namedProperty(node: ts.Expression, name: string, checker: ts.TypeChecker): ts.Expression | null {
  const value = resolvedExpression(node, checker);
  if (!ts.isObjectLiteralExpression(value)) return null;
  for (const property of value.properties) {
    const propertyName = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : null;
    if (propertyName !== name) continue;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
  }
  return null;
}

function propertyAtPath(node: ts.Expression, names: string[], checker: ts.TypeChecker): ts.Expression | null {
  let current: ts.Expression | null = node;
  for (const name of names) current = current && namedProperty(current, name, checker);
  return current;
}

function revisionValues(node: ts.Expression, plural: boolean, checker: ts.TypeChecker): { values: ts.Expression[]; unresolved: boolean } {
  const resolved = resolvedExpression(node, checker);
  if (!plural) return { values: [node], unresolved: false };
  if (!ts.isArrayLiteralExpression(resolved)) return { values: [], unresolved: true };
  return { values: [...resolved.elements].filter(ts.isExpression), unresolved: resolved.elements.some(ts.isSpreadElement) };
}

function revisionIdentity(node: ts.Expression, checker: ts.TypeChecker, seen = new Set<ts.Symbol>()): ts.Symbol | string | null {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isAwaitExpression(node)) return revisionIdentity(node.expression, checker, seen);
  if (ts.isIdentifier(node)) {
    const symbol = aliasSymbol(checker, node);
    if (!symbol || seen.has(symbol)) return symbol ?? null;
    seen.add(symbol);
    for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) return revisionIdentity(declaration.initializer, checker, seen);
    return symbol;
  }
  if (ts.isCallExpression(node) && canonicalActiveResolver(node, checker)) return `${node.getSourceFile().fileName}:${node.pos}`;
  return `${node.getSourceFile().fileName}:${node.pos}`;
}

function namespaceClassified(node: ts.Expression, checker: ts.TypeChecker, allowedPrefixes: Set<string>): boolean {
  const resolveValue = (current: ts.Expression, seen = new Set<ts.Symbol>()): ts.Expression => {
    if (!ts.isIdentifier(current)) return current;
    const symbol = aliasSymbol(checker, current);
    if (!symbol || seen.has(symbol)) return current;
    seen.add(symbol);
    for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) return resolveValue(declaration.initializer, seen);
    return current;
  };
  const value = resolveValue(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return [...allowedPrefixes].some((prefix) => value.text.startsWith(`${prefix}:`) && value.text.length > prefix.length + 1);
  if (ts.isTemplateExpression(value)) return [...allowedPrefixes].some((prefix) => value.head.text === `${prefix}:`);
  if (ts.isCallExpression(value)) {
    const location = ts.isPropertyAccessExpression(value.expression) ? value.expression.name : value.expression;
    const symbol = aliasSymbol(checker, location);
    return Boolean(symbol?.declarations?.some((declaration) => declaration.getSourceFile().fileName.replaceAll('\\', '/').endsWith(`/${ACTIVE_REVISION_RESOLVER_FILE}`)
      && declaration.name && ts.isIdentifier(declaration.name) && declaration.name.text === 'classifyLearningFactSource'));
  }
  return false;
}

function canonicalActiveResolver(node: ts.CallExpression, checker: ts.TypeChecker): boolean {
  const location = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
  const symbol = aliasSymbol(checker, location);
  return Boolean(symbol?.declarations?.some((declaration) => declaration.getSourceFile().fileName.replaceAll('\\', '/').endsWith(`/${ACTIVE_REVISION_RESOLVER_FILE}`)
    && ((declaration.name && ts.isIdentifier(declaration.name) && declaration.name.text === ACTIVE_REVISION_RESOLVER_EXPORT) || ts.isExportSpecifier(declaration))));
}

function derivesFromActiveRevision(node: ts.Expression, checker: ts.TypeChecker, seen = new Set<ts.Symbol>()): boolean {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return derivesFromActiveRevision(node.expression, checker, seen);
  if (ts.isCallExpression(node)) return canonicalActiveResolver(node, checker);
  if (ts.isIdentifier(node)) {
    const symbol = aliasSymbol(checker, node);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer && derivesFromActiveRevision(declaration.initializer, checker, seen)) return true;
  }
  if (ts.isAwaitExpression(node)) return derivesFromActiveRevision(node.expression, checker, seen);
  return false;
}

function inTransactionCallback(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isCallExpression(current.parent)
      && accessParts(current.parent.expression)?.at(-1) === '$transaction' && current.parent.arguments.includes(current)) return true;
  }
  return false;
}

function rootSymbol(node: ts.Expression, checker: ts.TypeChecker, seen = new Set<ts.Symbol>()): ts.Symbol | null {
  const root = accessParts(node)?.[0];
  if (!root) return null;
  let identifier: ts.Identifier | null = null;
  const find = (current: ts.Expression): void => {
    if (ts.isIdentifier(current)) identifier = current;
    else if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) find(current.expression);
  };
  find(node);
  if (!identifier) return null;
  const symbol = aliasSymbol(checker, identifier);
  if (!symbol || seen.has(symbol)) return symbol ?? null;
  seen.add(symbol);
  for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) return rootSymbol(declaration.initializer, checker, seen);
  return symbol;
}

function directTransactionClient(sink: ts.CallExpression, checker: ts.TypeChecker): boolean {
  const callback = transactionCallback(sink);
  if (!callback) return false;
  const sinkSymbol = rootSymbol(sink.expression, checker);
  return callback.parameters.some((parameter) => ts.isIdentifier(parameter.name) && aliasSymbol(checker, parameter.name) === sinkSymbol);
}

function transactionCallback(node: ts.Node): ts.FunctionLikeDeclaration | null {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isCallExpression(current.parent)
      && accessParts(current.parent.expression)?.at(-1) === '$transaction' && current.parent.arguments.includes(current)) return current;
  }
  return null;
}

function activeRevisionInSameTransaction(node: ts.Expression, sink: ts.Node, checker: ts.TypeChecker): boolean {
  const expected = transactionCallback(sink);
  if (!expected) return false;
  const visit = (current: ts.Expression, seen = new Set<ts.Symbol>()): ts.CallExpression | null => {
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) return visit(current.expression, seen);
    if (ts.isAwaitExpression(current)) return visit(current.expression, seen);
    if (ts.isCallExpression(current) && canonicalActiveResolver(current, checker)) return current;
    if (ts.isIdentifier(current)) {
      const symbol = aliasSymbol(checker, current);
      if (!symbol || seen.has(symbol)) return null;
      seen.add(symbol);
      for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const found = visit(declaration.initializer, seen); if (found) return found;
      }
    }
    return null;
  };
  const resolver = visit(node);
  const sinkCall = (() => { for (let current: ts.Node | undefined = sink; current; current = current.parent) if (ts.isCallExpression(current)) return current; return null; })();
  const sinkClient = sinkCall ? rootSymbol(sinkCall.expression, checker) : null;
  return Boolean(resolver && transactionCallback(resolver) === expected && sinkClient
    && resolver.arguments.some((argument) => rootSymbol(argument, checker) === sinkClient));
}

function activeRevisionInSinkOwner(node: ts.Expression, sink: ts.Node, checker: ts.TypeChecker): boolean {
  const ownerOf = (value: ts.Node): ts.FunctionLikeDeclaration | null => {
    for (let current: ts.Node | undefined = value; current; current = current.parent) if (isCallableImplementation(current)) return current;
    return null;
  };
  const find = (current: ts.Expression, seen = new Set<ts.Symbol>()): ts.CallExpression | null => {
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) return find(current.expression, seen);
    if (ts.isAwaitExpression(current)) return find(current.expression, seen);
    if (ts.isCallExpression(current) && canonicalActiveResolver(current, checker)) return current;
    if (ts.isIdentifier(current)) {
      const symbol = aliasSymbol(checker, current); if (!symbol || seen.has(symbol)) return null; seen.add(symbol);
      for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) { const found = find(declaration.initializer, seen); if (found) return found; }
    }
    return null;
  };
  const resolver = find(node);
  const sinkClient = ts.isCallExpression(sink) ? rootSymbol(sink.expression, checker) : null;
  return Boolean(resolver && ownerOf(resolver) === ownerOf(sink) && sinkClient
    && resolver.arguments.some((argument) => rootSymbol(argument, checker) === sinkClient));
}

function transactionClientFlowsToSink(program: ts.Program, checker: ts.TypeChecker, sink: ts.CallExpression, owner: ts.FunctionLikeDeclaration, callPaths: string[][]): boolean {
  const sinkClient = rootSymbol(sink.expression, checker);
  const parameterIndex = owner.parameters.findIndex((parameter) => ts.isIdentifier(parameter.name) && aliasSymbol(checker, parameter.name) === sinkClient);
  if (parameterIndex < 0) return false;
  for (const sourceFile of program.getSourceFiles().filter((item) => !item.isDeclarationFile)) {
    let proven = false;
    const visit = (node: ts.Node): void => {
      if (proven || !ts.isCallExpression(node)) { if (!proven) ts.forEachChild(node, visit); return; }
      const symbol = aliasSymbol(checker, ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression);
      const callsOwner = (symbol?.declarations ?? []).some((declaration) => declarationCallable(declaration) === owner || declaration === owner);
      const argument = node.arguments[parameterIndex];
      const callback = transactionCallback(node);
      if (callsOwner && callback && argument && callback.parameters.some((parameter) => ts.isIdentifier(parameter.name) && aliasSymbol(checker, parameter.name) === rootSymbol(argument, checker))) {
        const callbackName = functionName(callback, sourceFile);
        proven = callPaths.some((symbols) => symbols.some((entry) => entry.endsWith(`#${callbackName}`)) && symbols.at(-1)?.endsWith(`#${functionName(owner, owner.getSourceFile())}`));
      }
      if (!proven) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (proven) return true;
  }
  return false;
}

function learningFactSinkProofs(source: ts.SourceFile, checker: ts.TypeChecker, program: ts.Program, callPaths: string[][], sourceFileContractPaths: string[][], allowedPrefixes: Set<string>): LearningFactSinkProof[] {
  const sinkOwners = new Set(callPaths.map((item) => item.at(-1)?.split('#')[1]).filter(Boolean));
  const proofs: LearningFactSinkProof[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const parts = accessParts(node.expression);
      if (parts?.at(-2) === 'learningFact' && ['create', 'createMany', 'createManyAndReturn', 'upsert'].includes(parts.at(-1) ?? '')) {
        const owner = (() => { for (let current: ts.Node | undefined = node; current; current = current.parent) if (isCallableImplementation(current)) return functionName(current, source); return '<module>'; })();
        if (sinkOwners.has(owner) || [...sinkOwners].some((id) => id?.endsWith(owner))) {
          const options = node.arguments[0];
          const data = options && (namedProperty(options, 'data', checker) ?? namedProperty(options, 'create', checker));
          const sourceValue = data && (namedProperty(data, 'sourceEventId', checker) ?? namedProperty(data, 'sourceLogId', checker));
          const declaredPaths = (sourceFileContractPaths ?? []).filter((path) => path.at(-1) === 'knowledgeRevisionRef');
          const pluralPaths = (sourceFileContractPaths ?? []).filter((path) => path.at(-1) === 'knowledgeRevisionRefs');
          const revisions = data ? declaredPaths.map((path) => propertyAtPath(data, path, checker)).filter((value): value is ts.Expression => Boolean(value)) : [];
          const plurals = data ? pluralPaths.map((path) => propertyAtPath(data, path, checker)).filter((value): value is ts.Expression => Boolean(value)) : [];
          const collected = [
            ...revisions.map((value) => revisionValues(value, false, checker)),
            ...plurals.map((value) => revisionValues(value, true, checker)),
          ];
          const revisionCandidates = collected.flatMap((item) => item.values);
          const identities = revisionCandidates.map((value) => revisionIdentity(value, checker));
          const unresolvedRevision = collected.some((item) => item.unresolved) || identities.some((identity) => identity === null);
          const distinctRevisionCount = new Set(identities.filter((identity): identity is ts.Symbol | string => identity !== null)).size;
          const revision = revisionCandidates[0] ?? null;
          const ownerNode = (() => { for (let current: ts.Node | undefined = node; current; current = current.parent) if (isCallableImplementation(current)) return current; return null; })();
          const pathAtomic = Boolean(ownerNode && transactionClientFlowsToSink(program, checker, node, ownerNode, callPaths));
          const allActive = revisionCandidates.length > 0 && revisionCandidates.every((value) => derivesFromActiveRevision(value, checker)
            && (activeRevisionInSameTransaction(value, node, checker) || (pathAtomic && activeRevisionInSinkOwner(value, node, checker))));
          proofs.push({ sourcePresent: Boolean(sourceValue), sourceNamespaced: Boolean(sourceValue && namespaceClassified(sourceValue, checker, allowedPrefixes)), revisionPresent: revisionCandidates.length > 0 || plurals.length > 0, multipleRevisions: unresolvedRevision || distinctRevisionCount > 1, activeRevision: allActive && !unresolvedRevision && distinctRevisionCount === 1, atomic: directTransactionClient(node, checker) || pathAtomic });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return proofs;
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
    if (contract?.allFields && NESTED_CREATE_OPERATIONS.has(name)) output.push({ model: currentModel, operation: name, nested_relation: null });
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
  if (ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)) {
    const value = checker.getShorthandAssignmentValueSymbol(node.parent);
    if (value) return value;
  }
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
  drift.push(...await validateLearningFactProducerContracts(root, registry, evidence));
  return { evidence, drift };
}

export async function discoverWritersAtRevision(root: string, revision: string, registry: Registry, pipelineCommands: RevisionPipelineCommands = {}): Promise<{ evidence: WriterEvidence[]; drift: Drift[] }> {
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error(`invalid writer discovery revision: ${revision}`);
  const tempTag = pipelineCommands.tempTag && /^[A-Za-z0-9_-]{1,48}$/u.test(pipelineCommands.tempTag) ? `${pipelineCommands.tempTag}-` : '';
  const created = spawnSync('mktemp', ['-d', path.join(os.tmpdir(), `knowledge-writer-revision-${tempTag}XXXXXX`)], { encoding: 'utf8' });
  const directory = created.stdout.trim();
  if (created.status !== 0 || path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('knowledge-writer-revision-')) throw new Error('unable to create controlled writer revision directory');
  let primaryError: unknown;
  try {
    const source = registry.repository_sources.find((item) => item.id === 'knowledge-direct-writers');
    const roots = ((source?.static_discovery as { roots?: string[] } | undefined)?.roots ?? ['src', 'scripts', 'course-content']).map((item) => normalizePath(item));
    const listed = spawnSync('git', ['ls-tree', '-r', '--name-only', '-z', revision], { cwd: root, encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
    if (listed.status !== 0) throw new Error(`unable to list writer discovery revision: ${listed.stderr.toString('utf8').trim()}`);
    const support = new Set(['package.json', 'tsconfig.json', 'prisma/schema.prisma']);
    const files = sortUnique(listed.stdout.toString('utf8').split('\0').filter(Boolean).map(normalizePath).filter((file) =>
      support.has(file) || (roots.some((candidate) => file === candidate || file.startsWith(`${candidate}/`)) && /\.(?:[cm]?[jt]sx?|json|prisma)$/iu.test(file)),
    ));
    await materializeRevisionFiles(root, revision, directory, files, pipelineCommands);
    const linked = spawnSync('ln', ['-s', path.join(root, 'node_modules'), path.join(directory, 'node_modules')], { encoding: 'utf8' });
    if (linked.status !== 0) throw new Error(`unable to link writer discovery dependencies: ${linked.stderr.trim()}`);
    return await discoverWriters(directory, registry);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleaned = spawnSync('rm', ['-rf', '--', directory], { encoding: 'utf8' });
    if (cleaned.status !== 0) {
      const detail = `writer revision cleanup failed: ${cleaned.stderr.trim()}`;
      if (primaryError instanceof Error) primaryError.message = `${primaryError.message}; ${detail}`;
      else throw new Error(detail);
    }
  }
}
