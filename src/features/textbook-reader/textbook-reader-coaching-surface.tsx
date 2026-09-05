'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

import { KonlingEntryPointButton } from '@/components/ai/konling-entry-point-button';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useKonlingCompanionReporter } from '@/features/ai/companion/use-konling-companion-reporter';
import { TEXTBOOK_COURSE_ID, type TextbookReaderProjection } from '@/lib/textbook-reader-contracts';
import { STRUCTURED_TEXTBOOK_UNIT_KIND } from '@/lib/textbook-resource-coach/types';

const SELECTION_HINT_MAX = 500;

export function TextbookReaderCoachingSurface({
  projection,
  citationNotice = null,
  children,
}: {
  projection: TextbookReaderProjection;
  citationNotice?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, updatePageContext } = useGlobalAI();
  const canCoach = session?.user?.role === 'STUDENT' || session?.user?.role === 'TEACHER';
  const isStudent = session?.user?.role === 'STUDENT';
  // 控灵主动陪伴布点（Issue #1966）：教材页停顿提醒；flag 关闭时 Hook 静默停用。
  const { reportActivity } = useKonlingCompanionReporter({
    enabled: isStudent,
    pageKind: 'resource-textbook',
    pageRef: projection.unit.id,
    delivery: {
      courseId: TEXTBOOK_COURSE_ID,
      resources: [{
        resourceId: projection.unit.id,
        versionHash: projection.unit.contentHash,
        reason: `《${projection.book.title}》${projection.unit.title}`,
        kind: 'textbook-unit',
        caption: '回到当前单元继续阅读，预计 3 分钟。',
      }],
    },
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const openSnapshotRef = useRef<{ scrollTop: number; unitId: string } | null>(null);
  const userMovedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const [liveFragment, setLiveFragment] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState('');

  const scrollContainer = () => rootRef.current?.querySelector<HTMLElement>('section.min-w-0');

  const recordUserMove = useCallback(() => {
    userMovedRef.current = true;
    if (isStudent) reportActivity();
  }, [isStudent, reportActivity]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setLiveFragment(hash ? decodeURIComponent(hash) : null);
      recordUserMove();
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [recordUserMove]);

  useEffect(() => {
    const onSelection = () => {
      const text = window.getSelection()?.toString().trim() ?? '';
      setSelectionHint(text.slice(0, SELECTION_HINT_MAX));
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  useEffect(() => {
    const section = scrollContainer();
    if (!section) return;
    const onScroll = () => recordUserMove();
    section.addEventListener('scroll', onScroll, { passive: true });
    return () => section.removeEventListener('scroll', onScroll);
  }, [recordUserMove, projection.unit.id]);

  useEffect(() => {
    const section = scrollContainer();
    if (isOpen && !wasOpenRef.current) {
      openSnapshotRef.current = {
        scrollTop: section?.scrollTop ?? 0,
        unitId: projection.unit.id,
      };
      userMovedRef.current = false;
    }
    if (!isOpen && wasOpenRef.current
      && !userMovedRef.current
      && openSnapshotRef.current?.unitId === projection.unit.id
      && section) {
      section.scrollTop = openSnapshotRef.current.scrollTop;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, projection.unit.id]);

  useEffect(() => {
    const stepId = pathname.startsWith('/textbooks/') ? pathname : `/textbooks${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
    updatePageContext({
      courseId: TEXTBOOK_COURSE_ID,
      courseTitle: projection.book.title,
      pageType: 'practice',
      stepId,
      topic: projection.unit.title,
      learningObjectives: [],
      knowledgeType: 'X',
    });
  }, [pathname, projection.book.title, projection.unit.title, updatePageContext]);

  const fragment = liveFragment && projection.fragments.some((item) => item.id === liveFragment)
    ? liveFragment
    : null;

  return (
    <div
      ref={rootRef}
      className="relative"
      data-textbook-coaching-surface="true"
      data-live-unit={projection.unit.id}
      data-live-fragment={fragment ?? ''}
      data-panel-open={isOpen ? 'true' : 'false'}
    >
      {citationNotice ? (
        <div
          role="status"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
          data-textbook-citation-unavailable="true"
        >
          {citationNotice}
        </div>
      ) : null}
      {canCoach ? (
      <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] sm:right-6">
        <KonlingEntryPointButton
          entryPoint={{
            mode: 'resource-coach',
            promptContext: `textbook-unit:${projection.unit.id}`,
            serverContext: {
              resourceKind: STRUCTURED_TEXTBOOK_UNIT_KIND,
              resourceId: projection.unit.id,
              bookId: projection.book.bookId,
              edition: projection.book.edition,
              sourceRevision: projection.book.sourceRevision,
              unitId: projection.unit.id,
              contentHash: projection.unit.contentHash,
              ...(fragment ? { anchorId: fragment } : {}),
              ...(selectionHint ? { selectionHint } : {}),
            },
          }}
          label="对本页提问"
        />
      </div>
      ) : null}
      <div onClick={() => { if (isOpen) recordUserMove(); }}>
        {children}
      </div>
    </div>
  );
}
