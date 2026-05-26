import type { InteractiveEvidenceScoringRecomputeFilters } from '@/lib/data-governance/interactive-evidence-scoring-recompute';

export interface InteractiveEvidenceScoringRecomputeCliOptions {
  apply: boolean;
  json: boolean;
  compact: boolean;
  filters: InteractiveEvidenceScoringRecomputeFilters;
}

function parseList(option: string, value: string): string[] {
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`No values provided for ${option}`);
  }
  return values;
}

function assertValidCalendarDate(rawValue: string, year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1
    || month > 12
    || day < 1
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${rawValue}`);
  }
}

function parseDate(option: '--from' | '--to', value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    assertValidCalendarDate(trimmed, year, month, day);
    return option === '--to'
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const datePrefix = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/.exec(trimmed);
  if (datePrefix) {
    const [, yearText, monthText, dayText] = datePrefix;
    assertValidCalendarDate(trimmed, Number(yearText), Number(monthText), Number(dayText));
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${trimmed}`);
  }
  return date;
}

function readRequiredOptionValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

export function parseInteractiveEvidenceScoringRecomputeOptions(
  argv: string[],
): InteractiveEvidenceScoringRecomputeCliOptions {
  const options: InteractiveEvidenceScoringRecomputeCliOptions = {
    apply: false,
    json: false,
    compact: false,
    filters: {},
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--compact') {
      options.compact = true;
    } else if (arg === '--session-id' || arg === '--session-ids') {
      options.filters.sessionIds = parseList(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--lesson-key' || arg === '--lesson-keys') {
      options.filters.lessonKeys = parseList(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--from') {
      options.filters.from = parseDate(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--to') {
      options.filters.to = parseDate(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}
