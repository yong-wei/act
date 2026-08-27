const FORBIDDEN = [
  /\/Users\//,
  /\/home\//,
  /[A-Za-z]:\\/,
  /password/i,
  /api[_-]?key/i,
  /NEXTAUTH_SECRET/,
  /raw answers?/i,
];

export function privacyFailures(serialized: string): string[] {
  return FORBIDDEN.filter((pattern) => pattern.test(serialized)).map((pattern) => `forbidden:${pattern}`);
}
