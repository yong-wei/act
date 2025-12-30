
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, MoreVertical, Play, Edit, Trash2, Loader2 } from 'lucide-react';

interface LessonPlanListProps {
  plans: any[];
}

export function LessonPlanList({ plans }: LessonPlanListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const startSession = async (planId: string) => {
    setLoadingId(planId);
    try {
      // Create a new session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      
      if (!res.ok) throw new Error('Failed to start session');
      
      const session = await res.json();
      // Redirect to Teacher Player
      router.push(`/classroom/teacher/${session.id}`);
    } catch (e) {
      console.error(e);
      alert('无法开始上课');
      setLoadingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <div 
          key={plan.id} 
          className="group bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/50 transition-all hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-900/10 flex flex-col"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
               <BookOpen className="h-5 w-5" />
            </div>
            <button className="text-slate-500 hover:text-white p-1">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>

          <h3 className="text-lg font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors mb-2">
            {plan.title}
          </h3>
          
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-6">
            <span className="flex items-center gap-1">
               <Clock className="h-3 w-3" />
               {new Date(plan.updatedAt).toLocaleDateString()}
            </span>
            <span>
               {plan.author.name || '未知教师'}
            </span>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center justify-between">
             <div className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                {plan._count.items} 个环节
             </div>
             
             <div className="flex gap-2">
                <button 
                    onClick={() => router.push(`/admin/lesson-plans/${plan.id}/edit`)} 
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
                >
                    <Edit className="h-3 w-3" />
                    编辑
                </button>
                <button 
                    onClick={() => startSession(plan.id)}
                    disabled={!!loadingId}
                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1.5 rounded transition-all disabled:opacity-50"
                >
                    {loadingId === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    开始上课
                </button>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}
