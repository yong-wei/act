export function CourseBundleDriftState({ code, sessionId }: { code: string; sessionId: string }) {
  return (
    <main
      data-course-bundle-drift={code}
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 bg-platform-canvas p-8 text-platform-fg-primary"
      role="alert"
    >
      <h1 className="text-2xl font-semibold">课堂内容完整性校验失败</h1>
      <p>该课堂绑定的课程内容与开课时捕获的版本不一致，为避免课堂内容错版，已停止渲染。请联系教师重新开课或稍后重试。</p>
      <p className="text-sm text-platform-fg-muted">课堂编号：{sessionId}</p>
    </main>
  );
}
