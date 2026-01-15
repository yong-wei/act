'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckCircle, Loader2, WifiOff } from 'lucide-react';
import { ResourceRenderer } from './resource-renderer';
import { Prisma, TeachingResource, BopppsStage, KnowledgeNode, LessonItemType } from '@prisma/client';

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
  plan: { title: string };
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
      }

      // 检查课堂状态
      if (data.status !== sessionStatus) {
        setSessionStatus(data.status);
        if (data.status === 'FINISHED') {
          // 课堂已结束
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
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">课堂已结束</h2>
          <p className="text-slate-400 mb-6">感谢您的参与！</p>
          <button
            onClick={() => router.push('/classroom/join')}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            加入其他课堂
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* 顶部状态栏 */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
        {/* 左侧: 课程信息 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {initialSession.plan.title}
            </span>
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
              同步中
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <WifiOff className="h-3 w-3" />
              连接中断
            </div>
          )}
          <div className="text-xs text-slate-500 font-mono">
            #{initialSession.joinCode}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden relative">
        {currentItem && (currentItem.resource || currentItem.knowledgeNode) ? (
          <ResourceRenderer
            resource={currentItem.resource}
            knowledgeNode={currentItem.knowledgeNode}
            overrideConfig={currentItem.overrideConfig}
            sessionId={initialSession.id}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>等待教师开始...</p>
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
            <span className="text-xs text-slate-500 font-mono min-w-[60px] text-right">
              {currentIndex + 1} / {items.length}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StudentPlayer;
