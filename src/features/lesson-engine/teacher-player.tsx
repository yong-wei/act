
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Users, QrCode, LayoutDashboard, X } from 'lucide-react';
import { ResourceRenderer } from './resource-renderer';
import { DataDashboard } from './data-dashboard';
import {
  buildClassroomIdentityPayload,
  buildClassroomLifecycleEvidenceFields,
  type ClassroomIdentityPayload,
} from '@/lib/classroom-lifecycle-contract';

interface TeacherPlayerProps {
  session: any; // Simplified type
  initialItems: any[];
}

interface ClassroomRosterItem {
  id: string;
  name: string | null;
  email?: string | null;
  online: boolean;
  submitted: boolean;
}

interface ClassroomDeliveryState {
  releasedStepId: string | null;
  submittedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  notSubmitted: Array<{ id: string; name: string | null; email?: string | null }>;
  latestUpdate: string | Date | null;
}

export function TeacherPlayer({ session, initialItems }: TeacherPlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(() => {
      const idx = initialItems.findIndex(i => i.id === session.currentItemId);
      return idx >= 0 ? idx : 0;
  });
  const [studentCount, setStudentCount] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);
  const [endStatus, setEndStatus] = useState<'idle' | 'confirming' | 'ending' | 'failed'>('idle');
  const [endError, setEndError] = useState<string | null>(null);
  const [roster, setRoster] = useState<ClassroomRosterItem[]>([]);
  const [delivery, setDelivery] = useState<ClassroomDeliveryState | null>(null);
  const [lastObservedAt, setLastObservedAt] = useState<string | Date | null>(null);
  const [classroomStatus, setClassroomStatus] = useState('课堂运行态已加载。');
  const startEvidenceRecordedRef = useRef(false);

  const currentItem = initialItems[currentIndex];
  const reviewHref = `/classroom/teacher/${session.id}/review`;
  const classroomIdentity: ClassroomIdentityPayload = session.classroomIdentity ?? buildClassroomIdentityPayload(session);
  const currentStepLabel = currentItem
    ? `${currentIndex + 1}/${initialItems.length} · ${currentItem.title ?? currentItem.resource?.title ?? currentItem.knowledgeNode?.title ?? currentItem.stage}`
    : '未发放';
  const freshnessLabel = lastObservedAt
    ? new Date(lastObservedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '暂无心跳';
  const classroomStateSteps = [
    { label: '加入', value: studentCount > 0 ? `${studentCount} 在线` : '等待学生' },
    { label: '发放', value: currentItem ? `已发放 ${currentIndex + 1}/${initialItems.length}` : '未发放' },
    { label: '提交', value: delivery ? `${delivery.submittedCount} 已交 / ${delivery.notSubmitted.length} 未交` : '等待同步' },
    { label: '汇总', value: '复盘页生成' },
    { label: '结束', value: endStatus === 'ending' ? '结束中' : '可结束' },
    { label: '课后复盘', value: '结束后进入' },
  ];

  const emitControlEvidence = useCallback((eventType: string, stepId?: string | null) => {
    const clientEventAt = new Date().toISOString();
    const targetId = stepId ?? currentItem?.id ?? 'session';
    return buildClassroomLifecycleEvidenceFields({
      eventType,
      actorRole: 'teacher',
      sessionId: session.id,
      stepId: targetId === 'session' ? null : targetId,
      clientEventId: [session.id, eventType, targetId, clientEventAt].join(':'),
      clientEventAt,
    });
  }, [currentItem?.id, session.id]);

  const recordControlEvidence = useCallback(async (eventType: string, stepId?: string | null) => {
    const classroomEvent = emitControlEvidence(eventType, stepId);
    try {
      await fetch(`/api/session/${session.id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'teacher:course-sync',
          stateKey: 'teacher-sync',
          eventType,
          stepId: classroomEvent.stepId,
          cardId: classroomEvent.cardId,
          clientEventId: classroomEvent.clientEventId,
          sourceLogId: 'teacher-player',
          clientEventAt: classroomEvent.clientEventAt,
          data: {
            kind: 'teacher-control',
            eventType,
            stepId: classroomEvent.stepId,
          },
        }),
      });
    } catch {
      // 控制事件记录失败不阻断授课主流程，教师界面状态仍通过 PATCH 同步。
    }
  }, [emitControlEvidence, session.id]);

  // 获取学生在线名单与发放状态
  const fetchClassroomState = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${session.id}/state?scope=teacher-view`);
      if (res.ok) {
        const data = await res.json();
        const presenceRoster = Array.isArray(data.presence?.roster) ? data.presence.roster : [];
        setRoster(presenceRoster);
        setStudentCount(Number(data.presence?.onlineCount ?? data.states?.length ?? 0));
        setDelivery(data.delivery ?? null);
        setLastObservedAt(data.presence?.latestUpdate ?? data.summary?.latestUpdate ?? null);
      }
    } catch {
      // 静默失败
    }
  }, [session.id]);

  useEffect(() => {
    fetchClassroomState();
    const interval = setInterval(fetchClassroomState, 5000);
    return () => clearInterval(interval);
  }, [fetchClassroomState]);

  useEffect(() => {
    if (startEvidenceRecordedRef.current) return;
    startEvidenceRecordedRef.current = true;
    void recordControlEvidence('start-class', currentItem?.id ?? null);
  }, [currentItem?.id, recordControlEvidence]);

  const updateSession = async (item: any) => {
      try {
          await fetch(`/api/session/${session.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  currentItemId: item.id,
                  currentStage: item.stage,
                  classroomEvent: emitControlEvidence('page-change', item.id),
              })
          });
          void recordControlEvidence('release-interaction', item.id);
          setClassroomStatus(`已切换到 ${item.stage} 环节，课堂状态正在同步。`);
      } catch (e) {
          console.error('Failed to sync session', e);
          setClassroomStatus('课堂翻页同步失败，请稍后重试。');
      }
  };

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(session.joinCode);
      void recordControlEvidence('copy-code');
      setClassroomStatus(`课堂码 ${session.joinCode} 已复制。`);
    } catch {
      setClassroomStatus('课堂码复制失败，请手动选择课堂码。');
    }
  };

  const handleNext = () => {
      if (currentIndex < initialItems.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          updateSession(initialItems[nextIndex]);
      }
  };

  const handlePrev = () => {
      if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          setCurrentIndex(prevIndex);
          updateSession(initialItems[prevIndex]);
      }
  };

  const handleEndClass = () => {
    setEndError(null);
    setEndStatus('confirming');
    setClassroomStatus('已打开结束课堂确认。');
  };

  const confirmEndClass = async () => {
    try {
      setEndStatus('ending');
      // 调用 API 更新课堂状态为已结束
      const res = await fetch(`/api/session/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED', classroomEvent: emitControlEvidence('end-class') })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '结束课堂失败');
      }

      router.push(reviewHref);
    } catch (error) {
      console.error('结束课堂失败:', error);
      setEndError(error instanceof Error ? error.message : '结束课堂失败，请重试');
      setEndStatus('failed');
    }
  };

  if (session.status === 'FINISHED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-platform-canvas px-6 text-platform-fg-primary" data-classroom-teacher-state="finished-review">
        <section className="max-w-xl rounded-xl border border-platform-border bg-platform-surface p-8 text-center">
          <h1 className="text-2xl font-semibold text-platform-fg-primary">课堂已结束</h1>
          <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
            {classroomIdentity.summaryLabel} 已进入复盘状态，教师投影控制已关闭。
          </p>
          <button
            type="button"
            onClick={() => router.push(reviewHref)}
            className="mt-6 rounded-lg bg-platform-action-primary px-5 py-3 text-sm font-medium text-platform-fg-inverse hover:bg-platform-action-hover"
          >
            查看课堂复盘
          </button>
        </section>
      </div>
    );
  }

  if (initialItems.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-platform-canvas text-platform-fg-primary">
        <div className="flex h-14 items-center justify-between border-b border-platform-border bg-platform-surface px-6">
          <div>
            <span className="text-lg font-bold text-platform-fg-primary">{session.plan.title}</span>
            <p className="text-xs text-platform-fg-muted">{classroomIdentity.label}</p>
          </div>
          <button type="button" aria-label="结束课堂并进入复盘" onClick={handleEndClass} className="flex items-center gap-1 text-sm text-platform-evidence-unsupported hover:text-platform-evidence-unsupported/80">
            <X className="h-4 w-4" />
            结束
          </button>
        </div>
        <main className="flex flex-1 items-center justify-center px-6 text-center">
          <section className="max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8">
            <p className="text-lg font-semibold text-amber-100">该教案暂无可授课环节</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/80">
              请返回教案编辑页，至少添加 1 个资源或知识节点后再开始上课。
            </p>
          </section>
        </main>
        <EndClassDialog
          open={endStatus === 'confirming' || endStatus === 'ending' || endStatus === 'failed'}
          status={endStatus}
          error={endError}
          reviewHref={reviewHref}
          onCancel={() => setEndStatus('idle')}
          onConfirm={confirmEndClass}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-platform-canvas text-platform-fg-primary">
        {/* Top Bar */}
        <div className="z-20 flex h-14 items-center justify-between border-b border-platform-border bg-platform-surface px-6">
            <div className="flex items-center gap-4">
                <div>
                  <span className="text-lg font-bold text-platform-fg-primary">{session.plan.title}</span>
                  <p className="text-xs text-platform-fg-muted">{classroomIdentity.label}</p>
                </div>
                <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-mono">{currentItem?.stage}</span>
                <div className="hidden items-center gap-1 xl:flex" data-classroom-state-flow="join-release-submit-summary-end-review">
                  {classroomStateSteps.map((step) => (
                    <span key={step.label} className="rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5 text-[11px] text-platform-fg-secondary">
                      {step.label}: {step.value}
                    </span>
                  ))}
                </div>
            </div>

            <div className="flex items-center gap-6">
                <button
                  type="button"
                  aria-label={`复制${classroomIdentity.label}课堂码`}
                  onClick={copyJoinCode}
                  className="flex items-center gap-2 rounded-full bg-platform-action-subtle px-3 py-1 text-platform-fg-secondary hover:bg-platform-action-hover"
                >
                    <QrCode className="h-4 w-4" />
                    <span className="font-mono text-platform-fg-primary">{session.joinCode}</span>
                </button>
                <div className="flex items-center gap-2 text-platform-fg-secondary" aria-label={`在线学生 ${studentCount} 人，状态更新于 ${freshnessLabel}`}>
                    <Users className="h-4 w-4" />
                    <span>{studentCount} 在线 · {freshnessLabel}</span>
                </div>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button type="button" aria-label="结束课堂并进入复盘" onClick={handleEndClass} className="flex items-center gap-1 text-sm text-platform-evidence-unsupported hover:text-platform-evidence-unsupported/80">
                    <X className="h-4 w-4" />
                    结束
                </button>
            </div>
        </div>
        <div className="sr-only" role="status" aria-live="polite">{classroomStatus}</div>

        {/* Main Content */}
        <div className="relative flex-1 overflow-hidden bg-platform-canvas">
            {currentItem && (currentItem.resource || currentItem.knowledgeNode) ? (
                <ResourceRenderer
                  resource={currentItem.resource}
                  knowledgeNode={currentItem.knowledgeNode}
                  overrideConfig={currentItem.overrideConfig}
                  sessionId={session.id}
                  lessonItemId={currentItem.id}
                  lessonPlanId={session.plan?.id}
                  classId={session.classId ?? null}
                  stage={currentItem.stage}
                  classroomActorRole="teacher"
                />
            ) : (
                <div className="flex h-full items-center justify-center text-platform-fg-muted">
                    Waiting for content...
                </div>
            )}
        </div>

        {/* Bottom Control Bar */}
        <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-12 z-20 shadow-xl shadow-black/50">
            <button type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-200"
            >
                <ChevronLeft className="h-5 w-5" />
                上一页
            </button>

            <div className="flex flex-col items-center gap-1 w-64">
                <div className="font-mono text-xs text-platform-fg-muted">
                    {currentIndex + 1} / {initialItems.length}
                </div>
                <div className="text-[11px] text-platform-fg-muted">{currentStepLabel}</div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / initialItems.length) * 100}%` }}
                    />
                </div>
            </div>

            <button type="button"
                onClick={handleNext}
                disabled={currentIndex === initialItems.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
            >
                下一页
                <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute right-8">
                <button type="button"
                  onClick={() => {
                    void recordControlEvidence('online-panel');
                    setClassroomStatus('已打开在线学生与提交状态面板。');
                    setShowDashboard(true);
                  }}
                  aria-label="打开在线学生与提交状态面板"
                  className="flex items-center gap-2 rounded-lg border border-platform-border bg-platform-surface px-4 py-2 text-sm text-platform-fg-secondary transition-colors hover:bg-platform-action-hover"
                >
                    <LayoutDashboard className="h-4 w-4" />
                    数据大屏
                </button>
            </div>
        </div>

        {/* Data Dashboard Overlay */}
        {showDashboard && (
          <DataDashboard
            sessionId={session.id}
            roster={roster}
            delivery={delivery}
            onClose={() => setShowDashboard(false)}
          />
        )}
        <EndClassDialog
          open={endStatus === 'confirming' || endStatus === 'ending' || endStatus === 'failed'}
          status={endStatus}
          error={endError}
          reviewHref={reviewHref}
          onCancel={() => setEndStatus('idle')}
          onConfirm={confirmEndClass}
        />
    </div>
  );
}

function EndClassDialog({
  open,
  status,
  error,
  reviewHref,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  status: 'idle' | 'confirming' | 'ending' | 'failed';
  error: string | null;
  reviewHref: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" data-classroom-end-state={status}>
      <section className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          <div>
            <h2 className="text-lg font-semibold text-white">结束课堂并生成复盘</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              结束后学生进入课堂结束态，课堂状态、提交记录和互动日志会进入证据物化队列；教师将进入本次会话复盘页。
            </p>
            <p className="mt-2 text-xs text-slate-500">复盘路径：{reviewHref}</p>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={status === 'ending'}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={status === 'ending'}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {status === 'ending' ? '结束中...' : '确认结束'}
          </button>
        </div>
      </section>
    </div>
  );
}
