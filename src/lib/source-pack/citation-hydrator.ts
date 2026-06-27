/**
 * Citation Hydrator
 *
 * Resolves Source Pack citation display payloads from server-owned
 * CitationAddress or CitationTarget metadata.  Model-generated links
 * are NOT accepted as citation sources — hydration only uses metadata
 * that was authored or verified server-side.
 *
 * ## Safety boundary
 *
 * - Unsafe hrefs (javascript:, data:, file:, protocol-relative,
 *   non-http/https/relative) are rejected with limitation severity
 *   "blocking" and `verified: false`.
 * - Stale, provisional, restricted, or missing targets produce
 *   `verified: false` with appropriate limitation codes.
 *
 * @module citation-hydrator
 */

import type {
  SourcePackCitation,
  SourcePackLimitation,
} from './types';

// Re-export for convenience
export type {
  SourcePackCitation,
  SourcePackLimitation,
};

// ─── Citation Address Input ──────────────────────────────────────────────────

/**
 * Minimal CitationAddress shape accepted by the hydrator.
 * Matches fields from LearningEvidenceCitationAddress and
 * TextbookRuntimeSearchDocument.citationAddress.
 */
export interface HydratorCitationAddressInput {
  kind?: string;
  sourceRefId?: string | null;
  href?: string | null;
  locator?: string | null;
  contentHash?: string | null;
  mediaStartSeconds?: number | null;
  mediaEndSeconds?: number | null;
  imageRegion?: { x: number; y: number; width: number; height: number } | null;
  interactiveStepId?: string | null;
  simulationRunId?: string | null;
  arenaTaskId?: string | null;
  externalUrl?: string | null;
}

/**
 * Minimal CitationTarget metadata shape.
 * Used when the source is a ResourceNode/PlanningUnit registered target.
 */
export interface HydratorCitationTargetInput {
  id: string;
  label?: string | null;
  href?: string | null;
  kind?: string | null;
  verified?: boolean;
  stale?: boolean;
  restricted?: boolean;
  provisional?: boolean;
}

// ─── Href Safety ─────────────────────────────────────────────────────────────

const externalHrefPattern = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const protocolRelativeHrefPattern = /^\/\//;
const localAnchorHrefPattern = /^#[^\s]+$/;
const governedExternalCitationSchemes = new Set(['https', 'doi']);
const governedRelativeCitationResolvers = new Set([
  'course-runtime',
  'server-owned-runtime',
]);
const governedExternalCitationResolvers = new Set([
  'verified-external-reference',
  'server-owned-runtime',
  'doi',
  'official-reference',
]);
const rawVerifiedHrefPattern = /(course-content\/authoring|#L\d+\b)/i;

/**
 * Validate whether an href is safe for citation use.
 *
 * Accepted: http, https, doi, root-relative (/), anchor-only (#…).
 * Rejected: javascript:, data:, file:, // (protocol-relative without
 *           leading / for http-relative), vbscript:, and other unsafe
 *           schemes.
 */
export function isSafeHref(href: string | null | undefined): boolean {
  if (!href || href.trim().length === 0) return false;
  const trimmed = href.trim();

  // Protocol-relative (//example.com/…) — treated as unsafe because
  // the actual protocol is ambiguous and may be file: in some contexts.
  // Must be checked BEFORE root-relative since // starts with /.
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Root-relative or anchor-only. Path-relative citations are not accepted
  // because Source Pack verified payloads must be server-owned or local anchors.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return true;
  }

  // Explicit http/https
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('doi:')) {
    return true;
  }

  // Reject known unsafe schemes
  const unsafePrefixes = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:'];
  for (const prefix of unsafePrefixes) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return false;
    }
  }

  // Any other scheme-like pattern (word followed by colon)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) {
    return false;
  }

  // Bare domain-like or unknown pattern — reject as ambiguous
  return false;
}

export function isVerifiedCitationHref(href: string | null | undefined, resolver: string | undefined): boolean {
  if (!href || !isSafeHref(href)) return false;
  if (hasRawVerifiedHref(href)) return false;
  if (protocolRelativeHrefPattern.test(href)) return false;
  const hrefScheme = href.match(externalHrefPattern)?.[1]?.toLowerCase();
  if (!hrefScheme) {
    const governedRelative = localAnchorHrefPattern.test(href) ||
      href === '/course-runtime' ||
      href.startsWith('/course-runtime/') ||
      href === '/resources' ||
      href.startsWith('/resources/');
    return governedRelative && governedRelativeCitationResolvers.has(resolver || '');
  }
  return governedExternalCitationSchemes.has(hrefScheme) &&
    governedExternalCitationResolvers.has(resolver || '');
}

export function isSerializableCitationHref(href: string | null | undefined): boolean {
  return Boolean(href && isSafeHref(href) && !hasRawVerifiedHref(href));
}

function resolverForAddress(address: HydratorCitationAddressInput): string {
  const href = address.href ?? address.externalUrl ?? '';
  if (href.startsWith('/course-runtime') || href.startsWith('#')) return 'course-runtime';
  if (href.startsWith('/resources')) return 'server-owned-runtime';
  if (href.startsWith('doi:')) return 'doi';
  if (href.startsWith('https://')) return 'official-reference';
  return 'server-owned-runtime';
}

/**
 * Build a limitation for an unsafe href.
 */
export function buildUnsafeHrefLimitation(source: string): SourcePackLimitation {
  return {
    code: 'citation-unsafe-href',
    severity: 'blocking',
    message: 'Citation href is unsafe or uses a blocked protocol (javascript, data, file, etc.).',
    source,
    recoverable: false,
  };
}

