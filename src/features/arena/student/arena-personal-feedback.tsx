'use client';

import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import {
  buildArenaSubmissionFeedback,
  type ArenaFeedbackMode,
} from './arena-feedback-rules';

export function ArenaPersonalFeedback({
  latest,
  previousSubmissions = [],
  mode,
  officialOnlyMetricIds = [],
}: {
  latest: ArenaSubmissionRecord;
  previousSubmissions?: readonly ArenaSubmissionRecord[];
  mode: ArenaFeedbackMode;
  officialOnlyMetricIds?: readonly string[];
}) {
  const feedback = buildArenaSubmissionFeedback({
    latest,
    previousSubmissions,
    mode,
    officialOnlyMetricIds,
  });

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-sm">
      <div className="flex items-start gap-2">
        {feedback.rankingStatus === 'ranked' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
        )}
        <div>
          <div className="font-medium text-foreground">{feedback.title}</div>
          <div className="mt-1 text-xs leading-5 text-subtle">{feedback.summary}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {feedback.strongestMetric ? (
          <FeedbackMetric label="优势指标" value={`${feedback.strongestMetric.label} ${Math.round(feedback.strongestMetric.satisfaction * 100)}%`} />
        ) : null}
        {feedback.weakestMetric ? (
          <FeedbackMetric label="薄弱指标" value={`${feedback.weakestMetric.label} ${Math.round(feedback.weakestMetric.satisfaction * 100)}%`} />
        ) : null}
      </div>

      <div className="mt-3 rounded-md border border-border/60 bg-background/45 px-3 py-2">
        <div className="text-xs font-medium text-foreground">官方结果解释</div>
        {feedback.protocolVersion ? (
          <div className="mt-1 text-[11px] text-muted-foreground">协议版本：{feedback.protocolVersion}</div>
        ) : null}
        {feedback.scoreComposition.length > 0 ? (
          <div className="mt-2 grid gap-1">
            {feedback.scoreComposition.map((metric) => (
              <div key={metric.metricId} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-subtle">
                  {metric.label}{metric.officialOnly ? '（仅官方评测）' : ''}
                </span>
                <span className="font-medium text-foreground">{Math.round(metric.satisfaction * 100)}%</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-2 grid gap-1 text-[11px] leading-5 text-muted-foreground">
          {feedback.boundaryNotes.map((note) => (
            <span key={note}>{note}</span>
          ))}
          {feedback.officialOnlyMetricNotes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
      </div>

      {feedback.hardConstraintFailures.length > 0 ? (
        <div className="mt-3 grid gap-1">
          {feedback.hardConstraintFailures.map((failure) => (
            <div key={failure} className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-200">
              {failure}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-background/45 px-2 py-2 text-xs text-subtle">
        <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-primary" />
        <span>{feedback.nextStepSuggestion}</span>
      </div>

      {feedback.weakestMetricGuidance ? (
        <div className="mt-2 text-xs text-muted-foreground">{feedback.weakestMetricGuidance}</div>
      ) : null}

      {feedback.privacyNote ? (
        <div className="mt-2 text-xs text-muted-foreground">{feedback.privacyNote}</div>
      ) : null}
    </div>
  );
}

function FeedbackMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/45 px-2 py-1">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}
