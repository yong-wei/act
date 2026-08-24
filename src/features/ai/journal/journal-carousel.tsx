'use client';

/**
 * JournalCarousel - 学习日志轮播（底部区域）
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Award, Trophy, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import type { JournalEntryData } from '../personal-learning-center';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';

interface JournalCarouselProps {
  journals: JournalEntryData[];
  evidence: AiWorkshopEvidenceProjection;
}

const entryTypeConfig = {
  ETHICS_DECISION: { icon: FileText, label: '伦理决策', color: 'text-foreground', bg: 'bg-muted' },
  CERTIFICATE: { icon: Award, label: '证书认证', color: 'text-foreground', bg: 'bg-muted' },
  COMPETITION: { icon: Trophy, label: '竞赛成绩', color: 'text-foreground', bg: 'bg-muted' },
  TRAINING: { icon: GraduationCap, label: '培训记录', color: 'text-foreground', bg: 'bg-muted' },
};

export function JournalCarousel({ journals, evidence }: JournalCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : journals.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < journals.length - 1 ? prev + 1 : 0));
  };

  if (journals.length === 0) {
    return (
      <div className="border-t border-border bg-card p-4 text-sm text-muted-foreground" data-ai-workshop-empty="journals">
        {evidence.status === 'unavailable' ? '学习日志暂时不可用。' : '暂无已验证的学习日志记录。'}
        <Link className="mt-3 inline-flex font-medium text-foreground underline" href="/ai/copilot" data-ai-workshop-action="journals">
          记录学习反思
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          思政学习日志
        </h3>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={handlePrev}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {journals.length}
          </span>
          <button type="button"
            onClick={handleNext}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  ? 'w-full border-border bg-background'
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
                    <span className="font-medium text-foreground">{journal.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    {journal.grade && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                        评级：{journal.grade}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{journal.content}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {journal.createdAt.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                {/* 操作按钮 */}
                <button type="button" className="rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent">
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
              index === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
