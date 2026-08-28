import type { PersonalizedPathEffectEvaluation } from '@/lib/personalized-path-effect-evaluation';

const COHORT_LABELS = {
  personalized: '高置信个性化',
  baseline: '同目标基准路径',
  insufficient: '证据不足样本',
} as const;

function formatRate(value: number | null) {
  return value === null ? '数据不足' : `${Math.round(value * 1000) / 10}%`;
}

export function PersonalizedPathEffectPanel({
  evaluation,
}: {
  evaluation: PersonalizedPathEffectEvaluation | null;
}) {
  if (!evaluation) {
    return (
      <section className="mb-8 rounded-xl border border-border/70 bg-card p-6" data-personalized-path-effect-panel="empty">
        <h2 className="text-lg font-semibold text-foreground">个性化路径效果评估</h2>
        <p className="mt-2 text-sm text-subtle">当前班级还没有可读取的路径效果评估。既有路径执行和掌握度记录仍可继续查看。</p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-xl border border-border/70 bg-card p-6" data-personalized-path-effect-panel="ready">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">个性化路径效果评估</h2>
          <p className="mt-1 text-sm text-subtle">
            目标 {evaluation.goalId} · 只读快照评估 · {evaluation.conclusion === 'insufficient-data' ? '数据不足，不给出提升结论' : '观察性对照，不是最佳路径排名'}
          </p>
        </div>
        <p className="text-xs text-subtle">最小对照样本 {evaluation.minSampleSize} 人</p>
      </div>
      {evaluation.limitations.length > 0 ? (
        <ul className="mb-4 space-y-1 text-sm text-amber-700 dark:text-amber-300">
          {evaluation.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {evaluation.cohorts.map((cohort) => (
          <article key={cohort.id} className="rounded-lg border border-border/60 bg-muted/30 p-4" data-path-effect-cohort={cohort.id}>
            <h3 className="text-sm font-semibold text-foreground">{COHORT_LABELS[cohort.id]}</h3>
            <p className="mt-1 text-xs text-subtle">样本 {cohort.sampleSize}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {cohort.metrics.map((metric) => (
                <div key={metric.id} className="flex items-center justify-between gap-3">
                  <dt className="text-subtle">{metric.label}</dt>
                  <dd className="font-medium text-foreground">
                    {metric.id === 'competencyLift'
                      ? (metric.value === null ? '数据不足' : metric.value.toFixed(2))
                      : formatRate(metric.value)}
                    <span className="ml-2 text-xs font-normal text-subtle">{metric.numerator}/{metric.denominator}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
