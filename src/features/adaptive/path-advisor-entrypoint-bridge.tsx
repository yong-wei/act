'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { useGlobalAI } from '@/components/providers/global-ai-provider';

interface PathAdvisorEntryPointBridgeProps {
  classId: string | null;
  modeContextToken: string | null;
}

const PATH_ADVISOR_PAGE_CONTEXT = {
  courseId: 'control-correction',
  courseTitle: '自适应学习路径',
  pageType: 'practice' as const,
  stepId: 'adaptive-path-center',
  topic: '自适应学习路径中心',
  learningObjectives: ['基于当前证据生成、比较和调整学习路径'],
  knowledgeType: 'C' as const,
  url: '/assessment/adaptive-practice',
};

export function PathAdvisorEntryPointBridge({
  classId,
  modeContextToken,
}: PathAdvisorEntryPointBridgeProps) {
  const searchParams = useSearchParams();
  const { updatePageContext } = useGlobalAI();
  const explicitControlCorrectionGoal = searchParams.get('goal') === 'control-correction';

  useEffect(() => {
    if (!explicitControlCorrectionGoal || !classId || !modeContextToken) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }

    updatePageContext({
      ...PATH_ADVISOR_PAGE_CONTEXT,
      assistantEntryPoint: {
        mode: 'path-advisor',
        promptContext: 'student-path-center:control-correction:adaptive-path-center',
        serverContext: {
          classId,
          courseId: PATH_ADVISOR_PAGE_CONTEXT.courseId,
          pageId: PATH_ADVISOR_PAGE_CONTEXT.stepId,
          modeContextToken,
        },
      },
    });
    return () => updatePageContext({ assistantEntryPoint: null });
  }, [classId, explicitControlCorrectionGoal, modeContextToken, updatePageContext]);

  return null;
}
