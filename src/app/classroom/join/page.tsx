'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Users, Loader2, AlertCircle } from 'lucide-react';

export default function JoinClassroomPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    id: string;
    plan: { title: string };
    teacher: { name: string };
  } | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许数字，最多6位
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setJoinCode(value);
    setError(null);
    setSessionInfo(null);
  };

  const lookupSession = async () => {
    if (joinCode.length !== 6) {
      setError('请输入完整的6位入会码');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/session/join?code=${joinCode}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '查询失败');
        return;
      }

      setSessionInfo(data);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = () => {
    if (sessionInfo) {
      router.push(`/classroom/student/${sessionInfo.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 mb-4">
            <Users className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">加入课堂</h1>
          <p className="text-slate-400">输入教师提供的入会码</p>
        </div>

        {/* Join Code Input Card */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 shadow-xl">
          {/* Code Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              入会码
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={joinCode}
              onChange={handleCodeChange}
              placeholder="输入6位数字"
              className="w-full h-14 text-center text-3xl font-mono tracking-[0.5em] bg-slate-950 border border-slate-700 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base"
              maxLength={6}
              autoFocus
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Session Preview */}
          {sessionInfo && (
            <div className="mb-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="text-cyan-400 text-sm font-medium mb-1">找到课堂</div>
              <div className="text-white font-bold">{sessionInfo.plan.title}</div>
              <div className="text-slate-400 text-sm mt-1">
                教师: {sessionInfo.teacher.name}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {!sessionInfo ? (
              <button
                onClick={lookupSession}
                disabled={joinCode.length !== 6 || isLoading}
                className="w-full h-12 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                  bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    查询中...
                  </>
                ) : (
                  '查询课堂'
                )}
              </button>
            ) : (
              <button
                onClick={joinSession}
                className="w-full h-12 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                  bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <LogIn className="h-5 w-5" />
                加入课堂
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-500">
          向您的教师获取入会码以加入课堂
        </div>
      </div>
    </div>
  );
}
