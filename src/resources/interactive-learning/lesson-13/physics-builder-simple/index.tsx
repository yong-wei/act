'use client';

/**
 * PhysicsBuilderSimple - 简版物理工坊（前测）
 *
 * 学习主题：阻尼比与系统响应的关系
 * 场景：弹簧-阻尼器-小球系统（模拟乘客胃部感受）
 *
 * 交互：
 * - 阻尼系数 ζ 滑块 (0.1 → 1.0)
 * - 实时动画（小球振荡）
 * - 位移曲线图
 * - 验收: ζ ∈ [0.6, 0.8] 时显示 "Excellent"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface PhysicsBuilderSimpleProps extends BaseWidgetProps {
  /** 初始阻尼比 */
  initialDamping?: number;
  /** 目标阻尼区间 */
  targetDampingRange?: [number, number];
  /** 是否自动评分并完成 */
  autoGrade?: boolean;
}

// ========== 物理模拟参数 ==========

const SIMULATION_CONFIG = {
  mass: 1.0,           // 质量 (kg)
  stiffness: 10.0,     // 弹簧刚度 (N/m)
  initialDisplacement: 1.0, // 初始位移 (m)
  dt: 0.016,           // 时间步长 (s)
  duration: 10,        // 模拟总时长 (s)
};

// 自然频率 ωn = sqrt(k/m)
const NATURAL_FREQ = Math.sqrt(SIMULATION_CONFIG.stiffness / SIMULATION_CONFIG.mass);

// ========== 计算阻尼系统响应 ==========

function calculateResponse(
  zeta: number,
  t: number,
  x0: number = SIMULATION_CONFIG.initialDisplacement
): number {
  if (zeta >= 1) {
    // 过阻尼或临界阻尼
    const s1 = -zeta * NATURAL_FREQ + NATURAL_FREQ * Math.sqrt(zeta * zeta - 1);
    const s2 = -zeta * NATURAL_FREQ - NATURAL_FREQ * Math.sqrt(zeta * zeta - 1);
    const c1 = x0 * s2 / (s2 - s1);
    const c2 = -x0 * s1 / (s2 - s1);
    return c1 * Math.exp(s1 * t) + c2 * Math.exp(s2 * t);
  } else {
    // 欠阻尼
    const wd = NATURAL_FREQ * Math.sqrt(1 - zeta * zeta);
    return x0 * Math.exp(-zeta * NATURAL_FREQ * t) * (
      Math.cos(wd * t) + (zeta * NATURAL_FREQ / wd) * Math.sin(wd * t)
    );
  }
}

// ========== 获取响应特性 ==========

function getResponseCharacteristics(zeta: number) {
  if (zeta < 0.3) {
    return {
      type: '欠阻尼（振荡明显）',
      description: '小球来回振荡多次才能停下，乘客会感到明显的颠簸',
      color: '#ef4444', // red
      emoji: '😵',
    };
  } else if (zeta < 0.6) {
    return {
      type: '欠阻尼（轻微振荡）',
      description: '小球有少量振荡，乘客会感到轻微不适',
      color: '#f59e0b', // amber
      emoji: '😐',
    };
  } else if (zeta <= 0.8) {
    return {
      type: '最佳阻尼区间',
      description: '小球快速平稳地回到平衡位置，乘客几乎无感',
      color: '#22c55e', // green
      emoji: '😊',
    };
  } else if (zeta < 1.0) {
    return {
      type: '欠阻尼（接近临界）',
      description: '响应稍慢但平稳',
      color: '#3b82f6', // blue
      emoji: '🙂',
    };
  } else {
    return {
      type: '过阻尼',
      description: '响应过慢，无法及时调整',
      color: '#8b5cf6', // violet
      emoji: '😴',
    };
  }
}

// ========== 弹簧动画组件 ==========

