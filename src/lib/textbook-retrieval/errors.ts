import type {
  RetrievalDiagnosticCode,
  RetrievalDiagnosticStage,
} from './types';

export class TextbookRetrievalContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TextbookRetrievalContractError';
  }
}

export class TextbookRetrievalProviderError extends Error {
  constructor(
    readonly stage: RetrievalDiagnosticStage,
    readonly code: RetrievalDiagnosticCode,
    readonly traceId?: string,
  ) {
    super(`${stage} provider failed: ${code}`);
    this.name = 'TextbookRetrievalProviderError';
  }
}
