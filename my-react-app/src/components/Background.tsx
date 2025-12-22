import React, { useState } from 'react';

const Background = () => {
  const [showGhostProtocol, setShowGhostProtocol] = useState(false);

  return (
    <div className="bg-[#1c2833] text-[#ecf0f1] h-screen grid grid-rows-[140px_1fr_120px] grid-cols-[250px_1fr_250px] grid-areas-background">
      {/* Header */}
      <header className="grid-area-header bg-gradient-to-b from-[#1c2833] to-[#1a3e59] p-4 border-b-2 border-[#41b6e6] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl">船舶虚拟仿真教师管理后台</h1>
          <div>
            <button className="bg-[#2d6a9f] text-white px-3 py-1 rounded mr-2">帮助</button>
            <button className="bg-[#41b6e6] text-[#2c3e50] px-3 py-1 rounded">系统设置</button>
          </div>
        </div>
        {/* Other header content */}
      </header>

      {/* Sidebar */}
      <nav className="grid-area-sidebar bg-[#1a3e59] p-4 border-r border-[#2d6a9f]">
        {/* Navigation items */}
      </nav>

      {/* Main Content */}
      <main className="grid-area-main p-4 overflow-y-auto bg-[#233445]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">动力定位系统专题教学</h2>
          <div>
            <button className="bg-[#2d6a9f] text-white px-3 py-1 rounded mr-2">重置</button>
            <button className="bg-[#41b6e6] text-[#2c3e50] px-3 py-1 rounded mr-2">保存配置</button>
            <button onClick={() => setShowGhostProtocol(true)} className="bg-[#e74c3c] text-white px-3 py-1 rounded">应急模式</button>
          </div>
        </div>
        {/* Main matrix content */}
      </main>

      {/* Right Panel */}
      <aside className="grid-area-rightpanel bg-[#1a3e59] p-4 border-l border-[#2d6a9f]">
        {/* Analysis tools */}
      </aside>

      {/* Footer */}
      <footer className="grid-area-footer bg-[#1a3e59] p-4 border-t border-[#2d6a9f]">
        {/* Resource management */}
      </footer>

      {/* Ghost Protocol */}
      {showGhostProtocol && (
        <div className="fixed bottom-36 right-5 bg-red-900/50 border border-red-500 rounded p-4 w-80 z-50 animate-pulse">
          <div className="flex justify-between items-center border-b border-red-500/50 pb-2 mb-2">
            <h3 className="text-red-400 font-bold">幽灵协议控制台</h3>
            <button onClick={() => setShowGhostProtocol(false)} className="text-red-400">关闭</button>
          </div>
          {/* Protocol tools */}
        </div>
      )}
    </div>
  );
};

export default Background;
