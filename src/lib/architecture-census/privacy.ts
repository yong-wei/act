const ABSOLUTE_PATH = /(?:^|[\s"'`=(])(?:\/Users\/|\/home\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\)/u;
const SECRET = /(?:^|[^A-Za-z0-9_-])(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|postgres(?:ql)?:\/\/[^\s"'\\]+:[^\s"'\\]+@)/u;
const LEARNER = /"(?:studentId|userId|email|rawAnswer|eventPayload)"\s*:\s*"(?!test-|fixture-)[^"]+"/u;

export function privacyViolation(text: string): string | null {
  if (ABSOLUTE_PATH.test(text)) return 'absolute-path';
  if (SECRET.test(text)) return 'secret';
  if (LEARNER.test(text)) return 'forbidden-payload';
  return null;
}
