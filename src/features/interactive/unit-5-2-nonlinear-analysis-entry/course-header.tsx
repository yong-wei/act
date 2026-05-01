'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

import {
  UNIT_5_2_COURSE_TITLE,
  UNIT_5_2_STAGE_LABEL,
  type UNIT_5_2StageCode,
} from '@/lib/unit-5-2-course';

export function UNIT_5_2CourseHeader({
  stage,
  currentStepLabel,
  sessionCode,
  rightSlot,
}: {
  stage: UNIT_5_2StageCode;
  currentStepLabel: string;
  sessionCode?: string | null;
  rightSlot?: ReactNode;
}) {
  return (
    <header className="premium-lesson-topbar">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <Link href="/interactive-learning/courses" className="premium-lesson-nav-button mb-2 inline-flex items-center gap-1 px-2 py-1">
            <ChevronLeft className="h-3.5 w-3.5" />
            课程总览
          </Link>
          <div className="premium-lesson-kicker">{UNIT_5_2_STAGE_LABEL[stage]} · {currentStepLabel}</div>
          <h1 className="premium-lesson-title truncate text-base font-semibold sm:text-lg">{UNIT_5_2_COURSE_TITLE}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sessionCode ? <span className="premium-lesson-tone-pill premium-tone-cyan px-3 py-1 text-xs">课堂码 {sessionCode}</span> : null}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
