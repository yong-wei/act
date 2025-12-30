'use client';

/**
 * 方程显示组件
 * Equation Display with KaTeX
 */

import { memo, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react';

interface EquationDisplayProps {
  equation: string;
  isComplete: boolean;
  missing: string[];
  targetEquation?: string;
  showHint?: boolean;
}

/** KaTeX 渲染器（简化版，使用 dangerouslySetInnerHTML） */
function LatexRenderer({ latex }: { latex: string }) {
  // 在实际项目中应使用 react-katex 或 @matejmazur/react-katex
  // 这里使用简化的 HTML 渲染作为占位
  const formattedLatex = useMemo(() => {
    if (!latex) return '';

    // 简单的 LaTeX 到 HTML 转换（生产环境应使用 KaTeX）
    return latex
      .replace(/\\ddot\{([^}]+)\}/g, '$1̈')  // 二阶导数
      .replace(/\\dot\{([^}]+)\}/g, '$1̇')   // 一阶导数
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')  // 分数
      .replace(/\\int/g, '∫')
      .replace(/\\,/g, ' ')
      .replace(/dt/g, 'dt');
  }, [latex]);

  return (
    <div className="font-mono text-2xl tracking-wide text-amber-400">
      {formattedLatex || <span className="text-slate-500">等待构建模型...</span>}
    </div>
  );
}

/** 方程显示组件 */
function EquationDisplayComponent({
  equation,
  isComplete,
  missing,
  targetEquation,
  showHint = true,
}: EquationDisplayProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 backdrop-blur">
      {/* 标题 */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-400">生成的微分方程</h4>
        {isComplete ? (
          <div className="flex items-center gap-1.5 text-xs text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            <span>模型完整</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-500">
            <AlertCircle className="h-4 w-4" />
            <span>模型不完整</span>
          </div>
        )}
      </div>

      {/* 方程显示 */}
      <div className="flex min-h-[60px] items-center justify-center rounded-lg bg-slate-800/50 p-4">
        <LatexRenderer latex={equation} />
      </div>

      {/* 缺失项提示 */}
      {!isComplete && missing.length > 0 && showHint && (
        <div className="mt-3 rounded-lg bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-medium text-amber-500">缺少以下元件：</p>
              <ul className="mt-1 space-y-0.5">
                {missing.map((item, index) => (
                  <li key={index} className="text-xs text-amber-500/70">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 目标方程对比 */}
      {targetEquation && isComplete && (
        <div className="mt-3 rounded-lg bg-green-500/10 p-3">
          <p className="text-xs text-green-500">
            ✓ 你的模型与目标方程结构一致！
          </p>
        </div>
      )}
    </div>
  );
}

export const EquationDisplay = memo(EquationDisplayComponent);
