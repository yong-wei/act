export async function commitConfirmedState<T>({
  nextState,
  persist,
  commit,
}: {
  nextState: T;
  persist: (state: T) => Promise<unknown>;
  commit: (state: T) => void;
}) {
  await persist(nextState);
  commit(nextState);
  return nextState;
}

export async function persistCourseStateUpdate<T>({
  currentState,
  update,
  persist,
}: {
  currentState: T;
  update: (current: T) => T;
  persist: (state: T) => Promise<unknown>;
}) {
  const nextState = update(currentState);
  await persist(nextState);
  return nextState;
}