function SpringMassDamperCanvas({
  dampingRatio,
  displacement,
  isRunning,
}: {
  dampingRatio: number;
  displacement: number;
  isRunning: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空
    ctx.clearRect(0, 0, width, height);

    // 参数
    const wallX = 50;
    const wallWidth = 10;
    const springRestLength = 100;
    const ballRadius = 20;
    const damperWidth = 30;
    const damperHeight = 40;

    // 位移映射到画布坐标（反向，向下为正）
    const ballY = height / 2 + displacement * 80;
    const ballX = width / 2;

    // 绘制顶部固定端
    ctx.fillStyle = '#475569';
    ctx.fillRect(ballX - 40, 20, 80, 15);
    ctx.beginPath();
    ctx.moveTo(ballX - 50, 35);
    ctx.lineTo(ballX + 50, 35);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 绘制弹簧（左侧）
    const springStartY = 35;
    const springEndY = ballY - ballRadius;
    const springX = ballX - 25;
    const coils = 8;
    const coilWidth = 15;

    ctx.beginPath();
    ctx.moveTo(springX, springStartY);
    for (let i = 0; i <= coils; i++) {
      const y = springStartY + (springEndY - springStartY) * (i / coils);
      const x = springX + (i % 2 === 0 ? -coilWidth : coilWidth);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(springX, springEndY);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 绘制阻尼器（右侧）
    const damperX = ballX + 25;
    const damperStartY = 35;
    const damperEndY = ballY - ballRadius;
    const damperMidY = (damperStartY + damperEndY) / 2;

    // 阻尼器外壳
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(damperX - 10, damperMidY - 20, 20, 40);

    // 阻尼器活塞
    ctx.beginPath();
    ctx.moveTo(damperX, damperStartY);
    ctx.lineTo(damperX, damperMidY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(damperX, damperMidY + 20);
    ctx.lineTo(damperX, damperEndY);
    ctx.stroke();

    // 阻尼器活塞头
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(damperX - 8, damperMidY - 5, 16, 10);

    // 绘制小球
    const gradient = ctx.createRadialGradient(
      ballX - 5,
      ballY - 5,
      0,
      ballX,
      ballY,
      ballRadius
    );
    gradient.addColorStop(0, '#94a3b8');
    gradient.addColorStop(1, '#475569');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(ballX - 5, ballY - 5, 6, 0, Math.PI * 2);
    ctx.fill();

    // 平衡位置标记
    const eqY = height / 2;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(ballX - 50, eqY);
    ctx.lineTo(ballX + 50, eqY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 位移标注
    if (Math.abs(displacement) > 0.05) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`x = ${displacement.toFixed(2)}`, ballX + 35, ballY);
    }

    // 阻尼比标注
    ctx.fillStyle = '#f59e0b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ζ = ${dampingRatio.toFixed(2)}`, damperX, damperEndY + 25);

  }, [dampingRatio, displacement]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={350}
      className="bg-slate-900 rounded-lg"
    />
  );
}

// ========== 位移曲线图组件 ==========

