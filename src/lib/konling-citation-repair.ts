import type { KonlingAssignedCitation } from '@/lib/konling-citation-protocol';

export type KonlingCitationVerificationStatus = 'verified' | 'partial' | 'unverified';

export type KonlingCitationRepairMapping = {
  marker: string;
  displayNumber: number;
};

export type KonlingCitationRepairRequest = {
  originalQuestion: string;
  serverContext: Readonly<{
    role: string;
    topic: string;
    courseTitle: string;
  }>;
  assignedCitations: readonly {
    displayNumber: number;
    sourceType: KonlingAssignedCitation['sourceType'];
    displayTitle: string;
  }[];
  originalAnswer: string;
  unresolvedMarkers: readonly string[];
};

export type KonlingCitationRepairCall = (
  request: Readonly<KonlingCitationRepairRequest>,
) => Promise<readonly KonlingCitationRepairMapping[]>;

export type KonlingCitationNormalizationResult = {
  body: string;
  citations: KonlingAssignedCitation[];
  unresolvedMarkers: string[];
  verificationStatus: KonlingCitationVerificationStatus;
  userNotice: '部分引用未能核验' | '引用未能核验' | null;
  diagnostics: string[];
  repairCalls: number;
};

type MarkerOccurrence = {
  raw: string;
  value: string;
};

export type TextRange = {
  start: number;
  end: number;
};

const INTERNAL_CITATION_ID_PREFIX =
  '(?:textbook-unit|content|learner-state|path|memory|simulation|arena|evidence|LearningPathExecution|LearningPathIntervention|LearningPathDeviation|LearningPathEvidence)';
const CITATION_MARKER = new RegExp(
  `\\[(?:(?:证据|引用|content)\\s*:\\s*([^\\]\\n]+)|(\\d+)|(${INTERNAL_CITATION_ID_PREFIX}:[A-Za-z0-9][A-Za-z0-9._~:/@%+-]*))\\]`,
  'gi',
);
const MARKDOWN_CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const MARKDOWN_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const INTERNAL_PATH = /(?:file:\/\/|\/(?:Users|home|workspace|course-content|src|var|tmp)\/)[^\s)\]}]+/gi;
const BARE_URL = /https?:\/\/[^\s)\]}，。；、]+/gi;
const INTERNAL_TEXTBOOK_ID = /\b(?:textbook-(?:unit|fragment|window)|textbook):[^\s,，。；;)\]}]+/gi;
const INTERNAL_IDENTITY_FIELD =
  /["']?(?:canonicalKey|bookId|edition|sourceRevision|unitId|fragmentId|structuralPath|identity)["']?\s*[:=]\s*(?:\{[^}\n]*\}|\[[^\]\n]*\]|"[^"\n]*"|'[^'\n]*'|[^\s,，。；;)\]}]+)/gi;
const INTERNAL_TEXTBOOK_SLUG =
  /\b(?:hu-shousong-auto-control-(?:7th|8th)|liu-sheng-auto-control-2015|dorf-modern-control-systems|feedback-control-of-dynamic-systems|hu-shousong-exercise-analysis-3rd|control-encyclopedia)\b/gi;
const INTERNAL_STRUCTURE_PATH = /\b(?:chapter|section)-[a-z0-9._-]+\b/gi;
const PRIVATE_REPAIR_SCOPE =
  /(?:我(?:的)?|你(?:的)?|您(?:的)?|该生|学生|同学|学习者|姓名|学号|用户(?:id)?|掌握|混淆|薄弱|困难|进度|成绩|作答|尝试|风险|画像|能力向量|学习记录|learner|student|mastery|risk|user\s*id|attempt\s*history)/iu;
const PRIVATE_REPAIR_IDENTIFIER = /\b(?:student|user|learner)-[a-z0-9_-]+\b/giu;

