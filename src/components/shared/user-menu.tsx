'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type UserMenuProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  variant?: 'default' | 'admin';
};

export function UserMenu({ user, variant = 'default' }: UserMenuProps) {
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
    <div ref={menuRef} className="relative z-[70]">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-3 px-4 py-2 transition-colors',
          variant === 'admin'
            ? 'admin-console-user-menu-button hover:border-cyan-300/50'
            : 'surface-card-soft hover:border-primary/55'
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold',
            variant === 'admin'
              ? 'bg-cyan-500/20 text-cyan-100'
              : 'bg-gradient-to-br from-amber-500 to-orange-600 text-primary-foreground'
          )}
        >
          {initials}
        </div>
        <div className="text-left">
          <p className={cn('text-sm font-medium', variant === 'admin' ? 'admin-console-title' : 'text-foreground')}>
            {displayName}
          </p>
          <p className={cn('text-xs', variant === 'admin' ? 'admin-console-muted' : 'text-subtle')}>
            {user.email || '个人中心'}
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4', variant === 'admin' ? 'admin-console-muted' : 'text-subtle')} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 z-[80] mt-2 w-52 rounded-xl border p-2 text-sm shadow-xl backdrop-blur',
            variant === 'admin'
              ? 'admin-console-user-menu-panel'
              : 'border-border/70 bg-background/95 text-foreground'
          )}
        >
          {user.role === 'STUDENT' && (
            <Link
              href="/profile"
              onClick={closeMenu}
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-accent hover:text-accent-foreground"
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-accent hover:text-accent-foreground"
          >
            <KeyRound className="h-4 w-4" />
            修改密码
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-300 transition hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
          <div className="surface-card w-full max-w-md p-6 text-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-foreground">修改密码</p>
                <p className="text-xs text-subtle">请输入当前密码与新密码</p>
              </div>
              <button
                onClick={() => setPasswordOpen(false)}
                className="btn-ghost-themed rounded-lg border px-2 py-1 text-xs"
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                placeholder="新密码"
                type="password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="确认新密码"
                type="password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {error && <p className="text-xs text-rose-300">{error}</p>}
              {message && <p className="text-xs text-emerald-300">{message}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setPasswordOpen(false)}
                className="btn-ghost-themed rounded-lg border px-3 py-2 text-sm"
              >
                取消
              </button>
              <button
                disabled={submitting}
                onClick={handlePasswordSubmit}
                className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary disabled:opacity-50"
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
