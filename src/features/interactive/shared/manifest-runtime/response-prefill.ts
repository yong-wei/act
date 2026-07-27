import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';

export interface ManifestResponseHistoryItem {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export type ManifestResponseHistoryEntry = ManifestResponseHistoryItem | ManifestResponseHistoryItem[];

type TableRows = Record<string, Record<string, string>>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseRecord(value: unknown) {
  if (typeof value !== 'string') return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function valueAtPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => record(value)[key], source);
}

function evidenceDraft(response: ManifestResponseHistoryItem | undefined) {
  if (!response) return {};
  for (const answer of Object.values(response.answers)) {
    const parsed = parseRecord(answer);
    if (parsed.schemaVersion === 'control-workbench-evidence-v1') return parsed;
  }
  return {};
}

function newestFirst(entry: ManifestResponseHistoryEntry | undefined) {
  const responses = Array.isArray(entry) ? entry : entry ? [entry] : [];
  return [...responses].sort((left, right) => right.submittedAt - left.submittedAt);
}

function validatedExplicitSnapshot(
  response: ManifestResponseHistoryEntry | undefined,
  representativeK: number,
) {
  for (const item of newestFirst(response)) {
    const draft = evidenceDraft(item);
    const payload = record(draft.payload);
    const parameterSnapshot = record(payload.parameterSnapshot);
    const answerPayload = record(payload.answerPayload);
    const validationSnapshot = record(answerPayload.validationSnapshot);
    if (Number(parameterSnapshot.k) !== representativeK) continue;
    if (validationSnapshot.validationStatus !== 'validated') continue;
    return { parameterSnapshot, validationSnapshot };
  }
  return null;
}

function validatedComparisonSnapshot(
  response: ManifestResponseHistoryEntry | undefined,
  comparisonRequestId: string,
) {
  for (const item of newestFirst(response)) {
    const draft = evidenceDraft(item);
    const answerPayload = record(record(draft.payload).answerPayload);
    const snapshots = Array.isArray(answerPayload.comparisonSnapshots) ? answerPayload.comparisonSnapshots : [];
    const matched = snapshots.map(record).find((snapshot) => snapshot.comparisonRequestId === comparisonRequestId);
    if (!matched) continue;
    const validationSnapshot = record(matched.validationSnapshot);
    if (validationSnapshot.validationStatus !== 'validated') continue;
    return { parameterSnapshot: record(matched.parameterSnapshot), validationSnapshot };
  }
  return null;
}

function stringifyCell(value: unknown) {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

export function resolveManifestTablePrefill({
  stepManifest,
  responseHistory,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  responseHistory: Record<string, ManifestResponseHistoryEntry>;
}): TableRows {
  const workspace = stepManifest.modules.find((module) => module.kind === 'activity.workspace');
  const responsePrefill = record(workspace?.payload.responsePrefill ?? workspace?.payload.response_prefill);
  const sources = Array.isArray(responsePrefill.sources) ? responsePrefill.sources : [];
  const rows: TableRows = {};

  for (const rawSource of sources) {
    const source = record(rawSource);
    const targetRow = String(source.targetRow ?? source.target_row ?? '').trim();
    const evidenceKey = String(source.evidenceKey ?? source.evidence_key ?? '').trim();
    const sourceStepId = evidenceKey.match(/^(step-\d+)/)?.[1] ?? '';
    if (!targetRow || !sourceStepId) continue;
    const selector = record(source.snapshotSelector ?? source.snapshot_selector);
    const representativeK = Number(source.representativeK ?? source.representative_k);
    const snapshot = selector.comparisonRequestId
      ? validatedComparisonSnapshot(responseHistory[sourceStepId], String(selector.comparisonRequestId))
      : Number.isFinite(representativeK)
        ? validatedExplicitSnapshot(responseHistory[sourceStepId], representativeK)
        : null;
    if (!snapshot) continue;
    const fieldMap = record(source.fieldMap ?? source.field_map);
    const sourceRoot = {
      parameterSnapshot: snapshot.parameterSnapshot,
      validationSnapshot: snapshot.validationSnapshot,
    };
    rows[targetRow] = Object.fromEntries(Object.entries(fieldMap).map(([sourcePath, targetField]) => [
      String(targetField),
      stringifyCell(valueAtPath(sourceRoot, sourcePath)),
    ]).filter(([, value]) => value !== ''));
  }
  return rows;
}

export function mergeManifestTablePrefill(existingValue: string, prefillRows: TableRows) {
  const existing = parseRecord(existingValue);
  const existingRows = record(existing.rows ?? existing);
  const merged = Object.fromEntries(Object.entries(prefillRows).map(([rowKey, prefill]) => {
    const current = record(existingRows[rowKey]);
    return [rowKey, {
      ...prefill,
      ...Object.fromEntries(Object.entries(current).filter(([, value]) => stringifyCell(value).trim())),
    }];
  }));
  for (const [rowKey, row] of Object.entries(existingRows)) {
    if (!(rowKey in merged)) merged[rowKey] = record(row);
  }
  return JSON.stringify({ rows: merged });
}
