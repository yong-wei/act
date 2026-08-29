export class PersonalizationPolicyScopeError extends Error {
  readonly code = 'POLICY_SCOPE_DENIED';

  constructor() {
    super('recommendation and intervention decisions are scoped to the authenticated owner');
    this.name = 'PersonalizationPolicyScopeError';
  }
}

function privilegedRole(role: string): boolean {
  const normalized = role.trim().toUpperCase();
  return normalized === 'TEACHER' || normalized === 'ADMIN';
}

export function assertPersonalizationOwnerScope(input: {
  actorUserId: string;
  subjectUserId: string;
  role: string;
}): void {
  const actor = input.actorUserId.trim();
  const subject = input.subjectUserId.trim();
  if (!actor || !subject) {
    throw new PersonalizationPolicyScopeError();
  }
  if (actor === subject) return;
  if (privilegedRole(input.role)) return;
  throw new PersonalizationPolicyScopeError();
}
