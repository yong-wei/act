/**
 * Unicode/Latin word-boundary term matching for CourseCoverage evidence.
 * Latin terms must not match as arbitrary substrings (e.g. "ai" ≠ "gain").
 */

export function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[（）()【】\[\]{}，。；;：:\s\-_·•、,/\\]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * True when `term` appears as a whole token/phrase in `haystack`.
 * - Latin/ASCII terms: word-boundary regex (ai ⊈ gain/available/obtain)
 * - CJK terms: exact contiguous match (Chinese has no spaces)
 * - Multi-word Latin phrases: boundary on first/last word
 */
export function includesTermBounded(haystack: string, term: string): boolean {
  const h = haystack.trim();
  const t = term.trim();
  if (!h || !t || t.length < 2) return false;

  const hasLatin = /[a-z0-9]/iu.test(t);
  const hasCjk = /[\u4e00-\u9fff]/u.test(t);

  if (hasLatin && !hasCjk) {
    // Escape regex metacharacters; allow flexible internal whitespace for phrases.
    const escaped = t
      .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      .replace(/\s+/gu, '\\s+');
    const re = new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`, 'iu');
    return re.test(h);
  }

  // CJK or mixed: require contiguous phrase (already normalized spacing).
  return h.includes(t);
}

/** Stable lexicographic sort for directory entries. */
export function sortNames(names: readonly string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, 'en'));
}
