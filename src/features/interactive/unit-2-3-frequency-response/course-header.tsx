'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  UNIT_2_3_COURSE_SUBTITLE,
  UNIT_2_3_COURSE_TITLE,
  UNIT_2_3_ROUTE_SEGMENT,
  UNIT_2_3_STAGE_LABEL,
  type UNIT_2_3StepDefinition,
} from '@/lib/unit-2-3-course';

export function UNIT_2_3CourseHeader({
  steps,
  activeIndex,
  onIndexChange,
  middleNotice,
  rightSlot,
}: {
  steps: readonly UNIT_2_3StepDefinition[];
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
            <Link href={`/interactive-learning/courses/${UNIT_2_3_ROUTE_SEGMENT}`} className="premium-lesson-nav-button shrink-0">
              返回
            </Link>
            <div className="min-w-0">
              <div className="premium-lesson-kicker truncate text-[10px] tracking-[0.24em]">{UNIT_2_3_COURSE_SUBTITLE}</div>
              <h1 className="premium-lesson-title truncate text-sm font-semibold md:text-base">{UNIT_2_3_COURSE_TITLE}</h1>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 md:block">
            <div className="flex items-center justify-center gap-2">
              <span className="premium-lesson-tone-pill premium-tone-cyan px-3 py-0.5 text-[11px]">
                {UNIT_2_3_STAGE_LABEL[currentStep.stage]}
              </span>
              <span className="premium-lesson-tone-pill premium-tone-slate px-2.5 py-0.5 text-[11px]">
                ⏱ {currentStep.duration}
              </span>
            </div>
            <div className="premium-lesson-muted mt-0.5 truncate text-center text-[11px] leading-5">
              {middleNotice ?? currentStep.hint}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}

            <label className="premium-lesson-control inline-flex items-center gap-2">
              <span>环节</span>
              <select
                id="unit-2-3-step-select"
                name="lessonStep"
                aria-label="选择课程环节"
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
              <span className="premium-lesson-caption text-xs">
                {activeIndex + 1} / {steps.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
