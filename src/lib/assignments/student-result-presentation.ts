function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatPoints(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `${value} 分`
    : null;
}

function formatCriterion(value: unknown): string | null {
  const criterion = readRecord(value);
  if (!criterion) return null;
  const label = readText(criterion.label);
  const points = formatPoints(criterion.maxPoints);
  const title = label && points ? `${label}（${points}）` : label ?? points;
  const guidance = readText(criterion.studentVisibleGuidance)
    ?? readText(criterion.scoringStandard)
    ?? readText(criterion.evidenceDescription);
  const levels = Array.isArray(criterion.levels)
    ? criterion.levels.flatMap((level) => {
      const row = readRecord(level);
      if (!row) return [];
      const label = readText(row.label);
      const guideline = readText(row.guideline) ?? readText(row.description);
      return label && guideline ? [`${label}：${guideline}`] : guideline ? [guideline] : [];
    })
    : [];
  const lines = [title || null, guidance, ...levels].filter((item): item is string => Boolean(item));
  return lines.length ? lines.join('\n') : null;
}

export function presentStudentReferenceAnswer(value: unknown): string | null {
  return readText(value) ?? readText(readRecord(value)?.text);
}

export function presentStudentScoringStandard(value: unknown): string | null {
  const direct = readText(value);
  if (direct) return direct;
  const rubric = readRecord(value);
  if (!rubric || !Array.isArray(rubric.criteria)) return null;
  const criteria = rubric.criteria
    .map(formatCriterion)
    .filter((item): item is string => item !== null);
  return criteria.length ? criteria.join('\n\n') : null;
}
