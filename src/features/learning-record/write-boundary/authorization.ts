import { WriteBoundaryError, type HistoricalApplyAuthorization } from './types';

export function assertExplicitHistoricalApply(
  input: Partial<HistoricalApplyAuthorization> | undefined,
): HistoricalApplyAuthorization {
  const operationId = input?.operationId?.trim() ?? '';
  const authorizedBy = input?.authorizedBy?.trim() ?? '';
  const frozenCutoff = input?.frozenCutoff?.trim() ?? '';
  if (!operationId || !authorizedBy || !frozenCutoff) {
    throw new WriteBoundaryError(
      'historical-apply-unauthorized',
      'historical apply requires operationId, authorizedBy and frozenCutoff',
    );
  }
  return { operationId, authorizedBy, frozenCutoff };
}
