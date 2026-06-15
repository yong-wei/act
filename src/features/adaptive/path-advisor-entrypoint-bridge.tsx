'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { useGlobalAI } from '@/components/providers/global-ai-provider';

interface PathAdvisorEntryPointBridgeProps {
  classId: string | null;
  modeContextTokens: Partial<Record<AdaptivePathAdvisorGoalId, string | null>>;
}

type AdaptivePathAdvisorGoalId = 'control-correction' | 'frequency-response-foundations';

const PATH_ADVISOR_GOAL_CONTEXTS: Record<AdaptivePathAdvisorGoalId, {
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
}> = {
  'control-correction': {
    courseTitle: '控制系统校正设计',
    topic: '控制系统校正学习路径',
    learningObjectives: ['基于控制校正学习证据生成、比较和调整学习路径'],
  },
  'frequency-response-foundations': {
    courseTitle: '频率响应基础',
    topic: '频率响应基础学习路径',
    learningObjectives: ['基于频率响应学习证据生成、比较和调整学习路径'],
  },
};

const PATH_ADVISOR_PAGE_CONTEXT_BASE = {
  pageType: 'practice' as const,
  stepId: 'adaptive-path-center',
  knowledgeType: 'C' as const,
  url: '/assessment/adaptive-practice',
};

export function PathAdvisorEntryPointBridge({
  classId,
  modeContextTokens,
}: PathAdvisorEntryPointBridgeProps) {
  const searchParams = useSearchParams();
  const { updatePageContext } = useGlobalAI();
  const requestedGoal = searchParams.get('goal');
  const explicitGoal = isAdaptivePathAdvisorGoalId(requestedGoal) ? requestedGoal : null;
  const modeContextToken = explicitGoal ? modeContextTokens[explicitGoal] ?? null : null;

  useEffect(() => {
    if (!explicitGoal || !classId || !modeContextToken) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }
    const goalContext = PATH_ADVISOR_GOAL_CONTEXTS[explicitGoal];

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
  }, [classId, explicitGoal, modeContextToken, updatePageContext]);

  return null;
}

function isAdaptivePathAdvisorGoalId(value: string | null): value is AdaptivePathAdvisorGoalId {
  return value === 'control-correction' || value === 'frequency-response-foundations';
}
