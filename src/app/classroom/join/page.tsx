'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, LogIn, Users, Loader2, AlertCircle } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { AppShell } from '@/components/platform/app-shell';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';

type JoinMode = 'session' | 'class';

interface SessionJoinInfo {
  id: string;
  studentHref: string;
  plan: { title: string };
  teacher: { name: string };
  class?: { name: string };
  joinState?: {
    state: string;
    recoveryAction: string;
    evidenceWriteback: string;
  };
}

interface ClassJoinInfo {
  id: string;
  name: string;
  teacherName: string;
}

interface ClassJoinState {
  state: string;
  recoveryAction: string;
  evidenceWriteback: string;
}

interface JoinRecoveryLink {
  href: string;
  label: string;
}

export default function JoinClassroomPage() {
  return (
    <Suspense fallback={<JoinClassroomShell />}>
      <JoinClassroomContent />
    </Suspense>
  );
}

function sanitizeCode(value: string, mode: JoinMode) {
  if (mode === 'class') {
    return value
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
  }

  return value.replace(/\D/g, '').slice(0, 6);
}

function buildJoinCallbackPath(mode: JoinMode, code: string) {
  const params = new URLSearchParams({ code });
  if (mode === 'class') {
    params.set('mode', 'class');
  }

  return `/classroom/join?${params.toString()}`;
}

function JoinClassroomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [joinMode, setJoinMode] = useState<JoinMode>('session');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<JoinRecoveryLink | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionJoinInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassJoinInfo | null>(null);
  const [classJoinState, setClassJoinState] = useState<ClassJoinState | null>(null);
  const autoLookupKeyRef = useRef<string | null>(null);

  const resetResult = () => {
    setError(null);
    setRecoveryLink(null);
    setSessionInfo(null);
    setClassInfo(null);
    setClassJoinState(null);
  };

  const handleModeChange = (mode: JoinMode) => {
    setJoinMode(mode);
    setJoinCode((current) => sanitizeCode(current, mode));
    resetResult();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJoinCode(sanitizeCode(e.target.value, joinMode));
    resetResult();
  };

  const lookupSession = useCallback(
    async (code = joinCode) => {
      if (code.length !== 6) {
        setError('请输入完整的6位课堂码');
        return;
      }

      setIsLoading(true);
      setError(null);
      setRecoveryLink(null);

      try {
        const res = await fetch(`/api/session/join?code=${code}`);
        const data = await res.json();

        if (res.status === 401) {
          router.replace(buildLoginRedirectForPath(buildJoinCallbackPath('session', code)));
          return;
        }

        if (!res.ok) {
          const recoveryAction =
            typeof data.joinState?.recoveryAction === 'string' ? data.joinState.recoveryAction : null;
          const reviewHref = typeof data.reviewHref === 'string' ? data.reviewHref : null;
          setError([data.error || '查询失败', recoveryAction].filter(Boolean).join('。'));
          setRecoveryLink(reviewHref ? { href: reviewHref, label: '查看个人课堂证据' } : null);
          return;
        }

        setSessionInfo(data);
      } catch {
        setError('网络错误，请重试');
      } finally {
        setIsLoading(false);
      }
    },
    [joinCode, router],
  );

  const joinClass = useCallback(
    async (code = joinCode) => {
      if (code.length !== 6) {
        setError('请输入完整的6位班级加入码');
        return;
      }

      setIsLoading(true);
      setError(null);
      setRecoveryLink(null);

      try {
        const res = await fetch('/api/classes/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (res.status === 401) {
          router.replace(buildLoginRedirectForPath(buildJoinCallbackPath('class', code)));
          return;
        }

        if (!res.ok) {
          const recoveryAction =
            typeof data.classJoinState?.recoveryAction === 'string' ? data.classJoinState.recoveryAction : null;
          setError([data.error || '加入班级失败', recoveryAction].filter(Boolean).join('。'));
          setClassJoinState(typeof data.classJoinState?.state === 'string' ? data.classJoinState : null);
          setRecoveryLink(null);
          return;
        }

        setClassInfo(data.class);
        setClassJoinState(typeof data.classJoinState?.state === 'string' ? data.classJoinState : null);
      } catch {
        setError('网络错误，请重试');
      } finally {
        setIsLoading(false);
      }
    },
    [joinCode, router],
  );

  useEffect(() => {
    const rawCodeFromUrl = searchParams.get('code') ?? '';
    const modeFromUrl: JoinMode = searchParams.get('mode') === 'class' ? 'class' : 'session';
    const codeFromUrl = sanitizeCode(rawCodeFromUrl, modeFromUrl);
    const lookupKey = `${modeFromUrl}:${codeFromUrl}`;

    if (codeFromUrl.length !== 6 || autoLookupKeyRef.current === lookupKey) {
      return;
    }

    autoLookupKeyRef.current = lookupKey;
    setJoinMode(modeFromUrl);
    setJoinCode(codeFromUrl);
    resetResult();

    if (modeFromUrl === 'class') {
      void joinClass(codeFromUrl);
      return;
    }

    void lookupSession(codeFromUrl);
  }, [joinClass, lookupSession, searchParams]);

  const joinSession = () => {
    if (sessionInfo) {
      router.push(sessionInfo.studentHref);
    }
  };

  const returnToDashboard = () => {
    router.push('/profile');
  };

  return (
    <JoinClassroomShell
      joinMode={joinMode}
      joinCode={joinCode}
      isLoading={isLoading}
      error={error}
      recoveryLink={recoveryLink}
      sessionInfo={sessionInfo}
      classInfo={classInfo}
      classJoinState={classJoinState}
      onModeChange={handleModeChange}
      onCodeChange={handleCodeChange}
      onLookup={() => {
        if (joinMode === 'class') {
          void joinClass();
          return;
        }

        void lookupSession();
      }}
      onJoinSession={joinSession}
      onReturnToDashboard={returnToDashboard}
    />
  );
}

