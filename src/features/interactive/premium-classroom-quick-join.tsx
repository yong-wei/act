'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

export function PremiumClassroomQuickJoin() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinSession = async () => {
    setError(null);
    if (joinCode.length !== 6) {
      setError('请输入6位课堂码');
      return;
    }
    setIsJoining(true);
    try {
      const response = await fetch(`/api/session/join?code=${joinCode}`);
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || '课堂码无效');
      }
      router.push(`/interactive-learning/courses/cruise-comfort-boppps/student/${data.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加入失败');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-cyan-400/25 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold text-white">课堂快速加入</h2>
      <p className="mt-1 text-sm text-slate-300">输入课堂码可直接加入“柔性之海：豪华邮轮舒适度控制”，也可继续浏览下方入口。</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="输入6位课堂码"
          className="h-10 min-w-[220px] rounded-lg border border-white/20 bg-slate-950 px-3 text-sm tracking-[0.2em] text-white outline-none focus:border-cyan-300/60"
        />
        <button
          type="button"
          onClick={() => void joinSession()}
          disabled={isJoining}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          加入课堂
        </button>
        <Link
          href="/interactive-learning/courses/cruise-comfort-boppps"
          className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-slate-200 hover:border-cyan-300/60"
        >
          教师创建课堂
        </Link>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}
