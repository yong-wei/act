'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';
import { stringField, titleFromModule } from './manifest-payload-fields';
import { persistControlWorkbenchRun } from '@/resources/simulations/persisted-run-client';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { ControlWorkbenchComparisonPanel } from './control-workbench-comparison-panel';
import {
  buildControlWorkbenchComparisonRequests,
  buildControlWorkbenchValidationSnapshot,
  isControlWorkbenchSubmissionReady,
  type ControlWorkbenchComparisonSnapshot,
} from './control-workbench-comparison';
import { computeCapabilityRef } from './compute-capability-ref';
import type { ManifestComputePanelSubmission } from './plugins/plugin-contract';
import {
  buildControlWorkbenchRequestForSubmission,
  buildSharedControlWorkbenchEvidenceDraft,
  controlAnalysisRequestFromPayload,
  controlAnalysisResultFromPayload,
  controlWorkbenchLayoutFromPayload,
  controlWorkbenchSubmissionFieldsComplete,
  controlWorkbenchSubmissionFieldsFromPayload,
  initialControlWorkbenchSubmissionValues,
  stringArrayField,
  tryBeginControlWorkbenchSubmission,
} from './control-workbench-compute-support';

export function SharedControlWorkbenchComputePanel({
  manifest,
  step,
  module,
  onPanelSubmit,
  showFrequencyReadings = true,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void | Promise<void>;
  showFrequencyReadings?: boolean;
}) {
  const capabilityRef = computeCapabilityRef(module.payload);
  const visiblePanelIds = stringArrayField(module.payload, ['visiblePanelIds', 'visible_panel_ids', 'panels']);
  const responseContractId = stringField(module.payload, ['responseContractId', 'response_contract_id', 'responseKind', 'response_kind']);
  const releaseState = stringField(module.payload, ['releaseState', 'release_state']) || 'course-controlled';
  const fallbackState = stringField(module.payload, ['fallbackState', 'fallback_state']) || 'supported';
  const request = controlAnalysisRequestFromPayload(module.payload);
  const fallbackResult = controlAnalysisResultFromPayload(module.payload);
  const layout = controlWorkbenchLayoutFromPayload(module.payload);
  const hidePerformanceMetricsMeta = module.payload.hidePerformanceMetricsMeta === true
    || module.payload.hide_performance_metrics_meta === true;
  const submissionFields = controlWorkbenchSubmissionFieldsFromPayload(module.payload);
  const [submissionValues, setSubmissionValues] = useState<Record<string, string | number | boolean>>(() =>
    initialControlWorkbenchSubmissionValues(module.payload, request),
  );
  const dynamicRequest = useMemo(
    () => buildControlWorkbenchRequestForSubmission(module.payload, submissionValues),
    [module.payload, submissionValues],
  );
  const comparisonRequests = useMemo(
    () => dynamicRequest ? buildControlWorkbenchComparisonRequests({
      baseRequest: dynamicRequest,
      payload: module.payload,
      values: submissionValues,
    }) : [],
    [dynamicRequest, module.payload, submissionValues],
  );
  const dynamicRequestKey = useMemo(() => JSON.stringify(dynamicRequest), [dynamicRequest]);
  const comparisonRequestKey = useMemo(
    () => JSON.stringify(comparisonRequests.map((comparison) => ({ id: comparison.id, request: comparison.request }))),
    [comparisonRequests],
  );
  const [currentResultEntry, setCurrentResultEntry] = useState<{ requestKey: string; result: ControlAnalysisResult | null } | null>(null);
  const [comparisonState, setComparisonState] = useState<{ requestKey: string; snapshots: ControlWorkbenchComparisonSnapshot[]; ready: boolean }>({
    requestKey: '',
    snapshots: [],
    ready: false,
  });
  const [submitPending, setSubmitPending] = useState(false);
  const submitPendingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const handleCurrentResult = useCallback((result: ControlAnalysisResult | null, requestKey: string) => {
    setCurrentResultEntry({ requestKey, result });
  }, []);
  const handleComparisonSnapshots = useCallback((snapshots: ControlWorkbenchComparisonSnapshot[], ready: boolean) => {
    setComparisonState({ requestKey: comparisonRequestKey, snapshots, ready });
  }, [comparisonRequestKey]);
  const currentResult = currentResultEntry?.requestKey === dynamicRequestKey ? currentResultEntry.result : null;
  const comparisonSnapshots = comparisonState.requestKey === comparisonRequestKey ? comparisonState.snapshots : [];
  const comparisonsReady = comparisonRequests.length === 0
    || (comparisonState.requestKey === comparisonRequestKey
      && comparisonState.ready
      && comparisonSnapshots.length === comparisonRequests.length);
  const resultReady = Boolean(currentResult && !currentResult.isFallback);
  const submissionReady = isControlWorkbenchSubmissionReady({
    currentRequestKey: dynamicRequestKey,
    currentResultEntry,
    comparisonRequestKey,
    comparisonState,
    comparisonCount: comparisonRequests.length,
    submitPending,
  });
  const canSubmit = Boolean(
    onPanelSubmit
    && capabilityRef
    && submissionReady
    && controlWorkbenchSubmissionFieldsComplete(submissionFields, submissionValues),
  );
  const currentPanelIds = comparisonRequests.length
    ? visiblePanelIds.filter((panelId) => !['step-response', 'time-domain', 'bode', 'magnitude', 'phase'].includes(panelId))
    : visiblePanelIds;
  const content = {
    text: stringField(module.payload, ['text', 'caption', 'description']),
    bullets: stringArrayField(module.payload, ['bullets', 'items']),
  };
  const bullets = [
    visiblePanelIds.length ? '课程已声明本页需要的分析视图。' : '分析视图由课程配置选择。',
    responseContractId ? '提交会保存当前参数、图形状态和判断。' : '提交方式由课程活动设置提供。',
    fallbackState === 'unsupported' ? '当前状态仅提供替代说明。' : '本次参数探索可用于课后复盘。',
    ...content.bullets,
  ];
  const submitCurrent = async () => {
    if (!onPanelSubmit || !capabilityRef || !canSubmit || !currentResult || !dynamicRequest
      || !tryBeginControlWorkbenchSubmission(submitPendingRef)) return;
    setSubmitPending(true);
    setSubmitError(null);
    const submittedAt = Date.now();
    try {
      const clientRunId = `${step.id}:${module.id}:${submittedAt}`;
      const { simulationRunId } = await persistControlWorkbenchRun({
        clientRunId,
        capabilityId: capabilityRef,
        request: dynamicRequest,
        launchContext: {
          lessonId: manifest.lessonId,
          stepId: step.id,
          moduleId: module.id,
          resourceId: module.id,
        },
      });
      const eventDraft = buildSharedControlWorkbenchEvidenceDraft({
        manifest,
        step,
        module,
        submittedAt,
        submissionValues,
        validationSnapshot: buildControlWorkbenchValidationSnapshot(currentResult),
        comparisonSnapshots,
        derivedResultRefs: [{ kind: 'SimulationRun', id: simulationRunId }],
      });
      if (!eventDraft) return;
      await onPanelSubmit({
        stepId: step.id,
        submittedAt,
        answers: {
          [responseContractId ?? `${module.id}:control-workbench`]: JSON.stringify(eventDraft),
        },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请重试。');
    } finally {
      submitPendingRef.current = false;
      setSubmitPending(false);
    }
  };

  return (
    <section
      className="premium-lesson-panel interactive-courseware-panel"
      data-control-workbench-capability={capabilityRef}
      data-control-workbench-module-id={module.id}
      data-control-workbench-release-state={releaseState}
      data-control-workbench-fallback-state={fallbackState}
    >
      <div className="premium-lesson-panel interactive-courseware-panel">
        <h2 className="interactive-courseware-title-level-2">{titleFromModule(module, step)}</h2>
        <p className="interactive-courseware-body">{content.text || '本页使用控制分析工具观察参数变化、曲线响应和设计判断。'}</p>
        {bullets.length ? (
          <ul className="interactive-courseware-section interactive-courseware-body">
            {bullets.map((bullet) => (
              <li key={bullet} className="ml-5 list-disc">{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {dynamicRequest ? (
        <>
          <ControlFigureWorkspace
            request={dynamicRequest}
            fallbackResult={fallbackResult}
            layout={layout}
            allowedPanelIds={currentPanelIds}
            hidePerformanceMetricsMeta={hidePerformanceMetricsMeta}
            showFrequencyReadings={showFrequencyReadings}
            onResult={handleCurrentResult}
          />
          {comparisonRequests.length ? (
            <ControlWorkbenchComparisonPanel
              comparisons={comparisonRequests}
              showTimeDomain={visiblePanelIds.some((panelId) => ['step-response', 'time-domain'].includes(panelId))}
              showBode={visiblePanelIds.some((panelId) => ['bode', 'magnitude', 'phase'].includes(panelId))}
              onSnapshotsChange={handleComparisonSnapshots}
            />
          ) : null}
          {submissionFields.length > 0 ? (
            <div className="premium-lesson-panel-soft grid gap-3 p-4 sm:grid-cols-2">
              {submissionFields.map((field) => (
                <div key={field.key} className="grid gap-1 interactive-courseware-control">
                  <label
                    className="premium-lesson-muted block"
                    htmlFor={`control-workbench-${module.id}-${field.key}`}
                  >
                    {field.label}
                  </label>
                  {field.input === 'select' || field.input === 'toggle' ? (
                    <select
                      id={`control-workbench-${module.id}-${field.key}`}
                      name={field.key}
                      className="premium-lesson-select w-full"
                      value={String(submissionValues[field.key] ?? '')}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setSubmissionValues((prev) => ({ ...prev, [field.key]: nextValue }));
                      }}
                    >
                      {submissionValues[field.key] === undefined || submissionValues[field.key] === '' ? (
                        <option value="" disabled>请选择</option>
                      ) : null}
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.input === 'slider' ? (
                    <div className="grid gap-2">
                      <output
                        htmlFor={`control-workbench-${module.id}-${field.key}`}
                        className="text-sm font-semibold text-platform-fg-primary"
                        aria-live="polite"
                      >
                        当前值：{String(submissionValues[field.key] ?? field.defaultValue ?? field.min ?? 0)}
                      </output>
                      <input
                        id={`control-workbench-${module.id}-${field.key}`}
                        name={field.key}
                        className="w-full accent-current"
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 0.1}
                        value={Number(submissionValues[field.key] ?? field.defaultValue ?? field.min ?? 0)}
                        onChange={(event) => {
                          const nextValue = Number(event.currentTarget.value);
                          setSubmissionValues((prev) => ({ ...prev, [field.key]: nextValue }));
                        }}
                      />
                      {field.presets?.length ? (
                        <div className="flex flex-wrap gap-2" aria-label={`${field.label}代表点`}>
                          {field.presets.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className="premium-lesson-action-tone interactive-courseware-control px-3 py-1.5 text-xs"
                              onClick={() => setSubmissionValues((prev) => ({ ...prev, [field.key]: preset }))}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <input
                      id={`control-workbench-${module.id}-${field.key}`}
                      name={field.key}
                      className="premium-lesson-input w-full"
                      type={field.input === 'number' ? 'number' : 'text'}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={String(submissionValues[field.key] ?? '')}
                      onChange={(event) => {
                        const rawValue = event.currentTarget.value;
                        const value = field.input === 'number' && rawValue !== '' ? Number(rawValue) : rawValue;
                        setSubmissionValues((prev) => ({ ...prev, [field.key]: value }));
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void submitCurrent()}
            disabled={!canSubmit}
            className="premium-lesson-action-primary interactive-courseware-control px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!onPanelSubmit ? '等待教师发放' : submitPending ? '提交中...' : resultReady && comparisonsReady ? '提交当前观察' : '等待当前计算完成'}
          </button>
          {submitError ? (
            <div className="premium-lesson-tone-block premium-tone-rose mt-3" role="alert">
              {submitError} 当前结果仍保留，可再次提交。
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
