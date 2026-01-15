'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Users, Activity, TrendingUp, RefreshCw, Trophy, Clock } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface StudentStateData {
  id: string;
  userId: string;
  itemId: string | null;
  data: Record<string, unknown>;
  submittedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface DataDashboardProps {
  sessionId: string;
  onClose: () => void;
}

export function DataDashboard({ sessionId, onClose }: DataDashboardProps) {
  const [states, setStates] = useState<StudentStateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/state`);
      if (res.ok) {
        const data = await res.json();
        setStates(data.states || []);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch states:', e);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // 初始加载和定时刷新
  useEffect(() => {
    fetchStates();
    const interval = setInterval(fetchStates, 3000);
    return () => clearInterval(interval);
  }, [fetchStates]);

  // 处理 PID 参数数据（如果有）
  const pidData = states
    .filter((s) => {
      const data = s.data as Record<string, unknown>;
      return data?.kp !== undefined || data?.ki !== undefined || data?.kd !== undefined;
    })
    .map((s) => {
      const data = s.data as Record<string, number>;
      return {
        name: s.user.name || s.user.email.split('@')[0],
        kp: data.kp || 0,
        ki: data.ki || 0,
        kd: data.kd || 0,
      };
    });

  // 计算 PID 参数的平均值
  const avgPid = pidData.length > 0
    ? {
        kp: (pidData.reduce((sum, d) => sum + d.kp, 0) / pidData.length).toFixed(2),
        ki: (pidData.reduce((sum, d) => sum + d.ki, 0) / pidData.length).toFixed(2),
        kd: (pidData.reduce((sum, d) => sum + d.kd, 0) / pidData.length).toFixed(2),
      }
    : null;

  const poleData = states
    .filter((state) => {
      const data = state.data as Record<string, unknown>;
      return data?.kind === 'pole-manipulator';
    })
    .map((state) => {
      const data = state.data as Record<string, number | string>;
      return {
        name: state.user.name || state.user.email.split('@')[0],
        score: typeof data.score === 'number' ? data.score : 0,
        duration: typeof data.duration === 'number' ? data.duration : 0,
      };
    });

  const avgPole = poleData.length > 0
    ? {
        score: (poleData.reduce((sum, d) => sum + d.score, 0) / poleData.length).toFixed(1),
        duration: (poleData.reduce((sum, d) => sum + d.duration, 0) / poleData.length).toFixed(1),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Activity className="h-6 w-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">实时数据大屏</h1>
            {lastUpdate && (
              <span className="text-xs text-slate-500">
                更新于 {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStates}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              title="刷新数据"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Online Students */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <span className="text-slate-400 text-sm">在线学生</span>
            </div>
            <div className="text-4xl font-bold text-white">{states.length}</div>
          </div>

          {/* Average PID - Kp */}
          {avgPid && (
            <>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-slate-400 text-sm">平均 Kp</span>
                </div>
                <div className="text-4xl font-bold text-blue-400">{avgPid.kp}</div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                  <span className="text-slate-400 text-sm">平均 Ki / Kd</span>
                </div>
                <div className="text-2xl font-bold">
                  <span className="text-green-400">{avgPid.ki}</span>
                  <span className="text-slate-600 mx-2">/</span>
                  <span className="text-orange-400">{avgPid.kd}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {avgPole && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Trophy className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-slate-400 text-sm">极点挑战平均得分</span>
              </div>
              <div className="text-4xl font-bold text-amber-300">{avgPole.score}</div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-slate-500/20">
                  <Clock className="h-5 w-5 text-slate-300" />
                </div>
                <span className="text-slate-400 text-sm">极点挑战平均用时</span>
              </div>
              <div className="text-4xl font-bold text-slate-200">{avgPole.duration}s</div>
            </div>
          </div>
        )}

        {/* PID Parameters Chart */}
        {pidData.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">学生 PID 参数分布</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pidData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Bar dataKey="kp" name="Kp" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ki" name="Ki" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kd" name="Kd" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {poleData.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">极点挑战成绩分布</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={poleData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Bar dataKey="score" name="得分" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="duration" name="用时(s)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Student List */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white">学生状态列表</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {states.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                暂无学生提交数据
              </div>
            ) : (
              states.map((state) => (
                <div key={state.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">
                      {state.user.name || state.user.email}
                    </div>
                    <div className="text-xs text-slate-500">
                      提交于 {new Date(state.submittedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400 font-mono">
                    {JSON.stringify(state.data).slice(0, 50)}
                    {JSON.stringify(state.data).length > 50 && '...'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DataDashboard;
