const LATEX_COMMAND_NOISE = /\\[A-Za-z]+|[{}^_]/gu;

export function stripLatexCommandNoise(value: string): string {
  return value.replace(LATEX_COMMAND_NOISE, ' ').replace(/\s+/gu, ' ').trim();
}

export function uniqueSearchTerms(values: readonly (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = value.replace(/\s+/gu, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(normalized);
  }
  return terms.join(' ');
}

export function governedSearchHaystack(input: {
  label: string;
  aliases?: readonly string[];
  description?: string | null;
  searchText?: string | null;
  typeLabel?: string | null;
}): string {
  return uniqueSearchTerms([
    input.searchText ?? input.description,
    input.label,
    ...(input.aliases ?? []),
    input.typeLabel,
  ]).toLocaleLowerCase();
}

export function matchesGovernedSearch(haystack: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  const strippedNeedle = stripLatexCommandNoise(needle);
  return strippedNeedle.length > 0 && strippedNeedle !== needle
    ? haystack.includes(strippedNeedle)
    : false;
}
