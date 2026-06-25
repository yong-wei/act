'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckCircle, Loader2, WifiOff } from 'lucide-react';
import { ResourceRenderer } from './resource-renderer';
import { Prisma, TeachingResource, BopppsStage, KnowledgeNode, LessonItemType } from '@prisma/client';
import {
  buildClassroomIdentityPayload,
  type ClassroomIdentityPayload,
} from '@/lib/classroom-lifecycle-contract';

// BOPPPS 阶段标签
const STAGE_LABELS: Record<BopppsStage, { label: string; color: string }> = {
  BRIDGE_IN: { label: '导入', color: 'bg-blue-500' },
  OBJECTIVE: { label: '目标', color: 'bg-green-500' },
  PRE_ASSESSMENT: { label: '前测', color: 'bg-yellow-500' },
  PARTICIPATORY: { label: '参与', color: 'bg-purple-500' },
  POST_ASSESSMENT: { label: '后测', color: 'bg-orange-500' },
  SUMMARY: { label: '总结', color: 'bg-slate-500' },
};

interface LessonItemWithResource {
  id: string;
  itemType: LessonItemType;
  stage: BopppsStage;
  order: number;
  duration: number | null;
  overrideConfig?: Prisma.JsonValue | null;
  resource: TeachingResource | null;
  knowledgeNode: KnowledgeNode | null;
}

interface SessionInfo {
  id: string;
  joinCode: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  currentItemId: string | null;
  currentStage: BopppsStage | null;
  classId: string | null;
  class?: { name?: string | null } | null;
  classroomIdentity?: ClassroomIdentityPayload | null;
  plan: { id: string; title: string };
}

interface StudentPlayerProps {
  session: SessionInfo;
  items: LessonItemWithResource[];
}

export function StudentPlayer({ session: initialSession, items }: StudentPlayerProps) {
  const router = useRouter();
  const [currentItemId, setCurrentItemId] = useState<string | null>(initialSession.currentItemId);
  const [sessionStatus, setSessionStatus] = useState(initialSession.status);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [studentRuntimeStatus, setStudentRuntimeStatus] = useState('等待教师发放课堂内容。');
  const classroomIdentity = initialSession.classroomIdentity ?? buildClassroomIdentityPayload(initialSession);

  // 查找当前项
  const currentItem = items.find((item) => item.id === currentItemId) || items[0] || null;
  const currentIndex = currentItem ? items.findIndex((i) => i.id === currentItem.id) : 0;

  // 轮询同步课堂状态
  const syncSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${initialSession.id}`);
      if (!res.ok) {
        setIsConnected(false);
        return;
      }

      const data = await res.json();
      setIsConnected(true);
      setLastUpdate(Date.now());

      // 更新当前项
      if (data.currentItemId && data.currentItemId !== currentItemId) {
        setCurrentItemId(data.currentItemId);
        setStudentRuntimeStatus('教师已发放新的课堂环节。');
      }

      // 检查课堂状态
      if (data.status !== sessionStatus) {
        setSessionStatus(data.status);
        if (data.status === 'FINISHED') {
          setStudentRuntimeStatus('课堂已结束，本次作答正在进入证据页。');
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, [initialSession.id, currentItemId, sessionStatus]);

  // 每2秒轮询一次
  useEffect(() => {
    const interval = setInterval(syncSession, 2000);
    return () => clearInterval(interval);
  }, [syncSession]);

  // 初始化时同步一次
  useEffect(() => {
    syncSession();
  }, [syncSession]);

  // 课堂已结束
  if (sessionStatus === 'FINISHED') {
    const evidenceHref = `/profile/evidence?sessionId=${encodeURIComponent(initialSession.id)}`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-platform-canvas">
        <div className="max-w-lg px-6 text-center" data-classroom-student-state="finished-review" data-classroom-identity-kind={classroomIdentity.kind}>
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-platform-evidence-eligible" />
          <h2 className="mb-2 text-2xl font-bold text-platform-fg-primary">课堂已结束</h2>
          <p className="text-sm text-platform-action-primary">{classroomIdentity.summaryLabel}</p>
          <p className="mt-3 text-platform-fg-secondary">本次课堂作答会进入课堂复盘和个人证据页；重复提交会按课堂、步骤和提交身份合并。</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.push(evidenceHref)}
              className="rounded-lg bg-platform-action-primary px-6 py-3 text-platform-fg-inverse transition-colors hover:bg-platform-action-hover"
            >
              查看课堂证据
            </button>
            <button
              type="button"
              onClick={() => router.push('/classroom/join')}
              className="rounded-lg border border-platform-border px-6 py-3 text-platform-fg-secondary transition-colors hover:bg-platform-surface"
            >
              加入其他课堂
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* 顶部状态栏 */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-platform-border bg-platform-surface-overlay px-4 backdrop-blur-sm">
        {/* 左侧: 课程信息 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium max-w-[220px]">
                {classroomIdentity.label}
              </span>
              <span className="block max-w-[220px] truncate text-[11px] text-platform-fg-muted">
                {initialSession.plan.title}
              </span>
            </div>
          </div>
          {currentItem && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                STAGE_LABELS[currentItem.stage]?.color || 'bg-slate-600'
              }`}
            >
              {STAGE_LABELS[currentItem.stage]?.label || currentItem.stage}
            </span>
          )}
        </div>

        {/* 右侧: 连接状态 */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              已发放
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <WifiOff className="h-3 w-3" />
              连接中断
            </div>
          )}
          <div className="font-mono text-xs text-platform-fg-muted">
            课堂码 {initialSession.joinCode}
          </div>
        </div>
      </header>
      <div className="sr-only" role="status" aria-live="polite">{studentRuntimeStatus}</div>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden relative">
        {currentItem && (currentItem.resource || currentItem.knowledgeNode) ? (
          <ResourceRenderer
            resource={currentItem.resource}
            knowledgeNode={currentItem.knowledgeNode}
            overrideConfig={currentItem.overrideConfig}
            sessionId={initialSession.id}
            lessonItemId={currentItem.id}
            lessonPlanId={initialSession.plan.id}
            classId={initialSession.classId}
            stage={currentItem.stage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-platform-fg-secondary">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p data-classroom-student-state="released-waiting">等待教师发放课堂环节...</p>
          </div>
        )}
      </main>

      {/* 底部进度条 */}
      <footer className="h-12 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center px-4 flex-shrink-0">
        <div className="flex-1">
          {/* 进度指示器 */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{
                  width: items.length > 0 ? `${((currentIndex + 1) / items.length) * 100}%` : '0%',
                }}
              />
            </div>
            <span className="min-w-[60px] text-right font-mono text-xs text-platform-fg-muted" data-classroom-student-state="released-submission-ready">
              已发放，提交后进入课堂证据 · {currentIndex + 1} / {items.length}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StudentPlayer;
