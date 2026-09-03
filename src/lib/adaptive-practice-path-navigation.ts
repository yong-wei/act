import { isAdaptivePracticeGoalId } from '@/features/personalization/path-planning/adaptive-path-goal-options';

/**
 * 服务端路径任务导航的唯一构造口径（#1910）：
 * 编码 goal（仅服务端确认且属于合法自适应练习目标时）、pathId、nodeId 与
 * path-execution 意图。目标页按 path.goalId === goalId 校验恢复上下文，
 * 因此合法 goalId 不编码会导致执行恢复退化为 missing。
 */
export function buildAdaptivePracticePathExecutionHref(input: {
  goalId?: string | null;
  pathId: string;
  nodeId: string;
}): string {
  const params = new URLSearchParams();
  if (input.goalId && isAdaptivePracticeGoalId(input.goalId)) {
    params.set('goal', input.goalId);
  }
  params.set('pathId', input.pathId);
  params.set('nodeId', input.nodeId);
  params.set('intent', 'path-execution');
  return `/assessment/adaptive-practice?${params.toString()}`;
}
