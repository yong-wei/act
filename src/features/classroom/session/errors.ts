export type ClassroomSessionErrorCode =
  | 'unauthorized'
  | 'user-not-found'
  | 'forbidden'
  | 'not-found'
  | 'invalid-input'
  | 'duplicate-session'
  | 'reuse-session'
  | 'conflict'
  | 'class-not-found'
  | 'class-not-active'
  | 'class-not-owned'
  | 'class-busy'
  | 'session-finished'
  | 'invalid-join-code'
  | 'rate-limited';

export class ClassroomSessionError extends Error {
  constructor(
    public readonly code: ClassroomSessionErrorCode,
    message: string,
    public readonly payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ClassroomSessionError';
  }
}
