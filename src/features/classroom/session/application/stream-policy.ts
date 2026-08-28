export const CLASSROOM_STREAM_HEARTBEAT_MS = 15_000;
export const CLASSROOM_STREAM_POLL_MS = 2_000;

export function selectClassroomStreamBackend(isRedisReady: boolean): 'redis' | 'poll' {
  return isRedisReady ? 'redis' : 'poll';
}
