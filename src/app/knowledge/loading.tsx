export default function KnowledgeLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#020721]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
        <div className="text-lg text-blue-400">正在加载知识图谱系统...</div>
        <div className="mt-2 text-sm text-slate-500">初始化三维场景和节点数据</div>
      </div>
    </div>
  );
}
