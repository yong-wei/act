import { ArrowUpRight, BookOpen } from 'lucide-react';

import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { TextbookReaderLink } from '@/features/textbook-reader/textbook-reader-link';
import { buildTextbookReaderHref } from '@/lib/textbook-reader';

const REVIEW_TARGET = buildTextbookReaderHref({
  bookId: 'hu-shousong-auto-control-8th',
  edition: '第八版',
  unitPath: ['chapter-chapter-01'],
});

export default function UnifiedTextbookReaderReviewPage() {
  return (
    <main className="surface-page">
      <UnifiedTopBar title="统一教材阅读器验收" backHref="/review" backLabel="返回评审入口" />
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <section className="surface-card p-6">
          <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold text-foreground">应用内教材引用入口</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            此入口用于验证应用内软导航打开教材模态、教材内连续导航及一次关闭恢复来源页面。
          </p>
          <TextbookReaderLink
            href={REVIEW_TARGET}
            data-textbook-review-entry="true"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            打开教材来源
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </TextbookReaderLink>
        </section>
      </div>
    </main>
  );
}
