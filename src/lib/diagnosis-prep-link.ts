export function buildDiagnosisPrepLink(knowledgeNodeId: string, classId: string): string {
  return `/teacher/preparation?knowledgeNodeId=${encodeURIComponent(knowledgeNodeId)}&classId=${encodeURIComponent(classId)}`;
}
