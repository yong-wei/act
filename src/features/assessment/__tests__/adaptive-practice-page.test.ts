import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPathGenerationGoalHref,
  defaultPathGenerationPanel,
} from '@/features/personalization/path-planning/adaptive-path-generation-panel';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('adaptive practice page entry states', () => {
  it('opens a dedicated diagnosis conversation for the durable submitted answer', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('请控灵解析本题');
    expect(source).toContain("mode: 'diagnosis-explainer'");
    expect(source).not.toContain("durableAnswerId: 'demo-adaptive-answer-generated-live'");
    expect(source).toContain('serverContext: { answerId: feedback.durableAnswerId }');
    expect(source).toContain("promptContext: 'adaptive-attempt'");
    expect(source).toContain("await startAssistantConversation(entryPoint, '请解析本题')");
    expect(source).toContain("feedback.isCorrect ? 'border border-border");
    expect(source).toContain("'bg-primary text-primary-foreground hover:opacity-90'");
    expect(source).toContain('setPathAdvisorAssistantEntryPoint(pathAdvisorEntryPoint)');
    expect(source).toContain('openAssistantEntryPoint(pathAdvisorAssistantEntryPoint)');
    expect(source).toContain('requestedBatchId ? `authorized-candidate-batch:${requestedBatchId}` : null');
    expect(source).toContain('requestedBatchId ? { candidateBatchId: requestedBatchId } : {}');
    expect(source).toContain('解析请求失败，请重试');
    expect(source).not.toContain('serverContext: { question');
  });

  it('offers micro tutoring only for persisted incorrect answers while retaining the diagnosis entry', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("import { StudentMicroTutoringPanel } from '@/features/assessment/student-micro-tutoring-panel';");
    expect(source).toContain('!feedback.isCorrect');
    expect(source).toContain('feedback.durableAnswerId');
    expect(source).toContain('microTutoringEligibility?.qualified');
    expect(source).not.toContain('isMicroTutoringEligible(');
    expect(source).not.toContain('检查节点练习');
    expect(source).toContain('studentMicroTutoringStageLabel(practiceStage)');
    expect(source).toContain('data-adaptive-practice-stage={practiceStage}');
    expect(source).toContain('data-micro-tutoring-unavailable={microTutoringUnavailableReason}');
    expect(source).toContain('data-micro-tutoring-retry-attribution="true"');
    expect(source).toContain("}, [sessionId]);");
    expect(source).toContain('sessionIdRef.current = sessionId');
    expect(source).toContain('if (sessionIdRef.current !== requestedSessionId) return;');
    expect(source).toContain('<StudentMicroTutoringPanel');
    expect(source).toContain('onRequestHint={requestAttemptDiagnosis}');
  });

  it('does not leave unauthenticated homepage entry in an empty loading state', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("import { useSession } from 'next-auth/react';");
    expect(source).toContain("authStatus === 'unauthenticated'");
    expect(source).toContain('请先登录后再进入自适应练习');
    expect(source).toContain('登录后继续');
    expect(source).toContain('/login?callbackUrl=');
  });

  it('shows a retryable question loading fallback instead of only the pending placeholder', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('练习加载未完成');
    expect(source).toContain('重新加载');
    expect(source).toContain('void bootstrapPractice()');
  });

  it('keeps an explicit pathId stable after Konling path updates', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    const refreshBlock = source.slice(
      source.indexOf('const refreshLatestLearningPathAfterKonling = useCallback'),
      source.indexOf('useEffect(() => {', source.indexOf('const refreshLatestLearningPathAfterKonling = useCallback')),
    );

    expect(refreshBlock).toContain('if (activePathId)');
    expect(refreshBlock).toContain('fetchLearningPathRound(activePathId, activeGoal)');
    expect(refreshBlock).toContain("clearLoadedPathContext(loaded.status === 'failed' ? 'failed' : 'missing');");
    expect(refreshBlock.indexOf('if (activePathId)')).toBeLessThan(refreshBlock.indexOf('fetchLatestLearningPathRound(activeGoal)'));
    expect(refreshBlock.indexOf('fetchLearningPathRound(activePathId, activeGoal)')).toBeLessThan(refreshBlock.indexOf('fetchLatestLearningPathRound(activeGoal)'));
    expect(refreshBlock).toContain('}, [activeGoal, activePathId, authStatus, clearLoadedPathContext, isDemoMode, requestedPathContextKey]);');
  });

  it('binds adaptive quiz outcomes into path result cards', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('PathNodeResultCardView');
    expect(source).toContain('readPathNodeResultSummary');
    expect(source).toContain('data-adaptive-path-result-card');
    expect(source).toContain('结果待同步');
    expect(source).toContain('syncAdaptiveAssessmentPathResult');
    expect(source).toContain('adaptiveAssessmentRef');
    expect(source).toContain('durableAnswerId');
    expect(source).toContain("await syncAdaptiveAssessmentPathResult(data)");
  });

  it('syncs submitted checkpoint assessment outcomes back to the learning path', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const syncBlock = source.slice(
      source.indexOf('const syncAdaptiveAssessmentPathResult = useCallback'),
      source.indexOf('const skipPathNode = useCallback', source.indexOf('const syncAdaptiveAssessmentPathResult = useCallback')),
    );

    expect(source).toContain("return type === 'adaptive_quiz' || type === 'checkpoint';");
    expect(source).toContain('return isPathAssessmentResultNode(type) ||');
    expect(syncBlock).toContain('isPathAssessmentResultNode(targetNode.type)');
    expect(syncBlock).toContain('adaptiveAssessmentRef');
    expect(syncBlock).not.toContain("targetNode.type !== 'adaptive_quiz'");
  });

  it('isolates adaptive path workspaces by route intent', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("intentParam === 'path-selection'");
    expect(source).toContain("const requestedIntent = searchParams.get('intent')");
    expect(source).toContain("const workspaceIntent = routeIntent === 'contextual-recommendation'");
    expect(source).toContain("requestedIntent !== null && requestedIntent.trim().length > 0 && routeIntent === 'practice'");
    expect(source).toContain("data-adaptive-path-workspace-intent={workspaceIntent}");
    expect(source).toContain("const showPracticeWorkspace = workspaceIntent === 'practice'");
    expect(source).toContain('const isPresetGoalLanding = showLandingWorkspace && !hasInvalidRequestedGoal && !explicitGoal;');
    expect(source).toContain("const showPresetGoalCards = isPresetGoalLanding && pathLandingState === 'cold-start';");
    expect(source).toContain("canRenderCandidateComparison && !showPathContextRecovery ? (");
    expect(source).toContain("!showPathContextRecovery && (showGenerationWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace) && pathExecutionNodes.length > 0");
    expect(source).toContain("!showPathContextRecovery && (showPracticeWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace)");
    expect(source).toContain("showPracticeWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace ? (");
    expect(source).toContain("showSelectionWorkspace || showEvidenceWorkspace ? (");
    expect(source).toContain('data-adaptive-path-status-region={showSelectionWorkspace ? \'reserved\' : \'inline\'}');
    expect(source).toContain('pathChoiceMessage ? (');
    expect(source).toContain("showEvidenceWorkspace ? (");
    expect(source).toContain('await refreshLatestLearningPathAfterKonling()');
    expect(source).toContain("settlePathGenerationRequest(");
    expect(source).toContain("publishPathGenerationStatus('succeeded', generationRequestId, '学习路径已生成，请比较候选方案。')");
    expect(source).toContain("intent: 'path-execution'");
    expect(source).toContain("optionId: option.optionId");
    expect(source).toContain("const activeOptionId = searchParams.get('optionId')");
    expect(source).toContain("const selectedExecutionOption = useMemo");
    expect(source).toContain("option.optionId === activeOptionId");
    expect(source).toContain("getPathExecutionNodes(activePathPlan, activePathRound, selectedExecutionOption)");
    expect(source).toContain("const pathUpdate = getRecord(payload.pathUpdate)");
    expect(source).toContain("typeof pathUpdate.currentNodeId === 'string'");
    expect(source).toContain("option.activeNodeIds?.[0] ?? option.nodeIds?.[0]");
  });

  it('shows adaptive generation readiness before path generation can fail generically', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const contextRouteSource = readRepoFile('src/app/api/adaptive/path-advisor-context/route.ts');
    const toolRouteSource = readRepoFile('src/app/api/adaptive/path-advisor-tool/route.ts');

    expect(source).toContain('pathGenerationReadiness');
    expect(source).toContain('selectAdaptiveGenerationReadiness');
    expect(source).toContain('const learnerStatePendingReadiness = useMemo');
    expect(source).toContain('Boolean(pathAdvisorContextGoal)');
    expect(source).toContain("learnerStateLoadState !== 'ready'");
    expect(source).toContain("buildAdaptiveGenerationReadiness({ reason: 'retryable', source: 'learner-state' })");
    expect(source).toContain('const authRequiredGenerationReadiness = useMemo');
    expect(source).toContain("authStatus === 'unauthenticated'");
    expect(source).toContain("buildAdaptiveGenerationReadiness({ reason: 'auth-required', source: 'session' })");
    expect(source).toContain('const loginCallbackHref = showGenerationWorkspace');
    expect(source).toContain('? withFeedbackTaskHref(buildPathGenerationGoalHref(activeGoal, pathGenerationPanel))');
    expect(source).toContain(': feedbackGenericPathGenerationHref');
    expect(source).toContain(': activeGoalContextHref');
    expect(source).toContain('const loginHref = `/login?callbackUrl=${encodeURIComponent(loginCallbackHref)}`;');
    expect(source).toContain('if (activeGoal || !pathAdvisorContextGoal || !showGenerationWorkspace || isDemoMode) return;');
    expect(source).toContain('const generationGoal = pathAdvisorContextGoal;');
    expect(source).toContain('fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(generationGoal)}`)');
    expect(source).toContain("const pathGenerationDegradedReadiness = learnerStateReadiness?.status === 'degraded'");
    expect(source).toContain("evidenceReadiness?.status === 'degraded'");
    expect(source).toContain("const canRetryPathGeneration = pathGenerationReadiness.status === 'retryable'");
    expect(source).toContain("pathAdvisorReadiness?.status === 'retryable'");
    expect(source).toContain('!pathGenerationDegradedReadiness');
    expect(source).toContain("pathAdvisorAssistantEntryPoint?.mode === 'path-advisor'");
    expect(source).toContain('Boolean(pathAdvisorAssistantEntryPoint.serverContext.modeContextToken)');
    expect(source).toContain("const hasPathAdvisorModeContext = pathAdvisorAssistantEntryPoint?.mode === 'path-advisor'");
    expect(source).toContain("const canSubmitPathGeneration = (pathGenerationReadiness.status === 'ready' && hasPathAdvisorModeContext) || canRetryPathGeneration;");
    expect(source).toContain("const pathGenerationContextReadiness = pathGenerationReadiness.status === 'ready'");
    expect(source).toContain('!hasPathAdvisorModeContext');
    expect(source).toContain("buildAdaptiveGenerationReadiness({ reason: 'retryable', source: 'path-advisor' })");
    expect(source).toContain('learnerStatePendingReadiness,');
    expect(source).toContain('const pathGenerationDisplayReadiness = pathGenerationContextReadiness ??');
    expect(source).toContain("pathGenerationReadiness.status === 'retryable' && pathGenerationDegradedReadiness");
    expect(source).toContain('learner-state-unavailable');
    expect(source).toContain("pathGenerationDisplayReadiness.studentAction === 'login'");
    expect(source).toContain('登录后继续');
    expect(source).toContain("learnerStateLoadState === 'ready'");
    expect(source).toContain('insufficient-evidence');
    expect(source).toContain('data-adaptive-generation-readiness-status={pathGenerationDisplayReadiness.status}');
    expect(source).toContain('data-adaptive-generation-readiness-reason={pathGenerationDisplayReadiness.reason}');
    expect(source).toContain('data-adaptive-generation-student-action={pathGenerationDisplayReadiness.studentAction}');
    expect(source).toContain('data-adaptive-generation-staff-action={pathGenerationDisplayReadiness.staffAction}');
    expect(source).toContain('data-adaptive-generation-readiness-card={pathGenerationDisplayReadiness.reason}');
    expect(source).toContain('如仍无法继续，请把当前状态转交给教师或管理员处理。');
    expect(source).not.toContain('{pathGenerationReadiness.staffMessage}</p>');
    expect(source).toContain('disabled={pathGenerationPending !== null || hasInvalidRequestedGoal || !canSubmitPathGeneration}');
    expect(source).toContain('setPathChoiceMessage(pathGenerationDisplayReadiness.studentMessage)');
    expect(source).toContain('readAdaptiveGenerationReadiness(payload)');
    expect(source).toContain("fallbackReason: response.status === 401 ? 'auth-required' : 'service-unavailable'");
    expect(contextRouteSource).toContain('missing-class-binding');
    expect(contextRouteSource).toContain('missing-teacher-binding');
    expect(contextRouteSource).toContain('service-unavailable');
    expect(toolRouteSource).toContain('readiness: buildAdaptiveGenerationReadiness');
    expect(toolRouteSource).toContain('adaptiveGenerationReadinessFromHttp');
  });

  it('renders explicit path recovery instead of fake progress for missing path contexts', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('resolveAdaptivePathContextRecoveryState({');
    expect(source).toContain('const [pathContextLoadState, setPathContextLoadState]');
    expect(source).toContain('const [loadedPathContextKey, setLoadedPathContextKey]');
    expect(source).toContain("const requestedPathContextKey = activeGoal");
    expect(source).toContain('loadedPathContextKey === requestedPathContextKey');
    expect(source).toContain('const clearLoadedPathContext = useCallback');
    expect(source).toContain("clearLoadedPathContext(pathLoadFailed ? 'failed' : 'missing');");
    expect(source).toContain('const pathIdsToTry = activePathId');
    expect(source).toContain('? uniquePathIds([activePathId])');
    expect(source).toContain(': uniquePathIds(fallbackPathIds)');
    expect(source).toContain('setActivePathPlan(null);\n        setActivePathRound(null);');
    expect(source).toContain('const showPathContextRecovery = pathContextRecoveryState.shouldRecover;');
    expect(source).toContain('data-adaptive-path-recovery-state={pathContextRecoveryState.reason}');
    expect(source).toContain('data-adaptive-path-recovery-intent={workspaceIntent}');
    expect(source).toContain("data-adaptive-path-recovery-path-id={activePathId ?? 'missing'}");
    expect(source).toContain('暂不展示进度或执行入口');
    expect(source).toContain('路径服务暂时不可用');
    expect(source).toContain('data-adaptive-path-recovery-action="generate-path"');
    expect(source).toContain('data-adaptive-path-recovery-action="review-evidence"');
    expect(source).toContain('data-adaptive-path-recovery-action="return-to-task"');
  });

  it('keeps path loading and failure states separate from the cold-start workspace', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('resolveAdaptivePathLandingState({');
    expect(source).toContain('data-adaptive-path-landing-state="active"');
    expect(source).toContain('data-adaptive-path-action-bar="active"');
    expect(source).toContain('data-adaptive-path-continue-action="current-path"');
    expect(source).toContain('data-adaptive-path-generation-action="new-path"');
    expect(source).toContain('原路径仍会保留；你可以继续学习，也可以生成新的候选路径进行比较。');
    expect(source).toContain("(showLandingWorkspace || showGenerationWorkspace) && pathLandingState === 'active'");
    expect(source).toContain('(showGenerationWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace)');
    expect(source).toContain('showGenerationWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace ? (');
    expect(source).toContain('{showExecutionWorkspace || showRecoveredExecutionWorkspace ? null :');
    expect(source).toContain("const showColdStartLandingWorkspace = showLandingWorkspace && pathLandingState === 'cold-start';");
    expect(source).toContain("from '@/features/personalization/experience/cold-start-collection-panel'");
    expect(source).toContain("from '@/lib/cold-start-evidence-collection'");
    expect(source).toContain('const learnerStateReadyForCollection = isDemoMode || learnerStateLoadState === \'ready\'');
    expect(source).not.toContain('adaptive-path-candidate-batches');
    expect(source).toContain('data-adaptive-path-landing-state="loading"');
    expect(source).toContain('正在加载学习路径');
    expect(source).toContain('data-adaptive-path-landing-state="failed"');
    expect(source).toContain('学习路径暂时无法加载');
    expect(source).toContain('onClick={retryPathContext}');
    expect(source).toContain("setPathContextLoadState(pathLoadFailed ? 'failed' : 'missing');");
  });

  it('preserves the active goal and path when opening a new generation from the active landing', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const activePathGenerationHref = buildPathGenerationGoalHref(
      'frequency-response-foundations',
      defaultPathGenerationPanel,
    );
    const generationQuery = new URLSearchParams(activePathGenerationHref.split('?')[1]);

    expect(generationQuery.get('goal')).toBe('frequency-response-foundations');
    expect(generationQuery.get('intent')).toBe('contextual-recommendation');
    expect(source).toContain('const activePathGenerationHref = useMemo(() => {');
    expect(source).toContain('generationQuery.set(\'pathId\', activeExecutionPathId);');
    expect(source).toContain('href={activePathGenerationHref}');

    const generationBlock = source.slice(
      source.indexOf('const submitPathGeneration = useCallback'),
      source.indexOf('const startPathGenerationFromAdvisor = useCallback'),
    );
    expect(generationBlock).toContain('pathId: operation === \'explain\'');
    expect(generationBlock).toContain('comparisonPathId');
    expect(generationBlock).toContain('operation !== \'generate\' ? currentPathId : undefined');
    expect(generationBlock).toContain('await refreshLatestLearningPathAfterKonling();');
    expect(source).toContain('if (activePathId) {\n      const loaded = await fetchLearningPathRound(activePathId, activeGoal);');
  });

  it('keeps demo path state available for execution and visual QA routes', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    const learnerStateEffectStart = source.indexOf('if (isDemoMode) {\n      setActiveLearnerState(null);');
    const learnerStateEffect = source.slice(
      learnerStateEffectStart,
      source.indexOf("if (authStatus === 'loading')", learnerStateEffectStart),
    );
    const missingGoalBranch = learnerStateEffect.indexOf("if (!activeGoal) {\n      setActiveLearnerState(null);");

    expect(learnerStateEffectStart).toBeGreaterThan(-1);
    expect(learnerStateEffect).toContain("setLearnerStateLoadState('ready');");
    expect(learnerStateEffect).toContain("setPathContextLoadState('ready');");
    expect(learnerStateEffect).toContain('setLoadedPathContextKey(requestedPathContextKey);');
    expect(missingGoalBranch).toBeGreaterThan(-1);
    expect(source).not.toContain('if (!activeGoal || isDemoMode) {\n      setActiveLearnerState(null);');
    expect(learnerStateEffect).not.toContain('if (isDemoMode) {\n      setActivePathPlan(null);');
    expect(learnerStateEffect).not.toContain('if (isDemoMode) {\n      setActivePathRound(null);');
  });

  it('keeps demo execution fixture with an actionable current node for visual QA', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("completedNodeIds: ['demo-foundation-card'],");
    expect(source).not.toContain("completedNodeIds: ['demo-foundation-card', 'demo-current-quiz', 'demo-simulation']");
  });

  it('sends the current assessment session when generating practice questions', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const generateBlock = source.slice(
      source.indexOf('const generateQuestion = async () => {'),
      source.indexOf('if (!response.ok)', source.indexOf("fetch('/api/assessment/generate-question'")),
    );

    expect(generateBlock).toContain("fetch('/api/assessment/generate-question'");
   expect(generateBlock).toContain('sessionId,');
 });

  it('declares a separate pathExecutionError state', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    expect(source).toContain('const [pathExecutionError, setPathExecutionError] = useState<string | null>(null);');
  });

  it('path execution actions use setPathExecutionError not setError', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const activityBlock = source.slice(
      source.indexOf('const writePathNodeActivity = useCallback'),
      source.indexOf('}, [activePathPlan, activePathRound, reloadActiveLearningPath]);') + 1,
    );
    expect(activityBlock).not.toContain('setError(');
    expect(activityBlock).toContain('setPathExecutionError(');
  });

  it('launchPathNodeAction success clears pathExecutionError', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const launchBlock = source.slice(
      source.indexOf('const launchPathNodeAction = useCallback'),
      source.indexOf('}, []);', source.indexOf('const launchPathNodeAction')),
    );
    expect(launchBlock).toContain('setPathExecutionError(null)');
    expect(launchBlock).toContain('publishAdaptivePathJourneyResponse(payload)');
    const clearIndex = launchBlock.indexOf('setPathExecutionError(null)');
    const successIndex = launchBlock.indexOf('publishAdaptivePathJourneyResponse(payload)');
    expect(clearIndex).toBeGreaterThan(successIndex);
  });

  it('current-path module shows pathExecutionError with refresh button', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const moduleBlock = source.slice(
      source.indexOf('moduleId="current-path"'),
      source.indexOf('data-adaptive-path-progress-summary'),
    );
    expect(moduleBlock).toContain('pathExecutionError ?');
    expect(moduleBlock).toContain('data-adaptive-path-execution-error="visible"');
    expect(moduleBlock).toContain('setPathExecutionError(null); void reloadActiveLearningPath()');
  });

  it('loads candidate batches separately from the active learning path', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('const [activeCandidateBatch, setActiveCandidateBatch]');
    expect(source).toContain('fetchCandidateBatch(activeGoal, requestedBatchId, requestedCandidateId)');
    expect(source).toContain('getCandidateBatchPathOptions(activeCandidateBatch)');
    expect(source).not.toContain('setActivePathPlan(loadedBatch');
    expect(source).not.toContain('setActivePathRound(loadedBatch');
  });

  it('synchronizes a generated candidate batch through the app router', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const generationBlock = source.slice(
      source.indexOf('const generatedBatchId = typeof payload.result?.candidateBatch?.id'),
      source.indexOf('await refreshLatestLearningPathAfterKonling()', source.indexOf('const generatedBatchId = typeof payload.result?.candidateBatch?.id')),
    );

    expect(source).toContain("import { useRouter, useSearchParams } from 'next/navigation'");
    expect(source).toContain('const router = useRouter()');
    expect(generationBlock).toContain("setCandidateBatchLoadState('loading')");
    expect(generationBlock).toContain('synchronizedCandidateBatchRef.current = {');
    expect(generationBlock).toContain("nextUrl.searchParams.set('batch', generatedBatchId)");
    expect(generationBlock.indexOf('await fetchCandidateBatch(activeGoal, generatedBatchId)')).toBeLessThan(
      generationBlock.indexOf("nextUrl.searchParams.set('batch', generatedBatchId)"),
    );
    expect(generationBlock.indexOf("setCandidateBatchLoadState('ready')")).toBeLessThan(
      generationBlock.indexOf("nextUrl.searchParams.set('batch', generatedBatchId)"),
    );
    expect(generationBlock).toContain("nextUrl.searchParams.delete('candidate')");
    expect(generationBlock).toContain('router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`, { scroll: false })');
    expect(generationBlock).not.toContain('window.history.replaceState');
  });

  it('invalidates late adjustment batches when source, progress, or editable request inputs change', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const requestVersionBlock = source.slice(
      source.indexOf('const pathAdjustmentRequestVersionKey = useMemo'),
      source.indexOf('const requestedPathContextKey', source.indexOf('const pathAdjustmentRequestVersionKey = useMemo')),
    );
    const submitBlock = source.slice(
      source.indexOf('const submitPathGeneration = useCallback'),
      source.indexOf('const startPathGenerationFromAdvisor', source.indexOf('const submitPathGeneration = useCallback')),
    );
    const fetchIndex = submitBlock.indexOf('const loadedBatch = await fetchCandidateBatch(activeGoal, generatedBatchId)');
    const finalGuardIndex = submitBlock.indexOf('if (!isCurrentAdjustmentRequest()) return;', fetchIndex);
    const installIndex = submitBlock.indexOf('synchronizedCandidateBatchRef.current = {', fetchIndex);

    expect(requestVersionBlock).toContain('timeBudgetMinutes: pathGenerationPanel.timeBudgetMinutes');
    expect(requestVersionBlock).toContain('difficultyRhythm: pathGenerationPanel.difficultyRhythm');
    expect(requestVersionBlock).toContain('resourcePreference: [...pathGenerationPanel.resourcePreference].sort()');
    expect(requestVersionBlock).toContain('checkpointPreference: pathGenerationPanel.checkpointPreference');
    expect(requestVersionBlock).toContain('allowExternalResources: pathGenerationPanel.allowExternalResources');
    expect(requestVersionBlock).toContain('naturalLanguageIntent: pathGenerationPanel.naturalLanguageIntent.trim()');
    expect(requestVersionBlock).toContain("node.status === 'skipped' || node.status === 'blocked'");
    expect(submitBlock).toContain('adjustmentRequestInputVersionKey === pathAdjustmentRequestVersionKeyRef.current');
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(finalGuardIndex).toBeGreaterThan(fetchIndex);
    expect(installIndex).toBeGreaterThan(finalGuardIndex);
    expect(submitBlock.slice(submitBlock.indexOf('if (generatedBatchId && activeGoal)'), fetchIndex))
      .toContain("if (operation !== 'revise')");
  });

  it('reuses the authorized batch after synchronizing its route', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const candidateBatchEffect = source.slice(
      source.indexOf("useEffect(() => {\n    if (!activeGoal || (!isDemoMode && authStatus !== 'authenticated')"),
      source.indexOf("useEffect(() => {\n    if (activeGoal || !pathAdvisorContextGoal", source.indexOf("useEffect(() => {\n    if (!activeGoal || (!isDemoMode && authStatus !== 'authenticated')")),
    );

    expect(candidateBatchEffect).toContain('const synchronizedBatch = synchronizedCandidateBatchRef.current');
    expect(candidateBatchEffect).toContain('synchronizedBatch.batchId === requestedBatchId');
    expect(candidateBatchEffect).toContain('synchronizedBatch.candidateId === requestedCandidateId');
    expect(candidateBatchEffect).toContain('setActiveCandidateBatch(synchronizedBatch.batch)');
    expect(candidateBatchEffect.indexOf('setActiveCandidateBatch(synchronizedBatch.batch)')).toBeLessThan(
      candidateBatchEffect.indexOf('fetchCandidateBatch(activeGoal, requestedBatchId, requestedCandidateId)'),
    );
  });

  it('keeps candidate selection visible while its batch is loading independently', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("const shouldShowCandidateComparison = (showGenerationWorkspace || showSelectionWorkspace) && Boolean(requestedBatchId)");
    expect(source).toContain("const showCandidateBatchRecovery = (shouldShowCandidateComparison || generatedCandidateBatchFailure) &&");
    expect(source).toContain("const canRenderCandidateComparison = (\n    shouldShowCandidateComparison && candidateBatchLoadState === 'ready'\n  ) || (");
    expect(source).toContain("workspaceIntent !== 'generation' && workspaceIntent !== 'selection'");
    expect(source).toContain("requestedBatchId ?? 'batch:none'");
    expect(source).toContain("const hasCandidateBatchContext = shouldShowCandidateComparison");
    expect(source).toContain('data-adaptive-path-candidate-recovery-state={candidateBatchLoadState}');
    expect(source).toContain("candidateBatchLoadState !== 'missing'");
    expect(source).toContain("candidateBatchLoadState !== 'failed'");
    expect(source).toContain('hasLoadedPathContextForRecovery');
    expect(source).toContain('data-adaptive-path-candidate-state="loading"');
    expect(source).toContain('正在加载候选学习路径');
    expect(source).toContain('canRenderCandidateComparison && !showPathContextRecovery');
    expect(source).toContain('data-learning-path-options-layout="route-modules"');
  });

  it('keeps candidate identity fail-closed and writes selections to the source path', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');
    const sidebarSource = readRepoFile('src/components/ai/global-ai-sidebar.tsx');

    expect(source).toContain("requestedCandidateId && !requestedBatchId");
    expect(source).toContain('pathOptions.find((option) => option.optionId === display.id)?.candidateId === focusedCandidateId');
    expect(source).toContain('batchId: option.candidateId ? option.batchId : null');
    expect(source).toContain('candidateId: option.candidateId ?? null');
    expect(source).toContain("? activeCandidateBatch?.sourcePathId");
    expect(source).toContain("compareAllCandidateQuery.delete('candidate')");
    expect(source).toContain('data-learning-path-compare-all');
    expect(sidebarSource).toContain("detail: { mode: 'path-advisor', batchId, candidateId, pathId, source: 'candidate-selection' }");
    expect(sidebarSource).toContain("/choices`");
    expect(source).toContain("setPathChoiceMessage('路径已选中，等待你开始学习。')");
    expect(sidebarSource).not.toContain('/execute');
    expect(source).toContain('(showGenerationWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace)');
  });

  it('renders student-safe event evidence for candidates and persisted active nodes', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('function StudentEvidenceEventList');
    expect(source).toContain('data-adaptive-path-event-evidence');
    expect(source).toContain('references={entry.eventReferences ?? []}');
    expect(source).toContain('references={node.selectionBasis.eventReferences}');
    expect(source).toContain('该项判断尚无可核验的事件级学习记录。');
    expect(source).toContain('该路径生成时尚未记录可核验的事件级依据。');
    expect(source).toContain('isSafeEvidenceActionHref');
    expect(source).not.toContain('reference.sourceId');
  });
});