// ─── Hydration from CitationAddress ──────────────────────────────────────────

/**
 * Hydrate a SourcePackCitation from a server-owned CitationAddress.
 *
 * Only the metadata fields present in the CitationAddress are used.
 * Model-generated links or external URLs are NOT accepted.
 */
export function hydrateCitationFromAddress(
  citationTargetId: string,
  sourceId: string,
  address: HydratorCitationAddressInput,
  displayTitle: string,
): { citation: SourcePackCitation; limitations: SourcePackLimitation[] } {
  const limitations: SourcePackLimitation[] = [];

  // Determine the display href: prefer address.href, fallback to externalUrl
  const rawHref = address.href ?? address.externalUrl ?? null;
  const resolver = resolverForAddress(address);

  if (!rawHref) {
    limitations.push({
      code: 'citation-missing-href',
      severity: 'warning',
      message: `CitationAddress for ${citationTargetId} has no href or externalUrl.`,
      source: 'citation-hydrator',
      recoverable: true,
    });
  }

  const hrefValid = isSafeHref(rawHref);

  if (rawHref && !hrefValid) {
    limitations.push(buildUnsafeHrefLimitation('citation-hydrator'));
  }
  if (rawHref && hasRawVerifiedHref(rawHref)) {
    limitations.push({
      code: 'citation-raw-target-href',
      severity: 'blocking',
      message: 'Citation href points to raw authoring content or a source line target.',
      source: 'citation-hydrator',
      recoverable: false,
    });
  }

  if (!address.sourceRefId) {
    limitations.push({
      code: 'citation-missing-source-ref',
      severity: 'warning',
      message: `CitationAddress for ${citationTargetId} has no sourceRefId.`,
      source: 'citation-hydrator',
      recoverable: true,
    });
  }

  const verified = isVerifiedCitationHref(rawHref, resolver)
    && Boolean(address.sourceRefId)
    && limitations.every((limitation) => limitation.severity !== 'blocking');

  const citation: SourcePackCitation = {
    citationTargetId,
    sourceId,
    displayTitle,
    href: isSerializableCitationHref(rawHref) ? rawHref ?? undefined : undefined,
    resolver,
    verified,
  };

  return { citation, limitations };
}

// ─── Hydration from CitationTarget ───────────────────────────────────────────

/**
 * Hydrate a SourcePackCitation from a CitationTarget metadata record.
 *
 * This is the entry point when a ResourceNode/PlanningUnit already has
 * a registered CitationTarget with its own metadata.
 */
export function hydrateCitationFromTarget(
  citationTargetId: string,
  sourceId: string,
  target: HydratorCitationTargetInput,
): { citation: SourcePackCitation; limitations: SourcePackLimitation[] } {
  const limitations: SourcePackLimitation[] = [];

  // Staleness
  if (target.stale) {
    limitations.push({
      code: 'citation-stale',
      severity: 'warning',
      message: `CitationTarget ${citationTargetId} is stale.`,
      source: 'citation-hydrator',
      recoverable: true,
    });
  }

  // Restricted
  if (target.restricted) {
    limitations.push({
      code: 'citation-restricted',
      severity: 'warning',
      message: `CitationTarget ${citationTargetId} is restricted and may not be displayable.`,
      source: 'citation-hydrator',
      recoverable: false,
    });
  }

  // Provisional
  if (target.provisional) {
    limitations.push({
      code: 'citation-provisional',
      severity: 'info',
      message: `CitationTarget ${citationTargetId} is provisional and may change.`,
      source: 'citation-hydrator',
      recoverable: true,
    });
  }

  // Href safety
  const rawHref = target.href ?? null;
  const resolver = target.kind === 'doi'
    ? 'doi'
    : rawHref?.startsWith('/course-runtime') || rawHref?.startsWith('#')
      ? 'course-runtime'
      : rawHref?.startsWith('/resources')
        ? 'server-owned-runtime'
        : rawHref?.startsWith('https://')
          ? 'official-reference'
          : 'server-owned-runtime';
  if (!rawHref) {
    limitations.push({
      code: 'citation-missing-href',
      severity: 'warning',
      message: `CitationTarget ${citationTargetId} has no href.`,
      source: 'citation-hydrator',
      recoverable: true,
    });
  }

  const hrefValid = isSafeHref(rawHref);
  if (rawHref && !hrefValid) {
    limitations.push(buildUnsafeHrefLimitation('citation-hydrator'));
  }
  if (rawHref && hasRawVerifiedHref(rawHref)) {
    limitations.push({
      code: 'citation-raw-target-href',
      severity: 'blocking',
      message: 'Citation href points to raw authoring content or a source line target.',
      source: 'citation-hydrator',
      recoverable: false,
    });
  }

  const externallyVerified = target.verified === true;
  const hrefSafe = rawHref !== null && isSerializableCitationHref(rawHref);
  const notBlocked = limitations.every((l) => l.severity !== 'blocking');

  const citation: SourcePackCitation = {
    citationTargetId,
    sourceId,
    displayTitle: target.label ?? target.id,
    href: hrefSafe ? rawHref : undefined,
    resolver,
    verified: externallyVerified && isVerifiedCitationHref(rawHref, resolver) && notBlocked,
  };

  return { citation, limitations };
}

function hasRawVerifiedHref(value: string): boolean {
  let current = value;
  for (let index = 0; index < 32; index += 1) {
    if (rawVerifiedHrefPattern.test(current)) return true;
    const decoded = decodePercentEncodingLenient(current);
    if (decoded === current) return false;
    current = decoded;
  }
  return true;
}

function decodePercentEncodingLenient(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}
