import { ClassroomSessionError } from './errors';
import { jsonSafeClassroomPayload } from './json-safe';

export function classroomSessionHttpStatus(error: ClassroomSessionError): number {
  switch (error.code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'user-not-found':
    case 'not-found':
    case 'class-not-found':
      return 404;
    case 'invalid-input':
    case 'invalid-join-code':
      return 400;
    case 'duplicate-session':
    case 'conflict':
    case 'class-not-active':
    case 'class-busy':
      return 409;
    case 'session-finished':
      return 410;
    case 'rate-limited':
      return 429;
    case 'reuse-session':
      return 200;
    case 'class-not-owned':
      return 403;
    default:
      return 500;
  }
}

export function classroomSessionErrorBody(error: ClassroomSessionError): Record<string, unknown> {
  return jsonSafeClassroomPayload({
    error: error.message,
    ...error.payload,
  });
}
