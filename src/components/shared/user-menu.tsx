'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type UserMenuProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = user.name || user.email || '用户';
  const initials = displayName.charAt(0).toUpperCase();

  const closeMenu = () => setOpen(false);

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (!menuRef.current) return;
    if (!menuRef.current.contains(event.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, handleOutsideClick]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const handlePasswordSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!currentPassword || !nextPassword) {
      setError('请输入当前密码与新密码');
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword: nextPassword,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || '修改密码失败');
      }

      setMessage('密码已更新');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordOpen(false);
        setMessage(null);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 transition-colors hover:bg-slate-700"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-bold text-white">
          {initials}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-white">{displayName}</p>
          <p className="text-xs text-slate-400">{user.email || '个人中心'}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-950/95 p-2 text-sm text-slate-200 shadow-xl">
          {user.role === 'STUDENT' && (
            <Link
              href="/profile"
              onClick={closeMenu}
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-800/80"
            >
              <User className="h-4 w-4" />
              个人中心
            </Link>
          )}
          <button
            onClick={() => {
              closeMenu();
              setPasswordOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-800/80"
          >
            <KeyRound className="h-4 w-4" />
            修改密码
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-200 transition hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">修改密码</p>
                <p className="text-xs text-slate-500">请输入当前密码与新密码</p>
              </div>
              <button
                onClick={() => setPasswordOpen(false)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <input
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="当前密码"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
              />
              <input
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                placeholder="新密码"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
              />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="确认新密码"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
              />
              {error && <p className="text-xs text-rose-300">{error}</p>}
              {message && <p className="text-xs text-emerald-300">{message}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setPasswordOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
              >
                取消
              </button>
              <button
                disabled={submitting}
                onClick={handlePasswordSubmit}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
