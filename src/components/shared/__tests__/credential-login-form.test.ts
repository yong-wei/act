// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CredentialLoginForm, getLoginRequiredFieldErrors } from '../credential-login-form';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: mocks.signIn,
  getSession: vi.fn(),
}));

function alertTexts(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLParagraphElement>('p[role="alert"]')].map(
    (node) => node.textContent,
  );
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

describe('CredentialLoginForm required validation', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderForm() {
    await act(async () => {
      root.render(createElement(CredentialLoginForm, { onSuccess }));
    });
    const accountInput = container.querySelector<HTMLInputElement>('input[name="account"]')!;
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    return { accountInput, passwordInput, submitButton };
  }

  it('does not rely on browser-native validation bubbles', async () => {
    const { accountInput, passwordInput } = await renderForm();

    expect(container.querySelector('form')!.noValidate).toBe(true);
    expect(accountInput.hasAttribute('required')).toBe(false);
    expect(passwordInput.hasAttribute('required')).toBe(false);
  });

  it('blocks empty submit with both zh alerts and no signIn call', async () => {
    const { submitButton } = await renderForm();
    const user = userEvent.setup();

    await act(async () => {
      await user.click(submitButton);
    });

    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(alertTexts(container)).toEqual(['请输入学号/工号', '请输入密码']);
  });

  it('blocks password-only empty submit with a single alert', async () => {
    const { accountInput, submitButton } = await renderForm();
    const user = userEvent.setup();

    await act(async () => {
      await user.type(accountInput, '3121000001');
      await user.click(submitButton);
    });

    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(alertTexts(container)).toEqual(['请输入密码']);
  });

  it('blocks account-only empty submit with a single alert', async () => {
    const { passwordInput, submitButton } = await renderForm();
    const user = userEvent.setup();

    await act(async () => {
      await user.type(passwordInput, 'secret');
      await user.click(submitButton);
    });

    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(alertTexts(container)).toEqual(['请输入学号/工号']);
  });

  it('links each alert to its input via aria-describedby', async () => {
    const { submitButton } = await renderForm();
    const user = userEvent.setup();

    await act(async () => {
      await user.click(submitButton);
    });

    const accountInput = container.querySelector<HTMLInputElement>('input[name="account"]')!;
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]')!;
    const alerts = container.querySelectorAll<HTMLParagraphElement>('p[role="alert"]');
    expect(alerts).toHaveLength(2);
    expect(accountInput.getAttribute('aria-describedby')).toBe(alerts[0]!.id);
    expect(passwordInput.getAttribute('aria-describedby')).toBe(alerts[1]!.id);
  });

  it('clears the matching alert once the field is filled', async () => {
    const { submitButton } = await renderForm();
    const user = userEvent.setup();

    await act(async () => {
      await user.click(submitButton);
    });
    expect(alertTexts(container)).toHaveLength(2);

    const accountInput = container.querySelector<HTMLInputElement>('input[name="account"]')!;
    await act(async () => {
      await user.type(accountInput, '3121000001');
    });

    expect(alertTexts(container)).toEqual(['请输入密码']);
    expect(accountInput.getAttribute('aria-describedby')).toBeNull();
  });
});
