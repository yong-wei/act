import type { ResourceRegistryIndexErrorCode } from './types';

export class ResourceRegistryIndexError extends Error {
  constructor(
    public readonly code: ResourceRegistryIndexErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ResourceRegistryIndexError';
  }
}
