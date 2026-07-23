export type TeacherAttainmentScope = 'cumulative';

export const CUMULATIVE_ATTAINMENT_LABEL = '累计能力达成';

export function parseTeacherAttainmentScope(value: string | null): TeacherAttainmentScope | null {
  if (value === null || value === '' || value === 'cumulative') return 'cumulative';
  return null;
}

export function getUnsupportedTeacherAttainmentScopeError(value: string | null) {
  return parseTeacherAttainmentScope(value) === 'cumulative'
    ? null
    : { error: 'unsupported-scope', scope: value ?? '' };
}

export function getTeacherAttainmentScopeLabel(scope: TeacherAttainmentScope) {
  return CUMULATIVE_ATTAINMENT_LABEL;
}
