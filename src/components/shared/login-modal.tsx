'use client';

import { useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { X } from 'lucide-react';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
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
    if (session?.user?.role) {
      // Reset form
      setAccount('');
      setPassword('');
      setError('');
      onSuccess(session.user.role as UserRole);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 标题 */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">账号登录</h2>
          <p className="mt-1 text-sm text-slate-400">请输入学号或工号</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                name="account"
                placeholder="学号/工号"
                autoComplete="username"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                placeholder="密码"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-amber-500 py-3 text-sm font-medium text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '正在登录...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
