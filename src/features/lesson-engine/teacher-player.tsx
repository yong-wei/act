
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Users, QrCode, LayoutDashboard, X } from 'lucide-react';
import { ResourceRenderer } from './resource-renderer';
import { DataDashboard } from './data-dashboard';

interface TeacherPlayerProps {
  session: any; // Simplified type
  initialItems: any[];
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

  const currentItem = initialItems[currentIndex];
  const reviewHref = `/classroom/teacher/${session.id}/review`;
  const classroomStateSteps = [
    { label: '加入', value: studentCount > 0 ? `${studentCount} 在线` : '等待学生' },
    { label: '发放', value: currentItem ? '当前环节已发放' : '未发放' },
    { label: '提交', value: '数据大屏汇总' },
    { label: '汇总', value: '复盘页生成' },
    { label: '结束', value: endStatus === 'ending' ? '结束中' : '可结束' },
    { label: '课后复盘', value: '结束后进入' },
  ];

  // 获取学生在线人数
  const fetchStudentCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${session.id}/state`);
      if (res.ok) {
        const data = await res.json();
        setStudentCount(data.states?.length || 0);
      }
    } catch {
      // 静默失败
    }
  }, [session.id]);

  useEffect(() => {
    fetchStudentCount();
    const interval = setInterval(fetchStudentCount, 5000);
    return () => clearInterval(interval);
  }, [fetchStudentCount]);

  const updateSession = async (item: any) => {
      try {
          await fetch(`/api/session/${session.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  currentItemId: item.id,
                  currentStage: item.stage
              })
          });
      } catch (e) {
          console.error('Failed to sync session', e);
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
  };

  const confirmEndClass = async () => {
    try {
      setEndStatus('ending');
      // 调用 API 更新课堂状态为已结束
      const res = await fetch(`/api/session/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED' })
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

  if (initialItems.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-black text-slate-100">
        <div className="h-14 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between">
          <span className="font-bold text-lg text-white">{session.plan.title}</span>
          <button type="button" onClick={handleEndClass} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-sm">
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
    <div className="flex flex-col h-screen bg-black text-slate-100 overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-white">{session.plan.title}</span>
                <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-mono">{currentItem?.stage}</span>
                <div className="hidden items-center gap-1 xl:flex" data-classroom-state-flow="join-release-submit-summary-end-review">
                  {classroomStateSteps.map((step) => (
                    <span key={step.label} className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                      {step.label}: {step.value}
                    </span>
                  ))}
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
                    <QrCode className="h-4 w-4" />
                    <span className="font-mono text-white">{session.joinCode}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4" />
                    <span>{studentCount} 在线</span>
                </div>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button type="button" onClick={handleEndClass} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-sm">
                    <X className="h-4 w-4" />
                    结束
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative overflow-hidden bg-black">
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
                />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
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
                <div className="text-xs text-slate-400 font-mono">
                    {currentIndex + 1} / {initialItems.length}
                </div>
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
                  onClick={() => setShowDashboard(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
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
