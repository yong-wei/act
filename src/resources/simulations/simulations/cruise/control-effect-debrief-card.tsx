import type { CruiseControlEffectDebrief } from './control-effect-debrief';

export function ControlEffectDebriefCard({
  debrief,
}: {
  debrief: CruiseControlEffectDebrief;
}) {
  return (
    <section
      role="region"
      aria-labelledby="control-effect-debrief-title"
      data-testid="control-effect-debrief"
      className="space-y-3 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-3 text-xs text-platform-fg-secondary"
    >
      <h2 id="control-effect-debrief-title" className="text-sm font-semibold text-platform-fg-primary">
        控制效果复盘
      </h2>
      {debrief.status === 'unavailable' ? (
        <p data-testid="control-effect-debrief-unavailable">{debrief.unavailableReason}</p>
      ) : (
        <>
          <section aria-labelledby="control-effect-debrief-facts">
            <h3 id="control-effect-debrief-facts" className="mb-1 font-semibold text-platform-fg-primary">
              本次运行事实
            </h3>
            <ul className="space-y-1">
              {debrief.responseFacts.map((fact) => (
                <li key={fact.metricId} data-testid={`debrief-fact-${fact.metricId}`}>
                  <span className="text-platform-fg-primary">{fact.label}</span>
                  {' · '}
                  {fact.availability === 'available' ? fact.formattedValue : fact.unavailableReason}
                  {' · '}
                  {fact.measurementLabel}
                  <div>{fact.factText}</div>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="control-effect-debrief-control">
            <h3 id="control-effect-debrief-control" className="mb-1 font-semibold text-platform-fg-primary">
              控制量观察
            </h3>
            <ul className="space-y-1">
              {debrief.controlFacts.map((fact) => (
                <li key={fact.metricId} data-testid={`debrief-fact-${fact.metricId}`}>
                  <span className="text-platform-fg-primary">{fact.label}</span>
                  {' · '}
                  {fact.availability === 'available' ? fact.formattedValue : fact.unavailableReason}
                  {' · '}
                  {fact.measurementLabel}
                  <div>{fact.factText}</div>
                </li>
              ))}
            </ul>
            {debrief.controlConstraintNote ? <p>{debrief.controlConstraintNote}</p> : null}
          </section>
          <section aria-labelledby="control-effect-debrief-task">
            <h3 id="control-effect-debrief-task" className="mb-1 font-semibold text-platform-fg-primary">
              任务要求
            </h3>
            {debrief.hasAuthoritativeTask ? (
              <ul className="space-y-1">
                {debrief.thresholds.map((item) => (
                  <li key={item.metricId} data-testid={`debrief-threshold-${item.metricId}`}>
                    <div>{item.outcomeText}</div>
                    <div>{item.comparisonText}</div>
                    <div>来源：{item.provenanceLabel}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="debrief-task-unavailable">{debrief.taskJudgmentUnavailableReason}</p>
            )}
          </section>
          {debrief.nextObservation ? (
            <section aria-labelledby="control-effect-debrief-next">
              <h3 id="control-effect-debrief-next" className="mb-1 font-semibold text-platform-fg-primary">
                下一次可观察方向
              </h3>
              <p>{debrief.nextObservation}</p>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
