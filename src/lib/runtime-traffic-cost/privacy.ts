import { privacyViolation as censusPrivacyViolation } from '@/lib/architecture-census/privacy';

const SIGNED_QUERY = /(?:OSSAccessKeyId|Signature|Expires|security-token|x-oss-signature|X-Amz-Signature|X-Amz-Credential)=/iu;
const AUTHORIZATION = /(?:^|[\s"'])Authorization\s*:/iu;
const IPV4 = /(?:^|[^\d])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:[^\d]|$)/u;
const IPV6 = /(?:^|[^A-Fa-f0-9:])(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}(?:[^A-Fa-f0-9:]|$)/u;

export function trafficPrivacyViolation(text: string): string | null {
  const census = censusPrivacyViolation(text);
  if (census) return census;
  if (SIGNED_QUERY.test(text)) return 'signed-query';
  if (AUTHORIZATION.test(text)) return 'authorization-header';
  if (IPV4.test(text) || IPV6.test(text)) return 'client-ip';
  return null;
}

export function assertPortable(text: string, label: string): void {
  const violation = trafficPrivacyViolation(text);
  if (violation) throw new Error(`privacy-unsafe-${label}:${violation}`);
}
