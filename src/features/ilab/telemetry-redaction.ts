import { buildAiData, emptyAiLedger, isAiUsageLedger, type AiUsageLedger, type IlabAiData } from './ai-data';

export interface VesselAuditTelemetry {
  maskedOriginId: string;
  uploadMode: 'local-only' | 'dev-bypass' | 'ilab-remote';
  uploadStatus: string;
  completedStepCount: number;
  totalSamplePoints: number;
  aiData: IlabAiData;
}

/**
 * Redact an iLab originId while retaining prefix context and the trailing 4 characters.
 */
export function maskOriginId(originId: string): string {
  const trimmed = originId.trim();
  if (!trimmed) return '***';
  if (trimmed.length <= 6) {
    return `***${trimmed.slice(-2)}`;
  }
  const suffix = trimmed.slice(-4);
  const underscoreIndex = trimmed.indexOf('_');
  const prefix =
    underscoreIndex > 0 && underscoreIndex <= 10 && underscoreIndex + 1 < trimmed.length - 4
      ? trimmed.slice(0, underscoreIndex + 1)
      : trimmed.slice(0, Math.min(4, trimmed.length - 5));
  return `${prefix}***${suffix}`;
}

/**
 * Build a sanitized, client-safe iLab audit telemetry summary with no tokens or secrets.
 */
export function buildAuditTelemetry(input: {
  originId: string;
  uploadMode: 'local-only' | 'dev-bypass' | 'ilab-remote';
  uploadStatus: string;
  completedStepCount: number;
  totalSamplePoints: number;
  ledgerValue: unknown;
}): VesselAuditTelemetry {
  const ledger: AiUsageLedger = isAiUsageLedger(input.ledgerValue)
    ? input.ledgerValue
    : emptyAiLedger();
  let aiData: IlabAiData;
  try {
    aiData = buildAiData(ledger);
  } catch {
    aiData = buildAiData(emptyAiLedger());
  }

  return {
    maskedOriginId: maskOriginId(input.originId),
    uploadMode: input.uploadMode,
    uploadStatus: input.uploadStatus,
    completedStepCount: input.completedStepCount,
    totalSamplePoints: input.totalSamplePoints,
    aiData,
  };
}
