import { privacyViolation as censusPrivacyViolation } from '@/lib/architecture-census/privacy';

const SIGNED_QUERY = /(?:OSSAccessKeyId|Signature|Expires|security-token|x-oss-signature|X-Amz-Signature|X-Amz-Credential)=/iu;
const AUTHORIZATION = /(?:^|[\s"'])Authorization\s*:/iu;

export function esaPrivacyViolation(text: string): string | null {
  const census = censusPrivacyViolation(text);
  if (census) return census;
  if (SIGNED_QUERY.test(text)) return 'signed-query';
  if (AUTHORIZATION.test(text)) return 'authorization-header';
  return null;
}

export function assertPortable(value: unknown, label: string): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const violation = esaPrivacyViolation(text);
  if (violation) throw new Error(`privacy-unsafe-${label}:${violation}`);
}
