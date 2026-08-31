import { assertPortable as assertEsaPortable, esaPrivacyViolation } from '@/lib/static-esa-delivery/privacy';

export function deliveryPrivacyViolation(text: string): string | null {
  return esaPrivacyViolation(text);
}

export function assertPortable(value: unknown, label: string): void {
  assertEsaPortable(value, label);
}
