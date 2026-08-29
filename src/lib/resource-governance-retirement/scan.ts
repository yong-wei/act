/**
 * Caller denominator scan for resource-governance retirement (#1592).
 */

import type {
  GraphCaller,
  GraphFile,
  RetirementCandidate,
  ZeroCallerReceipt,
} from './contracts';
import { classifyCallerPath } from './candidates';
import { retirementDigest, retirementSha256 } from './hash';

export const RETIREMENT_SCAN_ROOTS = [
  'src',
  'scripts',
  'tests',
  'artifacts',
  'course-content',
  'openspec',
  'docs',
  'prisma',
] as const;
export const RETIREMENT_SCAN_ROOT_FILES = ['package.json'] as const;
export const RETIREMENT_SCAN_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.json',
] as const;

const DEFAULT_EXCLUDED_FRAGMENTS = [
  '/node_modules/',
  '/.git/',
  '/.next/',
  '/dist/',
  '/coverage/',
  '/src/lib/resource-governance-retirement/',
] as const;

export function fileDigest(content: string): string {
  return retirementSha256(content);
}

export function pathExcluded(
  filePath: string,
  extra: readonly string[] = [],
): boolean {
  const normalized = `/${filePath.replace(/\\/gu, '/')}`;
  return [...DEFAULT_EXCLUDED_FRAGMENTS, ...extra].some((frag) =>
    normalized.includes(frag.replace(/\\/gu, '/')),
  );
}

export function looksLikeDirectoryOrGlob(target: string): boolean {
  return /[*?[\]]/u.test(target) || target.endsWith('/') || target.endsWith('\\');
}

