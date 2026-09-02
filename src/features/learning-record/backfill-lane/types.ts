export const BACKFILL_LANE_CAPTURE_SHA = '2d4e23a468e2d9cc83edbf4e14da0aca0baba1c0';

export type BackfillLaneKind =
  | 'online-reader'
  | 'pointer-writer'
  | 'backfill-command'
  | 'worker'
  | 'report'
  | 'legacy-isolated';

export type BackfillOperationMode = 'online' | 'ordinary-backfill' | 'authorized-cutover';

export interface BackfillLaneRow {
  id: string;
  kind: BackfillLaneKind;
  path: string;
  owner: string;
  mode: BackfillOperationMode;
  authorization: string;
  deletionCondition: string;
}

export type BackfillInputOutcome = 'accepted' | 'duplicate' | 'invalid' | 'retryable' | 'terminal';

export interface BackfillTerminalReceipt {
  operationId: string;
  authorizedBy: string;
  lane: string;
  mode: 'dry-run' | 'apply';
  frozenCutoff: string;
  captureRevision: string;
  inputDigest: string;
  status: 'planned' | 'applied' | 'resumed' | 'rejected';
  outcomes: Partial<Record<BackfillInputOutcome, number>>;
  factsCreated: number;
  factsUpdated: number;
  currentPointerMoved: false;
}

export interface BackfillReceiptStore {
  get(operationId: string): BackfillTerminalReceipt | undefined;
  put(receipt: BackfillTerminalReceipt): void;
}

export class BackfillLaneError extends Error {
  constructor(
    public readonly code: 'input-drift' | 'online-backfill-forbidden' | 'current-pointer-forbidden' | 'online-import',
    message: string,
  ) {
    super(message);
    this.name = 'BackfillLaneError';
  }
}
