'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TelemetryScope } from './components/TelemetryScope';
import { LevelSelector } from './components/LevelSelector';
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
import { Play, RotateCcw, Settings2, Trophy, Info, ArrowLeft, Rocket, Gamepad2, Layers, ShoppingBag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  submitGameScore,
  getLevelLeaderboard,
  LeaderboardEntry,
  getControlProfile,
  purchaseController,
  upgradeController
} from '@/app/actions/control-odyssey';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

export const ControlOdysseyGame: React.FC<ControlOdysseyProps> = ({
  initialLevelId = 'level-1',
  showEducation = true,
}) => {
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
  const [tierProgress, setTierProgress] = useState<Record<string, LevelTier>>({});
  const [showDetails, setShowDetails] = useState(false);
  
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSubmittedRef = useRef(false);

  // 1. 提交成绩
  useEffect(() => {
    if (gameState !== 'VICTORY') {
      hasSubmittedRef.current = false;
      setShowDetails(false);
      return;
    }

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const saveScore = async () => {
      setIsSubmitting(true);
      try {
        // 评分公式：基础分 10000 - 误差惩罚 - 超调惩罚
        const baseScore = Math.max(0, Math.floor(10000 - (metrics.iae / 10) - metrics.maxOvershoot * 20));
        const scoreMultiplier = Math.max(0.7, Math.min(1.4, 1 / difficultyScale));
        const finalScore = Math.max(0, Math.floor(baseScore * scoreMultiplier));
        await submitGameScore(
          selectedLevelId,
          finalScore,
          {
          iae: metrics.iae,
          maxOvershoot: metrics.maxOvershoot,
          scoreMultiplier
          },
          {
            runId,
            tier: currentTier,
            controllerId
          }
        );

        const profile = await getControlProfile();
        if (profile) {
          setControlCredits(profile.credits);
          setUnlockedControllers(profile.unlocks);
          setTierProgress(profile.tierProgress ?? {});
          setControllerLevels(profile.controllerLevels);
        }
      } catch (e) {
        console.error('Failed to submit score', e);
      } finally {
        setIsSubmitting(false);
      }
    };

    saveScore();
  }, [gameState, metrics, selectedLevelId, runId, currentTier, controllerId, difficultyScale, setControlCredits, setUnlockedControllers, setControllerLevels]);

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
        }
      } catch (error) {
        console.error('Failed to load control profile', error);
      }
    };

    loadProfile();
  }, [setControlCredits, setUnlockedControllers, setControllerLevels]);

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

  const currentLevelIndex = levels.findIndex((level) => level.id === selectedLevelId);
  const nextLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex + 1] : null;
  const canAdvance = !!nextLevel;

  const handleAdvanceToNextLevel = () => {
    if (!nextLevel) return;
    setSelectedLevelId(nextLevel.id);
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

  const baseScoreValue = Math.max(0, Math.floor(10000 - (metrics.iae / 10) - metrics.maxOvershoot * 20));
  const scoreMultiplier = Math.max(0.7, Math.min(1.4, 1 / difficultyScale));
  const finalScoreValue = Math.max(0, Math.floor(baseScoreValue * scoreMultiplier));
  const selectedLevel = levels.find((level) => level.id === selectedLevelId);
  const highestTier = tierProgress[selectedLevelId] ?? 'bronze';
  const isTierUnlocked = (tier: LevelTier) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(highestTier);
  const effectiveTier = isTierUnlocked(currentTier) ? currentTier : highestTier;
  const tierConfig = getTierConfig(selectedLevelId, effectiveTier);
  const modelLabel = selectedLevel?.simulation.engineType === 'PROPORTIONAL'
    ? '比例环节'
    : selectedLevel?.simulation.engineType === 'INTEGRAL'
      ? '积分环节'
      : '惯性环节';
  const disturbanceLabel = tierConfig.disturbance.type === 'output-step'
    ? '输出阶跃扰动'
    : '无扰动';
  const specItems = [
    { label: '系统特性', value: modelLabel },
    { label: '增益 K', value: selectedLevel?.simulation.gain !== undefined ? selectedLevel.simulation.gain.toFixed(2) : null },
    { label: '时间常数 T', value: selectedLevel?.simulation.timeConstant !== undefined ? selectedLevel.simulation.timeConstant.toFixed(2) : null },
    { label: '输入延时 L', value: selectedLevel?.simulation.inputDelay !== undefined ? selectedLevel.simulation.inputDelay.toFixed(2) : null },
    { label: '额定航程', value: `${tierConfig.distance}m` },
    { label: '扰动类型', value: disturbanceLabel }
  ].filter((item) => item.value !== null) as { label: string; value: string }[];

  return (
    <div
      className={cn(
        'flex flex-col w-full max-w-[1600px] mx-auto bg-slate-950 relative',
        currentView === 'LEVEL_SELECT' ? 'min-h-[100dvh] overflow-y-auto' : 'h-full overflow-hidden'
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
           <Button variant="ghost" onClick={() => setCurrentView('INTRO')} className="absolute top-8 left-8 text-slate-500 hover:text-white z-20">
              <ArrowLeft className="w-4 h-4 mr-2" /> 返回介绍
           </Button>
           <LevelSelector 
             levels={levels} 
             selectedLevelId={selectedLevelId}
             leaderboardData={leaderboardData}
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
                    <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                      <div>
                        <div className="text-xs text-slate-500">等级 {level}/{maxLevel}</div>
                        {renderLevelMarks(level, maxLevel)}
                      </div>
                      {rule && (
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
                          onClick={() => unlocked && setCurrentTier(tier.id)}
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
                    <input
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
                    <div 
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
                    <div 
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
                <TuningPanel />
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
               <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl max-w-lg w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                 {gameState === 'VICTORY' ? (
                   <>
                     <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trophy className="w-12 h-12 text-yellow-400" />
                     </div>
                     <h2 className="text-4xl font-black text-white mb-2">航行成功!</h2>
                     <p className="text-slate-400 mb-8">表现优异，数据已同步。{isSubmitting && '上传中...'}</p>
                     
                     <div className="bg-slate-950/50 rounded-2xl p-6 mb-8 grid grid-cols-2 gap-y-6 text-left border border-slate-800">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">最终得分</div>
                          <div className="text-3xl font-mono text-emerald-400 font-bold">{finalScoreValue.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">误差积分 (IAE)</div>
                          <div className="text-2xl font-mono text-white">{(metrics.iae / 10).toFixed(1)}</div>
                        </div>
                        <div className="col-span-2 h-px bg-slate-800" />
                        <div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">最大超调</div>
                           <div className="text-xl font-mono text-white">{metrics.maxOvershoot.toFixed(1)}%</div>
                        </div>
                        <div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">任务航程</div>
                           <div className="text-xl font-mono text-white">{distance.toFixed(0)}m</div>
                        </div>
                     </div>

                     <Button
                       variant="outline"
                       onClick={() => setShowDetails((prev) => !prev)}
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

                     <div className="flex flex-col gap-3">
                       <Button onClick={handleStartGame} className="h-14 text-lg bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">立即重启任务</Button>
                       <Button onClick={handleBackToMenu} variant="outline" className="h-12 border-slate-700 rounded-xl">重新规划</Button>
                     </div>
                   </>
                 )}
               </div>
            </div>
          )}

          {/* 顶部 HUD */}
          <div className="flex-none h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
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
              <GameCanvas />
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
