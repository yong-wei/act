'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GameCanvas } from './components/GameCanvas';
import { TelemetryScope } from './components/TelemetryScope';
import { LevelSelector } from './components/LevelSelector';
import { ShipAvatar } from './components/ShipAvatar';
import {
  CONTROL_BASE_CONTROLLERS,
  CONTROL_ODYSSEY_LEVELS,
  CONTROL_SHOP_CONFIG,
  CONTROLLER_UPGRADE_RULES,
  getTierConfig,
  type ControllerId,
  type LevelTier
} from './level-data';
import { TuningPanel } from './components/TuningPanel';
import { useGameStore } from './store/game-store';
import { Bot, Play, RotateCcw, Settings2, Trophy, Info, ArrowLeft, Rocket, Gamepad2, Layers, ShoppingBag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  submitGameScore,
  getLevelLeaderboard,
  LeaderboardEntry,
  getControlProfile,
  purchaseController,
  upgradeController,
  redeemControlAICredits,
  getTopControlConfigs,
  getControlAiHistory,
  saveControlAiHistory,
  type ControlConfigSnapshot
} from '@/app/actions/control-odyssey';
import { cn } from '@/lib/utils';
import { readAITextStream } from '@/lib/ai-stream-compat';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useArenaPathSubmissionCompletion } from '@/features/arena/arena-path-journey-control';

interface ControlOdysseyProps {
  initialLevelId?: string;
  showEducation?: boolean;
}

type ViewState = 'INTRO' | 'LEVEL_SELECT' | 'MODE_SELECT' | 'GAME';

const TIER_OPTIONS: {
  id: LevelTier;
  label: string;
  description: string;
  accent: string;
  ring: string;
  border: string;
  bg: string;
  hover: string;
}[] = [
  {
    id: 'bronze',
    label: '青铜',
    description: '单一阶跃信号',
    accent: 'text-orange-300',
    ring: 'ring-orange-400/30',
    border: 'border-orange-400/40',
    bg: 'bg-orange-500/10',
    hover: 'hover:border-orange-400/60'
  },
  {
    id: 'silver',
    label: '白银',
    description: '随机阶跃组合',
    accent: 'text-slate-200',
    ring: 'ring-slate-300/30',
    border: 'border-slate-300/40',
    bg: 'bg-slate-500/10',
    hover: 'hover:border-slate-300/60'
  },
  {
    id: 'gold',
    label: '黄金',
    description: '叠加暗流扰动',
    accent: 'text-yellow-200',
    ring: 'ring-yellow-300/30',
    border: 'border-yellow-300/40',
    bg: 'bg-yellow-500/10',
    hover: 'hover:border-yellow-300/60'
  }
];

const TIER_ORDER: LevelTier[] = ['bronze', 'silver', 'gold'];
const AI_ASSIST_COST = 20;

