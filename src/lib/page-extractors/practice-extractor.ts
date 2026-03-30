/**
 * 练习页面上下文提取器
 *
 * 实现互动练习页面的上下文提取
 * 适用于当前互动课程中的练习步骤
 */

import type {
  StaticSemanticContext,
  RuntimeStateContext,
  PracticePageState,
  LayeredAIContext,
} from '@/types/ai-context-layered';
import type { PageContextExtractor } from '@/types/page-context-extractor';
import type { PageType } from '@/types/ai-context';
import { getStepAIContext } from '@/lib/course-ai-contexts';

/**
 * 练习运行时状态
 */
export interface PracticeRuntimeState {
  currentTask: string;
  attempts: number;
  lastAnswer?: unknown;
  errorPattern?: string;
  hintsUsed: number;
  completionProgress: number;
  events: Array<{
    type: string;
    target: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }>;
  sessionDuration: number;
  taskHistory: Array<{
    taskId: string;
    completed: boolean;
    attempts: number;
  }>;
}

/**
 * 练习页面上下文提取器
 */
export class PracticeContextExtractor
  implements PageContextExtractor<PracticeRuntimeState>
{
  readonly id = 'practice-extractor';
  readonly pageType: PageType = 'practice';

  private courseId: string = 'default';

  setCourseId(courseId: string): void {
    this.courseId = courseId;
  }

  async extractSemantic(stepId: string): Promise<StaticSemanticContext> {
    const stepConfig = getStepAIContext(this.courseId, stepId);

    return {
      courseMeta: {
        courseId: this.courseId,
        courseTitle: stepConfig?.courseTitle || '互动练习',
        courseDescription: '',
        keyConcepts: stepConfig?.tools || [],
      },
      stepMeta: {
        stepId,
        stepType: 'practice',
        topic: stepConfig?.topic || stepConfig?.courseTitle || '练习步骤',
        learningObjectives: stepConfig?.learningObjectives || [],
        knowledgeType: stepConfig?.knowledgeType || 'X',
      },
      pedagogicalIntent: {
        focus: stepConfig?.systemPromptExtension || '',
        commonMisconceptions: [],
        suggestedScaffolds: [],
      },
      knowledgePoints: [],
    };
  }

  extractRuntime(state: PracticeRuntimeState): RuntimeStateContext {
    const pageState: PracticePageState = {
      type: 'practice',
      currentTask: state.currentTask,
      attempts: state.attempts,
      lastAnswer: state.lastAnswer,
      errorPattern: state.errorPattern,
      hintsUsed: state.hintsUsed,
      completionProgress: state.completionProgress,
    };

    return {
      pageType: 'practice',
      pageState,
      interactionHistory: state.events,
      timestamp: Date.now(),
      sessionDuration: state.sessionDuration,
    };
  }

  getPriorityFields(): string[] {
    return [
      'runtime.pageState.currentTask',
      'static.stepMeta.learningObjectives',
      'runtime.pageState.completionProgress',
      'runtime.pageState.attempts',
      'runtime.pageState.errorPattern',
      'static.pedagogicalIntent.focus',
      'runtime.interactionHistory',
      'static.pedagogicalIntent.commonMisconceptions',
    ];
  }

  serialize(context: LayeredAIContext): string {
    const { static: s, runtime: r } = context;
    const state = r.pageState as PracticePageState;

    const parts: string[] = [
      `【练习主题】${s.stepMeta.topic}`,
      `【学习目标】${s.stepMeta.learningObjectives.join('；')}`,
      `【当前任务】${state.currentTask}`,
      `【完成进度】${(state.completionProgress * 100).toFixed(0)}%`,
    ];

    if (state.attempts > 0) {
      parts.push(`【尝试次数】${state.attempts}次`);
    }

    if (state.errorPattern) {
      parts.push(`【错误模式】${state.errorPattern}`);
    }

    if (state.hintsUsed > 0) {
      parts.push(`【已用提示】${state.hintsUsed}个`);
    }

    if (s.pedagogicalIntent.focus) {
      parts.push(`【教学重点】${s.pedagogicalIntent.focus}`);
    }

    parts.push(
      `【学习时长】${Math.floor(r.sessionDuration / 60)}分钟`
    );

    return parts.join('\n');
  }
}

// 单例实例
export const practiceContextExtractor = new PracticeContextExtractor();
