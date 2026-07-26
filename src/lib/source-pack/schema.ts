import { z } from 'zod';

import { SOURCE_PACK_SCHEMA_VERSION, type SourcePack } from './types';

const governedIdPattern = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*:[^\s]+$/u;
const barePlatformRefPattern = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*(?:\/[\p{L}\p{N}_.-]+)*$/u;
const rawCitationTargetPattern = /(https?:\/\/|:\/\/|course-content\/authoring|#L\d+\b)/i;
const rawVerifiedHrefPattern = /(course-content\/authoring|#L\d+\b)/i;
const externalHrefPattern = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const protocolRelativeHrefPattern = /^\/\//;
const localAnchorHrefPattern = /^#[^\s]+$/;
const governedExternalCitationSchemes = new Set(['https', 'doi']);
const governedExternalCitationResolvers = new Set([
  'verified-external-reference',
  'server-owned-runtime',
  'doi',
  'official-reference',
]);
const governedRelativeCitationResolvers = new Set([
  'course-runtime',
  'server-owned-runtime',
]);

const governedIdSchema = z.string().min(1)
  .refine((value) => governedIdPattern.test(value), {
    message: 'Expected a stable governed source id.',
  })
  .refine((value) => !hasRawCitationTarget(value), {
    message: 'Governed source ids must not point to raw authoring files or line numbers.',
  });

const platformNodeRefSchema = z.string().min(1)
  .refine((value) => governedIdPattern.test(value) || barePlatformRefPattern.test(value), {
    message: 'Expected a stable platform node reference.',
  })
  .refine((value) => !hasRawCitationTarget(value), {
    message: 'Platform node references must not point to raw authoring files or line numbers.',
  });

const verifiedHrefSchema = z.string().min(1).refine((value) => !hasRawVerifiedHref(value), {
  message: 'Verified citation href must not point to raw authoring files or line targets.',
});

export const sourcePackProfileSchema = z.enum([
  'handout-authoring',
  'assessment-item',
  'konling-answer',
  'lesson-authoring',
  'lesson-design',
  'homework-authoring',
  'konling',
  'path-planning',
  'generic',
]);

export const sourcePackQuerySchema = z.object({
  queryId: z.string().min(1),
  text: z.string().min(1),
  profile: sourcePackProfileSchema,
  caller: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  topK: z.number().int().positive().optional(),
  filters: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
}).strict();

export const sourcePackIndexRefsSchema = z.object({
  corpusVersion: z.string().min(1).optional(),
  graphVersion: z.string().min(1).optional(),
  projectionVersion: z.string().min(1).optional(),
  generatedAt: z.string().datetime(),
}).strict().superRefine((indexRefs, context) => {
  if (!indexRefs.corpusVersion && !indexRefs.graphVersion && !indexRefs.projectionVersion) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source Pack indexRefs require a corpus, graph, or projection version reference.',
      path: ['projectionVersion'],
    });
  }
});

export const sourcePackScoresSchema = z.object({
  relevance: z.number().min(0).max(1),
  graphAlignment: z.number().min(0).max(1).optional(),
  authority: z.number().min(0).max(1).optional(),
  eligibility: z.number().min(0).max(1).optional(),
  freshness: z.number().min(0).max(1).optional(),
  final: z.number().min(0).max(1),
}).strict();

export const sourcePackAccessSchema = z.object({
  visibility: z.enum(['public', 'student', 'teacher', 'admin', 'restricted']),
  license: z.string().min(1).optional(),
  aiUseAllowed: z.boolean(),
  policyRef: z.string().min(1).optional(),
}).strict();

export const sourcePackCitationSchema = z.object({
  citationTargetId: governedIdSchema,
  sourceId: governedIdSchema,
  displayTitle: z.string().min(1),
  canonicalHref: verifiedHrefSchema.optional(),
  displayHref: verifiedHrefSchema.optional(),
  href: verifiedHrefSchema.optional(),
  resolver: z.string().min(1).optional(),
  verified: z.boolean(),
}).strict().superRefine((citation, context) => {
  const hrefScheme = citation.href?.match(externalHrefPattern)?.[1]?.toLowerCase();
  if (!citation.verified || !citation.href) return;
  if (protocolRelativeHrefPattern.test(citation.href)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Verified external citation hrefs require an explicit allowed scheme.',
      path: ['href'],
    });
    return;
  }
  if (!hrefScheme) {
    if (!isGovernedRelativeHref(citation.href)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Verified relative citation hrefs require a platform-owned path or local anchor.',
        path: ['href'],
      });
    }
    if (!governedRelativeCitationResolvers.has(citation.resolver || '')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Verified relative citation hrefs require a governed resolver.',
        path: ['resolver'],
      });
    }
    return;
  }
  if (!governedExternalCitationSchemes.has(hrefScheme)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Verified external citation hrefs require an allowed scheme.',
      path: ['href'],
    });
  }
  if (!governedExternalCitationResolvers.has(citation.resolver || '')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Verified external citation hrefs require a governed resolver.',
      path: ['resolver'],
    });
  }
});

function isGovernedRelativeHref(href: string): boolean {
  if (localAnchorHrefPattern.test(href)) return true;
  if (/\s/.test(href) || !href.startsWith('/')) return false;
  try {
    const parsed = new URL(href, 'https://act.local');
    if (parsed.origin !== 'https://act.local') return false;
    return (
      parsed.pathname === '/course-runtime'
      || parsed.pathname.startsWith('/course-runtime/')
      || parsed.pathname === '/resources'
      || parsed.pathname.startsWith('/resources/')
      || parsed.pathname === '/textbooks'
      || parsed.pathname.startsWith('/textbooks/')
    );
  } catch {
    return false;
  }
}

