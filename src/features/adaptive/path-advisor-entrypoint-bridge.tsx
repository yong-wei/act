'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import {
  getAdaptivePracticeGoalOption,
  isAdaptivePracticeGoalId,
  type AdaptivePathAdvisorGoalContext,
} from '@/lib/adaptive-path-goal-options';

interface PathAdvisorEntryPointBridgeProps {
  classId: string | null;
  modeContextTokens: Partial<Record<string, string | null>>;
  goalContexts: Partial<Record<string, AdaptivePathAdvisorGoalContext>>;
}

const PATH_ADVISOR_PAGE_CONTEXT_BASE = {
  pageType: 'practice' as const,
  stepId: 'adaptive-path-center',
  knowledgeType: 'C' as const,
  url: '/assessment/adaptive-practice',
};

export function PathAdvisorEntryPointBridge({
  classId,
  goalContexts,
  modeContextTokens,
}: PathAdvisorEntryPointBridgeProps) {
  const searchParams = useSearchParams();
  const { updatePageContext } = useGlobalAI();
  const requestedGoal = searchParams.get('goal');
  const activeGraphNodeId = searchParams.get('graphNodeId');
  const explicitGoal = isAdaptivePracticeGoalId(requestedGoal) ? requestedGoal : null;
  const modeContextToken = explicitGoal ? modeContextTokens[explicitGoal] ?? null : null;

  useEffect(() => {
    if (activeGraphNodeId) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }
    if (!explicitGoal || !classId || !modeContextToken) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }
    const goalContext = goalContexts[explicitGoal] ?? getAdaptivePracticeGoalOption(explicitGoal)?.konlingContext;
    if (!goalContext) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }

    updatePageContext({
      ...PATH_ADVISOR_PAGE_CONTEXT_BASE,
      courseId: explicitGoal,
      courseTitle: goalContext.courseTitle,
      topic: goalContext.topic,
      learningObjectives: goalContext.learningObjectives,
      assistantEntryPoint: {
        mode: 'path-advisor',
        promptContext: `student-path-center:${explicitGoal}:adaptive-path-center`,
        serverContext: {
          classId,
          courseId: explicitGoal,
          goalId: explicitGoal,
          pageId: PATH_ADVISOR_PAGE_CONTEXT_BASE.stepId,
          modeContextToken,
        },
      },
    });
    return () => updatePageContext({ assistantEntryPoint: null });
  }, [activeGraphNodeId, classId, explicitGoal, goalContexts, modeContextToken, updatePageContext]);

  return null;
}
