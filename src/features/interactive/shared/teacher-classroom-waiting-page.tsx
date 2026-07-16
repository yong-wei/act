'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Presentation,
  QrCode,
  Users,
} from 'lucide-react';
import * as QRCode from 'qrcode/lib/browser';

import {
  AppShell,
  PlatformSurface,
} from '@/components/platform/app-shell';
import { buildClassroomJoinUrl } from '@/features/interactive/shared/teacher-join-qr-dialog';

const QR_DARK_COLOR = `#${'111827'}`;
const QR_LIGHT_COLOR = `#${'ffffff'}`;

interface TeacherClassroomWaitingPageProps {
  routeSegment: string;
  sessionId: string;
}

interface SessionPayload {
  id: string;
  joinCode?: string | null;
  planTitle?: string | null;
  status?: string | null;
}

interface TeacherStatePayload {
  summary?: {
    totalStudents?: number;
    latestUpdate?: string | null;
  };
}

export function TeacherClassroomWaitingPage({
  routeSegment,
  sessionId,
}: TeacherClassroomWaitingPageProps) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [joinedStudentCount, setJoinedStudentCount] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const refreshControllerRef = useRef<AbortController | null>(null);
  const refreshSequenceRef = useRef(0);

  const courseHref = `/interactive-learning/courses/${routeSegment}`;
  const waitingHref = `${courseHref}/teacher/${sessionId}/waiting`;
  const runtimeHref = `${courseHref}/teacher/${sessionId}`;
  const joinCode = session?.joinCode?.trim() || '';
  const title = session?.planTitle || '互动课堂等待页';
  const joinUrl = useMemo(() => {
    if (!joinCode || !origin) return null;
    return buildClassroomJoinUrl(joinCode, origin);
  }, [joinCode, origin]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const refreshWaitingState = useCallback(async () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    const sequence = refreshSequenceRef.current + 1;
    refreshControllerRef.current = controller;
    refreshSequenceRef.current = sequence;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionResponse, stateResponse] = await Promise.all([
        fetch(`/api/session/${sessionId}`, { cache: 'no-store', signal: controller.signal }),
        fetch(`/api/session/${sessionId}/state?scope=teacher-view`, { cache: 'no-store', signal: controller.signal }),
      ]);
      if (!sessionResponse.ok || !stateResponse.ok) {
        throw new Error('课堂状态读取失败，请重试。');
      }
      const [sessionPayload, statePayload] = await Promise.all([
        sessionResponse.json() as Promise<SessionPayload>,
        stateResponse.json() as Promise<TeacherStatePayload>,
      ]);
      if (sequence === refreshSequenceRef.current) {
        setSession(sessionPayload);
        setJoinedStudentCount(Math.max(0, statePayload.summary?.totalStudents ?? 0));
      }
    } catch (requestError) {
      if (!controller.signal.aborted && sequence === refreshSequenceRef.current) {
        setLoadError(requestError instanceof Error ? requestError.message : '课堂状态读取失败，请重试。');
      }
    } finally {
      if (sequence === refreshSequenceRef.current) setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshWaitingState();
    const intervalId = window.setInterval(() => void refreshWaitingState(), 5000);

    return () => {
      refreshControllerRef.current?.abort();
      window.clearInterval(intervalId);
    };
  }, [refreshWaitingState]);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    setQrError(null);

    if (!joinUrl) return undefined;

    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 288,
      color: {
        dark: QR_DARK_COLOR,
        light: QR_LIGHT_COLOR,
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError('二维码生成失败，请刷新或使用课堂码加入。');
      });

    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
    } catch {
      setNotice('复制失败，请手动记录。');
    }
  };

  const startClass = () => {
    if (session?.status === 'FINISHED') return;
    setIsStarting(true);
    router.push(runtimeHref);
  };

  return (
    <AppShell
      viewerRole="teacher"
      title="课堂等待页"
      subtitle="确认学生扫码加入后，再进入教师投影运行态。"
      breadcrumbs={[
        { label: '首页', href: '/dashboard' },
        { label: '互动学习', href: '/interactive-learning' },
        { label: '互动课程', href: '/interactive-learning/courses' },
        { label: '课程入口', href: courseHref },
        { label: '课堂等待页' },
      ]}
      actions={(
        <Link
          href={courseHref}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 text-sm font-medium text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程
        </Link>
      )}
      activeHref={waitingHref}
      sidebarMode="collapsible"
      className="surface-page"
    >
      <div
        className="space-y-5"
        data-teacher-classroom-waiting="standard"
        data-commercial-workspace="interactive-learning"
        data-commercial-entry-intent="teach"
        data-task-workspace-archetype="lesson-waiting"
        data-return-target={courseHref}
      >
        <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
          <PlatformSurface variant="raised" className="p-5 sm:p-6" data-teacher-classroom-waiting-panel="join">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-platform-fg-muted">
                  Classroom waiting
                </div>
                <h2 className="mt-3 text-xl font-semibold text-platform-fg-primary sm:text-2xl">扫码加入课堂</h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-platform-border bg-platform-action-subtle text-platform-action-primary">
                <QrCode className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 rounded-md border border-platform-border bg-platform-canvas-muted p-4 text-center" data-classroom-join-qr>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="课堂加入二维码"
                  className="mx-auto aspect-square w-full max-w-[288px] rounded-md border border-platform-border bg-platform-surface p-2"
                />
              ) : (
                <div className="mx-auto flex aspect-square w-full max-w-[288px] items-center justify-center rounded-md border border-platform-border bg-platform-surface text-sm text-platform-fg-muted">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : qrError ?? (joinUrl ? '二维码生成中' : '等待课堂信息')}
                </div>
              )}
              <div className="mt-4 text-xs font-medium text-platform-fg-muted">课堂码</div>
              <div
                className="mt-2 font-mono text-3xl font-semibold tracking-[0.24em] text-platform-fg-primary"
                data-classroom-code={joinCode || 'pending'}
              >
                {joinCode || '------'}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!joinCode}
                onClick={() => joinCode && void copyText(joinCode, '课堂码已复制')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 text-sm font-semibold text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                data-teacher-classroom-waiting-action="copy-code"
              >
                <Copy className="h-4 w-4" />
                复制课堂码
              </button>
              <button
                type="button"
                disabled={!joinUrl}
                onClick={() => joinUrl && void copyText(joinUrl, '加入链接已复制')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 text-sm font-semibold text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                data-teacher-classroom-waiting-action="copy-link"
              >
                <Copy className="h-4 w-4" />
                复制加入链接
              </button>
            </div>
            {notice ? <p className="mt-3 text-sm text-platform-fg-secondary">{notice}</p> : null}
            {loadError ? (
              <div className="mt-3 rounded-md border border-platform-evidence-unsupported px-3 py-3 text-sm text-platform-fg-primary" role="alert">
                {loadError}
                <button type="button" onClick={() => void refreshWaitingState()} className="ml-3 font-semibold text-platform-action-primary">重试</button>
              </div>
            ) : null}
          </PlatformSurface>

          <div className="grid gap-4">
            <PlatformSurface variant="default" className="p-5 sm:p-6" data-teacher-classroom-waiting-panel="status">
              <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
                <Users className="h-4 w-4 text-platform-action-primary" />
                加入状态
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-platform-border bg-platform-canvas-muted p-4">
                  <div className="text-xs font-medium text-platform-fg-muted">已加入学生</div>
                  <div className="mt-3 text-4xl font-semibold text-platform-fg-primary" data-joined-student-count={joinedStudentCount}>
                    {joinedStudentCount}
                  </div>
                </div>
                <div className="rounded-md border border-platform-border bg-platform-canvas-muted p-4">
                  <div className="text-xs font-medium text-platform-fg-muted">课堂状态</div>
                  <div className="mt-3 text-lg font-semibold text-platform-fg-primary">
                    {session?.status === 'FINISHED' ? '已结束' : '等待开始'}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-platform-fg-secondary">
                {session?.status === 'FINISHED'
                  ? `${title} 已结束，不能再次开始。`
                  : `${title} 已创建。等待学生完成扫码或输入课堂码后，点击开始上课进入教师投影运行态。`}
              </p>
              <button
                type="button"
                onClick={startClass}
                disabled={isStarting || !session || session.status === 'FINISHED'}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-platform-action-primary px-4 text-sm font-semibold text-platform-fg-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                data-start-class-action="teacher-runtime"
              >
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                {session?.status === 'FINISHED' ? '课堂已结束' : '开始上课'}
              </button>
            </PlatformSurface>

            <PlatformSurface variant="default" className="p-5" data-teacher-classroom-waiting-panel="flow">
              <div className="text-sm font-semibold text-platform-fg-primary">开课流程</div>
              <div className="mt-4 grid gap-3">
                {[
                  { label: '生成课堂码与二维码', complete: Boolean(qrDataUrl) },
                  { label: '学生扫码或输入课堂码加入', complete: joinedStudentCount > 0 },
                  { label: '教师点击开始上课进入投影运行态', complete: false },
                ].map((item, index) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-md border border-platform-border bg-platform-surface px-3 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-platform-action-subtle text-xs font-semibold text-platform-action-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 text-sm text-platform-fg-secondary">{item.label}</div>
                    {item.complete ? (
                      <CheckCircle2
                        className="ml-auto h-4 w-4 shrink-0 text-platform-fg-muted"
                        data-flow-step-complete="true"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </PlatformSurface>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
