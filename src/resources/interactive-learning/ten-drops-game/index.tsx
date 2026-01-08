'use client';

/**
 * TenDropsGame - 十滴水益智游戏
 *
 * 通过水滴爆炸的连锁反应，演示控制理论中的系统动态概念：
 * - 连锁反应 → 级联效应、正反馈
 * - 格子容量 → 边界条件
 * - 临界状态 → 分岔点
 * - 预测规划 → 模型预测控制
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Droplets, RotateCcw, Undo2, Info, List } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import { useTenDropsGame } from './hooks/useTenDropsGame';
import { GameGrid } from './components/GameGrid';
import { ScoreBoard } from './components/ScoreBoard';
import { GameResultModal } from './components/GameResultModal';
import { LevelSelector } from './components/LevelSelector';
import { EducationalPanel } from './components/EducationalPanel';
import { LevelLeaderboard, type LeaderboardEntry } from './components/LevelLeaderboard';
import { LEVELS, getLevelById, getNextLevel } from './levels/level-data';
import type { LevelConfig } from './types';

const LOCAL_PROGRESS_KEY = 'ten_drops_progress_v1';

interface LocalProgressSnapshot {
  completedLevels: string[];
  bestScores: Record<string, number>;
  updatedAt: number;
}

function readLocalProgress(): LocalProgressSnapshot {
  if (typeof window === 'undefined') {
    return { completedLevels: [], bestScores: {}, updatedAt: 0 };
  }

  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return { completedLevels: [], bestScores: {}, updatedAt: 0 };
    const parsed = JSON.parse(raw) as LocalProgressSnapshot;
    if (!Array.isArray(parsed.completedLevels)) {
      return { completedLevels: [], bestScores: {}, updatedAt: 0 };
    }
    return {
      completedLevels: parsed.completedLevels,
      bestScores: parsed.bestScores || {},
      updatedAt: parsed.updatedAt || 0,
    };
  } catch {
    return { completedLevels: [], bestScores: {}, updatedAt: 0 };
  }
}

function writeLocalProgress(snapshot: LocalProgressSnapshot) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(snapshot));
}

function getNextUncompletedLevelId(completedLevels: string[]) {
  const completedSet = new Set(completedLevels);
  for (const level of LEVELS) {
    if (!completedSet.has(level.id)) return level.id;
  }
  return LEVELS[LEVELS.length - 1]?.id ?? 'tutorial-1';
}

export interface TenDropsGameProps {
  /** 初始关卡ID */
  initialLevelId?: string;
  /** 嵌入模式（隐藏全屏装饰） */
  embedded?: boolean;
  /** 完成回调 */
  onComplete?: (score: number, levelId: string) => void;
  /** 是否显示教育提示 */
  showEducation?: boolean;
}

