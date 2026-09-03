import type { CourseEvidenceBackfillFilters } from '@/lib/data-governance/course-evidence-backfill';

export interface CourseEvidenceBackfillCliOptions {
  apply: boolean;
  json: boolean;
  compact: boolean;
  regenerateReports: boolean;
  refreshCache: boolean;
  operationId?: string;
  authorizedBy?: string;
  frozenCutoff?: string;
  filters: CourseEvidenceBackfillFilters;
}

function readFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function readListValues(args: string[], flag: string) {
  const prefix = `${flag}=`;
  return args
    .filter((arg) => arg.startsWith(prefix))
    .flatMap((arg) => arg.slice(prefix.length).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function readDateValue(args: string[], flag: string) {
  const prefix = `${flag}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${flag} date: ${raw}`);
  }
  return date;
}

function readStringValue(args: string[], flag: string) {
  const prefix = `${flag}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)?.trim();
  return raw || undefined;
}

export function parseCourseEvidenceBackfillOptions(argv: string[]): CourseEvidenceBackfillCliOptions {
  const args = argv.slice(2);
  const sessionIds = readListValues(args, '--session-id');
  const lessonKeys = readListValues(args, '--lesson-key');
  const from = readDateValue(args, '--from');
  const to = readDateValue(args, '--to');
  const filters: CourseEvidenceBackfillFilters = {};

  if (sessionIds.length > 0) filters.sessionIds = sessionIds;
  if (lessonKeys.length > 0) filters.lessonKeys = lessonKeys;
  if (from) filters.from = from;
  if (to) filters.to = to;
  const frozenCutoff = readStringValue(args, '--frozen-cutoff');
  if (frozenCutoff) {
    const cutoff = new Date(frozenCutoff);
    if (Number.isNaN(cutoff.getTime())) {
      throw new Error(`Invalid --frozen-cutoff date: ${frozenCutoff}`);
    }
    if (!filters.to || cutoff < filters.to) filters.to = cutoff;
  }

  return {
    apply: readFlag(args, '--apply'),
    json: readFlag(args, '--json'),
    compact: readFlag(args, '--compact'),
    regenerateReports: readFlag(args, '--regenerate-reports'),
    refreshCache: readFlag(args, '--refresh-cache'),
    operationId: readStringValue(args, '--operation-id'),
    authorizedBy: readStringValue(args, '--authorize'),
    frozenCutoff,
    filters,
  };
}
