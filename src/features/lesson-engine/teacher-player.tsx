
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Users, QrCode, LayoutDashboard, X } from 'lucide-react';
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

  const currentItem = initialItems[currentIndex];

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

  const handleEndClass = async () => {
      if (confirm('确定要结束课堂吗？结束后学生将无法继续参与互动。')) {
          try {
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

              // 教师返回班级详情页（如果有classId），否则返回教案列表
              const returnPath = session.classId
                  ? `/teacher/classes/${session.classId}`
                  : (window.location.pathname.includes('/classroom/teacher')
                      ? '/teacher/lesson-plans'
                      : '/admin/lesson-plans');
              router.push(returnPath);
          } catch (error) {
              console.error('结束课堂失败:', error);
              alert(error instanceof Error ? error.message : '结束课堂失败，请重试');
          }
      }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-100 overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-white">{session.plan.title}</span>
                <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-mono">{currentItem?.stage}</span>
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
                <button onClick={handleEndClass} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-sm">
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
                />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                    Waiting for content...
                </div>
            )}
        </div>

        {/* Bottom Control Bar */}
        <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-12 z-20 shadow-xl shadow-black/50">
            <button 
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

            <button 
                onClick={handleNext} 
                disabled={currentIndex === initialItems.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
            >
                下一页
                <ChevronRight className="h-5 w-5" />
            </button>
            
            <div className="absolute right-8">
                <button
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
    </div>
  );
}