export function TenDropsGame({
  initialLevelId = 'tutorial-1',
  embedded = false,
  onComplete,
  showEducation = true,
}: TenDropsGameProps) {
  // 本地状态
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showEducationalPanel, setShowEducationalPanel] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [resolvedInitialLevelId, setResolvedInitialLevelId] = useState<string | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardState, setLeaderboardState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  const { data: session, status: sessionStatus } = useSession();
  const interactiveContext = useOptionalInteractiveContext();
  const lastCompletionKeyRef = useRef<string | null>(null);
  const isAuthenticated = sessionStatus === 'authenticated';

  // 游戏状态
  const {
    board,
    dropsAvailable,
    initialDrops,
    score,
    gameStatus,
    chainCount,
    maxChainReached,
    history,
    loadLevel,
    resetLevel,
    addDrop,
    undo,
    activeFlyingDrops,
  } = useTenDropsGame();

  const loadProgress = useCallback(async () => {
    if (!isAuthenticated) {
      const localSnapshot = readLocalProgress();
      setCompletedLevels(localSnapshot.completedLevels);
      setResolvedInitialLevelId(
        getNextUncompletedLevelId(localSnapshot.completedLevels) || initialLevelId
      );
      setIsProgressLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/interactive/ten-drops/progress');
      if (!res.ok) {
        throw new Error('Failed to load progress');
      }

      const data = (await res.json()) as {
        completedLevels?: string[];
      };
      const completed = Array.isArray(data.completedLevels) ? data.completedLevels : [];
      setCompletedLevels(completed);
      setResolvedInitialLevelId(getNextUncompletedLevelId(completed) || initialLevelId);
    } catch (error) {
      console.error('[TenDrops] Failed to load progress:', error);
      setResolvedInitialLevelId(initialLevelId);
    } finally {
      setIsProgressLoading(false);
    }
  }, [initialLevelId, isAuthenticated]);

  // 初始化进度与关卡
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    loadProgress();
  }, [sessionStatus, loadProgress]);

  // 加载初始关卡
  useEffect(() => {
    if (!resolvedInitialLevelId) return;
    const level = getLevelById(resolvedInitialLevelId) || LEVELS[0];
    setCurrentLevel(level);
    loadLevel(level);
  }, [resolvedInitialLevelId, loadLevel]);

  const fetchLeaderboard = useCallback(async (levelId: string) => {
    if (!isAuthenticated) return;
    setLeaderboardState('loading');
    try {
      const res = await fetch(`/api/interactive/ten-drops/leaderboard?levelId=${encodeURIComponent(levelId)}`);
      if (!res.ok) {
        throw new Error('Failed to load leaderboard');
      }

      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      setLeaderboardEntries(Array.isArray(data.entries) ? data.entries : []);
      setLeaderboardState('idle');
    } catch (error) {
      console.error('[TenDrops] Failed to load leaderboard:', error);
      setLeaderboardState('error');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!currentLevel) return;
    fetchLeaderboard(currentLevel.id);
  }, [currentLevel, fetchLeaderboard]);

  const persistCompletion = useCallback(async (levelId: string, finalScore: number) => {
    setCompletedLevels((prev) => (prev.includes(levelId) ? prev : [...prev, levelId]));

    if (isAuthenticated) {
      if (interactiveContext) {
        interactiveContext.tracking.emit('complete', {
          game: 'ten-drops',
          levelId,
          score: finalScore,
          dropsRemaining: dropsAvailable,
          maxChain: maxChainReached,
        });
        return;
      }

      await fetch('/api/interactive/ten-drops/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelId,
          score: finalScore,
          dropsRemaining: dropsAvailable,
          maxChain: maxChainReached,
        }),
      });
      return;
    }

    const localSnapshot = readLocalProgress();
    const nextCompleted = localSnapshot.completedLevels.includes(levelId)
      ? localSnapshot.completedLevels
      : [...localSnapshot.completedLevels, levelId];
    const bestScore = Math.max(localSnapshot.bestScores[levelId] ?? 0, finalScore);

    writeLocalProgress({
      completedLevels: nextCompleted,
      bestScores: { ...localSnapshot.bestScores, [levelId]: bestScore },
      updatedAt: Date.now(),
    });
  }, [dropsAvailable, interactiveContext, isAuthenticated, maxChainReached]);

  // 处理胜利
  useEffect(() => {
    if (gameStatus !== 'won' || !currentLevel) return;
    const completionKey = `${currentLevel.id}-${score}`;
    if (lastCompletionKeyRef.current === completionKey) return;
    lastCompletionKeyRef.current = completionKey;

    persistCompletion(currentLevel.id, score);
    onComplete?.(score, currentLevel.id);

    if (isAuthenticated) {
      fetchLeaderboard(currentLevel.id);
    }
  }, [gameStatus, currentLevel, score, persistCompletion, onComplete, isAuthenticated, fetchLeaderboard]);

  // 点击格子处理
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameStatus === 'playing') {
        addDrop({ row, col });
      }
    },
    [addDrop, gameStatus]
  );

  // 选择关卡
  const handleLevelSelect = useCallback(
    (level: LevelConfig) => {
      setCurrentLevel(level);
      loadLevel(level);
      setShowLevelSelect(false);
    },
    [loadLevel]
  );

  // 重新开始
  const handleRestart = useCallback(() => {
    resetLevel();
  }, [resetLevel]);

  // 下一关
  const handleNextLevel = useCallback(() => {
    if (currentLevel) {
      const next = getNextLevel(currentLevel.id);
      if (next) {
        setCurrentLevel(next);
        loadLevel(next);
      }
    }
  }, [currentLevel, loadLevel]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (history.length > 0 && gameStatus === 'playing') {
      undo();
    }
  }, [history.length, gameStatus, undo]);

  if (!currentLevel || isProgressLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        正在加载进度...
      </div>
    );
  }

  const isProcessing = gameStatus === 'processing';
  const canUndo = history.length > 0 && gameStatus === 'playing';
  const hasNextLevel = !!getNextLevel(currentLevel.id);

  return (
    <div
      className={`${
        embedded ? '' : 'min-h-screen'
      } bg-slate-950 text-white select-none`}
    >
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="order-2 md:order-1 md:w-64 md:sticky md:top-6 h-fit">
            <LevelLeaderboard
              levelName={currentLevel.name}
              entries={leaderboardEntries}
              isLoading={leaderboardState === 'loading'}
              hasError={leaderboardState === 'error'}
              isAuthenticated={isAuthenticated}
              currentUserId={session?.user?.id}
            />
          </aside>

          <div className="order-1 md:order-2 flex-1">
            {/* 头部 */}
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Droplets className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">十滴水</h1>
                  <p className="text-sm text-slate-400">{currentLevel.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showEducation && currentLevel.educationalHint && (
                  <button
                    onClick={() => setShowEducationalPanel(true)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="学习提示"
                  >
                    <Info className="h-5 w-5 text-blue-400" />
                  </button>
                )}
                <button
                  onClick={() => setShowLevelSelect(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                >
                  <List className="h-4 w-4" />
                  选关
                </button>
              </div>
            </header>

        {/* 关卡描述 */}
        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-sm text-slate-300">{currentLevel.description}</p>
        </div>

        {/* 得分面板 */}
        <ScoreBoard
          dropsAvailable={dropsAvailable}
          initialDrops={initialDrops}
          chainCount={chainCount}
          maxChainReached={maxChainReached}
          gameStatus={gameStatus}
          score={score}
        />

        {/* 游戏网格 */}
        <div className="my-6 flex justify-center">
          <GameGrid
            board={board}
            onCellClick={handleCellClick}
            disabled={isProcessing || gameStatus === 'won' || gameStatus === 'lost'}
            gridSize={currentLevel.gridSize}
            activeFlyingDrops={activeFlyingDrops}
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-center gap-3">
          <button
            onClick={handleUndo}
            disabled={!canUndo || isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Undo2 className="h-4 w-4" />
            撤销
          </button>
          <button
            onClick={handleRestart}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
        </div>

        {/* 教育提示（底部） */}
        {showEducation && currentLevel.educationalHint && gameStatus === 'playing' && (
          <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300/80">
              <span className="font-medium">💡 提示：</span>{' '}
              {currentLevel.educationalHint.slice(0, 80)}
              {currentLevel.educationalHint.length > 80 && '...'}
              {currentLevel.educationalHint.length > 80 && (
                <button
                  onClick={() => setShowEducationalPanel(true)}
                  className="ml-1 text-blue-400 hover:underline"
                >
                  查看更多
                </button>
              )}
            </p>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* 游戏结果弹窗 */}
      {(gameStatus === 'won' || gameStatus === 'lost') && (
        <GameResultModal
          status={gameStatus}
          score={score}
          dropsRemaining={dropsAvailable}
          maxChain={maxChainReached}
          onRestart={handleRestart}
          onNextLevel={handleNextLevel}
          hasNextLevel={hasNextLevel}
          educationalHint={
            gameStatus === 'won' ? currentLevel.educationalHint : undefined
          }
        />
      )}

      {/* 关卡选择弹窗 */}
      {showLevelSelect && (
        <LevelSelector
          levels={LEVELS}
          currentLevelId={currentLevel.id}
          completedLevels={completedLevels}
          onSelect={handleLevelSelect}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {/* 教育面板弹窗 */}
      {showEducationalPanel && currentLevel.educationalHint && (
        <EducationalPanel
          hint={currentLevel.educationalHint}
          levelName={currentLevel.name}
          onClose={() => setShowEducationalPanel(false)}
        />
      )}
    </div>
  );
}

export default TenDropsGame;
