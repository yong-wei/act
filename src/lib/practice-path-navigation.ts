import { isAdaptivePracticeGoalId } from '@/features/personalization/path-planning/adaptive-path-goal-options';

/**
 * 服务端路径任务导航的唯一构造口径（#1910）：
 * 编码 goal（仅服务端确认且属于合法自适应练习目标时）、pathId、nodeId 与
 * path-execution 意图。目标页按 path.goalId === goalId 校验恢复上下文，
 * goal 无效时返回 null，由调用方不投影该任务并退回诚实的不可用/恢复语义。
 */
export function buildAdaptivePracticePathExecutionHref(input: {
  goalId: string | null | undefined;
  pathId: string;
  nodeId: string;
}): string | null {
  if (!isAdaptivePracticeGoalId(input.goalId)) return null;
  const params = new URLSearchParams();
  params.set('goal', input.goalId);
  params.set('pathId', input.pathId);
  params.set('nodeId', input.nodeId);
  params.set('intent', 'path-execution');
  return `/assessment/adaptive-practice?${params.toString()}`;
}
