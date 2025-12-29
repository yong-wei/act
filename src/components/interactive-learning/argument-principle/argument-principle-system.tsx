'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { FunctionInputPanel } from './function-input-panel';
import { ContourSettingsPanel } from './contour-settings-panel';
import { ComplexPlaneCanvas } from './complex-plane-canvas';
import { MappedPlaneCanvas } from './mapped-plane-canvas';
import { AnalysisResultPanel } from './analysis-result-panel';
import { PresetExamples } from './preset-examples';
import { useComplexFunction } from './hooks/use-complex-function';
import { useCanvasTransform } from './hooks/use-canvas-transform';
import { useContourDrawing } from './hooks/use-contour-drawing';
import type { ComplexNumber, Point2D } from './types';

// 计算绕原点圈数
function calculateWindingNumber(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let totalAngle = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // 跳过无效点
    if (!isFinite(p1.x) || !isFinite(p1.y) || !isFinite(p2.x) || !isFinite(p2.y)) {
      continue;
    }

    const angle1 = Math.atan2(p1.y, p1.x);
    const angle2 = Math.atan2(p2.y, p2.x);

    let deltaAngle = angle2 - angle1;

    // 处理角度跳变
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    totalAngle += deltaAngle;
  }

  return Math.round(totalAngle / (2 * Math.PI));
}

export function ArgumentPrincipleSystem() {
  // 复数函数状态
  const {
    inputFormat,
    setInputFormat,
    parsedFunction,
    parseError,
    parse,
    evaluate,
  } = useComplexFunction();

  // 源平面变换
  const {
    transform: sourceTransform,
    initializeCenter: initializeSourceCenter,
    handleWheel: handleSourceWheel,
    handlePan: handleSourcePan,
    resetTransform: resetSourceTransform,
    screenToWorld: sourceScreenToWorld,
  } = useCanvasTransform({ initialScale: 50 });

  // 映射平面变换
  const {
    transform: mappedTransform,
    initializeCenter: initializeMappedCenter,
    handleWheel: handleMappedWheel,
    handlePan: handleMappedPan,
    resetTransform: resetMappedTransform,
  } = useCanvasTransform({ initialScale: 50 });

  // 轮廓绘制
  const contourDrawing = useContourDrawing({
    screenToWorld: sourceScreenToWorld,
  });
  const {
    contourParams,
    generateContour,
    worldPoints,
    isDrawing,
    startDrawing,
    continueDrawing,
    endDrawing,
    clearManualPoints,
    updateContourParams,
  } = contourDrawing;

  // 轮廓点和映射点
  const [contourPoints, setContourPoints] = useState<Point2D[]>([]);
  const [mappedPoints, setMappedPoints] = useState<Point2D[]>([]);
  const [windingNumber, setWindingNumber] = useState<number | null>(null);

  // 初始化画布中心
  useEffect(() => {
    // 延迟初始化以确保DOM已渲染
    const timer = setTimeout(() => {
      initializeSourceCenter(400, 400);
      initializeMappedCenter(400, 400);
    }, 100);
    return () => clearTimeout(timer);
  }, [initializeSourceCenter, initializeMappedCenter]);

  // 生成轮廓并映射
  const handleDraw = useCallback(() => {
    const points = generateContour(contourParams);
    setContourPoints(points);

    // 映射轮廓点
    if (parsedFunction && points.length > 0) {
      const mapped: Point2D[] = [];
      for (const point of points) {
        const s: ComplexNumber = { re: point.x, im: point.y };
        const result = evaluate(s);
        if (result && isFinite(result.re) && isFinite(result.im)) {
          mapped.push({ x: result.re, y: result.im });
        }
      }
      setMappedPoints(mapped);

      // 计算绕数
      const winding = calculateWindingNumber(mapped);
      setWindingNumber(winding);
    }
  }, [generateContour, contourParams, parsedFunction, evaluate]);

  // 清除轮廓
  const handleClear = useCallback(() => {
    clearManualPoints();
    setContourPoints([]);
    setMappedPoints([]);
    setWindingNumber(null);
  }, [clearManualPoints]);

  // 重置视图
  const handleReset = useCallback(() => {
    resetSourceTransform(400, 400);
    resetMappedTransform(400, 400);
  }, [resetSourceTransform, resetMappedTransform]);

  // 预设示例选择
  const handleSelectExample = useCallback(
    (numerator: string, denominator: string) => {
      setInputFormat('tf');
      parse('tf', {
        numerator: numerator.split(',').map((s) => parseFloat(s.trim())),
        denominator: denominator.split(',').map((s) => parseFloat(s.trim())),
      });
    },
    [setInputFormat, parse]
  );

  // 当轮廓参数变化时自动重绘
  useEffect(() => {
    if (contourParams.type !== 'manual') {
      handleDraw();
    }
  }, [contourParams, handleDraw]);

  // 手动绘制结束时映射
  useEffect(() => {
    if (
      contourParams.type === 'manual' &&
      worldPoints.length > 2 &&
      !isDrawing
    ) {
      setContourPoints(worldPoints);

      if (parsedFunction) {
        const mapped: Point2D[] = [];
        for (const point of worldPoints) {
          const s: ComplexNumber = { re: point.x, im: point.y };
          const result = evaluate(s);
          if (result && isFinite(result.re) && isFinite(result.im)) {
            mapped.push({ x: result.re, y: result.im });
          }
        }
        setMappedPoints(mapped);

        const winding = calculateWindingNumber(mapped);
        setWindingNumber(winding);
      }
    }
  }, [worldPoints, isDrawing, contourParams.type, parsedFunction, evaluate]);

  // 零点和极点
  const zeros = useMemo(() => parsedFunction?.zeros ?? [], [parsedFunction]);
  const poles = useMemo(() => parsedFunction?.poles ?? [], [parsedFunction]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* 顶部导航 */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/interactive-learning"
              className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">返回</span>
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <h1 className="text-lg font-semibold text-white">幅角原理可视化</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              重置视图
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              保存图像
            </button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex flex-1 flex-col gap-6 p-6">
        {/* 顶部控制面板 */}
        <section className="grid gap-4 lg:grid-cols-3">
          <FunctionInputPanel
            inputFormat={inputFormat}
            onFormatChange={setInputFormat}
            onParse={parse}
            parseError={parseError}
          />
          <ContourSettingsPanel
            contourParams={contourParams}
            onParamsChange={updateContourParams}
            onDraw={handleDraw}
            onClear={handleClear}
          />
          <PresetExamples onSelectExample={handleSelectExample} />
        </section>

        {/* 画布区域 */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="grid flex-1 gap-4 lg:grid-cols-2">
            {/* 源平面 */}
            <div className="min-h-[400px]">
              <ComplexPlaneCanvas
                transform={sourceTransform}
                zeros={zeros}
                poles={poles}
                contourPoints={contourPoints}
                isManualMode={contourParams.type === 'manual'}
                onWheel={handleSourceWheel}
                onPan={handleSourcePan}
                onDrawStart={startDrawing}
                onDrawContinue={continueDrawing}
                onDrawEnd={endDrawing}
              />
            </div>

            {/* 映射平面 */}
            <div className="min-h-[400px]">
              <MappedPlaneCanvas
                transform={mappedTransform}
                mappedPoints={mappedPoints}
                windingNumber={windingNumber}
                onWheel={handleMappedWheel}
                onPan={handleMappedPan}
              />
            </div>
          </div>

          {/* 底部分析结果 */}
          <AnalysisResultPanel
            parsedFunction={parsedFunction}
            windingNumber={windingNumber}
          />
        </div>
      </main>
    </div>
  );
}
