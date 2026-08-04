/**
 * Deterministic old-ID scan for new authoring/runtime content (#1277 task 1.2).
 *
 * Proves new content does not reference legacy graph/card IDs as Canonical.
 * Crosswalk / historical adapters listing legacy IDs are excluded.
 */

import { createHash } from 'node:crypto';

import { isLegacyLocalGraphNodeId } from '@/lib/teaching-projection/legacy-id-policy';

import {
  LEGACY_RETIREMENT_BUILDER_VERSION,
  LEGACY_RETIREMENT_OLD_ID_SCAN_CONTRACT,
  type OldIdScanHit,
  type OldIdScanReport,
} from './contracts';
import { retirementDigest } from './hash';

/** Paths retained for history / crosswalk — not new-content violations. */
const EXCLUDED_PATH_FRAGMENTS = [
  '/legacy-course-coverage-audit/',
  '/legacy-crosswalk',
  'legacy-crosswalk.schema.json',
  '/cards/crosswalk',
  'card-crosswalk',
  '/migration/',
  '/fixtures/',
  '/__tests__/',
  '/legacy/',
  'legacy-audit-manifest',
  'old-to-canonical',
  'historical',
] as const;

export interface ScanContentFile {
  path: string;
  content: string;
}

function pathIsExcluded(filePath: string): boolean {
  const normalized = filePath.replace(/\\/gu, '/');
  return EXCLUDED_PATH_FRAGMENTS.some((frag) => normalized.includes(frag));
}

function contentDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Extract candidate tokens that look like legacy local graph node IDs.
 * Scans JSON string values and bare tokens in text.
 */
export function extractLegacyIdCandidates(content: string): string[] {
  const found = new Set<string>();

  // JSON / YAML style quoted strings.
  const quoted = content.matchAll(/["'`]([^"'`\n]{2,120})["'`]/gu);
  for (const match of quoted) {
    const value = match[1]?.trim();
    if (value && isLegacyLocalGraphNodeId(value)) {
      found.add(value);
    }
  }

  // Bare tokens in prose / identifiers (CJK + underscore + digits).
  const bare = content.matchAll(
    /(?:^|[\s,;:{[\]()"'`])([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9]*_\d+(?:_[0-9a-fA-F]+)?)(?=$|[\s,;:}\])"'`])/gu,
  );
  for (const match of bare) {
    const value = match[1]?.trim();
    if (value && isLegacyLocalGraphNodeId(value)) {
      found.add(value);
    }
  }

  return [...found].sort();
}

function lineOfMatch(content: string, match: string): number | null {
  const idx = content.indexOf(match);
  if (idx < 0) return null;
  return content.slice(0, idx).split('\n').length;
}

/**
 * Run the old-ID scan over provided content files (tests inject fixtures;
 * production callers load from authoring/runtime roots).
 */
export function runOldIdScan(input: {
  files: readonly ScanContentFile[];
  scannedRoots?: readonly string[];
  captureRevision?: string | null;
}): OldIdScanReport {
  const hits: OldIdScanHit[] = [];

  for (const file of input.files) {
    if (pathIsExcluded(file.path)) continue;
    const candidates = extractLegacyIdCandidates(file.content);
    if (candidates.length === 0) continue;
    const digest = contentDigest(file.content);
    for (const match of candidates) {
      hits.push({
        path: file.path,
        line: lineOfMatch(file.content, match),
        match,
        contentDigest: digest,
      });
    }
  }

  hits.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.match !== b.match) return a.match < b.match ? -1 : 1;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  const body = {
    contract: LEGACY_RETIREMENT_OLD_ID_SCAN_CONTRACT,
    builderVersion: LEGACY_RETIREMENT_BUILDER_VERSION,
    captureRevision: input.captureRevision ?? null,
    scannedRoots: [...(input.scannedRoots ?? [])].sort(),
    hits,
    hitCount: hits.length,
    zeroViolations: hits.length === 0,
  };

  return {
    ...body,
    scanDigest: retirementDigest(body),
  };
}

/** Fail closed when new-content old-ID hits exist. */
export function assertZeroOldIdViolations(report: OldIdScanReport): void {
  if (!report.zeroViolations || report.hitCount > 0) {
    const sample = report.hits
      .slice(0, 5)
      .map((h) => `${h.path}:${h.line ?? '?'}:${h.match}`)
      .join('; ');
    throw new Error(
      `old-ID scan found ${report.hitCount} new-content violation(s): ${sample}`,
    );
  }
}