function DisplacementChart({
  history,
  dampingRatio,
}: {
  history: { t: number; x: number }[];
  dampingRatio: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // 清空
    ctx.clearRect(0, 0, width, height);

    // 背景
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // 网格
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // 水平网格线
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (plotWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // 坐标轴
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;

    // X轴
    const xAxisY = padding.top + plotHeight / 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, xAxisY);
    ctx.lineTo(width - padding.right, xAxisY);
    ctx.stroke();

    // Y轴
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // 标签
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';

    // X轴标签
    ctx.textAlign = 'center';
    ctx.fillText('时间 (s)', width / 2, height - 5);
    for (let i = 0; i <= 10; i += 2) {
      const x = padding.left + (plotWidth / 10) * i;
      ctx.fillText(i.toString(), x, height - padding.bottom + 15);
    }

    // Y轴标签
    ctx.textAlign = 'right';
    ctx.fillText('位移 x', padding.left - 5, padding.top - 5);
    ctx.fillText('1', padding.left - 5, padding.top + 5);
    ctx.fillText('0', padding.left - 5, xAxisY + 5);
    ctx.fillText('-1', padding.left - 5, height - padding.bottom + 5);

    // 绘制曲线
    if (history.length > 1) {
      const characteristics = getResponseCharacteristics(dampingRatio);

      ctx.beginPath();
      ctx.strokeStyle = characteristics.color;
      ctx.lineWidth = 2;

      history.forEach((point, index) => {
        const x = padding.left + (point.t / SIMULATION_CONFIG.duration) * plotWidth;
        const y = xAxisY - point.x * (plotHeight / 2.5);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // 包络线（理论值）
    if (dampingRatio < 1 && history.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      for (let t = 0; t <= SIMULATION_CONFIG.duration; t += 0.1) {
        const envelope = Math.exp(-dampingRatio * NATURAL_FREQ * t);
        const x = padding.left + (t / SIMULATION_CONFIG.duration) * plotWidth;
        const y = xAxisY - envelope * (plotHeight / 2.5);

        if (t === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [history, dampingRatio]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={250}
      className="rounded-lg"
    />
  );
}

// ========== 主组件 ==========

export function PhysicsBuilderSimple({
  onComplete,
  onStateChange,
  embedded = false,
  initialDamping = 0.1,
  targetDampingRange = [0.6, 0.8],
  autoGrade = true,
}: PhysicsBuilderSimpleProps) {
  const interactive = useOptionalInteractiveContext();
  const [dampingRatio, setDampingRatio] = useState(initialDamping);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [displacement, setDisplacement] = useState(SIMULATION_CONFIG.initialDisplacement);
  const [history, setHistory] = useState<{ t: number; x: number }[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [pathContinueResult, setPathContinueResult] = useState<WidgetResult | null>(null);

  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);

  const characteristics = getResponseCharacteristics(dampingRatio);
  const isOptimal = dampingRatio >= targetDampingRange[0] && dampingRatio <= targetDampingRange[1];

  // 计算得分
  const calculateScore = (zeta: number): number => {
    if (zeta >= 0.6 && zeta <= 0.8) {
      // 最佳区间，满分
      return 100;
    } else if (zeta >= 0.5 && zeta <= 0.9) {
      // 次优区间
      return 80;
    } else if (zeta >= 0.3 && zeta <= 1.0) {
      // 可接受区间
      return 60;
    } else {
      // 较差
      return 40;
    }
  };

  // 开始模拟
  const startSimulation = useCallback(() => {
    setIsRunning(true);
    setTime(0);
    setHistory([]);
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTimeRef.current) / 1000;

      if (elapsed >= SIMULATION_CONFIG.duration) {
        setIsRunning(false);

        // 检查是否达到最佳区间
        if (isOptimal && !hasCompleted && autoGrade) {
          setHasCompleted(true);
          const score = calculateScore(dampingRatio);
          if (score > bestScore) {
            setBestScore(score);
          }
          setPathContinueResult({
            success: true,
            score,
            data: { dampingRatio, targetRange: targetDampingRange },
          });
        }
        return;
      }

      const x = calculateResponse(dampingRatio, elapsed);
      setTime(elapsed);
      setDisplacement(x);
      setHistory((prev) => [...prev, { t: elapsed, x }]);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [
    dampingRatio,
    isOptimal,
    hasCompleted,
    bestScore,
    autoGrade,
    targetDampingRange,
  ]);

  // 重置
  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRunning(false);
    setTime(0);
    setDisplacement(SIMULATION_CONFIG.initialDisplacement);
    setHistory([]);
    interactive?.progress.reset();
  }, [interactive]);

  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const progressValue = hasCompleted ? 100 : calculateScore(dampingRatio);
    const snapshot = {
      progress: progressValue,
      data: {
        dampingRatio,
        isOptimal,
        bestScore,
        targetRange: targetDampingRange,
      },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
  }, [
    dampingRatio,
    isOptimal,
    bestScore,
    hasCompleted,
    targetDampingRange,
    interactive,
    onStateChange,
  ]);

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-slate-950 text-white p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">阻尼调节实验</h1>
          <p className="text-slate-400">
            调节阻尼系数，让小球在受力后最快平稳下来，且不产生第二次回弹。
          </p>
        </div>

        {/* 任务说明 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-full">
              <Gauge className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-blue-400 mb-1">前测任务</h3>
              <p className="text-sm text-slate-300">
                当前阻尼比 ζ = 0.1，小球震荡剧烈。请调节阻尼系数，找到让小球在受力后
                <strong className="text-emerald-400">最快平稳下来且不产生第二次回弹</strong>
                的阻尼区间。
              </p>
            </div>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左侧：动画和控制 */}
          <div className="space-y-4">
            {/* 弹簧动画 */}
            <div className="bg-slate-900 rounded-xl p-4">
              <div className="flex justify-center">
                <SpringMassDamperCanvas
                  dampingRatio={dampingRatio}
                  displacement={displacement}
                  isRunning={isRunning}
                />
              </div>
            </div>

            {/* 控制面板 */}
            <div className="bg-slate-900 rounded-xl p-4 space-y-4">
              {/* 阻尼滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-400">阻尼比 ζ</p>
                  <span
                    className="text-lg font-mono font-bold"
                    style={{ color: characteristics.color }}
                  >
                    {dampingRatio.toFixed(2)}
                  </span>
                </div>
                <input aria-label="物理构型参数"
                  type="range"
                  min="0.05"
                  max="1.2"
                  step="0.01"
                  value={dampingRatio}
                  onChange={(e) => {
                    setDampingRatio(parseFloat(e.target.value));
                    if (!isRunning) {
                      setDisplacement(SIMULATION_CONFIG.initialDisplacement);
                      setHistory([]);
                    }
                  }}
                  disabled={isRunning}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0.05</span>
                  <span className="text-emerald-400">最佳区间 0.6-0.8</span>
                  <span>1.2</span>
                </div>
              </div>

              {/* 按钮 */}
              <div className="flex gap-3">
                <button type="button"
                  onClick={startSimulation}
                  disabled={isRunning}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Play className="h-4 w-4" />
                  {isRunning ? '模拟中...' : '开始模拟'}
                </button>
                <button type="button"
                  onClick={reset}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 响应特性 */}
            <div
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: `${characteristics.color}10`,
                borderColor: `${characteristics.color}30`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{characteristics.emoji}</span>
                <div>
                  <div
                    className="font-medium"
                    style={{ color: characteristics.color }}
                  >
                    {characteristics.type}
                  </div>
                  <div className="text-sm text-slate-400">
                    {characteristics.description}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：曲线图和结果 */}
          <div className="space-y-4">
            {/* 位移曲线 */}
            <div className="bg-slate-900 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">位移-时间曲线</span>
                {isRunning && (
                  <span className="text-xs text-slate-500 ml-auto">
                    t = {time.toFixed(2)}s
                  </span>
                )}
              </div>
              <DisplacementChart history={history} dampingRatio={dampingRatio} />
            </div>

            {/* 结果判定 */}
            {history.length > 0 && !isRunning && (
              <div
                className={`rounded-xl p-4 border ${
                  isOptimal
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isOptimal ? (
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-amber-400" />
                  )}
                  <div>
                    <div
                      className={`font-bold text-lg ${
                        isOptimal ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isOptimal ? 'Excellent!' : '继续调整'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {isOptimal
                        ? `你找到了最佳阻尼区间 (ζ = ${dampingRatio.toFixed(2)})`
                        : '提示：尝试增大阻尼系数，减少振荡次数'}
                    </div>
                  </div>
                </div>
                {isOptimal && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20">
                    <div className="text-sm text-slate-400">
                      在这个阻尼区间内，系统响应最快且不会产生过冲，
                      对应邮轮控制中最舒适的调节效果。
                    </div>
                  </div>
                )}
              </div>
            )}

            {pathContinueResult ? (
              <PathResourceContinueAction
                enabled
                result={pathContinueResult}
                onComplete={onComplete}
              />
            ) : null}

            {/* 知识点 */}
            <div className="bg-slate-900 rounded-xl p-4">
              <h3 className="font-medium mb-3">💡 知识点</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span>
                    <strong className="text-slate-300">ζ &lt; 1</strong>：欠阻尼，系统振荡后衰减
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>
                    <strong className="text-slate-300">ζ = 0.6~0.8</strong>：最佳区间，响应快且平稳
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">•</span>
                  <span>
                    <strong className="text-slate-300">ζ = 1</strong>：临界阻尼，最快无振荡响应
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400">•</span>
                  <span>
                    <strong className="text-slate-300">ζ &gt; 1</strong>：过阻尼，响应缓慢
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhysicsBuilderSimple;
