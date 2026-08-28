import type { LearningRecordErrorCode } from './types';

export class LearningRecordContractError extends Error {
  constructor(
    public readonly code: LearningRecordErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'LearningRecordContractError';
  }
}
