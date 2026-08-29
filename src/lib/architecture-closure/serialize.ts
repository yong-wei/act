import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { closureOutputPrivacyViolation } from './privacy';

export { serializeDeterministic, sha256Text };
export { closureOutputPrivacyViolation as privacyViolation };
export { publicEvidenceTextViolation } from './privacy';

export function sha256WithoutKey(value: object, key: string): string {
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete copy[key];
  return sha256Text(serializeDeterministic(copy));
}
