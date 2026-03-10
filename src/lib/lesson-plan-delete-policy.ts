export function canDeleteLessonPlan(referencedSessionCount: number): boolean {
  return referencedSessionCount <= 0;
}

export function buildLessonPlanDeleteConflictMessage(referencedSessionCount: number): string {
  return `该教案已被 ${referencedSessionCount} 次课堂记录引用，无法删除。请改为归档或保留历史记录。`;
}
