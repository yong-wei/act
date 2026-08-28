import type {
  PersonalizationPluginWritePort,
  PluginPersistenceRequest,
  PluginPersistenceResult,
} from '../types';

function persistenceIdentity(request: PluginPersistenceRequest): string {
  return [
    request.pluginId,
    request.pluginVersion,
    request.subjectUserId,
    request.idempotencyKey,
    request.evidenceRevision,
  ].join(':');
}

export function createIdempotentPluginWritePort(
  store: Map<string, PluginPersistenceResult> = new Map(),
): PersonalizationPluginWritePort {
  return {
    async persist(request) {
      const identity = persistenceIdentity(request);
      const existing = store.get(identity);
      if (existing) {
        return { ...existing, duplicate: true };
      }
      const result: PluginPersistenceResult = {
        accepted: true,
        duplicate: false,
        identity,
      };
      store.set(identity, result);
      return result;
    },
  };
}
