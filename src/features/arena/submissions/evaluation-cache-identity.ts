export function isCompleteArenaEvaluationCacheIdentity(input: {
  taskId?: string | null;
  artifactHash?: string | null;
  protocolVersion?: string | null;
}): boolean {
  return [input.taskId, input.artifactHash, input.protocolVersion]
    .every((value) => typeof value === 'string' && value.trim().length > 0);
}
