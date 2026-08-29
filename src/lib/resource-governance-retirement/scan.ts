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

function pathExcluded(
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

    const mentionsPath = file.content.includes(source)
      || file.content.includes(source.replace(/^src\//u, '@/'))
      || (source.startsWith('src/lib/')
        && file.content.includes(`@/${source.slice('src/'.length).replace(/\.tsx?$/u, '')}`))
      || (source.startsWith('src/app/api/')
        && file.content.includes(
          source.slice('src/app'.length).replace(/\/route\.tsx?$/u, ''),
        ));

    const mentionsSymbol = symbol && symbol.length >= 16
      ? lineMatchesSymbol(file.content, symbol)
      : false;
    if (!mentionsPath && !mentionsSymbol) continue;

    hits.push({
      path,
      symbol: mentionsSymbol ? symbol : source,
      callerClass: classifyCallerPath(path),
      kind: path.includes('__tests__') || /\.test\./u.test(path)
        ? 'test'
        : file.content.includes('import(')
          && mentionsPath
          ? 'dynamic'
          : mentionsPath
            ? 'import'
            : 'string',
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

export function hashCandidateSet(candidates: readonly RetirementCandidate[]): string {
  return retirementDigest(
    [...candidates]
      .map((row) => ({
        id: row.id,
        owner: row.owner,
        sourcePath: row.sourcePath,
        exportName: row.exportName,
        semanticRole: row.semanticRole,
        replacementContract: row.replacement.contract,
        replacementSymbol: row.replacement.publicSymbol,
        migrationRevision: row.migrationRevision,
        retireable: row.retireable,
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
