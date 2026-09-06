'use client';

import { useId, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolvePostLoginRedirect } from '@/lib/auth-redirect';
import { cn } from '@/lib/utils';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface CredentialLoginSuccess {
  role: UserRole;
  redirectPath: string;
}

export interface CredentialLoginFormProps {
  callbackUrl?: string | null;
  onSuccess: (result: CredentialLoginSuccess) => void;
  variant?: 'page' | 'modal';
  className?: string;
}

export interface CredentialLoginRequiredFieldErrors {
  account?: string;
  password?: string;
}

export function getLoginRequiredFieldErrors(
  account: string,
  password: string,
): CredentialLoginRequiredFieldErrors {
  const errors: CredentialLoginRequiredFieldErrors = {};
  if (!account.trim()) {
    errors.account = '请输入学号/工号';
  }
  if (!password) {
    errors.password = '请输入密码';
  }
  return errors;
}

export function CredentialLoginForm({
  callbackUrl,
  onSuccess,
  variant = 'page',
  className,
}: CredentialLoginFormProps) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CredentialLoginRequiredFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalVariant = variant === 'modal';
  const accountErrorId = useId();
  const passwordErrorId = useId();
  const errorTextClass = cn(
    'text-sm text-red-400',
    modalVariant && 'rounded-lg bg-red-500/10 px-3 py-2',
  );

  const clearFieldError = (field: 'account' | 'password') => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const requiredErrors = getLoginRequiredFieldErrors(account, password);
    setFieldErrors(requiredErrors);
    if (requiredErrors.account || requiredErrors.password) {
      return;
    }
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email: account,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setError('账号或密码错误');
      return;
    }

    const session = await getSession();
    const role = session?.user?.role as UserRole | undefined;
    if (!role) {
      setError('无法读取登录身份');
      return;
    }

    setAccount('');
    setPassword('');
    setError('');
    setFieldErrors({});
    onSuccess({
      role,
      redirectPath: resolvePostLoginRedirect({
        callbackUrl,
        origin: typeof window === 'undefined' ? undefined : window.location.origin,
        role,
      }),
    });
  };

  return (
    <form
      action="/login"
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className={cn('space-y-4', className)}
    >
      <Input
        type="text"
        name="account"
        placeholder="学号/工号"
        autoComplete="username"
        value={account}
        onChange={(event) => {
          setAccount(event.target.value);
          clearFieldError('account');
        }}
        aria-describedby={fieldErrors.account ? accountErrorId : undefined}
        className={cn(
          modalVariant &&
            'border-slate-700 bg-slate-900/70 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500',
        )}
      />
      {fieldErrors.account ? (
        <p id={accountErrorId} role="alert" className={errorTextClass}>
          {fieldErrors.account}
        </p>
      ) : null}
      <Input
        type="password"
        name="password"
        placeholder="密码"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          clearFieldError('password');
        }}
        aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
        className={cn(
          modalVariant &&
            'border-slate-700 bg-slate-900/70 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500',
        )}
      />
      {fieldErrors.password ? (
        <p id={passwordErrorId} role="alert" className={errorTextClass}>
          {fieldErrors.password}
        </p>
      ) : null}
      {error ? (
        <p className={errorTextClass}>
          {error}
        </p>
      ) : null}
      <Button
        className={cn(
          'w-full',
          modalVariant && 'bg-amber-500 py-3 text-sm font-medium text-slate-900 hover:bg-amber-400',
        )}
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? '正在登录...' : '登录'}
      </Button>
    </form>
  );
}
