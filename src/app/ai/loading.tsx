export default function AiLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a2a43]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
        <div className="text-lg text-cyan-400">正在加载学习中心...</div>
        <div className="mt-2 text-sm text-slate-500">初始化学情画像数据</div>
      </div>
    </div>
  );
}
