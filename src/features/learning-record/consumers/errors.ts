import { authorizeProjectionRead } from '@/features/learning-record/projections/public-api';
import type { ProjectionViewer } from '@/features/learning-record/projections/types';

export class ConsumerUnauthorizedError extends Error {
  readonly code = 'projection-unauthorized';

  constructor() {
    super('projection-unauthorized');
    this.name = 'ConsumerUnauthorizedError';
  }
}

export function isConsumerUnauthorized(error: unknown): boolean {
  return error instanceof ConsumerUnauthorizedError
    || (error instanceof Error && error.message === 'projection-unauthorized');
}

export function guardProjectionRead(
  viewer: ProjectionViewer,
  targetUserId: string,
  target: { classId?: string } = {},
): void {
  try {
    authorizeProjectionRead(viewer, targetUserId, target);
  } catch (error) {
    if (error instanceof Error && error.message === 'projection-unauthorized') {
      throw new ConsumerUnauthorizedError();
    }
    throw error;
  }
}
