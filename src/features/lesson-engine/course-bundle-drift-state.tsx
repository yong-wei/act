import { AppShell, PlatformSurface } from '@/components/platform/app-shell';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export function CourseBundleDriftState({
  code,
  sessionId,
  viewerRole = 'student',
}: {
  code: string;
  sessionId: string;
  viewerRole?: PlatformRole;
}) {
  return (
    <AppShell
      viewerRole={viewerRole}
      title="课堂内容完整性校验失败"
      subtitle="绑定课程与开课捕获版本不一致"
      activeHref="/interactive-learning"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '互动课', href: '/interactive-learning' },
        { label: '课堂完整性' },
      ]}
    >
      <PlatformSurface>
        <main
          data-course-bundle-drift={code}
          className="mx-auto flex min-h-[52vh] max-w-2xl flex-col justify-center gap-4 p-8 text-platform-fg-primary"
          role="alert"
        >
          <h1 className="text-2xl font-semibold">课堂内容完整性校验失败</h1>
          <p>该课堂绑定的课程内容与开课时捕获的版本不一致，为避免课堂内容错版，已停止渲染。请联系教师重新开课或稍后重试。</p>
          <p className="text-sm text-platform-fg-muted">课堂编号：{sessionId}</p>
        </main>
      </PlatformSurface>
    </AppShell>
  );
}
