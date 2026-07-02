import Link from 'next/link';
import { RouteOff } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';

export default function NotFound() {
  const state = buildPlatformRecoveryState({
    kind: 'invalid-object-route',
    sourceRoute: '/not-found',
    targetLabel: '平台页面',
    message: '当前链接无法识别或页面已经迁移。',
    recoveryAction: '返回工作台或从主导航重新进入',
  });

  return (
    <main
      className="surface-page flex min-h-screen items-center justify-center px-6 py-12"
      data-platform-route-recovery="global-not-found"
    >
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card/75 p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3 text-sm font-medium text-subtle">
          <RouteOff className="h-5 w-5 text-primary" />
          平台恢复状态
        </div>
        <ActionStatusPanel
          state={state}
          action={(
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="inline-flex rounded-lg border border-border px-3 py-2 text-sm text-primary hover:text-primary/80"
              >
                返回工作台
              </Link>
              <Link
                href="/interactive-learning"
                className="inline-flex rounded-lg border border-border px-3 py-2 text-sm text-primary hover:text-primary/80"
              >
                进入互动学习
              </Link>
            </div>
          )}
        />
      </div>
    </main>
  );
}