function JoinClassroomShell({
  joinMode = 'session',
  joinCode = '',
  isLoading = false,
  error = null,
  recoveryLink = null,
  sessionInfo = null,
  classInfo = null,
  classJoinState = null,
  onModeChange,
  onCodeChange,
  onLookup,
  onJoinSession,
  onReturnToDashboard,
}: {
  joinMode?: JoinMode;
  joinCode?: string;
  isLoading?: boolean;
  error?: string | null;
  recoveryLink?: JoinRecoveryLink | null;
  sessionInfo?: SessionJoinInfo | null;
  classInfo?: ClassJoinInfo | null;
  classJoinState?: ClassJoinState | null;
  onModeChange?: (mode: JoinMode) => void;
  onCodeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLookup?: () => void;
  onJoinSession?: () => void;
  onReturnToDashboard?: () => void;
}) {
  const isClassMode = joinMode === 'class';
  const hasResult = Boolean(sessionInfo || classInfo);
  const joinErrorState = error
    ? buildPlatformRecoveryState({
        kind: 'classroom-code-error',
        sourceRoute: '/classroom/join',
        targetLabel: isClassMode ? '班级加入码' : '课堂码',
        displayReference: joinCode || null,
        message: error,
        recoveryAction: recoveryLink ? '查看个人课堂证据或重新输入加入码' : undefined,
      })
    : null;

  return (
    <ClassroomJoinAppShell>
      <section className="flex min-h-[calc(100dvh-12rem)] items-center justify-center rounded-lg border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/20">
              <Users className="h-8 w-8 text-cyan-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">加入课堂 / 班级</h1>
            <p className="text-slate-400">输入教师提供的课堂码或班级加入码</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => onModeChange?.('session')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  !isClassMode ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                加入课堂
              </button>
              <button
                type="button"
                onClick={() => onModeChange?.('class')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isClassMode ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                加入班级
              </button>
            </div>

            <div className="mb-6">
              <label htmlFor="classroom-join-code" className="mb-2 block text-sm font-medium text-slate-400">
                {isClassMode ? '班级加入码' : '课堂码'}
              </label>
              <input
                id="classroom-join-code"
                type="text"
                inputMode={isClassMode ? 'text' : 'numeric'}
                value={joinCode}
                onChange={onCodeChange}
                readOnly={!onCodeChange}
                placeholder={isClassMode ? '如 B78429' : '输入6位数字'}
                className="h-14 w-full rounded-xl border border-slate-700 bg-slate-950 text-center font-mono text-3xl tracking-[0.35em] text-white outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                maxLength={6}
                autoFocus
              />
            </div>

            {joinErrorState && (
              <div data-classroom-join-state="recoverable-error">
                <ActionStatusPanel
                  state={joinErrorState}
                  className="mb-4 border-red-500/30 bg-red-500/10 text-red-100"
                  action={
                    recoveryLink ? (
                      <Link
                        href={recoveryLink.href}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-400/40 px-3 text-xs font-semibold text-red-100 transition hover:border-red-300 hover:bg-red-400/10"
                        data-classroom-join-recovery-link="review-evidence"
                      >
                        <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0" />
                        {recoveryLink.label}
                      </Link>
                    ) : null
                  }
                />
              </div>
            )}

            {sessionInfo && (
              <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="mb-1 text-sm font-medium text-cyan-400">找到课堂</div>
                <div className="font-bold text-white">{sessionInfo.plan.title}</div>
                <div className="mt-1 space-y-0.5 text-sm text-slate-400">
                  <div>教师: {sessionInfo.teacher.name}</div>
                  {sessionInfo.class && <div>班级: {sessionInfo.class.name}</div>}
                </div>
                {sessionInfo.joinState?.evidenceWriteback ? (
                  <div className="mt-3 rounded-lg border border-cyan-500/20 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-cyan-100/80">
                    {sessionInfo.joinState.evidenceWriteback}
                  </div>
                ) : null}
              </div>
            )}

            {classInfo && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  已加入班级
                </div>
                <div className="font-bold text-white">{classInfo.name}</div>
                <div className="mt-1 text-sm text-slate-400">教师: {classInfo.teacherName}</div>
                {classJoinState?.evidenceWriteback ? (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-emerald-100/80">
                    {classJoinState.evidenceWriteback}
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-3">
              {!hasResult ? (
                <button
                  type="button"
                  onClick={onLookup}
                  disabled={joinCode.length !== 6 || isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 font-medium text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {isClassMode ? '加入中...' : '查询中...'}
                    </>
                  ) : isClassMode ? (
                    '加入班级'
                  ) : (
                    '查询课堂'
                  )}
                </button>
              ) : sessionInfo ? (
                <button
                  type="button"
                  onClick={onJoinSession}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 font-medium text-white transition-all hover:bg-cyan-500"
                >
                  <LogIn className="h-5 w-5" />
                  加入课堂
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReturnToDashboard}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 font-medium text-white transition-all hover:bg-cyan-500"
                >
                  返回学习首页
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            课堂码用于进入一次课堂，班级加入码用于绑定长期班级
          </div>
        </div>
      </section>
    </ClassroomJoinAppShell>
  );
}

function ClassroomJoinAppShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      viewerRole="student"
      activeHref="/classroom/join"
      activeNavigationHref="/interactive-learning"
      title="加入课堂 / 班级"
      subtitle="输入教师提供的课堂码或班级加入码。"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '加入课堂 / 班级' }]}
    >
      {children}
    </AppShell>
  );
}
