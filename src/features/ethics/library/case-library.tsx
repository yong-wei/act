'use client';

/**
 * CaseLibrary - 历史案例库（底部区域）
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Calendar, AlertCircle } from 'lucide-react';
import type { HistoricalCase } from '../ethics-sandbox';

interface CaseLibraryProps {
  cases: HistoricalCase[];
}

export function CaseLibrary({ cases }: CaseLibraryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : cases.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < cases.length - 1 ? prev + 1 : 0));
  };

  if (cases.length === 0) return null;

  const currentCase = cases[currentIndex];

  return (
    <div className="border-t border-emerald-500/30 bg-[#1a2942]/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-emerald-400">
          <BookOpen className="h-4 w-4" />
          历史深渊案例库
        </h3>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={handlePrev}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500">
            {currentIndex + 1} / {cases.length}
          </span>
          <button type="button"
            onClick={handleNext}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-600 bg-slate-800/50 p-4">
        <div className="flex items-start gap-4">
          {/* 案例信息 */}
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h4 className="font-medium text-slate-200">{currentCase.title}</h4>
              <span className="flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                <Calendar className="h-3 w-3" />
                {currentCase.year}
              </span>
            </div>
            <p className="text-sm text-slate-400">{currentCase.description}</p>

            {/* 结果 */}
            <div className="mt-3 flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{currentCase.outcome}</span>
            </div>
          </div>

          {/* 经验教训 */}
          <div className="w-1/3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="mb-2 text-xs font-medium text-emerald-400">经验教训</div>
            <ul className="space-y-1">
              {currentCase.lessons.map((lesson, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{lesson}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 指示器 */}
      <div className="mt-3 flex justify-center gap-1.5">
        {cases.map((_, index) => (
          <button type="button"
            aria-label={`查看案例 ${index + 1}`}
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === currentIndex ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
