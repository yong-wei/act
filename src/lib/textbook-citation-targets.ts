import path from 'node:path';

export const TEXTBOOK_CITATION_READER_PREFIX = '/textbook-citations';
export const TEXTBOOK_RUNTIME_PREFIX = '/course-runtime/resources/textbooks/';

export interface TextbookCitationHrefResolution {
  canonicalHref: string;
  displayHref: string;
  runtimeRelativePath: string;
  anchor: string | null;
}

const supportedMarkdownExtensions = new Set(['.md', '.mdx']);
const markdownAnchorPattern = /<a\s+(?:id|name)=["']([^"']+)["']\s*><\/a>/gi;
const safeMarkdownAnchorIdPattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;

export const TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX = 'textbook-citation-anchor:';

function parseRootRelativeHref(href: string | null | undefined): URL | null {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed !== href || !trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//') || /[\s\p{Cc}]/u.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, 'https://act.local');
    return parsed.origin === 'https://act.local' ? parsed : null;
  } catch {
    return null;
  }
}

function hasUnsafePathSegment(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.some((segment) => {
    let decoded = segment;
    for (let index = 0; index < 4; index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        return true;
      }
    }
    return decoded === '..' || decoded.includes('/') || decoded.includes('\\');
  });
}

function normalizeRuntimeTextbookPath(pathname: string): string | null {
  if (!pathname.startsWith(TEXTBOOK_RUNTIME_PREFIX)) return null;
  if (hasUnsafePathSegment(pathname)) return null;
  const runtimeRelativePath = pathname.replace(/^\/course-runtime\//, '');
  const normalized = path.posix.normalize(runtimeRelativePath);
  if (normalized !== runtimeRelativePath || normalized.startsWith('../')) return null;
  if (!normalized.startsWith('resources/textbooks/')) return null;
  if (!/\/(?:chunks|sections)\//.test(normalized)) return null;
  if (!supportedMarkdownExtensions.has(path.posix.extname(normalized).toLowerCase())) return null;
  return normalized;
}

export function resolveTextbookCitationHref(
  canonicalHref: string | null | undefined,
): TextbookCitationHrefResolution | null {
  const parsed = parseRootRelativeHref(canonicalHref);
  if (!parsed) return null;
  const runtimeRelativePath = normalizeRuntimeTextbookPath(parsed.pathname);
  if (!runtimeRelativePath) return null;
  const anchor = parsed.hash ? parsed.hash.slice(1) : null;
  return {
    canonicalHref: `${parsed.pathname}${parsed.hash}`,
    displayHref: `${TEXTBOOK_CITATION_READER_PREFIX}/${runtimeRelativePath}${parsed.hash}`,
    runtimeRelativePath,
    anchor,
  };
}

export function resolveTextbookCitationReaderPath(
  targetPath: readonly string[],
): { runtimeRelativePath: string; canonicalHref: string } | null {
  if (targetPath.length === 0) return null;
  if (targetPath.some((segment) => segment.length === 0)) return null;
  const pathname = `/course-runtime/${targetPath.join('/')}`;
  const runtimeRelativePath = normalizeRuntimeTextbookPath(pathname);
  if (!runtimeRelativePath) return null;
  return {
    runtimeRelativePath,
    canonicalHref: `/course-runtime/${runtimeRelativePath}`,
  };
}

export function preprocessTextbookCitationMarkdown(markdown: string): string {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');
  const lines = withoutComments.split(/\r?\n/);
  const visibleLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*>\s*Image description\s*:/i.test(line)) {
      while (index + 1 < lines.length && /^\s*>/.test(lines[index + 1]) && lines[index + 1].trim() !== '>') {
        index += 1;
      }
      continue;
    }
    visibleLines.push(line.replace(markdownAnchorPattern, (_match, anchorId: string) => (
      safeMarkdownAnchorIdPattern.test(anchorId)
        ? `[[${TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX}${anchorId}]]`
        : ''
    )));
  }

  return visibleLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function resolveRuntimeMarkdownAssetHref(
  href: string | null | undefined,
  currentRuntimeRelativePath: string,
): string {
  if (typeof href !== 'string') return '';
  const trimmed = href.trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/course-runtime/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  const baseDir = path.posix.dirname(currentRuntimeRelativePath);
  const normalized = path.posix.normalize(path.posix.join(baseDir, trimmed));
  if (normalized.startsWith('../') || !normalized.startsWith('resources/textbooks/')) return '';
  const currentSegments = currentRuntimeRelativePath.split('/');
  const targetSegments = normalized.split('/');
  if (currentSegments[2] !== targetSegments[2]) return '';
  return `/course-runtime/${normalized}`;
}
