export function logClassroomEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    '[classroom]',
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    }),
  );
}
