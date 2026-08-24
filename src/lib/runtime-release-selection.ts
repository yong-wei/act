import { assertRuntimeReleaseId, RuntimeReleaseValidationError } from '@/lib/runtime-release';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface RuntimeReleaseSelection {
  schemaVersion: 'runtime-release-selection.v1';
  generation: number;
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
}

export interface RuntimeReleaseActiveReceipt {
  schemaVersion: 'runtime-release-active-receipt.v1';
  selection: RuntimeReleaseSelection;
  healthCheck: 'readyz';
}

export class RuntimeReleaseSelectionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RuntimeReleaseSelectionError';
  }
}

function digest(value: string, name: string) {
  if (!SHA256_PATTERN.test(value)) throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', `${name} must be a SHA-256 digest.`);
  return value;
}

function positiveInteger(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', `${name} must be a positive integer.`);
  return Number(value);
}

function object(value: unknown, name: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', `${name} must be an object.`);
  return value as Record<string, unknown>;
}

export function parseRuntimeReleaseSelection(value: unknown): RuntimeReleaseSelection {
  const raw = object(value, 'selection');
  if (raw.schemaVersion !== 'runtime-release-selection.v1') throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', 'Unsupported runtime release selection version.');
  if (typeof raw.releaseId !== 'string') throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', 'selection.releaseId must be a string.');
  try {
    assertRuntimeReleaseId(raw.releaseId);
  } catch (error) {
    throw new RuntimeReleaseSelectionError('runtime-release-selection-invalid', error instanceof RuntimeReleaseValidationError ? error.message : 'selection.releaseId is invalid.');
  }
  return {
    schemaVersion: 'runtime-release-selection.v1',
    generation: positiveInteger(raw.generation, 'selection.generation'),
    releaseId: raw.releaseId,
    manifestSha256: digest(String(raw.manifestSha256), 'selection.manifestSha256'),
    treeSha256: digest(String(raw.treeSha256), 'selection.treeSha256'),
  };
}

export function serializeRuntimeReleaseSelection(selection: RuntimeReleaseSelection) {
  return `${JSON.stringify(parseRuntimeReleaseSelection(selection))}\n`;
}

export function createRuntimeReleaseSelection(input: {
  previousSelection: RuntimeReleaseSelection | null;
  activeReceipt: RuntimeReleaseActiveReceipt | null;
  expectedActiveReleaseId: string | null;
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
}): RuntimeReleaseSelection {
  const previousSelection = input.previousSelection ? parseRuntimeReleaseSelection(input.previousSelection) : null;
  const activeReceipt = input.activeReceipt ? parseRuntimeReleaseActiveReceipt(input.activeReceipt) : null;
  if (input.expectedActiveReleaseId !== (activeReceipt?.selection.releaseId ?? null)) {
    throw new RuntimeReleaseSelectionError('runtime-release-selection-fenced', 'Expected active release does not match the current active receipt.');
  }
  return parseRuntimeReleaseSelection({
    schemaVersion: 'runtime-release-selection.v1',
    generation: (previousSelection?.generation ?? 0) + 1,
    releaseId: input.releaseId,
    manifestSha256: input.manifestSha256,
    treeSha256: input.treeSha256,
  });
}

export function parseRuntimeReleaseActiveReceipt(value: unknown): RuntimeReleaseActiveReceipt {
  const raw = object(value, 'active receipt');
  if (raw.schemaVersion !== 'runtime-release-active-receipt.v1' || raw.healthCheck !== 'readyz') {
    throw new RuntimeReleaseSelectionError('runtime-release-active-receipt-invalid', 'Runtime active receipt is invalid.');
  }
  return {
    schemaVersion: 'runtime-release-active-receipt.v1',
    selection: parseRuntimeReleaseSelection(raw.selection),
    healthCheck: 'readyz',
  };
}

export function serializeRuntimeReleaseActiveReceipt(receipt: RuntimeReleaseActiveReceipt) {
  return `${JSON.stringify(parseRuntimeReleaseActiveReceipt(receipt))}\n`;
}

export function createRuntimeReleaseActiveReceipt(selection: RuntimeReleaseSelection): RuntimeReleaseActiveReceipt {
  return {
    schemaVersion: 'runtime-release-active-receipt.v1',
    selection: parseRuntimeReleaseSelection(selection),
    healthCheck: 'readyz',
  };
}
