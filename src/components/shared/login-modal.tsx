'use client';

import { X } from 'lucide-react';

import { CredentialLoginForm } from '@/components/shared/credential-login-form';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  if (!isOpen) return null;

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

        <CredentialLoginForm
          variant="modal"
          onSuccess={({ role }) => onSuccess(role as UserRole)}
        />
      </div>
    </div>
  );
}
