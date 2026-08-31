export interface DecisionTransactionDb {
  $transaction?: <T>(fn: (tx: DecisionTransactionDb) => Promise<T>) => Promise<T>;
}

export async function runDecisionTransaction<T>(
  db: DecisionTransactionDb,
  execute: (tx: DecisionTransactionDb) => Promise<T>,
): Promise<T> {
  if (typeof db.$transaction === 'function') {
    return db.$transaction((tx) => execute(tx));
  }
  return execute(db);
}