function lineMatchesSymbol(content: string, symbol: string): boolean {
  if (!symbol) return false;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9_])${escaped}(?:$|[^A-Za-z0-9_])`, 'u').test(content);
}

/**
 * Recompute callers for one candidate from the supplied graph files.
 * Hits inside the candidate's own source path are ownership, not callers.
 */
export function scanCandidateCallers(input: {
  candidate: RetirementCandidate;
  files: readonly GraphFile[];
  excludedFrameworkFiles?: readonly string[];
}): GraphCaller[] {
  const hits: GraphCaller[] = [];
  const source = input.candidate.sourcePath.replace(/\\/gu, '/');
  const symbol = input.candidate.exportName;
  const extraExcluded = input.excludedFrameworkFiles ?? [];

  for (const file of input.files) {
    const path = file.path.replace(/\\/gu, '/');
    if (path === source) continue;
    if (pathExcluded(path, extraExcluded)) continue;
    if (file.isDirectory) continue;

    const mentionsPath = mentionsEntrypoint(file.content, source, path);

    const mentionsSymbol = symbol && symbol.length >= 16
      ? lineMatchesSymbol(file.content, symbol)
      : false;
    if (!mentionsPath && !mentionsSymbol) continue;

    hits.push({
      path,
      symbol: mentionsSymbol ? symbol : source,
      callerClass: classifyCallerPath(path),
      kind: classifyHitKind(path, file.content, mentionsPath),
    });
  }

  hits.sort((a, b) =>
    a.path === b.path
      ? (a.symbol ?? '').localeCompare(b.symbol ?? '')
      : a.path.localeCompare(b.path),
  );
  return hits;
}

export function buildZeroCallerReceipt(input: {
  candidate: RetirementCandidate;
  captureRevision: string;
  hits: readonly GraphCaller[];
  excludedFrameworkFiles?: readonly string[];
}): ZeroCallerReceipt {
  const body = {
    candidateId: input.candidate.id,
    captureRevision: input.captureRevision,
    scanRules: {
      exactPath: true as const,
      exactSymbol: true as const,
      includeTests: true as const,
      includeDynamic: true as const,
      includeGenerated: true as const,
      excludedFrameworkFiles: [...(input.excludedFrameworkFiles ?? [])].sort(),
    },
    hits: [...input.hits].sort((a, b) => a.path.localeCompare(b.path)),
    zeroCallers: input.hits.length === 0,
  };
  return {
    ...body,
    receiptDigest: retirementDigest(body),
  };
}

export function receiptIntegrityReasons(receipt: ZeroCallerReceipt): string[] {
  const reasons: string[] = [];
  const { receiptDigest, ...body } = receipt;
  if (retirementDigest(body) !== receiptDigest) {
    reasons.push(`zero-caller-digest-mismatch:${receipt.candidateId}`);
  }
  if (receipt.zeroCallers !== (receipt.hits.length === 0)) {
    reasons.push(`zero-caller-flag-mismatch:${receipt.candidateId}`);
  }
  return reasons;
}

function classifyHitKind(
  path: string,
  content: string,
  mentionsPath: boolean,
): GraphCaller['kind'] {
  const normalized = path.replace(/\\/gu, '/');
  if (
    normalized.includes('/__tests__/')
    || normalized.startsWith('tests/')
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(normalized)
  ) {
    return 'test';
  }
  if (content.includes('import(') && mentionsPath) return 'dynamic';
  if (mentionsPath) return 'import';
  return 'string';
}

function posixRelative(fromDir: string, toDir: string): string {
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = toDir.split('/').filter(Boolean);
  let index = 0;
  while (index < fromParts.length && index < toParts.length && fromParts[index] === toParts[index]) {
    index += 1;
  }
  const up = fromParts.slice(index).map(() => '..');
  const down = toParts.slice(index);
  return [...up, ...down].join('/');
}

function mentionsRelativeImport(content: string, source: string, fromFile: string): boolean {
  if (!/\.tsx?$/u.test(source)) return false;
  const sourceDir = source.slice(0, source.lastIndexOf('/'));
  const fromDir = fromFile.slice(0, fromFile.lastIndexOf('/'));
  if (!sourceDir || !fromDir) return false;
  const base = source.slice(source.lastIndexOf('/') + 1).replace(/\.tsx?$/u, '');
  const relDir = posixRelative(fromDir, sourceDir);
  const specifiers = relDir === ''
    ? [`./${base}`, `./${base}.ts`, `./${base}.tsx`]
    : [`${relDir}/${base}`, `${relDir}/${base}.ts`, `${relDir}/${base}.tsx`];
  return specifiers.some((specifier) => content.includes(specifier));
}

/**
 * Match an exact source path, TS path alias, relative import, or API href.
 * List routes must not match detail / v2 / active suffixes.
 */
export function mentionsEntrypoint(
  content: string,
  source: string,
  fromFile?: string,
): boolean {
  const normalized = source.replace(/\\/gu, '/');
  if (content.includes(normalized)) return true;
  const atPath = normalized.replace(/^src\//u, '@/');
  if (content.includes(atPath)) return true;
  const atPathNoExt = atPath.replace(/\.tsx?$/u, '');
  if (atPathNoExt !== atPath && content.includes(atPathNoExt)) return true;
  if (fromFile && mentionsRelativeImport(content, normalized, fromFile.replace(/\\/gu, '/'))) {
    return true;
  }
  if (normalized.startsWith('src/app/api/') && /\/route\.tsx?$/u.test(normalized)) {
    const href = normalized.slice('src/app'.length).replace(/\/route\.tsx?$/u, '');
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return new RegExp(`${escaped}(?![\\w./-])`, 'u').test(content);
  }
  return false;
}

export function hashCandidateSet(candidates: readonly RetirementCandidate[]): string {
  return retirementDigest(
    [...candidates]
      .map((row) => ({
        id: row.id,
        owner: row.owner,
        sourcePath: row.sourcePath,
        exportName: row.exportName,
        semanticRole: row.semanticRole,
        replacement: row.replacement,
        migrationRevision: row.migrationRevision,
        retireable: row.retireable,
        deletionCondition: row.deletionCondition,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function hashDenominator(
  callersByCandidate: Readonly<Record<string, readonly GraphCaller[]>>,
): string {
  const rows = Object.keys(callersByCandidate)
    .sort()
    .map((id) => ({
      id,
      callers: [...callersByCandidate[id]!].map((hit) => ({
        path: hit.path,
        symbol: hit.symbol,
        callerClass: hit.callerClass,
        kind: hit.kind,
      })).sort((a, b) => a.path.localeCompare(b.path)),
    }));
  return retirementDigest(rows);
}

export function callersMatchReceipt(
  live: readonly GraphCaller[],
  receipt: ZeroCallerReceipt,
): boolean {
  if (live.length !== receipt.hits.length) return false;
  const left = [...live].map((h) => `${h.path}|${h.symbol}|${h.callerClass}|${h.kind}`).sort();
  const right = [...receipt.hits].map((h) => `${h.path}|${h.symbol}|${h.callerClass}|${h.kind}`).sort();
  return left.every((row, index) => row === right[index]);
}
