/**
 * 页面AI上下文 Hook
 *
 * 从当前路由和课程配置中提取页面上下文
 */

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PageContext, UserProfile, AIContext, BopppsStage } from '@/types/ai-context';

interface UsePageAIContextOptions {
  courseId?: string;
  courseTitle?: string;
  stepId?: string;
  topic?: string;
  pageType?: PageContext['pageType'];
  learningObjectives?: string[];
  knowledgeType?: 'C' | 'X' | 'D';
  stage?: BopppsStage;
}

export function usePageAIContext(options: UsePageAIContextOptions = {}): {
  pageContext: PageContext;
  userProfile: UserProfile | null;
  aiContext: AIContext | null;
} {
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 构建页面上下文
  const pageContext = useMemo<PageContext>(() => {
    const url = typeof window !== 'undefined' ? window.location.href : pathname || '';

    return {
      courseId: options.courseId || extractCourseIdFromPath(pathname),
      courseTitle: options.courseTitle || getCourseTitleFromId(options.courseId),
      stepId: options.stepId || searchParams?.get('step') || 'default',
      topic: options.topic || '当前学习内容',
      pageType: options.pageType || inferPageTypeFromPath(pathname),
      learningObjectives: options.learningObjectives || [],
      knowledgeType: options.knowledgeType || 'C',
      stage: options.stage,
      url,
    };
  }, [options, pathname, searchParams]);

  // 仅保留认证身份；学习风格与能力事实由服务端受治理画像提供。
  const userProfile = useMemo<UserProfile | null>(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id || 'anonymous',
      name: session.user.name || '同学',
    };
  }, [session]);

  // 组合AI上下文
  const aiContext = useMemo<AIContext | null>(() => {
    if (!userProfile) return null;

    return {
      page: pageContext,
      user: userProfile,
    };
  }, [pageContext, userProfile]);

  return { pageContext, userProfile, aiContext };
}

/**
 * 从路径提取课程ID
 */
function extractCourseIdFromPath(pathname: string | null): string {
  if (!pathname) return 'unknown';

  if (pathname.includes('simulation') || pathname.includes('destroyer')) {
    return 'simulation';
  }
  if (pathname.includes('lesson-02')) {
    return 'lesson-02';
  }

  return 'general';
}

/**
 * 从课程ID获取标题
 */
function getCourseTitleFromId(courseId?: string): string {
  const titles: Record<string, string> = {
    'simulation': '船舶控制仿真',
    'lesson-02': 'BOPPPS教学模块',
  };

  return titles[courseId || ''] || 'AI-OBE学习平台';
}

/**
 * 从路径推断页面类型
 */
function inferPageTypeFromPath(pathname: string | null): PageContext['pageType'] {
  if (!pathname) return 'theory';

  if (pathname.includes('quiz') || pathname.includes('assessment')) {
    return 'quiz';
  }
  if (pathname.includes('practice') || pathname.includes('workspace') || pathname.includes('task')) {
    return 'practice';
  }
  if (pathname.includes('reflection') || pathname.includes('summary')) {
    return 'reflection';
  }
  if (pathname.includes('simulation')) {
    return 'workspace';
  }

  return 'theory';
}

/**
 * 用于课程页面的简化Hook
 */
export function useLessonAIContext(
  courseId: string,
  stepId: string,
  stepTitle: string,
  stepType: PageContext['pageType'],
  learningObjectives?: string[]
): AIContext | null {
  const { data: session } = useSession();
  const pathname = usePathname();

  return useMemo(() => {
    if (!session?.user) return null;

    const pageContext: PageContext = {
      courseId,
      courseTitle: getCourseTitleFromId(courseId),
      stepId,
      topic: stepTitle,
      pageType: stepType,
      learningObjectives: learningObjectives || [],
      knowledgeType: inferKnowledgeType(stepType),
      url: pathname || '',
    };

    const userProfile: UserProfile = {
      id: session.user.id || 'anonymous',
      name: session.user.name || '同学',
    };

    return { page: pageContext, user: userProfile };
  }, [session, courseId, stepId, stepTitle, stepType, learningObjectives, pathname]);
}

/**
 * 推断知识类型
 */
function inferKnowledgeType(pageType: PageContext['pageType']): 'C' | 'X' | 'D' {
  switch (pageType) {
    case 'theory':
      return 'C'; // 概念性
    case 'practice':
    case 'workspace':
      return 'X'; // 程序性
    case 'reflection':
      return 'D'; // 元认知
    default:
      return 'C';
  }
}
