import type { GeneratedCoursewareRecovery } from '@/lib/smart-courseware/classroom-runtime';

export function GeneratedCoursewareRecoveryState({ recovery }: { recovery: GeneratedCoursewareRecovery }) {
  return (
    <main
      data-generated-courseware-recovery={recovery.code}
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 bg-platform-canvas p-8 text-platform-fg-primary"
      role="alert"
    >
      <h1 className="text-2xl font-semibold">互动课件版本需要恢复</h1>
      <p>{recovery.message}</p>
      <p className="text-sm text-platform-fg-muted">课堂编号：{recovery.sessionId}</p>
    </main>
  );
}
