'use client';

/**
 * JournalCarousel - 学习日志轮播（底部区域）
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Award, Trophy, GraduationCap } from 'lucide-react';
import type { JournalEntryData } from '../personal-learning-center';

interface JournalCarouselProps {
  journals: JournalEntryData[];
}

const entryTypeConfig = {
  ETHICS_DECISION: { icon: FileText, label: '伦理决策', color: 'text-green-400', bg: 'bg-green-500/20' },
  CERTIFICATE: { icon: Award, label: '证书认证', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  COMPETITION: { icon: Trophy, label: '竞赛成绩', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  TRAINING: { icon: GraduationCap, label: '培训记录', color: 'text-blue-400', bg: 'bg-blue-500/20' },
};

export function JournalCarousel({ journals }: JournalCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : journals.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < journals.length - 1 ? prev + 1 : 0));
  };

  if (journals.length === 0) return null;

  return (
    <div className="border-t border-cyan-500/30 bg-[#0c3654]/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-cyan-400">
          <FileText className="h-4 w-4" />
          思政学习日志
        </h3>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={handlePrev}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500">
            {currentIndex + 1} / {journals.length}
          </span>
          <button type="button"
            onClick={handleNext}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-hidden">
        {journals.map((journal, index) => {
          const config = entryTypeConfig[journal.entryType];
          const Icon = config.icon;
          const isActive = index === currentIndex;

          return (
            <div
              key={journal.id}
              className={`flex-shrink-0 rounded-xl border p-4 transition-all duration-300 ${
                isActive
                  ? 'w-full border-cyan-500/30 bg-[#0a2a43]/80'
                  : 'hidden w-0 border-transparent'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* 类型图标 */}
                <div className={`rounded-lg p-2 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>

                {/* 内容 */}
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-slate-200">{journal.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    {journal.grade && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                        评级：{journal.grade}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-400">{journal.content}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    {journal.createdAt.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                {/* 操作按钮 */}
                <button type="button" className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/20">
                  查看详情
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 指示器 */}
      <div className="mt-3 flex justify-center gap-1.5">
        {journals.map((_, index) => (
          <button type="button"
            aria-label={`查看日志 ${index + 1}`}
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === currentIndex ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
