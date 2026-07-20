import 'server-only';

import { SmartCoursewareError } from './domain';

export function resolveSmartCoursewareOrderingSecret(environment = process.env) {
  const secret = environment.SMART_COURSEWARE_ORDERING_SECRET?.trim() ?? '';
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new SmartCoursewareError('courseware-ordering-secret-unavailable', 503);
  }
  return secret;
}
