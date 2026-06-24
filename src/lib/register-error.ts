type FlattenedValidationError = {
  formErrors?: unknown;
  fieldErrors?: Record<string, unknown>;
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstString(item);
      if (message) return message;
    }
  }
  return null;
}

export function normalizeRegistrationError(error: unknown): string {
  const fallback = '注册信息有误，请检查后重试。';
  if (typeof error === 'string' && error.trim()) return error;
  if (!error || typeof error !== 'object') return fallback;

  const flattened = error as FlattenedValidationError;
  const fieldErrors = flattened.fieldErrors ?? {};
  return (
    firstString(fieldErrors.password)
    ?? firstString(fieldErrors.email)
    ?? firstString(fieldErrors.name)
    ?? firstString(Object.values(fieldErrors))
    ?? firstString(flattened.formErrors)
    ?? fallback
  );
}
