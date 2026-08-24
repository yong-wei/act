export type EvidenceCaptureRevision = {
  commitSha: string;
  treeSha: string;
};

export function evidenceCaptureRevisionProblems(
  expected: EvidenceCaptureRevision,
  actual: EvidenceCaptureRevision,
  dirtyPaths: readonly string[],
  allowedDirtyPrefixes: readonly string[] = [],
) {
  const unexpectedDirtyPaths = dirtyPaths.filter((dirtyPath) => (
    !allowedDirtyPrefixes.some((prefix) => {
      const normalizedPrefix = prefix.replace(/\\/gu, '/');
      const normalizedPath = dirtyPath.replace(/\\/gu, '/');
      return normalizedPrefix.endsWith('/')
        ? normalizedPath.startsWith(normalizedPrefix)
        : normalizedPath === normalizedPrefix;
    })
  ));

  return [
    expected.commitSha === actual.commitSha ? null : 'capture-revision:head-changed',
    expected.treeSha === actual.treeSha ? null : 'capture-revision:tree-changed',
    ...unexpectedDirtyPaths.map((dirtyPath) => `capture-revision:unexpected-dirty:${dirtyPath}`),
  ].filter((problem): problem is string => Boolean(problem));
}
