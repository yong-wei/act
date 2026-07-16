import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const GIT_ENVIRONMENT_KEYS = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
]);
const reviewedFileCache = new Map<string, Buffer | null>();

export type SemanticDigestPair = {
  reviewed: string | null;
  current: string | null;
  currentRawHash: string | null;
  baselineStatus: 'available' | 'unavailable';
};

export function canonicalSemanticDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function canonicalLocatorDigest(content: Buffer, selector: string): string {
  if (selector === 'resource-body') {
    return canonicalSemanticDigest(content.toString('utf8').replace(/\r\n?/g, '\n'));
  }
  if (selector.startsWith('json-pointer:')) {
    const document = JSON.parse(content.toString('utf8')) as unknown;
    return canonicalSemanticDigest(resolveJsonPointer(document, selector.slice('json-pointer:'.length)));
  }
  if (selector.startsWith('markdown-line:')) {
    const lineNumber = Number(selector.slice('markdown-line:'.length));
    const lines = content.toString('utf8').replace(/\r\n?/g, '\n').split('\n');
    if (!Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid Markdown semantic locator: ${selector}`);
    }
    return canonicalSemanticDigest(lines[lineNumber - 1].trim());
  }
  if (selector.startsWith('file-sha256:')) {
    return rawContentDigest(content);
  }
  throw new Error(`Unsupported semantic locator: ${selector}`);
}

export async function semanticDigestPair(
  repoRoot: string,
  relativePath: string | null,
  selector: string | null,
  reviewedRawHash: string | null,
): Promise<SemanticDigestPair> {
  if (!relativePath || !selector) {
    return { reviewed: null, current: null, currentRawHash: null, baselineStatus: 'unavailable' };
  }
  const currentFile = await readCurrentFile(repoRoot, relativePath);
  const currentRawHash = currentFile ? rawContentDigest(currentFile) : null;
  const reviewedFile = readReviewedFile(repoRoot, relativePath, reviewedRawHash);
  return {
    reviewed: reviewedFile ? canonicalLocatorDigest(reviewedFile, selector) : null,
    current: currentFile ? canonicalLocatorDigest(currentFile, selector) : null,
    currentRawHash,
    baselineStatus: reviewedFile ? 'available' : 'unavailable',
  };
}

export function semanticFreshnessReasons(
  scope: 'source' | 'manifest' | 'evidence',
  pair: Pick<SemanticDigestPair, 'reviewed' | 'current'>,
): string[] {
  return [
    pair.current === null ? `${scope}-identity-disappeared` : null,
    pair.reviewed === null ? `${scope}-semantic-baseline-unavailable` : null,
    pair.reviewed !== null && pair.current !== null && pair.reviewed !== pair.current
      ? `${scope}-semantic-changed`
      : null,
  ].filter((reason): reason is string => reason !== null);
}

export function sanitizedGitEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sanitized = { ...environment };
  for (const key of GIT_ENVIRONMENT_KEYS) delete sanitized[key];
  return sanitized;
}

function rawContentDigest(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

async function readCurrentFile(repoRoot: string, relativePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function readReviewedFile(
  repoRoot: string,
  relativePath: string,
  reviewedRawHash: string | null,
): Buffer | null {
  if (!reviewedRawHash) return null;
  const cacheKey = `${repoRoot}\0${relativePath}\0${reviewedRawHash}`;
  if (reviewedFileCache.has(cacheKey)) return reviewedFileCache.get(cacheKey)!;
  const options = {
    cwd: repoRoot,
    env: sanitizedGitEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
  } as const;
  const commits = execFileSync('git', ['log', '--all', '--format=%H', '--', relativePath], {
    ...options,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  for (const commit of commits) {
    try {
      const content = execFileSync('git', ['show', `${commit}:${relativePath}`], options);
      if (rawContentDigest(content) === reviewedRawHash) {
        reviewedFileCache.set(cacheKey, content);
        return content;
      }
    } catch {
      // The path may not exist in an older commit.
    }
  }
  reviewedFileCache.set(cacheKey, null);
  return null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function resolveJsonPointer(document: unknown, pointer: string): unknown {
  if (pointer !== '' && !pointer.startsWith('/')) throw new Error(`Invalid JSON Pointer: ${pointer}`);
  let current: any = document;
  for (const rawSegment of pointer === '' ? [] : pointer.slice(1).split('/')) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || current === undefined) throw new Error(`JSON Pointer traversed null: ${pointer}`);
    current = Array.isArray(current) ? current[Number(segment)] : current[segment];
    if (current === undefined) throw new Error(`JSON Pointer target missing: ${pointer}`);
  }
  return current;
}
