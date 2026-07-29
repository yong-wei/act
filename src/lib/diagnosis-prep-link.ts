/**
 * Diagnosis-to-preparation workspace linking helpers.
 * See: tasks.md section 4
 */

/** Build preparation workspace URL from weak knowledge point */
export function buildDiagnosisPrepLink(knowledgeNodeId: string, classId: string): string {
  return `/teacher/preparation?knowledgeNodeId=${encodeURIComponent(knowledgeNodeId)}&classId=${encodeURIComponent(classId)}`;
}

/** Extract knowledgeNodeId from URL search params in prep workspace */
export function getDiagnosisKnowledgeNodeId(searchParams: URLSearchParams): string | null {
  return searchParams.get('knowledgeNodeId');
}
