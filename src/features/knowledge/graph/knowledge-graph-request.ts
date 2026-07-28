export function buildKnowledgeGraphRootRequestUrl({
  lessonId,
}: {
  lessonId?: string | null;
}): string {
  return lessonId
    ? `/api/knowledge/graph?mode=root&lessonId=${encodeURIComponent(lessonId)}`
    : '/api/knowledge/graph?mode=root';
}

export function buildKnowledgeGraphDomainRequestUrl({
  domainId,
}: {
  domainId: string;
}): string {
  return `/api/knowledge/graph?mode=expansion&domainId=${encodeURIComponent(domainId)}`;
}
