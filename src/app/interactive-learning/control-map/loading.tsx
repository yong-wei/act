export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-platform-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-platform-border border-t-platform-action-primary" />
        <p className="text-sm text-platform-fg-secondary">加载控制理论地图...</p>
      </div>
    </div>
  );
}
