'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  L2A_COURSE_SUBTITLE,
  L2A_COURSE_TITLE,
  L2A_ROUTE_SEGMENT,
  L2A_STAGE_COLOR,
  L2A_STAGE_LABEL,
  L2A_STEP_DURATION,
  type L2ALessonStep,
} from '@/lib/l2a-course';

export function L2ACourseHeader({
  steps,
  activeIndex,
  onIndexChange,
  middleNotice,
  rightSlot,
}: {
  steps: L2ALessonStep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  middleNotice?: string;
  rightSlot?: ReactNode;
}) {
  const currentStep = steps[activeIndex];

  return (
    <header className="premium-lesson-topbar">
      <div className="mx-auto max-w-[1280px] px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href={`/interactive-learning/courses/${L2A_ROUTE_SEGMENT}`}
              className="premium-lesson-nav-button shrink-0"
            >
              返回
            </Link>
            <div className="min-w-0">
              <div className="premium-lesson-kicker truncate text-[10px] tracking-[0.24em]">{L2A_COURSE_SUBTITLE}</div>
              <h1 className="truncate text-sm font-semibold text-slate-100 md:text-base">{L2A_COURSE_TITLE}</h1>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 md:block">
            <div className="flex items-center justify-center gap-2">
              <span className={`rounded-full border px-3 py-0.5 text-[11px] ${L2A_STAGE_COLOR[currentStep.stage]}`}>
                {L2A_STAGE_LABEL[currentStep.stage]}
              </span>
              <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-slate-200">
                ⏱ {L2A_STEP_DURATION[currentStep.id]}
              </span>
            </div>
            <div className="premium-lesson-muted mt-0.5 truncate text-center text-[11px] leading-5">
              {middleNotice ?? currentStep.title}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
            <label className="premium-lesson-control inline-flex items-center gap-2">
              <span>环节</span>
              <select
                value={currentStep.id}
                onChange={(event) => {
                  const nextIndex = steps.findIndex((step) => step.id === event.target.value);
                  if (nextIndex >= 0) {
                    onIndexChange(nextIndex);
                  }
                }}
                className="premium-lesson-select"
              >
                {steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}
                className="premium-lesson-control inline-flex items-center disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={activeIndex >= steps.length - 1}
                onClick={() => onIndexChange(Math.min(steps.length - 1, activeIndex + 1))}
                className="premium-lesson-control inline-flex items-center disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-slate-400">
                {activeIndex + 1} / {steps.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
