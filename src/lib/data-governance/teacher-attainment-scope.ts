export type TeacherAttainmentScope = 'cumulative' | 'recent';

export const CUMULATIVE_ATTAINMENT_LABEL = '累计能力达成';
export const RECENT_ATTAINMENT_LABEL = '近阶段学情';

export function parseTeacherAttainmentScope(value: string | null): TeacherAttainmentScope | null {
  if (value === null || value === '' || value === 'cumulative') return 'cumulative';
  if (value === 'recent') return 'recent';
  return null;
}

export function getTeacherAttainmentScopeLabel(scope: TeacherAttainmentScope) {
  return scope === 'cumulative' ? CUMULATIVE_ATTAINMENT_LABEL : RECENT_ATTAINMENT_LABEL;
}
