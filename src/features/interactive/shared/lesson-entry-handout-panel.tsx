'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Download, Loader2 } from 'lucide-react';

interface LessonEntryHandoutPanelProps {
  summary: string;
  pdfReady: boolean;
  isDownloading: boolean;
  onOpen: () => void;
  onDownload: () => void;
}

export function LessonEntryHandoutPanel({
  summary,
  pdfReady,
  isDownloading,
  onOpen,
  onDownload,
}: LessonEntryHandoutPanelProps) {
  return (
    <section className="premium-lesson-panel-soft rounded-[24px] border border-border/70 p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
        <div className="flex flex-col items-start gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="premium-lesson-control inline-flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <div className="premium-lesson-kicker">课前讲义</div>
              <h3 className="premium-lesson-title mt-1 text-lg font-semibold">讲义阅读与下载</h3>
            </div>
          </div>
          <span className="premium-lesson-tone-pill premium-tone-cyan shrink-0">
            {pdfReady ? '已备好' : '在线阅读'}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="premium-lesson-action-secondary flex shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            在线阅读讲义
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!pdfReady || isDownloading}
            className="premium-lesson-action-secondary flex shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            下载 PDF 讲义
          </button>
        </div>
        <div className="min-w-0">
          <div className="prose prose-sm max-w-none text-muted-foreground prose-p:my-0 prose-strong:text-foreground prose-ul:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summary}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </section>
  );
}
