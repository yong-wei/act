export default function KnowledgeLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-platform-canvas text-platform-fg-primary">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-platform-border border-t-platform-action-primary" />
        <div className="text-lg text-platform-fg-primary">正在加载知识图谱系统...</div>
        <div className="mt-2 text-sm text-platform-fg-secondary">初始化图谱场景和节点数据</div>
      </div>
    </div>
  );
}
