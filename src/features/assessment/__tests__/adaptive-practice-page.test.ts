import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('adaptive practice page entry states', () => {
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
    expect(source).toContain('const showPresetGoalCards = showLandingWorkspace && !hasInvalidRequestedGoal && !explicitGoal;');
    expect(source).toContain("showSelectionWorkspace && !showPathContextRecovery ? (");
    expect(source).toContain("!showPathContextRecovery && (showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace) && pathExecutionNodes.length > 0");
    expect(source).toContain("!showPathContextRecovery && (showPracticeWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace)");
    expect(source).toContain("showPracticeWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace ? (");
    expect(source).toContain("showSelectionWorkspace || showEvidenceWorkspace ? (");
    expect(source).toContain("pathChoiceMessage && (showGenerationWorkspace || showSelectionWorkspace)");
    expect(source).toContain("showEvidenceWorkspace ? (");
    expect(source).toContain("intent: 'path-selection'");
    expect(source).toContain('const generatedPathId = typeof payload.result?.pathId ===');
    expect(source).toContain("if (generatedPathId) selectionQuery.set('pathId', generatedPathId)");
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
    expect(source).toContain('if (activeGoal || !pathAdvisorContextGoal || !showGenerationWorkspace || isDemoMode) return;');
    expect(source).toContain('const generationGoal = pathAdvisorContextGoal;');
    expect(source).toContain('fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(generationGoal)}`)');
    expect(source).toContain("const pathGenerationDegradedReadiness = learnerStateReadiness?.status === 'degraded'");
    expect(source).toContain("evidenceReadiness?.status === 'degraded'");
    expect(source).toContain("const canRetryPathGeneration = pathGenerationReadiness.status === 'retryable'");
    expect(source).toContain("pathAdvisorReadiness?.status === 'retryable'");
    expect(source).toContain('!pathGenerationDegradedReadiness');
    expect(source).toContain("assistantEntryPoint?.mode === 'path-advisor'");
    expect(source).toContain('Boolean(assistantEntryPoint.serverContext.modeContextToken)');
    expect(source).toContain("const hasPathAdvisorModeContext = assistantEntryPoint?.mode === 'path-advisor'");
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

  it('keeps demo path state available for execution and visual QA routes', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    const learnerStateEffectStart = source.indexOf("if (!activeGoal) {\n      setActiveLearnerState(null);");
    const learnerStateEffect = source.slice(
      learnerStateEffectStart,
      source.indexOf("if (authStatus === 'loading')", learnerStateEffectStart),
    );

    expect(learnerStateEffectStart).toBeGreaterThan(-1);
    expect(learnerStateEffect).toContain('if (isDemoMode) {\n      setActiveLearnerState(null);');
    expect(learnerStateEffect).toContain("setLearnerStateLoadState('ready');");
    expect(learnerStateEffect).toContain("setPathContextLoadState('ready');");
    expect(learnerStateEffect).toContain('setLoadedPathContextKey(requestedPathContextKey);');
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
});
