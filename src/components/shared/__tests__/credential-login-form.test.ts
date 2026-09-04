import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getLoginRequiredFieldErrors } from '../credential-login-form';

const rootDir = path.resolve(__dirname, '../../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('getLoginRequiredFieldErrors', () => {
  it('flags both fields on empty submit with zh messages', () => {
    expect(getLoginRequiredFieldErrors('', '')).toEqual({
      account: '请输入学号/工号',
      password: '请输入密码',
    });
  });

  it('flags only password when account is filled', () => {
    expect(getLoginRequiredFieldErrors('3121000001', '')).toEqual({
      password: '请输入密码',
    });
  });

  it('flags only account when password is filled', () => {
    expect(getLoginRequiredFieldErrors('', 'secret')).toEqual({
      account: '请输入学号/工号',
    });
  });

  it('treats whitespace-only account as empty but keeps password verbatim', () => {
    expect(getLoginRequiredFieldErrors('   ', 'secret')).toEqual({
      account: '请输入学号/工号',
    });
    expect(getLoginRequiredFieldErrors(' 3121000001 ', 'secret')).toEqual({});
  });
});

describe('CredentialLoginForm required validation wiring', () => {
  const source = readSource('src/components/shared/credential-login-form.tsx');

  it('opts out of browser-native validation bubbles', () => {
    expect(source).toContain('noValidate');
    expect(source).not.toMatch(/^\s+required$/m);
  });

  it('blocks submit before signIn when required fields are missing', () => {
    const handleSubmitBody = source.slice(
      source.indexOf('const handleSubmit'),
      source.indexOf('setIsSubmitting(true)'),
    );
    expect(handleSubmitBody).toContain('getLoginRequiredFieldErrors(account, password)');
    expect(handleSubmitBody).toContain('return;');
  });

  it('exposes field errors with accessible semantics and shared error styling', () => {
    expect(source).toContain('aria-describedby={fieldErrors.account');
    expect(source).toContain('aria-describedby={fieldErrors.password');
    expect(source.match(/role="alert"/g)).toHaveLength(2);
    expect(source).toContain('const errorTextClass');
  });

  it('clears the matching field error on input', () => {
    expect(source).toContain("clearFieldError('account')");
    expect(source).toContain("clearFieldError('password')");
  });
});