function hasRawCitationTarget(value: string): boolean {
  return testsRawPattern(value, rawCitationTargetPattern);
}

function hasRawVerifiedHref(value: string): boolean {
  return testsRawPattern(value, rawVerifiedHrefPattern);
}

function testsRawPattern(value: string, pattern: RegExp): boolean {
  let current = value;
  for (let index = 0; index < 32; index += 1) {
    if (pattern.test(current)) return true;
    const decoded = decodePercentEncodingLenient(current);
    if (decoded === current) return false;
    current = decoded;
  }
  return true;
}

function decodePercentEncodingLenient(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export const sourcePackItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceKind: z.enum([
    'textbook',
    'reference',
    'runtime-lesson',
    'knowledge-card',
    'exercise',
    'learner-evidence',
    'simulation',
    'other',
  ]),
  modality: z.enum(['text', 'image', 'video', 'audio', 'interactive', 'mixed']),
  excerpt: z.string().min(1),
  inclusionRationale: z.string().min(1),
  resourceNodeId: platformNodeRefSchema.optional(),
  planningUnitId: platformNodeRefSchema.optional(),
  retrievalChunkId: governedIdSchema.optional(),
  citationTargetId: governedIdSchema.optional(),
  scores: sourcePackScoresSchema,
  access: sourcePackAccessSchema,
  citation: sourcePackCitationSchema.optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
}).strict().superRefine((item, context) => {
  if (!item.retrievalChunkId && !item.citationTargetId && !item.citation?.citationTargetId && !item.resourceNodeId && !item.planningUnitId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source Pack items require at least one stable source identifier.',
      path: ['id'],
    });
  }
  if (item.citation && item.citationTargetId && item.citation.citationTargetId !== item.citationTargetId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'citation.citationTargetId must match item.citationTargetId.',
      path: ['citation', 'citationTargetId'],
    });
  }
});

export const sourcePackCoverageSchema = z.object({
  requestedTopK: z.number().int().positive(),
  returnedItems: z.number().int().min(0),
  eligibleItems: z.number().int().min(0).optional(),
  omittedItems: z.number().int().min(0).optional(),
  coverageRatio: z.number().min(0).max(1).optional(),
  notes: z.array(z.string().min(1)).optional(),
}).strict();

export const sourcePackLimitationSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warning', 'blocking']),
  message: z.string().min(1),
  source: z.string().min(1).optional(),
  recoverable: z.boolean(),
}).strict();

export const sourcePackAuditSchema = z.object({
  schemaVersion: z.literal(SOURCE_PACK_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  builderId: z.string().min(1),
  profile: sourcePackProfileSchema,
  queryHash: z.string().min(8),
  itemCount: z.number().int().min(0),
  limitationCount: z.number().int().min(0),
  citationTargetIds: z.array(governedIdSchema),
  retrievalChunkIds: z.array(governedIdSchema),
}).strict();

export const sourcePackSchema = z.object({
  packId: z.string().min(1),
  profile: sourcePackProfileSchema,
  query: sourcePackQuerySchema,
  indexRefs: sourcePackIndexRefsSchema,
  coverage: sourcePackCoverageSchema,
  items: z.array(sourcePackItemSchema),
  limitations: z.array(sourcePackLimitationSchema),
  audit: sourcePackAuditSchema,
}).strict().superRefine((pack, context) => {
  if (pack.profile !== pack.query.profile) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pack.profile must match query.profile.',
      path: ['profile'],
    });
  }
  if (pack.audit.profile !== pack.profile) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.profile must match pack.profile.',
      path: ['audit', 'profile'],
    });
  }
  if (pack.audit.itemCount !== pack.items.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.itemCount must match items.length.',
      path: ['audit', 'itemCount'],
    });
  }
  if (pack.audit.limitationCount !== pack.limitations.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.limitationCount must match limitations.length.',
      path: ['audit', 'limitationCount'],
    });
  }
  if (pack.coverage.returnedItems !== pack.items.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'coverage.returnedItems must match items.length.',
      path: ['coverage', 'returnedItems'],
    });
  }
  const citationTargetIds = uniqueSorted(pack.items.flatMap((item) => [
    item.citationTargetId,
    item.citation?.citationTargetId,
  ].filter((value): value is string => Boolean(value))));
  const retrievalChunkIds = uniqueSorted(pack.items.map((item) => item.retrievalChunkId).filter((value): value is string => Boolean(value)));
  if (!sameStringArray(pack.audit.citationTargetIds, citationTargetIds)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.citationTargetIds must match item citation target ids.',
      path: ['audit', 'citationTargetIds'],
    });
  }
  if (!sameStringArray(pack.audit.retrievalChunkIds, retrievalChunkIds)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.retrievalChunkIds must match item retrieval chunk ids.',
      path: ['audit', 'retrievalChunkIds'],
    });
  }
});

export function validateSourcePack(pack: unknown): SourcePack {
  return sourcePackSchema.parse(pack);
}

export function safeValidateSourcePack(pack: unknown) {
  return sourcePackSchema.safeParse(pack);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
