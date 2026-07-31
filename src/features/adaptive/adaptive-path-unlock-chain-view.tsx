import Link from 'next/link';
import { ArrowRight, LockKeyhole } from 'lucide-react';

import type { AdaptivePathUnlockChain } from '@/lib/adaptive-path-unlock-chain';

export function AdaptivePathUnlockChainView({ chain }: { chain: AdaptivePathUnlockChain }) {
  return (
    <div
      className="rounded-lg border border-platform-evidence-context/45 bg-platform-evidence-context/10 p-3"
      data-adaptive-path-unlock-chain={chain.canExplain ? 'structured' : 'fallback'}
    >
      <div className="flex items-start gap-2">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-platform-evidence-context" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-platform-evidence-context">锁定原因</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{chain.reason}</p>
        </div>
      </div>
      {chain.missingConditions.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-subtle">缺失条件</p>
          <ul className="mt-2 space-y-2">
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
        </div>
      ) : null}
      {chain.nextAction ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-subtle">下一步</p>
          {chain.nextAction.target ? (
            <Link
              href={chain.nextAction.target}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
            >
              {chain.nextAction.title}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <p className="mt-1 text-sm leading-6 text-foreground">{chain.nextAction.title}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
