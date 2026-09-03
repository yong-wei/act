'use client';

/**
 * JournalCarousel - 学习日志轮播（底部区域）
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Award, Trophy, GraduationCap, NotebookPen, Sprout } from 'lucide-react';
import Link from 'next/link';
import type { AiCollectionEnvelope, AiJournalItem } from '../ai-workshop-collections';

interface JournalCarouselProps {
  collection: AiCollectionEnvelope<AiJournalItem>;
}

const entryTypeConfig = {
  ETHICS_DECISION: { icon: FileText, label: '伦理决策', color: 'text-foreground', bg: 'bg-muted' },
  CERTIFICATE: { icon: Award, label: '证书认证', color: 'text-foreground', bg: 'bg-muted' },
  COMPETITION: { icon: Trophy, label: '竞赛成绩', color: 'text-foreground', bg: 'bg-muted' },
  TRAINING: { icon: GraduationCap, label: '培训记录', color: 'text-foreground', bg: 'bg-muted' },
  REFLECTION: { icon: NotebookPen, label: '学习反思', color: 'text-foreground', bg: 'bg-muted' },
  GROWTH: { icon: Sprout, label: '成长档案', color: 'text-foreground', bg: 'bg-muted' },
};

export function JournalCarousel({ collection }: JournalCarouselProps) {
  const journals = collection.items;
  const [currentIndex, setCurrentIndex] = useState(0);

  if (collection.state !== 'available') {
    return (
      <div
        className="border-t border-border bg-card p-4 text-sm text-muted-foreground"
        data-ai-workshop-collection="journals"
        data-ai-workshop-collection-state={collection.state}
        data-ai-workshop-empty="journals"
      >
        {collection.state === 'unavailable'
          ? collection.limitation ?? '学习日志暂时不可用。'
          : '暂无已验证的学习日志记录。'}
        <Link className="mt-3 inline-flex font-medium text-foreground underline" href={collection.action.href} data-ai-workshop-action="journals">
          {collection.action.label}
        </Link>
      </div>
    );
  }

  const activeIndex = Math.min(currentIndex, journals.length - 1);

  return (
    <div
      className="border-t border-border bg-card p-4"
      data-ai-workshop-collection="journals"
      data-ai-workshop-collection-state={collection.state}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          思政学习日志
        </h3>
        <div className="flex items-center gap-2">
          <button type="button"
            aria-label="上一条日志"
            onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : journals.length - 1))}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {activeIndex + 1} / {collection.total ?? journals.length}
          </span>
          <button type="button"
            aria-label="下一条日志"
            onClick={() => setCurrentIndex((prev) => (prev < journals.length - 1 ? prev + 1 : 0))}
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
          const isActive = index === activeIndex;

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
                    {journal.grade ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                        评级：{journal.grade}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{journal.content}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(journal.createdAt).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {' · '}来源：{journal.sourceLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 指示器 */}
      <div className="mt-3 flex justify-center gap-1.5">
        {journals.map((journal, index) => (
          <button type="button"
            aria-label={`查看日志 ${index + 1}`}
            key={journal.id}
            onClick={() => setCurrentIndex(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
