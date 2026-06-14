'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ComplexNumber, ParsedFunction } from './types';

interface AnalysisResultPanelProps {
  parsedFunction: ParsedFunction | null;
  windingNumber: number | null;
}

function formatComplex(c: ComplexNumber): string {
  const re = c.re.toFixed(3);
  const im = Math.abs(c.im).toFixed(3);

  if (Math.abs(c.im) < 0.0001) {
    return re;
  }
  if (Math.abs(c.re) < 0.0001) {
    return c.im >= 0 ? `${im}i` : `-${im}i`;
  }
  return c.im >= 0 ? `${re} + ${im}i` : `${re} - ${im}i`;
}

export function AnalysisResultPanel({
  parsedFunction,
  windingNumber,
}: AnalysisResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const zerosCount = parsedFunction?.zeros.length ?? 0;
  const polesCount = parsedFunction?.poles.length ?? 0;
  const balance = zerosCount - polesCount;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
      <button type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <h3 className="text-sm font-semibold text-white">解析结果</h3>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700/50 p-4">
          {parsedFunction ? (
            <div className="space-y-4">
              {/* 表达式 */}
              <div>
                <p className="mb-1 text-xs text-slate-400">函数表达式</p>
                <p className="font-mono text-sm text-white">{parsedFunction.expression}</p>
              </div>

              {/* 零点和极点 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-slate-400">
                    零点 <span className="text-green-400">({zerosCount})</span>
                  </p>
                  <div className="space-y-1">
                    {parsedFunction.zeros.length > 0 ? (
                      parsedFunction.zeros.map((zero, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="font-mono text-xs text-slate-300">
                            {formatComplex(zero)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">无</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-slate-400">
                    极点 <span className="text-red-400">({polesCount})</span>
                  </p>
                  <div className="space-y-1">
                    {parsedFunction.poles.length > 0 ? (
                      parsedFunction.poles.map((pole, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-2 w-2 bg-red-500" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
                          <span className="font-mono text-xs text-slate-300">
                            {formatComplex(pole)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">无</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 增益 */}
              <div>
                <p className="mb-1 text-xs text-slate-400">增益 K</p>
                <p className="font-mono text-sm text-white">{parsedFunction.gain.toFixed(4)}</p>
              </div>

              {/* 分析结果 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">包围区域内 Z - P</span>
                  <span className="font-mono text-sm text-white">{balance}</span>
                </div>

                {windingNumber !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">映射曲线绕原点圈数 N</span>
                    <span className="font-mono text-sm text-amber-400">{windingNumber}</span>
                  </div>
                )}

                {windingNumber !== null && (
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <p className="text-xs text-slate-400">
                      幅角原理：
                      <span className="text-white"> N = Z - P</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      其中 Z 为包围区域内的零点数，P 为极点数，N 为映射曲线绕原点的圈数（逆时针为正）
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">请输入函数并点击&quot;解析函数&quot;按钮</p>
          )}
        </div>
      )}
    </div>
  );
}
