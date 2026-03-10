export default function EthicsLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#1c2331]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        <div className="text-lg text-emerald-400">正在加载伦理决策沙盘...</div>
        <div className="mt-2 text-sm text-slate-500">初始化场景和决策模块</div>
      </div>
    </div>
  );
}
