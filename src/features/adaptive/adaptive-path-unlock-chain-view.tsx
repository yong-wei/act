import { ArrowRight, LockKeyhole } from 'lucide-react';

import type { AdaptivePathUnlockChain } from '@/lib/adaptive-path-unlock-chain';

export interface AdaptivePathUnlockProjectedAction {
  nodeId: string | null;
  href: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  redirectHref?: string;
}

export function resolveAdaptivePathUnlockChainAction<T extends AdaptivePathUnlockProjectedAction>(
  chain: AdaptivePathUnlockChain | undefined,
  projectedAction: T | null | undefined,
): T | null {
  const chainNodeId = chain?.nextAction?.nodeId;
  if (!chainNodeId || !projectedAction || projectedAction.nodeId !== chainNodeId) return null;
  if (!projectedAction.href.trim()) return null;
  if (projectedAction.method === 'POST' && (
    !projectedAction.body || !isSafeProjectedRedirect(projectedAction.redirectHref)
  )) return null;
  return projectedAction;
}

function isSafeProjectedRedirect(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

type AdaptivePathUnlockChainViewProps = {
  chain: AdaptivePathUnlockChain;
  estimatedTimeMinutes?: number | null;
  onAction?: (nodeId: string) => void;
};

export function AdaptivePathUnlockChainView({
  chain,
  estimatedTimeMinutes = null,
  onAction,
}: AdaptivePathUnlockChainViewProps) {
  const actionNodeId = chain.nextAction?.nodeId;
  const canStartAction = Boolean(actionNodeId && onAction);

  return (
    <div
      className="rounded-lg border border-platform-evidence-context/45 bg-platform-evidence-context/10 p-3"
      data-adaptive-path-unlock-chain={chain.canExplain ? 'structured' : 'fallback'}
    >
      <div className="flex items-start gap-2">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-platform-evidence-context" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-platform-evidence-context">暂不能进入该任务</p>
          {chain.missingConditions.length > 0 ? (
            <p className="mt-1 text-sm leading-6 text-foreground">需要先完成：</p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-foreground">{chain.fallbackMessage ?? chain.reason}</p>
          )}
        </div>
      </div>
      {chain.missingConditions.length > 0 ? (
        <div className="mt-3">
          <ul className="space-y-2">
            {chain.missingConditions.map((condition) => (
              <li key={condition.id} className="rounded-lg border border-border bg-background/60 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{condition.title}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
                  {condition.current ? <span>当前：{condition.current}</span> : null}
                  {condition.required ? <span>要求：{condition.required}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          {typeof estimatedTimeMinutes === 'number' && estimatedTimeMinutes > 0 ? (
            <p className="mt-2 text-xs leading-5 text-subtle">
              预计耗时：约 {estimatedTimeMinutes} 分钟
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-foreground">
            完成后：系统将自动解锁该任务。
          </p>
        </div>
      ) : null}
      {chain.nextAction ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-subtle">下一步</p>
          {canStartAction ? (
            <button
              type="button"
              data-adaptive-path-unlock-action="governed"
              onClick={() => {
                if (actionNodeId) onAction?.(actionNodeId);
              }}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
            >
              去完成前置任务
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          ) : (
            <p className="mt-1 text-sm leading-6 text-foreground">{chain.nextAction.title}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
