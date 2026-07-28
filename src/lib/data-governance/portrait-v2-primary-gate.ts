export const PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER =
  'portrait-v2-legacy-compatibility-adapter';
const PORTRAIT_V2_COMPATIBILITY_MARKERS = [
  PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER,
  'PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER',
] as const;
const COMPATIBILITY_CONTEXT_RADIUS = 3;

const LEGACY_PRIMARY_USAGE_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'legacy-competency-vector', pattern: /\b(?:CompetencyVector|competencyVector)\b/ },
  { code: 'legacy-competency-dimensions', pattern: /\bCOMPETENCY_DIMENSIONS\b/ },
  { code: 'legacy-primary-competencies', pattern: /\bprimaryCompetencies\b/ },
  { code: 'legacy-snapshot-source', pattern: /\bStudentCompetencySnapshot\b/ },
  { code: 'legacy-feature-cache-source', pattern: /\bStudentEvidenceFeatureCache\b/ },
  { code: 'legacy-ai-ability-vector', pattern: /\babilityVector\b/ },
];

const IGNORED_PATH_PATTERNS = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)tests?(\/|\.|$)/,
  /(^|\/)fixtures?(\/|\.|$)/,
  /(^|\/)portrait-v2-primary-gate\.ts$/,
];

export interface PortraitV2PrimaryGateIssue {
  filePath: string;
  line: number;
  code: string;
  message: string;
}

export function inspectPortraitV2PrimaryUsage(input: {
  filePath: string;
  addedLines: string[];
  addedLineNumbers?: number[];
  compatibilityRanges?: Array<{ start: number; end: number }>;
  source?: string;
}): PortraitV2PrimaryGateIssue[] {
  if (!isScannablePath(input.filePath) || IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(input.filePath))) {
    return [];
  }

  const source = input.source ?? input.addedLines.join('\n');
  const sourceLines = source.split('\n');

  return input.addedLines.flatMap((lineText, index) => {
    const matches = LEGACY_PRIMARY_USAGE_PATTERNS.filter(({ pattern }) => pattern.test(lineText));
    if (matches.length === 0 || hasNearbyCompatibilityMarker(input, sourceLines, lineText, index)) {
      return [];
    }
    return matches.map(({ code }) => ({
      filePath: input.filePath,
      line: input.addedLineNumbers?.[index] ?? index + 1,
      code,
      message: '新增代码引用旧六维画像字段，必须通过 portrait-v2 显式兼容适配器，并将旧字段标记为非主权数据。',
    }));
  });
}

function hasNearbyCompatibilityMarker(
  input: {
    addedLines: string[];
    addedLineNumbers?: number[];
    compatibilityRanges?: Array<{ start: number; end: number }>;
  },
  sourceLines: string[],
  lineText: string,
  addedLineIndex: number,
): boolean {
  const lineNumber = input.addedLineNumbers?.[addedLineIndex];
  const sourceIndex = lineNumber
    ? lineNumber - 1
    : sourceLines.findIndex((sourceLine) => sourceLine.trim() === lineText.trim());
  const compatibilityRange = lineNumber && input.compatibilityRanges?.find((range) =>
    lineNumber >= range.start && lineNumber <= range.end
  );
  if (compatibilityRange && sourceLines
    .slice(
      Math.max(compatibilityRange.start - 1, lineNumber - COMPATIBILITY_CONTEXT_RADIUS - 1),
      Math.min(compatibilityRange.end, lineNumber + COMPATIBILITY_CONTEXT_RADIUS),
    )
    .some((sourceLine) => PORTRAIT_V2_COMPATIBILITY_MARKERS.some((marker) => sourceLine.includes(marker)))) {
    return true;
  }
  if (sourceIndex >= 0 && sourceLines
    .slice(
      Math.max(0, sourceIndex - COMPATIBILITY_CONTEXT_RADIUS),
      sourceIndex + COMPATIBILITY_CONTEXT_RADIUS + 1,
    )
    .some((sourceLine) => PORTRAIT_V2_COMPATIBILITY_MARKERS.some((marker) => sourceLine.includes(marker)))) {
    return true;
  }

  return input.addedLines
    .slice(Math.max(0, addedLineIndex - COMPATIBILITY_CONTEXT_RADIUS), addedLineIndex + 1)
    .some((addedLine) => PORTRAIT_V2_COMPATIBILITY_MARKERS.some((marker) => addedLine.includes(marker)));
}

function isScannablePath(filePath: string): boolean {
  return /^(?:src|scripts)\/.+\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
}