export function normalizeKonlingCitations(input: {
  answer: string;
  assignedCitations: readonly KonlingAssignedCitation[];
  repairMappings?: readonly KonlingCitationRepairMapping[];
}): KonlingCitationNormalizationResult {
  const citations = [...input.assignedCitations].sort((left, right) =>
    left.displayNumber - right.displayNumber);
  const byNumber = new Map(citations.map((citation) => [citation.displayNumber, citation]));
  const byId = new Map(citations.map((citation) => [normalizeLookup(citation.id), citation]));
  const byTitle = uniqueTitleMap(citations);
  const repairMap = new Map(
    (input.repairMappings ?? []).map((mapping) => [mapping.marker, mapping.displayNumber]),
  );
  const unresolvedMarkers: string[] = [];
  const referencedNumbers = new Set<number>();
  let markerCount = 0;

  let body = input.answer.replace(MARKDOWN_LINK, (_match, label: string) => label);
  const codeRanges = markdownCodeRanges(body);
  body = body.replace(CITATION_MARKER, (
    raw,
    prefixed: string,
    numericValue: string,
    completeId: string,
    offset: number,
  ) => {
    const value = prefixed ?? numericValue ?? completeId;
    const normalized = normalizeLookup(value);
    const numeric = /^\d+$/.test(normalized) ? Number(normalized) : null;
    const citation = numeric !== null
      ? byNumber.get(numeric)
      : byId.get(normalized) ?? byTitle.get(normalized);
    if (
      codeRanges.some((range) => offset >= range.start && offset < range.end)
      || (numericValue && isTechnicalIndexContext(body, offset, citation !== undefined))
    ) {
      return raw;
    }
    markerCount += 1;
    const repairedNumber = repairMap.get(raw);
    const repaired = repairedNumber === undefined ? undefined : byNumber.get(repairedNumber);
    const resolved = citation ?? repaired;
    if (!resolved) {
      if (!unresolvedMarkers.includes(raw)) unresolvedMarkers.push(raw);
      return '';
    }
    // 表内解析成功但服务器声明不可核验（未核验/无目标锚点）的条目按未核验
    // 处理：删除标记并降级，不得以已核验引用留在正文（#1949）
    if (resolved.verifiable === false) {
      if (!unresolvedMarkers.includes(raw)) unresolvedMarkers.push(raw);
      return '';
    }
    referencedNumbers.add(resolved.displayNumber);
    return `[${resolved.displayNumber}]`;
  });
  body = body
    .replace(BARE_URL, '')
    .replace(INTERNAL_IDENTITY_FIELD, '')
    .replace(INTERNAL_TEXTBOOK_ID, '')
    .replace(INTERNAL_TEXTBOOK_SLUG, '')
    .replace(INTERNAL_STRUCTURE_PATH, '')
    .replace(INTERNAL_PATH, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const usedCitations = citations.filter((citation) => referencedNumbers.has(citation.displayNumber));
  const unresolvedCount = unresolvedMarkers.length;
  const verificationStatus: KonlingCitationVerificationStatus = unresolvedCount === 0
    ? 'verified'
    : usedCitations.length > 0
      ? 'partial'
      : 'unverified';
  const userNotice = verificationStatus === 'partial'
    ? '部分引用未能核验'
    : verificationStatus === 'unverified' && markerCount > 0
      ? '引用未能核验'
      : null;

  return {
    body,
    citations: usedCitations,
    unresolvedMarkers,
    verificationStatus,
    userNotice,
    diagnostics: unresolvedMarkers.map((marker) => `unresolved-citation-marker:${marker}`),
    repairCalls: 0,
  };
}

export function markdownCodeRanges(value: string): TextRange[] {
  return Array.from(value.matchAll(MARKDOWN_CODE), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function isTechnicalIndexContext(
  value: string,
  offset: number,
  hasAssignedCitation: boolean,
): boolean {
  const precedingToken = value
    .slice(0, offset)
    .match(/[\p{L}_][\p{L}\p{N}_]*$/u)?.[0];
  if (!precedingToken) return false;
  // 中日韩文不构成数学下标：中文正文无空格紧邻的 `结论[9]` 是引用标记，
  // 不能因宽判定被当作技术下标而逃过清理（#1949 review）。
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(precedingToken)) {
    return false;
  }
  if (!hasAssignedCitation) return true;
  return /^[\p{Script=Latin}\p{Script=Greek}]$/u.test(precedingToken)
    || /^(?:array|data|items?|samples?|values?|vectors?)$/iu.test(precedingToken);
}

export async function normalizeAndRepairKonlingCitations(input: {
  answer: string;
  assignedCitations: readonly KonlingAssignedCitation[];
  originalQuestion: string;
  serverContext: KonlingCitationRepairRequest['serverContext'];
  privateValues?: readonly string[];
  repair?: KonlingCitationRepairCall;
}): Promise<KonlingCitationNormalizationResult> {
  const initial = normalizeKonlingCitations(input);
  if (initial.unresolvedMarkers.length === 0 || !input.repair) return initial;

  const request = deepFreeze({
    originalQuestion: buildSafeRepairText(input.originalQuestion, input.privateValues, 2_000),
    serverContext: {
      role: normalizeRepairContextValue(input.serverContext.role, 32),
      topic: normalizeRepairContextValue(input.serverContext.topic, 300),
      courseTitle: normalizeRepairContextValue(input.serverContext.courseTitle, 300),
    },
    assignedCitations: input.assignedCitations.slice(0, 64).map((citation) => ({
      displayNumber: citation.displayNumber,
      sourceType: citation.sourceType,
      displayTitle: citation.displayTitle,
    })),
    originalAnswer: buildRepairAnswerExcerpt(
      input.answer,
      initial.unresolvedMarkers,
      input.privateValues,
    ),
    unresolvedMarkers: [...initial.unresolvedMarkers].slice(0, 32),
  });
  let mappings: readonly KonlingCitationRepairMapping[] = [];
  const diagnostics = [...initial.diagnostics];
  try {
    const response = await input.repair(request);
    mappings = response
      .slice(0, request.unresolvedMarkers.length)
      .filter((mapping) =>
        request.unresolvedMarkers.includes(mapping.marker)
        && request.assignedCitations.some((citation) => citation.displayNumber === mapping.displayNumber)
      );
  } catch {
    diagnostics.push('citation-repair-call-failed');
  }
  const final = normalizeKonlingCitations({
    answer: input.answer,
    assignedCitations: input.assignedCitations,
    repairMappings: mappings,
  });
  return {
    ...final,
    diagnostics: [...new Set([...diagnostics, ...final.diagnostics])],
    repairCalls: 1,
  };
}

function normalizeLookup(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function normalizeRepairContextValue(value: string, maxLength: number) {
  return value
    .normalize('NFKC')
    .replace(BARE_URL, '')
    .replace(INTERNAL_PATH, '')
    .replace(INTERNAL_IDENTITY_FIELD, '')
    .replace(INTERNAL_TEXTBOOK_ID, '')
    .replace(INTERNAL_TEXTBOOK_SLUG, '')
    .replace(INTERNAL_STRUCTURE_PATH, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildRepairAnswerExcerpt(
  answer: string,
  unresolvedMarkers: readonly string[],
  privateValues?: readonly string[],
) {
  const relevantSegments = answer
    .split(/(?<=[。！？!?；;\n])/u)
    .map((segment) => segment.trim())
    .filter((segment) => unresolvedMarkers.some((marker) => segment.includes(marker)));
  return buildSafeRepairText(
    relevantSegments.join('\n'),
    privateValues,
    4_000,
  );
}

function buildSafeRepairText(
  value: string,
  privateValues: readonly string[] | undefined,
  maxLength: number,
) {
  const normalizedPrivateValues = (privateValues ?? [])
    .map((item) => item.normalize('NFKC').trim())
    .filter((item) => item.length >= 2);
  return value
    .normalize('NFKC')
    .split(/(?<=[。！？!?；;\n])/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !PRIVATE_REPAIR_SCOPE.test(segment))
    .filter((segment) => !normalizedPrivateValues.some((privateValue) => segment.includes(privateValue)))
    .join('\n')
    .replace(MARKDOWN_LINK, (_match, label: string) => label)
    .replace(BARE_URL, '')
    .replace(INTERNAL_PATH, '')
    .replace(INTERNAL_IDENTITY_FIELD, '')
    .replace(INTERNAL_TEXTBOOK_ID, '')
    .replace(INTERNAL_TEXTBOOK_SLUG, '')
    .replace(INTERNAL_STRUCTURE_PATH, '')
    .replace(PRIVATE_REPAIR_IDENTIFIER, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function uniqueTitleMap(citations: readonly KonlingAssignedCitation[]) {
  const grouped = new Map<string, KonlingAssignedCitation[]>();
  for (const citation of citations) {
    const title = normalizeLookup(citation.displayTitle);
    grouped.set(title, [...(grouped.get(title) ?? []), citation]);
  }
  return new Map(
    [...grouped].flatMap(([title, matches]) => matches.length === 1 ? [[title, matches[0]] as const] : []),
  );
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
