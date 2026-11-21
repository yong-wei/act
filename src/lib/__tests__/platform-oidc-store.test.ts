import { describe, expect, it } from 'vitest';
import {
  cancelOidcTransaction,
  codeChallenge,
  consumeOidcCompletion,
  createOidcTransaction,
  publishOidcCompletion,
  readOidcTransaction,
  sanitizeReturnTo,
  transactionCookieName,
} from '@/lib/platform-oidc-store';

describe('in-page OIDC transaction lifecycle', () => {
  it('binds a transaction to state, PKCE, origin return path, and a distinct cookie', () => {
    const first = createOidcTransaction('/course/1?step=2');
    const second = createOidcTransaction('/other');
    expect(first.returnTo).toBe('/course/1?step=2');
    expect(codeChallenge(first.codeVerifier)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(transactionCookieName(first.state)).not.toBe(transactionCookieName(second.state));
    expect(readOidcTransaction(first.state, second.state)).toBeNull();
    expect(readOidcTransaction(first.state, first.state)?.nonce).toBe(first.nonce);
  });

  it('consumes a completion exactly once', () => {
    const transaction = createOidcTransaction('/deep-link');
    expect(publishOidcCompletion(transaction.state, 'session-token', transaction.returnTo)).toBe(true);
    expect(consumeOidcCompletion(transaction.state)?.sessionToken).toBe('session-token');
    expect(consumeOidcCompletion(transaction.state)).toBeNull();
  });

  it('does not publish or consume a cancelled transaction', () => {
    const transaction = createOidcTransaction('/draft');
    cancelOidcTransaction(transaction.state);
    expect(readOidcTransaction(transaction.state, transaction.state)).toBeNull();
    expect(publishOidcCompletion(transaction.state, 'session-token', transaction.returnTo)).toBe(false);
    expect(consumeOidcCompletion(transaction.state)).toBeNull();
  });

  it('rejects external return targets', () => {
    expect(sanitizeReturnTo('https://evil.example')).toBe('/');
    expect(sanitizeReturnTo('//evil.example')).toBe('/');
    expect(sanitizeReturnTo('/\\evil.example/path')).toBe('/');
    expect(sanitizeReturnTo('/%5C%5Cevil.example/path')).toBe('/');
    expect(sanitizeReturnTo('/safe')).toBe('/safe');
  });
});
