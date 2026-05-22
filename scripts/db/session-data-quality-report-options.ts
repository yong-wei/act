import type { SessionDataQualityFilters } from '@/lib/data-governance/session-data-quality-report';

export interface SessionDataQualityReportCliOptions {
  json: boolean;
  compact: boolean;
  filters: SessionDataQualityFilters;
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

function hasValidIsoCalendarDate(raw: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function readDateValue(args: string[], flag: string) {
  const prefix = `${flag}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  if (!hasValidIsoCalendarDate(raw)) {
    throw new Error(`Invalid ${flag} date: ${raw}`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${flag} date: ${raw}`);
  }
  return date;
}

export function parseSessionDataQualityReportOptions(argv: string[]): SessionDataQualityReportCliOptions {
  const args = argv.slice(2);
  const sessionIds = readListValues(args, '--session-id');
  const lessonKeys = readListValues(args, '--lesson-key');
  const from = readDateValue(args, '--from');
  const to = readDateValue(args, '--to');
  const filters: SessionDataQualityFilters = {};

  if (sessionIds.length > 0) filters.sessionIds = sessionIds;
  if (lessonKeys.length > 0) filters.lessonKeys = lessonKeys;
  if (from) filters.from = from;
  if (to) filters.to = to;

  return {
    json: readFlag(args, '--json'),
    compact: readFlag(args, '--compact'),
    filters,
  };
}
