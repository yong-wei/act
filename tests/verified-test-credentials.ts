import { accountByKey } from '../scripts/db/verified-test-accounts.mjs';

export { accountByKey };

export function verifiedCredentials(key: 'student' | 'teacher' | 'admin') {
  const account = accountByKey(key);
  return {
    loginId: account.loginId,
    password: account.password,
    email: account.email,
    name: account.name,
    role: account.role,
  };
}

export function verifiedAuthForm(key: 'student' | 'teacher' | 'admin') {
  const account = accountByKey(key);
  return {
    email: account.loginId,
    password: account.password,
  };
}
