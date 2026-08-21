export function shouldStartTextbookCoachConversation(
  requested: { mode?: string; serverContext?: Record<string, string> } | null | undefined,
  active: {
    teachingAssistantModeId?: string;
    modeClientContextHints?: Record<string, unknown>;
    pinnedTextbookResourceIdentity?: {
      unitId?: string;
      sourceRevision?: string;
      contentHash?: string;
      anchorId?: string | null;
    };
  } | null | undefined,
): boolean {
  if (requested?.mode !== 'resource-coach') return false;
  if (requested.serverContext?.resourceKind !== 'structured-textbook-unit') return false;
  const requestedKey = textbookCoachSessionKey(requested.serverContext);
  if (!requestedKey) return false;
  const activeKey = textbookCoachSessionKey({
    resourceKind: String(active?.modeClientContextHints?.resourceKind ?? 'structured-textbook-unit'),
    unitId: String(active?.pinnedTextbookResourceIdentity?.unitId
      ?? active?.modeClientContextHints?.unitId ?? ''),
    sourceRevision: String(active?.pinnedTextbookResourceIdentity?.sourceRevision
      ?? active?.modeClientContextHints?.sourceRevision ?? ''),
    contentHash: String(active?.pinnedTextbookResourceIdentity?.contentHash
      ?? active?.modeClientContextHints?.contentHash ?? ''),
    anchorId: String(active?.pinnedTextbookResourceIdentity?.anchorId
      ?? active?.modeClientContextHints?.anchorId ?? ''),
  });
  return requestedKey !== activeKey;
}

function textbookCoachSessionKey(value: Record<string, unknown> | undefined): string | null {
  const unitId = typeof value?.unitId === 'string' ? value.unitId : '';
  const sourceRevision = typeof value?.sourceRevision === 'string' ? value.sourceRevision : '';
  const contentHash = typeof value?.contentHash === 'string' ? value.contentHash : '';
  if (!unitId || !sourceRevision || !contentHash) return null;
  const anchorId = typeof value?.anchorId === 'string' ? value.anchorId : '';
  return `${unitId}\u001f${sourceRevision}\u001f${contentHash}\u001f${anchorId}`;
}
