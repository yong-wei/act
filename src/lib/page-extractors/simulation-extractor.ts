/**
 * 仿真页面上下文提取器
 *
 * 实现船舶控制仿真页面的上下文提取
 * 捕获PID参数、响应指标、操作历史等运行时状态
 */

import type {
  StaticSemanticContext,
  RuntimeStateContext,
  SimulationPageState,
  LayeredAIContext,
} from '@/types/ai-context-layered';
import type { PageContextExtractor } from '@/types/page-context-extractor';
import type { PageType } from '@/types/ai-context';
import { getStepAIContext } from '@/lib/course-ai-contexts';

/**
 * 仿真运行时状态（来自Zustand store或组件状态）
 */
export interface SimulationRuntimeState {
  pidParams: {
    kp: number;
    ki: number;
    kd: number;
  };
  waveParams: {
    height: number;
    period: number;
  };
  metrics: {
    overshoot?: number;
    settlingTime?: number;
    riseTime?: number;
    steadyStateError?: number;
  };
  paramHistory: Array<{
    param: string;
    from: number;
    to: number;
    timestamp: number;
  }>;
  activeView?: string;
  events: Array<{
    type: string;
    target: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }>;
  sessionDuration: number;
}

/**
 * 仿真页面上下文提取器
 */
export class SimulationContextExtractor
  implements PageContextExtractor<SimulationRuntimeState>
{
  readonly id = 'simulation-extractor';
  readonly pageType: PageType = 'workspace';

  async extractSemantic(stepId: string): Promise<StaticSemanticContext> {
    // 从课程配置中读取静态信息
    const stepConfig = getStepAIContext('simulation', stepId);

    return {
      courseMeta: {
        courseId: 'simulation',
        courseTitle: '船舶控制仿真',
        courseDescription: 'Nomoto船舶模型与PID控制仿真',
        keyConcepts: ['PID控制', 'Nomoto模型', '超调量', '调节时间'],
      },
      stepMeta: {
        stepId,
        stepType: 'workspace',
        topic: stepConfig?.topic || '船舶控制仿真',
        learningObjectives: stepConfig?.learningObjectives || [],
        knowledgeType: 'X',
      },
      pedagogicalIntent: {
        focus: stepConfig?.systemPromptExtension || '',
        commonMisconceptions: ['PID参数越大越好', '积分项总是有益的'],
        suggestedScaffolds: ['先调P再调I', '观察响应曲线形状'],
      },
      knowledgePoints: [],
    };
  }

  extractRuntime(state: SimulationRuntimeState): RuntimeStateContext {
    const pageState: SimulationPageState = {
      type: 'simulation',
      parameters: {
        kp: state.pidParams.kp,
        ki: state.pidParams.ki,
        kd: state.pidParams.kd,
        waveHeight: state.waveParams.height,
      },
      observedMetrics: {
        overshoot: state.metrics.overshoot ?? 0,
        settlingTime: state.metrics.settlingTime ?? 0,
        riseTime: state.metrics.riseTime ?? 0,
        steadyStateError: state.metrics.steadyStateError ?? 0,
      },
      manipulationHistory: state.paramHistory,
      selectedView: state.activeView,
    };

    return {
      pageType: 'workspace',
      pageState,
      interactionHistory: state.events,
      timestamp: Date.now(),
      sessionDuration: state.sessionDuration,
    };
  }

  getPriorityFields(): string[] {
    // 优先级排序：核心参数 > 观察指标 > 操作历史 > 教学意图
    return [
      'runtime.pageState.parameters',
      'runtime.pageState.observedMetrics',
      'static.pedagogicalIntent.focus',
      'static.stepMeta.learningObjectives',
      'runtime.pageState.manipulationHistory',
      'static.pedagogicalIntent.commonMisconceptions',
      'runtime.interactionHistory',
      'static.pedagogicalIntent.suggestedScaffolds',
    ];
  }

  serialize(context: LayeredAIContext): string {
    const { static: s, runtime: r } = context;
    const state = r.pageState as SimulationPageState;

    const parts: string[] = [
      `【仿真场景】${s.stepMeta.topic}`,
      `【学习目标】${s.stepMeta.learningObjectives.join('；')}`,
      `【当前参数】Kp=${state.parameters.kp?.toFixed(2) ?? 'N/A'}, Ki=${state.parameters.ki?.toFixed(2) ?? 'N/A'}, Kd=${state.parameters.kd?.toFixed(2) ?? 'N/A'}`,
    ];

    // 添加观察指标（如果有）
    const metrics = state.observedMetrics;
    const metricStrs: string[] = [];
    if (metrics.overshoot !== undefined && metrics.overshoot > 0) {
      metricStrs.push(`超调量=${metrics.overshoot.toFixed(1)}%`);
    }
    if (metrics.settlingTime !== undefined && metrics.settlingTime > 0) {
      metricStrs.push(`调节时间=${metrics.settlingTime.toFixed(1)}s`);
    }
    if (metrics.riseTime !== undefined && metrics.riseTime > 0) {
      metricStrs.push(`上升时间=${metrics.riseTime.toFixed(1)}s`);
    }

    if (metricStrs.length > 0) {
      parts.push(`【观察指标】${metricStrs.join(', ')}`);
    }

    // 添加教学重点
    if (s.pedagogicalIntent.focus) {
      parts.push(`【教学重点】${s.pedagogicalIntent.focus}`);
    }

    // 添加学生操作统计
    parts.push(
      `【学生操作】已尝试${r.interactionHistory.length}次参数调整，持续${Math.floor(r.sessionDuration / 60)}分钟`
    );

    // 添加常见误区提示（如果参数调整次数较多）
    if (r.interactionHistory.length > 5 && s.pedagogicalIntent.commonMisconceptions.length > 0) {
      parts.push(`【常见误区】${s.pedagogicalIntent.commonMisconceptions.join('；')}`);
    }

    return parts.join('\n');
  }
}

// 单例实例
export const simulationContextExtractor = new SimulationContextExtractor();