export const ControlOdysseyGame: React.FC<ControlOdysseyProps> = ({
  initialLevelId = 'level-1',
  showEducation = true,
}) => {
  const searchParams = useSearchParams();
  const arenaTaskId = searchParams.get('arenaTask') ?? undefined;
  const publicationId = searchParams.get('publicationId') ?? undefined;
  const completeArenaPath = useArenaPathSubmissionCompletion(arenaTaskId ?? '');
  const {
    gameState,
    setGameState,
    resetGame,
    distance,
    maxDistance,
    metrics,
    controlMode,
    setControlMode,
    setCurrentLevelId,
    currentTier,
    setCurrentTier,
    controllerId,
    setControllerId,
    unlockedControllers,
    setUnlockedControllers,
    controllerLevels,
    setControllerLevels,
    pidParams,
    extraParams,
    enableSpeedFeedback,
    enableFeedforward,
    enableSmithPredictor,
    difficultyScale,
    setDifficultyScale,
    autoOffset,
    controlCredits,
    setControlCredits,
    runId
  } = useGameStore();

  const [currentView, setCurrentView] = useState<ViewState>('INTRO');
  const [selectedLevelId, setSelectedLevelId] = useState<string>(initialLevelId);
  const [levels, setLevels] = useState(() => CONTROL_ODYSSEY_LEVELS.map((level) => ({ ...level })));
  const [shopOpen, setShopOpen] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [shopPreviewLevels, setShopPreviewLevels] = useState<Record<ControllerId, number | null>>(
    {} as Record<ControllerId, number | null>
  );
  const [tierProgress, setTierProgress] = useState<Record<string, LevelTier>>({});
  const [personalBestScores, setPersonalBestScores] = useState<Record<string, { overall: number; tiers: Partial<Record<LevelTier, number>> }>>({});
  const [detailsState, setDetailsState] = useState({ runId: '', visible: false });
  const [aiStatusByLevel, setAiStatusByLevel] = useState<
    Record<string, {
      configError: string | null;
      resultError: string | null;
      loadingContext: 'config' | 'result' | null;
    }>
  >({});
  const [aiHistoryByLevel, setAiHistoryByLevel] = useState<Record<string, { content: string; updatedAt: string }>>({});
  const [topConfigs, setTopConfigs] = useState<ControlConfigSnapshot[]>([]);
  const [manualTierSelections, setManualTierSelections] = useState<Record<string, boolean>>({});

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSubmittedRef = useRef(false);
  const bestScoreSnapshotRef = useRef<number | null>(null);
  const currentAiStatus = aiStatusByLevel[selectedLevelId] ?? {
    configError: null,
    resultError: null,
    loadingContext: null
  };
  const aiConfigError = currentAiStatus.configError;
  const aiResultError = currentAiStatus.resultError;
  const aiLoadingContext = currentAiStatus.loadingContext;
  const showDetails = detailsState.runId === runId && detailsState.visible;
  const toggleDetails = useCallback(() => {
    setDetailsState((prev) => ({
      runId,
      visible: prev.runId === runId ? !prev.visible : true
    }));
  }, [runId]);
  const updateAiStatusForSelectedLevel = useCallback((
    patch: Partial<{
      configError: string | null;
      resultError: string | null;
      loadingContext: 'config' | 'result' | null;
    }>
  ) => {
    setAiStatusByLevel((prev) => {
      const current = prev[selectedLevelId] ?? {
        configError: null,
        resultError: null,
        loadingContext: null
      };
      return {
        ...prev,
        [selectedLevelId]: {
          ...current,
          ...patch
        }
      };
    });
  }, [selectedLevelId]);

  const hasLevelProgress = useCallback(
    (levelId: string) =>
      Boolean(tierProgress[levelId])
      || (personalBestScores[levelId]?.overall ?? 0) > 0,
    [tierProgress, personalBestScores]
  );

  // 1. 提交成绩
  useEffect(() => {
    if (gameState !== 'VICTORY') {
      hasSubmittedRef.current = false;
      bestScoreSnapshotRef.current = null;
      return;
    }

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const saveScore = async () => {
      setIsSubmitting(true);
      try {
        const tierBase = currentTier === 'gold' ? 15000 : currentTier === 'silver' ? 12000 : 10000;
        const baseScore = Math.max(
          0,
          Math.floor(
            tierBase
            - metrics.maxOvershoot * 20
            - metrics.steadyError * 50
            - metrics.avgRelativeError * 30
          )
        );
        const scoreMultiplier = Math.max(0.7, Math.min(1.4, 1 / difficultyScale));
        const finalScore = Math.max(0, Math.floor(baseScore * scoreMultiplier));
        if (bestScoreSnapshotRef.current === null) {
          bestScoreSnapshotRef.current = personalBestScores[selectedLevelId]?.tiers?.[currentTier] ?? 0;
        }
        const result = await submitGameScore(
          selectedLevelId,
          finalScore,
          {
          maxOvershoot: metrics.maxOvershoot,
          settlingTime: metrics.settlingTime,
          steadyError: metrics.steadyError,
          avgRelativeError: metrics.avgRelativeError,
          controlEnergy: metrics.controlEnergy,
          controlSmoothness: metrics.controlSmoothness,
          scoreMultiplier
          },
          {
            runId,
            tier: currentTier,
            controllerId,
            controlMode,
            pidParams,
            extraParams,
            enableSpeedFeedback,
            enableFeedforward,
            enableSmithPredictor,
            difficultyScale,
            arenaTaskId,
            publicationId
          }
        );
        if (result && 'arenaSubmissionId' in result && result.arenaSubmissionId) {
          await completeArenaPath(result.arenaSubmissionId);
        }

        const profile = await getControlProfile();
        if (profile) {
          setControlCredits(profile.credits);
          setUnlockedControllers(profile.unlocks);
          setTierProgress(profile.tierProgress ?? {});
          setControllerLevels(profile.controllerLevels);
          if (profile.bestScores) {
            setPersonalBestScores(profile.bestScores);
          }
        }
        const configs = await getTopControlConfigs(selectedLevelId);
        setTopConfigs(configs);
      } catch (e) {
        console.error('Failed to submit score', e);
      } finally {
        setIsSubmitting(false);
      }
    };

    saveScore();
  }, [
    gameState,
    metrics,
    selectedLevelId,
    runId,
    currentTier,
    controllerId,
    controlMode,
    pidParams,
    extraParams,
    enableSpeedFeedback,
    enableFeedforward,
    enableSmithPredictor,
    difficultyScale,
    arenaTaskId,
    publicationId,
    completeArenaPath,
    personalBestScores,
    setControlCredits,
    setUnlockedControllers,
    setControllerLevels,
    setTopConfigs
  ]);

  useEffect(() => {
    const loadTopConfigs = async () => {
      try {
        const configs = await getTopControlConfigs(selectedLevelId);
        setTopConfigs(configs);
      } catch (error) {
        console.error('Failed to load top configs', error);
        setTopConfigs([]);
      }
    };
    if (!selectedLevelId) return;
    loadTopConfigs();
  }, [selectedLevelId]);

  useEffect(() => {
    const loadAiHistory = async () => {
      try {
        const history = await getControlAiHistory(selectedLevelId);
        if (!history) {
          setAiHistoryByLevel((prev) => {
            const next = { ...prev };
            delete next[selectedLevelId];
            return next;
          });
          return;
        }
        setAiHistoryByLevel((prev) => ({
          ...prev,
          [selectedLevelId]: history
        }));
      } catch (error) {
        console.error('Failed to load AI history', error);
      }
    };
    if (!selectedLevelId) return;
    loadAiHistory();
  }, [selectedLevelId]);

  useEffect(() => {
    if (gameState !== 'VICTORY') return;

    setLevels((prev) => {
      const index = prev.findIndex((level) => level.id === selectedLevelId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const next = prev[index + 1];
      if (next.unlocked) return prev;
      const updated = [...prev];
      updated[index + 1] = { ...next, unlocked: true };
      return updated;
    });
  }, [gameState, selectedLevelId]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getControlProfile();
        if (profile) {
          setControlCredits(profile.credits);
          setUnlockedControllers(profile.unlocks);
          setTierProgress(profile.tierProgress ?? {});
          setControllerLevels(profile.controllerLevels);
          if (profile.bestScores) {
            setPersonalBestScores(profile.bestScores);
          }
        }
      } catch (error) {
        console.error('Failed to load control profile', error);
      }
    };

    loadProfile();
  }, [setControlCredits, setUnlockedControllers, setControllerLevels, setPersonalBestScores]);

  useEffect(() => {
    setLevels((prev) => prev.map((level, index, list) => {
      if (index === 0) return { ...level, unlocked: true };
      const prevLevelId = list[index - 1]?.id;
      const prevUnlocked = prevLevelId ? hasLevelProgress(prevLevelId) : false;
      const selfUnlocked = hasLevelProgress(level.id);
      return { ...level, unlocked: prevUnlocked || selfUnlocked };
    }));
  }, [hasLevelProgress]);

  useEffect(() => {
    const fallback = CONTROL_BASE_CONTROLLERS.find((id) => unlockedControllers.includes(id)) ?? 'P';
    if (!CONTROL_BASE_CONTROLLERS.includes(controllerId) || !unlockedControllers.includes(controllerId)) {
      setControllerId(fallback);
    }
  }, [unlockedControllers, controllerId, setControllerId]);

  useEffect(() => {
    const highestTier = tierProgress[selectedLevelId] ?? 'bronze';
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const allowedIndex = TIER_ORDER.indexOf(highestTier);
    if (currentIndex > allowedIndex) {
      setCurrentTier(highestTier);
    }
  }, [selectedLevelId, tierProgress, currentTier, setCurrentTier]);

  // 2. 加载排行榜
  const fetchLeaderboard = async (levelId: string) => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await getLevelLeaderboard(levelId);
      setLeaderboardData(data);
    } catch (e) {
      setLeaderboardData([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const handlePurchaseController = async (target: ControllerId) => {
    setIsPurchasing(true);
    setShopError(null);
    try {
      const profile = await purchaseController(target);
      if (profile) {
        setControlCredits(profile.credits);
        setUnlockedControllers(profile.unlocks);
        setTierProgress(profile.tierProgress ?? {});
        setControllerLevels(profile.controllerLevels);
        if (profile.bestScores) {
          setPersonalBestScores(profile.bestScores);
        }
      } else {
        setShopError('请先登录后兑换控制器。');
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : '兑换失败，请稍后再试。');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleUpgradeController = async (target: ControllerId) => {
    setIsPurchasing(true);
    setShopError(null);
    try {
      const profile = await upgradeController(target);
      if (profile) {
        setControlCredits(profile.credits);
        setUnlockedControllers(profile.unlocks);
        setTierProgress(profile.tierProgress ?? {});
        setControllerLevels(profile.controllerLevels);
        if (profile.bestScores) {
          setPersonalBestScores(profile.bestScores);
        }
      } else {
        setShopError('请先登录后升级控制器。');
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : '升级失败，请稍后再试。');
    } finally {
      setIsPurchasing(false);
    }
  };

  useEffect(() => {
    if (currentView !== 'LEVEL_SELECT') return;
    fetchLeaderboard(selectedLevelId);
  }, [currentView, selectedLevelId]);

  const handleLevelSelect = (levelId: string) => {
    setSelectedLevelId(levelId);
    setCurrentTier('bronze');
  };

  const handleEnterConfig = () => {
    setGameState('IDLE');
    setCurrentView('MODE_SELECT');
  };

  const handleStartGame = () => {
    const highestTier = tierProgress[selectedLevelId] ?? 'bronze';
    const effectiveTier = TIER_ORDER.indexOf(currentTier) > TIER_ORDER.indexOf(highestTier) ? highestTier : currentTier;
    const tierConfig = getTierConfig(selectedLevelId, effectiveTier);
    setCurrentLevelId(selectedLevelId);
    setCurrentTier(effectiveTier);
    resetGame(tierConfig.distance);
    setGameState('RUNNING');
    setCurrentView('GAME');
  };

  const handleBackToMenu = () => {
    setGameState('IDLE');
    setCurrentView('LEVEL_SELECT');
    fetchLeaderboard(selectedLevelId);
  };

  const getUpgradeRule = (controller: ControllerId) =>
    CONTROLLER_UPGRADE_RULES.find((rule) => rule.controller === controller);
  const getControllerLevel = (controller: ControllerId) => controllerLevels[controller] ?? 0;
  const getUpgradePrice = (controller: ControllerId) => {
    const rule = getUpgradeRule(controller);
    if (!rule) return 0;
    const level = Math.max(1, getControllerLevel(controller));
    return Math.round(rule.basePrice * Math.pow(2, Math.max(0, level - 1)));
  };
  const renderLevelMarks = (level: number, maxLevel = 10) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLevel }).map((_, index) => (
        <span
          key={`lvl-${index}`}
          className={cn(
            'h-2 w-2 rounded-full border border-slate-700',
            index < level ? 'bg-emerald-400 border-emerald-500' : 'bg-slate-800'
          )}
        />
      ))}
    </div>
  );
  const emptyPreviewLevels: Record<ControllerId, number> = {
    P: 0,
    PI: 0,
    PD: 0,
    PID: 0,
    VFB: 0,
    FF: 0,
    SMITH: 0
  };
  const buildSoloLevels = (controller: ControllerId, level: number) => {
    const levels = { ...emptyPreviewLevels };
    if (controller === 'P') levels.P = level;
    if (controller === 'PI') levels.PI = level;
    if (controller === 'PD') levels.PD = level;
    if (controller === 'VFB') levels.VFB = level;
    if (controller === 'FF') levels.FF = level;
    if (controller === 'SMITH') levels.SMITH = level;
    return levels;
  };
  const buildPidLevels = (overrideLevel?: number | null) => {
    const levels = { ...emptyPreviewLevels };
    if (overrideLevel && overrideLevel > 0) {
      levels.P = overrideLevel;
      levels.PI = overrideLevel;
      levels.PD = overrideLevel;
    } else {
      levels.P = controllerLevels.P ?? 0;
      levels.PI = controllerLevels.PI ?? 0;
      levels.PD = controllerLevels.PD ?? 0;
    }
    levels.VFB = unlockedControllers.includes('VFB') ? controllerLevels.VFB ?? 0 : 0;
    levels.FF = unlockedControllers.includes('FF') ? controllerLevels.FF ?? 0 : 0;
    levels.SMITH = unlockedControllers.includes('SMITH') ? controllerLevels.SMITH ?? 0 : 0;
    return levels;
  };
  const buildShopPreviewConfig = (controller: ControllerId, previewLevel: number | null) => {
    if (controller === 'PID') {
      return {
        controllerId: 'PID' as const,
        enableFeedforward: (controllerLevels.FF ?? 0) > 0 && unlockedControllers.includes('FF'),
        enableSpeedFeedback: (controllerLevels.VFB ?? 0) > 0 && unlockedControllers.includes('VFB'),
        controllerLevels: buildPidLevels(previewLevel)
      };
    }
    if (controller === 'PI') {
      return {
        controllerId: 'PI' as const,
        enableFeedforward: false,
        enableSpeedFeedback: false,
        controllerLevels: buildSoloLevels('PI', previewLevel ?? 0)
      };
    }
    if (controller === 'PD') {
      return {
        controllerId: 'PD' as const,
        enableFeedforward: false,
        enableSpeedFeedback: false,
        controllerLevels: buildSoloLevels('PD', previewLevel ?? 0)
      };
    }
    if (controller === 'VFB') {
      return {
        controllerId: 'P' as const,
        enableFeedforward: false,
        enableSpeedFeedback: true,
        controllerLevels: buildSoloLevels('VFB', previewLevel ?? 0)
      };
    }
    if (controller === 'FF') {
      return {
        controllerId: 'P' as const,
        enableFeedforward: true,
        enableSpeedFeedback: false,
        controllerLevels: buildSoloLevels('FF', previewLevel ?? 0)
      };
    }
    if (controller === 'SMITH') {
      return {
        controllerId: 'P' as const,
        enableFeedforward: false,
        enableSpeedFeedback: false,
        controllerLevels: buildSoloLevels('SMITH', previewLevel ?? 0)
      };
    }
    return {
      controllerId: 'P' as const,
      enableFeedforward: false,
      enableSpeedFeedback: false,
      controllerLevels: buildSoloLevels('P', previewLevel ?? 0)
    };
  };

  const currentLevelIndex = levels.findIndex((level) => level.id === selectedLevelId);
  const nextLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex + 1] : null;
  const canAdvance = !!nextLevel;

  const handleAdvanceToNextLevel = () => {
    if (!nextLevel) return;
    setSelectedLevelId(nextLevel.id);
    setCurrentTier('bronze');
    setLevels((prev) => {
      const index = prev.findIndex((level) => level.id === nextLevel.id);
      if (index < 0) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], unlocked: true };
      return updated;
    });
    setGameState('IDLE');
    setCurrentView('MODE_SELECT');
  };

  const tierBaseValue = currentTier === 'gold' ? 15000 : currentTier === 'silver' ? 12000 : 10000;
  const baseScoreValue = Math.max(
    0,
    Math.floor(
      tierBaseValue
      - metrics.maxOvershoot * 20
      - metrics.steadyError * 50
      - metrics.avgRelativeError * 30
    )
  );
  const scoreMultiplier = Math.max(0.7, Math.min(1.4, 1 / difficultyScale));
  const finalScoreValue = Math.max(0, Math.floor(baseScoreValue * scoreMultiplier));
  const tierBestScore = personalBestScores[selectedLevelId]?.tiers?.[currentTier] ?? 0;
  const previousTierBest = bestScoreSnapshotRef.current ?? tierBestScore;
  const encouragementText = (() => {
    if (previousTierBest <= 0) return '首次记录已生成，继续保持！';
    if (finalScoreValue > previousTierBest) {
      return `刷新纪录！提升了 ${(finalScoreValue - previousTierBest).toLocaleString()} 分`;
    }
    if (finalScoreValue === previousTierBest) return '追平历史最佳，表现稳定！';
    return `距离历史最佳还差 ${(previousTierBest - finalScoreValue).toLocaleString()} 分`;
  })();
  const tierLabel = TIER_OPTIONS.find((option) => option.id === currentTier)?.label ?? currentTier;
  const selectedLevel = levels.find((level) => level.id === selectedLevelId);
  const highestTier = tierProgress[selectedLevelId] ?? 'bronze';
  const isTierUnlocked = (tier: LevelTier) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(highestTier);
  const effectiveTier = isTierUnlocked(currentTier) ? currentTier : highestTier;
  const tierConfig = getTierConfig(selectedLevelId, effectiveTier);
  const hasManualTierSelection = manualTierSelections[selectedLevelId] ?? false;
  const modelLabel = selectedLevel?.plantLabel ?? '未知模型';
  const disturbanceLabel = tierConfig.disturbance.type === 'output-step'
    ? '输出阶跃扰动'
    : '无扰动';
  const delayLabel = selectedLevel?.model.delay !== undefined ? '?' : null;
  const specItems = [
    { label: '系统特性', value: modelLabel },
    { label: '输入延时 L', value: delayLabel },
    { label: '额定航程', value: `${tierConfig.distance}m` },
    { label: '扰动类型', value: disturbanceLabel }
  ].filter((item) => item.value !== null) as { label: string; value: string }[];
  const currentAiHistory = aiHistoryByLevel[selectedLevelId];
  const aiResponseContent = currentAiHistory?.content ?? null;
  const aiResponseTime = currentAiHistory?.updatedAt
    ? new Date(currentAiHistory.updatedAt).toLocaleString('zh-CN')
    : null;
  const controllerLabelMap = useMemo(() => {
    return CONTROL_SHOP_CONFIG.items.reduce<Record<ControllerId, string>>((acc, item) => {
      acc[item.unlocks.controller] = item.label;
      return acc;
    }, {} as Record<ControllerId, string>);
  }, []);

  const formatControllerName = (id: ControllerId) => controllerLabelMap[id] ?? id;
  const formatEvents = (events: { at: number; amplitude: number; duration?: number }[]) => {
    if (!events.length) return '无';
    return events
      .map((event) => {
        const durationText = event.duration ? `, 持续 ${event.duration}` : '';
        return `位置 ${event.at}, 幅值 ${event.amplitude}${durationText}`;
      })
      .join('；');
  };

  const buildReferenceSummary = () => {
    const reference = tierConfig.reference;
    const baseText = reference.base !== undefined ? `基准 ${reference.base}` : '';
    const startSafe = reference.startSafeDistance ? `起始安全距离 ${reference.startSafeDistance}` : '';
    if (reference.type === 'step') {
      return `阶跃信号。${baseText} ${startSafe} 事件：${formatEvents(reference.events)}`.trim();
    }
    if (reference.type === 'sequence') {
      const random = reference.random;
      const randomText = random
        ? `随机阶跃 ${random.count} 次，区间 ${random.minAt}-${random.maxAt}，幅值 ${random.minAmplitude}-${random.maxAmplitude}，最小间隔 ${random.minGap ?? 200}`
        : '';
      const eventsText = reference.events.length ? `预设事件：${formatEvents(reference.events)}` : '';
      return `阶跃序列。${startSafe} ${randomText} ${eventsText}`.trim();
    }
    if (reference.type === 'ramp') {
      return `斜坡信号。${baseText} 速率 ${reference.rampRate ?? 0} ${startSafe}`.trim();
    }
    if (reference.type === 'accel') {
      return `加速度信号。${baseText} 速率 ${reference.accelRate ?? 0} ${startSafe}`.trim();
    }
    return `自定义信号。${startSafe}`.trim();
  };

  const buildDisturbanceSummary = () => {
    if (tierConfig.disturbance.type === 'none') return '无扰动';
    const visual = tierConfig.disturbance.visual;
    const visualText = visual
      ? `视觉风格 ${visual.style}${visual.intensity ? `，强度 ${visual.intensity}` : ''}`
      : '';
    return `输出扰动，事件：${formatEvents(tierConfig.disturbance.events)}。${visualText}`.trim();
  };

  const buildModelSummary = () => {
    if (!selectedLevel) return '';
    const model = selectedLevel.model;
    const modelDelayText = model.delay !== undefined ? '，延时 ?' : '';
    const modelText = model.form === 'tf'
      ? `传递函数分子 [${model.numerator.join(', ')}]，分母 [${model.denominator.join(', ')}]${modelDelayText}`
      : `零极点模型：零点 [${model.zeros.join(', ')}]，极点 [${model.poles.join(', ')}]，增益 ${model.gain}${modelDelayText}`;
    const simText = `模型类型 ${modelLabel}`;
    return `${modelText}\n${simText}`;
  };

  const buildControllerSummary = () => {
    const getLevel = (id: ControllerId) => controllerLevels[id] ?? 0;
    const baseMax = 0.1;
    const kpMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('P') - 1)));
    const kiMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PI') - 1)));
    const kdMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PD') - 1)));
    const tauMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('VFB') - 1)));
    const ffMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('FF') - 1)));
    const smithMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('SMITH') - 1)));
    const unlocked = unlockedControllers.map((id) => `${formatControllerName(id)}(Lv ${getLevel(id)})`).join('、') || '无';
    const locked = CONTROL_SHOP_CONFIG.items
      .map((item) => item.unlocks.controller)
      .filter((id) => !unlockedControllers.includes(id))
      .map((id) => formatControllerName(id))
      .join('、') || '无';

    return [
      `控制模式：${controlMode === 'AUTO' ? 'PID 辅助' : '手动直控'}`,
      `当前控制器：${formatControllerName(controllerId)}`,
      `模块：测速反馈 ${enableSpeedFeedback ? '开启' : '关闭'}，前馈 ${enableFeedforward ? '开启' : '关闭'}，史密斯预估器 ${enableSmithPredictor ? '开启' : '关闭'}`,
      `PID 参数：Kp=${pidParams.kp.toFixed(3)}, Ki=${pidParams.ki.toFixed(3)}, Kd=${pidParams.kd.toFixed(3)}`,
      `扩展参数：τ=${extraParams.speedFeedbackTau.toFixed(3)}, Kff=${extraParams.feedforwardGain.toFixed(3)}, L_est=${extraParams.smithDelay.toFixed(3)}`,
      `参数上限：Kp<=${kpMax.toFixed(3)}, Ki<=${kiMax.toFixed(3)}, Kd<=${kdMax.toFixed(3)}, τ<=${tauMax.toFixed(3)}, Kff<=${ffMax.toFixed(3)}, L_est<=${smithMax.toFixed(3)}`,
      `已解锁控制器：${unlocked}`,
      `未解锁控制器：${locked}`
    ].join('\n');
  };

  const formatTopConfigsSummary = () => {
    if (!topConfigs.length) return '暂无历史高分配置记录。';
    const labelForTier = (tier?: LevelTier) =>
      TIER_OPTIONS.find((option) => option.id === tier)?.label ?? tier ?? '未知';

    return topConfigs.map((item, index) => {
      const config = item.config ?? {};
      const parts = [
        `Top ${index + 1}｜得分 ${item.score}｜时间 ${new Date(item.createdAt).toLocaleString('zh-CN')}`,
        `难度等级：${labelForTier(config.tier as LevelTier | undefined)}`,
        `控制模式：${config.controlMode ?? '未知'}`,
        `控制器：${config.controllerId ? formatControllerName(config.controllerId) : '未知'}`,
      ];

      if (config.pidParams) {
        parts.push(
          `PID 参数：Kp=${config.pidParams.kp?.toFixed?.(3) ?? config.pidParams.kp}, Ki=${config.pidParams.ki?.toFixed?.(3) ?? config.pidParams.ki}, Kd=${config.pidParams.kd?.toFixed?.(3) ?? config.pidParams.kd}`
        );
      }
      if (config.extraParams) {
        const smithDelayValue = config.extraParams.smithDelay;
        parts.push(
          `扩展参数：τ=${config.extraParams.speedFeedbackTau?.toFixed?.(3) ?? config.extraParams.speedFeedbackTau}, Kff=${config.extraParams.feedforwardGain?.toFixed?.(3) ?? config.extraParams.feedforwardGain}, L_est=${smithDelayValue?.toFixed?.(3) ?? smithDelayValue ?? '未知'}`
        );
      }
      if (config.enableSpeedFeedback !== undefined || config.enableFeedforward !== undefined || config.enableSmithPredictor !== undefined) {
        parts.push(
          `模块：测速反馈 ${config.enableSpeedFeedback ? '开启' : '关闭'}，前馈 ${config.enableFeedforward ? '开启' : '关闭'}，史密斯预估器 ${config.enableSmithPredictor ? '开启' : '关闭'}`
        );
      }
      if (config.difficultyScale !== undefined) {
        parts.push(`难度系数：${Number(config.difficultyScale).toFixed(2)}`);
      }

      return parts.join('\n');
    }).join('\n\n');
  };

  const tierNarrative: Record<LevelTier, string> = {
    bronze: '青铜：单一阶跃信号，重点控制稳态误差与超调。',
    silver: '白银：多阶跃随机变化，关注对多次变化的跟踪与鲁棒性。',
    gold: '黄金：多阶跃叠加暗流扰动，强调抗扰动与稳定性。'
  };

  const markdownComponents = useMemo<Components>(() => ({
    h2: ({ node, children, ...props }) => (
      <h3 className="text-sm font-semibold text-slate-100 mt-3 mb-2" {...props}>
        {children}
      </h3>
    ),
    h3: ({ node, children, ...props }) => (
      <h4 className="text-xs font-semibold text-slate-200 mt-3 mb-1" {...props}>
        {children}
      </h4>
    ),
    p: ({ node, children, ...props }) => (
      <p className="text-sm leading-relaxed text-slate-200 mb-2 last:mb-0" {...props}>
        {children}
      </p>
    ),
    ul: ({ node, children, ...props }) => (
      <ul className="list-disc ml-5 space-y-1 text-sm text-slate-200" {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, children, ...props }) => (
      <ol className="list-decimal ml-5 space-y-1 text-sm text-slate-200" {...props}>
        {children}
      </ol>
    ),
    li: ({ node, children, ...props }) => (
      <li className="text-sm leading-relaxed text-slate-200" {...props}>
        {children}
      </li>
    ),
    strong: ({ node, children, ...props }) => (
      <strong className="font-semibold text-white" {...props}>
        {children}
      </strong>
    ),
    blockquote: ({ node, children, ...props }) => (
      <blockquote className="border-l-2 border-slate-600 pl-3 text-sm text-slate-300 italic" {...props}>
        {children}
      </blockquote>
    ),
    code: ({ node, className: codeClassName, children, ...props }) => {
      if (!codeClassName) {
        return (
          <code className="rounded bg-slate-900/70 px-1 py-0.5 text-xs text-emerald-200" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className="text-xs text-emerald-200" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ node, children, ...props }) => (
      <pre className="rounded-lg bg-slate-900/70 p-3 text-xs text-slate-200 overflow-x-auto" {...props}>
        {children}
      </pre>
    ),
  }), []);

  const buildAiPrompt = (contextType: 'config' | 'result') => {
    if (!selectedLevel) return '';
    const tierMeaningNote = hasManualTierSelection
      ? ''
      : [
          `未手动选择难度，当前采用可用等级：${tierLabel}。`,
          `难度等级含义：${tierNarrative.bronze} ${tierNarrative.silver} ${tierNarrative.gold}`
        ].join(' ');
    const tierDetail = hasManualTierSelection ? (tierNarrative[effectiveTier] ?? '') : '';
    const tierSummary = [
      `等级：${tierLabel} (${effectiveTier})`,
      `参考信号：${buildReferenceSummary()}`,
      `扰动：${buildDisturbanceSummary()}`,
      `误差包络：±${tierConfig.envelope.margin}，航程 ${tierConfig.distance}m`,
      `难度系数：${difficultyScale.toFixed(2)}`,
      tierDetail,
      tierMeaningNote
    ].filter(Boolean).join('\n');

    const performanceSummary = contextType === 'result'
      ? `结果：${gameState === 'VICTORY' ? '成功' : '失败'}；最大超调 ${metrics.maxOvershoot.toFixed(1)}%，稳态误差 ${metrics.steadyError.toFixed(1)}%，平均相对误差 ${metrics.avgRelativeError.toFixed(1)}%，调节时间 ${metrics.settlingTime.toFixed(1)}s`
      : '';
    const topConfigSummary = `历史最佳配置（Top 3）：\n${formatTopConfigsSummary()}`;

    return [
      '你是控制奥德赛的控制器调参顾问，请基于以下上下文给出控制器配置建议。',
      '要求：优先使用已解锁控制器/模块，参数不超过上限。',
      '输出格式：使用 Markdown，并包含以下二级标题小节：',
      '## 推荐控制器/模块',
      '## 参数建议',
      '## 调参思路',
      '## 注意事项',
      `关卡：${selectedLevel.name}（${selectedLevel.id}）`,
      `关卡模型：\n${buildModelSummary()}`,
      `等级信息：\n${tierSummary}`,
      topConfigSummary,
      `当前控制配置：\n${buildControllerSummary()}`,
      performanceSummary ? `仿真结果：\n${performanceSummary}` : ''
    ].filter(Boolean).join('\n\n');
  };

  const readAiStream = async (response: Response) => {
    return (await readAITextStream(response)).trim();
  };

  const logFrontendEvent = async (payload: { type: string; content: string; context?: Record<string, unknown> }) => {
    try {
      await fetch('/api/log/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // 日志失败不影响主流程
    }
  };

  const persistAiHistory = async (levelId: string, content: string) => {
    const history = await saveControlAiHistory(levelId, content);
    if (!history) {
      throw new Error('请先登录后保存 AI 建议。');
    }
    setAiHistoryByLevel((prev) => ({
      ...prev,
      [levelId]: history
    }));
    return history.updatedAt;
  };

  const requestAiAdvice = async (contextType: 'config' | 'result') => {
    const setError = (message: string | null) => {
      updateAiStatusForSelectedLevel(
        contextType === 'config'
          ? { configError: message }
          : { resultError: message }
      );
    };

    if (controlCredits < AI_ASSIST_COST) {
      setError('积分不足，请先获取控制积分。');
      return;
    }

    updateAiStatusForSelectedLevel({ loadingContext: contextType });
    setError(null);

    try {
      const prompt = buildAiPrompt(contextType);
      const logContext = {
        contextType,
        levelId: selectedLevelId,
        tier: effectiveTier,
        view: currentView
      };
      await logFrontendEvent({
        type: 'control-odyssey-ai-request',
        content: prompt,
        context: logContext
      });
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          lessonContext: {
            stage: 'interactive',
            resourceTitle: 'Control Odyssey',
            aiPersona: 'analyst'
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'AI 请求失败');
      }

      const content = await readAiStream(response);
      if (!content) {
        throw new Error('AI 未返回建议');
      }
      const updatedAt = await persistAiHistory(selectedLevelId, content);
      await logFrontendEvent({
        type: 'control-odyssey-ai-response',
        content,
        context: { ...logContext, updatedAt }
      });

      try {
        const updatedCredits = await redeemControlAICredits();
        if (updatedCredits === null) {
          setError('请先登录后使用 AI 建议。');
        } else {
          setControlCredits(updatedCredits);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : '积分扣减失败，请稍后再试。');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'AI 请求失败，请稍后再试。');
    } finally {
      updateAiStatusForSelectedLevel({ loadingContext: null });
    }
  };

  const isConfigAiLoading = aiLoadingContext === 'config';
  const isResultAiLoading = aiLoadingContext === 'result';
  const aiConfigDisabled = isConfigAiLoading || controlCredits < AI_ASSIST_COST || !selectedLevel;
  const aiResultDisabled = isResultAiLoading || controlCredits < AI_ASSIST_COST || !selectedLevel;

  const aiConfigPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">AI 控制建议</div>
          <div className="text-xs text-slate-500">基于当前关卡与控制器配置生成</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700"
          disabled={aiConfigDisabled}
          onClick={() => requestAiAdvice('config')}
        >
          <Bot className="w-4 h-4 mr-2" />
          {isConfigAiLoading ? '分析中...' : `AI 建议 (${AI_ASSIST_COST}积分)`}
        </Button>
      </div>
      <div className="text-xs text-slate-500">当前积分：{controlCredits.toLocaleString()}</div>
      {aiResponseTime && (
        <div className="text-xs text-slate-500">最新建议时间：{aiResponseTime}</div>
      )}
      {controlCredits < AI_ASSIST_COST && (
        <div className="text-xs text-amber-400">积分不足，需 20 积分后可使用。</div>
      )}
      {aiConfigError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {aiConfigError}
        </div>
      )}
      {aiResponseContent && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {aiResponseContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );

  const aiResultPanel = (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-left">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">AI 复盘建议</div>
          <div className="text-xs text-slate-500">结合关卡配置与仿真指标分析</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700"
          disabled={aiResultDisabled}
          onClick={() => requestAiAdvice('result')}
        >
          <Bot className="w-4 h-4 mr-2" />
          {isResultAiLoading ? '分析中...' : `AI 建议 (${AI_ASSIST_COST}积分)`}
        </Button>
      </div>
      <div className="mt-2 text-xs text-slate-500">当前积分：{controlCredits.toLocaleString()}</div>
      {aiResponseTime && (
        <div className="mt-1 text-xs text-slate-500">最新建议时间：{aiResponseTime}</div>
      )}
      {controlCredits < AI_ASSIST_COST && (
        <div className="mt-2 text-xs text-amber-400">积分不足，需 20 积分后可使用。</div>
      )}
      {aiResultError && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {aiResultError}
        </div>
      )}
      {aiResponseContent && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {aiResponseContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-col w-full bg-slate-950 relative',
        currentView === 'LEVEL_SELECT' ? 'min-h-[100dvh]' : 'h-full overflow-hidden'
      )}
    >

      {/* 视图 0: 游戏介绍 (Landing) */}
      {currentView === 'INTRO' && (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-950 text-white p-8">
           <div className="max-w-3xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="inline-block p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 mb-4">
                 <Rocket className="w-16 h-16 text-blue-500 animate-pulse" />
              </div>
              <h1 className="text-6xl font-black tracking-tighter italic">CONTROL ODYSSEY</h1>
              <p className="text-xl text-slate-400 font-light leading-relaxed">
                欢迎来到控制奥德赛。这不仅是一场飞行竞赛，更是一次对自动控制理论的深度探索。
                你将化身为控制工程师，通过调校 PID 参数或手动直控，驾驶飞船穿越复杂的误差带通道。
              </p>

              <div className="grid grid-cols-3 gap-6 py-8">
                 <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <Gamepad2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                    <h3 className="font-bold">手动模式</h3>
                    <p className="text-xs text-slate-500 mt-2">体验开环控制的挑战，感受系统惯性与延迟。</p>
                 </div>
                 <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <Settings2 className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                    <h3 className="font-bold">PID 辅助</h3>
                    <p className="text-xs text-slate-500 mt-2">实时整定 Kp/Ki/Kd，让飞船自动稳定航行。</p>
                 </div>
                 <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <Layers className="w-8 h-8 text-violet-400 mx-auto mb-3" />
                    <h3 className="font-bold">多重挑战</h3>
                    <p className="text-xs text-slate-500 mt-2">从无惯性比例环节到复杂的二阶干扰环境。</p>
                 </div>
              </div>

              <Button onClick={() => setCurrentView('LEVEL_SELECT')} className="h-16 px-12 text-xl bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-900/20 rounded-full font-bold group">
                 进入星域选择
                 <ArrowLeft className="w-6 h-6 ml-3 rotate-180 transition-transform group-hover:translate-x-1" />
              </Button>
           </div>
        </div>
      )}

      {/* 视图 1: 关卡选择器 */}
      {currentView === 'LEVEL_SELECT' && (
        <div className="relative w-full">
           <Button variant="ghost" onClick={() => setCurrentView('INTRO')} className="absolute top-3 left-4 text-slate-500 hover:text-white z-20">
              <ArrowLeft className="w-4 h-4 mr-2" /> 返回介绍
           </Button>
             <LevelSelector
               levels={levels}
               selectedLevelId={selectedLevelId}
               leaderboardData={leaderboardData}
               tierProgress={tierProgress}
               personalBestScores={personalBestScores}
               onSelectLevel={handleLevelSelect}
               onConfirmLevel={handleEnterConfig}
               isLoadingLeaderboard={isLoadingLeaderboard}
               controlCredits={controlCredits}
             onOpenShop={() => {
               setShopError(null);
               setShopOpen(true);
             }}
           />
        </div>
      )}

      <Dialog
        open={shopOpen}
        onOpenChange={(open) => {
          setShopOpen(open);
          if (!open) setShopError(null);
        }}
      >
        <DialogContent className="bg-slate-900 text-white border border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              控制商店
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              使用控制积分兑换控制器，解锁后可在关卡配置中使用。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 text-xs text-slate-500">
            结算得分会按难度倍率换算积分，升级可扩大参数上限（最高 10 级）。
          </div>

          {shopError && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-sm px-3 py-2">
              {shopError}
            </div>
          )}

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {CONTROL_SHOP_CONFIG.items.map((item) => {
              const unlocked = unlockedControllers.includes(item.unlocks.controller);
              const missing = (item.requires ?? []).filter((req) => !unlockedControllers.includes(req));
              const pidLockedByLevel = item.unlocks.controller === 'PID'
                && ((controllerLevels.PI ?? 0) < 5 || (controllerLevels.PD ?? 0) < 5);
              const canPurchase = !unlocked && missing.length === 0 && !pidLockedByLevel && controlCredits >= item.price;
              const rule = getUpgradeRule(item.unlocks.controller);
              const level = getControllerLevel(item.unlocks.controller);
              const maxLevel = rule?.maxLevel ?? 10;
              const upgradePrice = rule ? getUpgradePrice(item.unlocks.controller) : 0;
              const canUpgrade = unlocked && rule && level < maxLevel && controlCredits >= upgradePrice;
              const upgradeTargetLevel = Math.min(level + 1, maxLevel);
              const previewOverride = shopPreviewLevels[item.unlocks.controller] ?? null;
              const defaultPreviewLevel = item.unlocks.controller === 'PID' ? null : upgradeTargetLevel;
              const previewLevel = previewOverride ?? defaultPreviewLevel;
              const currentPreviewLevel = item.unlocks.controller === 'PID' ? null : level;
              const currentPreviewConfig = buildShopPreviewConfig(item.unlocks.controller, currentPreviewLevel);
              const upgradePreviewConfig = buildShopPreviewConfig(item.unlocks.controller, previewLevel);
              return (
                <div key={item.id} className="flex flex-col gap-3 p-4 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{item.label}</div>
                        {unlocked && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">已解锁</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                      {missing.length > 0 && (
                        <div className="text-xs text-amber-400 mt-1">需先解锁：{missing.join(' + ')}</div>
                      )}
                      {pidLockedByLevel && (
                        <div className="text-xs text-amber-400 mt-1">需先将 PI 与 PD 升至 5 级</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">解锁价格</div>
                      <div className="text-lg font-mono text-white">{item.price}</div>
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={!canPurchase || isPurchasing}
                        onClick={() => handlePurchaseController(item.unlocks.controller)}
                      >
                        {unlocked ? '已拥有' : controlCredits < item.price ? '积分不足' : '兑换'}
                      </Button>
                    </div>
                  </div>

                  {unlocked && (
                    <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <div className="text-xs text-slate-400">当前状态</div>
                          <div className="mt-2 flex items-center gap-3">
                            <ShipAvatar
                              controlMode="AUTO"
                              controllerId={currentPreviewConfig.controllerId}
                              enableFeedforward={currentPreviewConfig.enableFeedforward}
                              enableSpeedFeedback={currentPreviewConfig.enableSpeedFeedback}
                              controllerLevels={currentPreviewConfig.controllerLevels}
                              showThrusters={false}
                              className="!w-[120px] !h-[72px]"
                            />
                            <div className="space-y-1">
                              <div className="text-xs text-slate-500">等级 {level}/{maxLevel}</div>
                              {renderLevelMarks(level, maxLevel)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>升级预览</span>
                            {previewOverride !== null && (
                              <button
                                type="button"
                                className="text-[11px] text-cyan-300 hover:text-cyan-200"
                                onClick={() =>
                                  setShopPreviewLevels((prev) => ({
                                    ...prev,
                                    [item.unlocks.controller]: null
                                  }))
                                }
                              >
                                恢复默认
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <ShipAvatar
                              controlMode="AUTO"
                              controllerId={upgradePreviewConfig.controllerId}
                              enableFeedforward={upgradePreviewConfig.enableFeedforward}
                              enableSpeedFeedback={upgradePreviewConfig.enableSpeedFeedback}
                              controllerLevels={upgradePreviewConfig.controllerLevels}
                              showThrusters={false}
                              className="!w-[120px] !h-[72px]"
                            />
                            {rule && (
                              <div className="space-y-2">
                                <div className="text-xs text-slate-500">
                                  预览等级 {typeof previewLevel === 'number' ? previewLevel : '当前最高'}
                                </div>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: maxLevel }).map((_, index) => {
                                    const dotLevel = index + 1;
                                    const isOwned = dotLevel <= level;
                                    const isUpgrade = dotLevel === upgradeTargetLevel;
                                    const isSelected = previewLevel === dotLevel;
                                    return (
                                      <button
                                        key={`${item.id}-preview-${dotLevel}`}
                                        type="button"
                                        disabled={!isOwned && !isUpgrade}
                                        onClick={() =>
                                          setShopPreviewLevels((prev) => ({
                                            ...prev,
                                            [item.unlocks.controller]:
                                              prev[item.unlocks.controller] === dotLevel ? null : dotLevel
                                          }))
                                        }
                                        className={cn(
                                          'h-2 w-2 rounded-full border transition',
                                          isOwned && 'bg-emerald-400 border-emerald-500',
                                          !isOwned && isUpgrade && 'bg-cyan-400/60 border-cyan-300',
                                          !isOwned && !isUpgrade && 'bg-slate-800 border-slate-700 cursor-not-allowed',
                                          isSelected && 'ring-2 ring-emerald-200/70'
                                        )}
                                        aria-label={`预览等级 ${dotLevel}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {rule && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-xs text-slate-500">
                            {level >= maxLevel ? '已满级' : `升级后将至 Lv${upgradeTargetLevel}`}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">升级价格</div>
                            <div className="text-sm font-mono text-white">{upgradePrice}</div>
                            <Button
                              size="sm"
                              className="mt-2"
                              variant="outline"
                              disabled={!canUpgrade || isPurchasing}
                              onClick={() => handleUpgradeController(item.unlocks.controller)}
                            >
                              {level >= maxLevel ? '已满级' : controlCredits < upgradePrice ? '积分不足' : `升级 Lv${level + 1}`}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 视图 2: 模式选择 */}
      {currentView === 'MODE_SELECT' && (
        <div className="flex items-start justify-center w-full h-full bg-slate-950/90 p-4 overflow-y-auto">
           <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-2xl rounded-xl shadow-2xl p-8">
              <div className="flex items-center gap-2 mb-2">
                 <Button variant="ghost" size="sm" onClick={() => setCurrentView('LEVEL_SELECT')} className="text-slate-400 -ml-2">
                   <ArrowLeft className="w-4 h-4 mr-1" /> 返回关卡列表
                 </Button>
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-2">
                      {selectedLevel?.name}
                    </h2>
                    <p className="text-slate-400 mt-2 text-lg italic">
                      &quot;{selectedLevel?.description}&quot;
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 font-mono text-xs border border-blue-500/20">
                    MISSION_ID: {selectedLevelId.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="space-y-6 py-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <h3 className="font-semibold text-blue-400 flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4" /> 控制对象规格
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-300">
                    {specItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="font-mono text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> 选择关卡等级
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {TIER_OPTIONS.map((tier) => {
                        const unlocked = isTierUnlocked(tier.id);
                        return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setCurrentTier(tier.id);
                            setManualTierSelections((prev) => ({ ...prev, [selectedLevelId]: true }));
                          }}
                          className={cn(
                            'rounded-xl border px-3 py-3 text-left transition-all',
                            currentTier === tier.id
                              ? `${tier.border} ${tier.bg} ring-2 ${tier.ring}`
                              : `border-slate-800 bg-slate-900/40 ${tier.hover}`,
                            !unlocked && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn('text-sm font-semibold', tier.accent)}>{tier.label}</div>
                            {!unlocked && <Lock className="w-3 h-3 text-slate-500" />}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">{tier.description}</div>
                        </button>
                      );
                      })}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <h3 className="font-semibold text-emerald-400 flex items-center gap-2 mb-3">
                      <Settings2 className="w-4 h-4" /> 难度调节
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>包络宽度系数</span>
                      <span className="font-mono text-white">{difficultyScale.toFixed(2)}</span>
                    </div>
                    <input aria-label="控制奥德赛参数"
                      type="range"
                      min="0.7"
                      max="1.3"
                      step="0.05"
                      value={difficultyScale}
                      onChange={(e) => setDifficultyScale(parseFloat(e.target.value))}
                      className="mt-3 w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                    <div className="mt-2 text-[11px] text-slate-500">
                      当前积分倍率：<span className="text-emerald-400 font-semibold">x{scoreMultiplier.toFixed(2)}</span>
                      <span className="text-slate-600">（难度越大倍数越高）</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" /> 控制模式：手动
                    </h3>
                    <div tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                      onClick={() => setControlMode('MANUAL')}
                      className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer hover:bg-slate-800",
                        controlMode === 'MANUAL' ? "bg-slate-800 border-emerald-500 ring-4 ring-emerald-500/10" : "bg-slate-900/50 border-slate-800"
                      )}
                    >
                      <div className="font-bold text-white mb-1">手动直控 (Manual)</div>
                      <div className="text-xs text-slate-500">
                        键盘上下键决定控制增量。松开按键后控制量将保持。
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> 控制模式：PID
                    </h3>
                    <div tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                      onClick={() => setControlMode('AUTO')}
                      className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer hover:bg-slate-800",
                        controlMode === 'AUTO' ? "bg-slate-800 border-blue-500 ring-4 ring-blue-500/10" : "bg-slate-900/50 border-slate-800"
                      )}
                    >
                      <div className="font-bold text-white mb-1">PID 辅助 (PID Assist)</div>
                      <div className="text-xs text-slate-500">
                        通过上下键调整设定值(R)，控制器自动生成 U(t) 响应。
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <TuningPanel aiSection={aiConfigPanel} />
              </div>

              <div className="flex justify-end gap-4 mt-10">
                <Button onClick={handleStartGame} className="bg-blue-600 hover:bg-blue-500 text-white px-12 h-14 text-xl shadow-xl shadow-blue-900/20 rounded-xl font-bold">
                  <Play className="w-6 h-6 mr-2" />
                  启动引擎
                </Button>
              </div>
           </div>
        </div>
      )}

      {/* 视图 3: 游戏进行中 */}
      {currentView === 'GAME' && (
        <div className="flex flex-col w-full h-full relative">
           {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
               <div className="bg-slate-900 border border-slate-800 p-8 md:p-10 rounded-3xl max-w-4xl w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto pr-3 custom-scrollbar">
                 {gameState === 'VICTORY' ? (
                   <>
                     <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trophy className="w-12 h-12 text-yellow-400" />
                     </div>
                     <h2 className="text-4xl font-black text-white mb-2">航行成功!</h2>
                     <p className="text-slate-400 mb-8">表现优异，数据已同步。{isSubmitting && '上传中...'}</p>

                     <div className="bg-slate-950/50 rounded-2xl p-6 mb-8 border border-slate-800 text-left space-y-4">
                        <div className="flex items-center justify-between gap-6">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">挑战分支</div>
                            <div className="text-lg font-semibold text-white">{tierLabel}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">最终得分</div>
                            <div className="text-3xl font-mono text-emerald-400 font-bold">{finalScoreValue.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>当前分支最高得分</span>
                          <span className="font-mono text-emerald-300">
                            {tierBestScore > 0 ? tierBestScore.toLocaleString() : '暂无记录'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{encouragementText}</div>
                        <div className="grid grid-cols-3 gap-4">
                          <div title="阶跃出现后，响应超过目标的最大比例。">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">最大超调</div>
                            <div className="text-xl font-mono text-white">{metrics.maxOvershoot.toFixed(1)}%</div>
                          </div>
                          <div title="最后500M内，响应均值相对给定的偏差。">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">稳态误差</div>
                            <div className="text-xl font-mono text-white">{metrics.steadyError.toFixed(1)}%</div>
                          </div>
                          <div title="误差绝对值相对于当前阶跃幅值的平均比例。">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">平均相对误差</div>
                            <div className="text-xl font-mono text-white">{metrics.avgRelativeError.toFixed(1)}%</div>
                          </div>
                        </div>
                     </div>

                     <Button
                       variant="outline"
                       onClick={toggleDetails}
                       className="mb-6 border-slate-700 text-slate-300"
                     >
                       {showDetails ? '收起详细信息' : '详细信息'}
                     </Button>

                     {showDetails && (
                       <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                         <div className="text-xs text-slate-500 mb-1">
                           给定航线 R(t)、系统响应 Y(t)、控制信号 U(t)（全航程）
                         </div>
                         <TelemetryScope height={220} />
                       </div>
                     )}

                     {aiResultPanel}

                     <div className="flex flex-col gap-3">
                       {canAdvance && (
                         <Button onClick={handleAdvanceToNextLevel} className="h-14 text-lg bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold">
                           下一关挑战
                         </Button>
                       )}
                       <div className="grid grid-cols-2 gap-3">
                         <Button onClick={handleBackToMenu} variant="outline" className="h-12 border-slate-700 rounded-xl">返回总部</Button>
                         <Button onClick={handleEnterConfig} variant="outline" className="h-12 border-slate-700 rounded-xl">返回配置</Button>
                       </div>
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Info className="w-12 h-12 text-red-500" />
                     </div>
                     <h2 className="text-4xl font-black text-white mb-2">任务失败</h2>
                     <p className="text-slate-400 mb-8 italic">&quot;指挥官，飞船超出了安全操作包线。&quot;</p>

                     <div className="bg-red-500/5 rounded-2xl p-6 mb-8 text-left border border-red-500/20">
                        <div className="text-[10px] text-red-400/60 uppercase font-bold tracking-widest mb-1">遥测报告</div>
                        <div className="text-red-200 text-lg">飞船触碰了物理边界。请在操作时注意观察底部误差曲线。</div>
                     </div>

                     <Button
                       variant="outline"
                       onClick={toggleDetails}
                       className="mb-6 border-slate-700 text-slate-300"
                     >
                       {showDetails ? '收起详细信息' : '详细信息'}
                     </Button>

                     {showDetails && (
                       <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                         <div className="text-xs text-slate-500 mb-1">
                           给定航线 R(t)、系统响应 Y(t)、控制信号 U(t)（全航程）
                         </div>
                         <TelemetryScope height={220} />
                       </div>
                     )}

                     {aiResultPanel}

                     <div className="flex flex-col gap-3">
                       <Button onClick={handleStartGame} className="h-14 text-lg bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">立即重启任务</Button>
                       <div className="grid grid-cols-2 gap-3">
                         <Button onClick={handleBackToMenu} variant="outline" className="h-12 border-slate-700 rounded-xl">返回总部</Button>
                         <Button onClick={handleEnterConfig} variant="outline" className="h-12 border-slate-700 rounded-xl">返回配置</Button>
                       </div>
                     </div>
                   </>
                 )}
               </div>
            </div>
          )}

          {/* 顶部 HUD */}
          <div className="flex-none h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBackToMenu} className="text-slate-400 hover:text-white mr-2">
                   <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-lg font-bold text-white tracking-widest italic">CONTROL ODYSSEY</div>
                <div className="h-4 w-px bg-slate-700" />
                <div className="text-sm text-blue-400 font-mono">{selectedLevel?.name}</div>
             </div>

             <div className="flex items-center gap-8">
                {controlMode === 'AUTO' && (
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">偏置 ΔR</div>
                    <div className="text-xl font-mono font-bold text-blue-300">
                      {autoOffset.toFixed(0)}
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Progress</div>
                  <div className="text-xl font-mono font-bold text-emerald-400">
                    {(distance).toFixed(0)} <span className="text-sm text-slate-500">/ {maxDistance}m</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => resetGame(maxDistance)} className="border-slate-700 text-slate-400">
                   <RotateCcw className="w-4 h-4 mr-2" /> 重置
                </Button>
             </div>
          </div>

          <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 relative bg-slate-950">
              <GameCanvas lockSetpointInput={Boolean(arenaTaskId)} />
            </div>
          </div>

          <div className="flex-none h-[120px] bg-slate-900 border-t border-slate-800 relative z-10">
             <TelemetryScope height={120} />
          </div>
        </div>
      )}

    </div>
  );
};
