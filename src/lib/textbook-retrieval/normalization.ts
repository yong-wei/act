export const TEXTBOOK_RETRIEVAL_FORMAT_VERSION = 'textbook-hybrid-retrieval.v1';
export const TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION =
  'nfkc-lower-cjk-unigram-bigram-technical-v1';

const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu;
const TECHNICAL_TOKEN =
  /\\[a-z]+|[a-z\u0370-\u03ff]+(?:[._/-][a-z0-9\u0370-\u03ff]+)*|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[=+*/^()<>≤≥≈%-]/gu;

export function normalizeText(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  return text.normalize('NFKC').toLowerCase();
}

export function lexicalTokens(text: string): string[] {
  const normalized = normalizeText(text);
  const positioned: Array<[number, number, string]> = [];

  for (const match of normalized.matchAll(CJK_RUN)) {
    const run = match[0];
    const start = match.index;
    for (let index = 0; index < run.length; index += 1) {
      positioned.push([start + index, 0, run[index]]);
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      positioned.push([start + index, 1, run.slice(index, index + 2)]);
    }
  }
  for (const match of normalized.matchAll(TECHNICAL_TOKEN)) {
    positioned.push([match.index, 2, match[0]]);
  }

  positioned.sort((left, right) =>
    left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]));
  return positioned.map(([, , token]) => token);
}
