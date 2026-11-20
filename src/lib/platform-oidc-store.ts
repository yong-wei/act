import { createHash, randomBytes } from 'node:crypto';

interface Transaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

interface Completion {
  sessionToken: string;
  returnTo: string;
  expiresAt: number;
}

interface OidcStore {
  transactions: Map<string, Transaction>;
  pending: Map<string, Completion>;
  consumed: Map<string, number>;
  cancelled: Map<string, number>;
}

const globalStore = globalThis as typeof globalThis & { __actOidcStore?: OidcStore };

function store(): OidcStore {
  if (!globalStore.__actOidcStore) {
    globalStore.__actOidcStore = {
      transactions: new Map(),
      pending: new Map(),
      consumed: new Map(),
      cancelled: new Map(),
    };
  }
  return globalStore.__actOidcStore;
}

function clean(now: number): void {
  const current = store();
  for (const [key, value] of current.transactions) if (value.expiresAt <= now) current.transactions.delete(key);
  for (const [key, value] of current.pending) if (value.expiresAt <= now) current.pending.delete(key);
  for (const [key, value] of current.consumed) if (value <= now) current.consumed.delete(key);
  for (const [key, value] of current.cancelled) if (value <= now) current.cancelled.delete(key);
}

export function sanitizeReturnTo(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function transactionCookieName(state: string): string {
  return `act_oidc_tx_${createHash('sha256').update(state).digest('hex').slice(0, 16)}`;
}

export function createOidcTransaction(returnTo: string) {
  const current = store();
  const now = Date.now();
  clean(now);
  const transaction: Transaction = {
    state: randomBytes(24).toString('base64url'),
    nonce: randomBytes(24).toString('base64url'),
    codeVerifier: randomBytes(36).toString('base64url'),
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt: now + 10 * 60 * 1000,
  };
  current.transactions.set(transaction.state, transaction);
  return transaction;
}

export function readOidcTransaction(state: string, cookieState: string) {
  const current = store();
  const now = Date.now();
  clean(now);
  if (current.consumed.has(state) || current.cancelled.has(state) || state !== cookieState) return null;
  return current.transactions.get(state) ?? null;
}

export function cancelOidcTransaction(state: string): void {
  const current = store();
  current.cancelled.set(state, Date.now() + 10 * 60 * 1000);
  current.pending.delete(state);
}

export function publishOidcCompletion(state: string, sessionToken: string, returnTo: string): boolean {
  const current = store();
  const now = Date.now();
  clean(now);
  if (current.cancelled.has(state) || current.consumed.has(state)) return false;
  current.pending.set(state, { sessionToken, returnTo: sanitizeReturnTo(returnTo), expiresAt: now + 60_000 });
  return true;
}

export function consumeOidcCompletion(state: string): Completion | null {
  const current = store();
  const now = Date.now();
  clean(now);
  if (current.consumed.has(state) || current.cancelled.has(state)) return null;
  const completion = current.pending.get(state);
  if (!completion) return null;
  current.pending.delete(state);
  current.consumed.set(state, now + 10 * 60 * 1000);
  return completion;
}

export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
