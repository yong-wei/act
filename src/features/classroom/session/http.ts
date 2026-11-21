import { ClassroomSessionError } from './errors';
import { jsonSafeClassroomPayload } from './json-safe';
import type { Session } from 'next-auth';

export function classroomReadHeaders(start: number, sessionChecked: number) {
  return {
    'Cache-Control': 'private, no-store',
    'Server-Timing': `session;dur=${(sessionChecked - start).toFixed(1)}, classroom;dur=${(performance.now() - sessionChecked).toFixed(1)}`,
  };
}

export function classroomAuthenticationResponse(error: Session['error'], message = 'Unauthorized') {
  if (error === 'ACT_ACCESS_UNAVAILABLE') {
    return Response.json({ error: '正在核验课堂访问资格，请稍后重试。' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '3' },
    });
  }
  if (error === 'ACT_ACCESS_DENIED') {
    return Response.json({ error: '无法进入这间课堂。' }, { status: 403 });
  }
  return Response.json({ error: message }, { status: 401 });
}

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
