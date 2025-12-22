import React, { useState } from 'react';

const Knowledge = () => {
  const [activeTab, setActiveTab] = useState('cognition');
  const [activeResourceTab, setActiveResourceTab] = useState('knowledge');
  const [isResourcePanelActive, setResourcePanelActive] = useState(true);
  const [isWorkshopMenu, setWorkshopMenu] = useState(false);

  return (
    <div className="bg-[#020721] text-[#e0e6ff] h-screen overflow-hidden flex relative">
      {/* Sidebar */}
      <div className="w-[30%] bg-black/30 border-r border-blue-400/30 p-5 overflow-y-auto z-10">
        <h2 className="text-2xl text-blue-400 mb-6 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
          船舶知识图谱导航
        </h2>
        <div className="border-b border-blue-400/30 mb-5">
          <button onClick={() => setActiveTab('cognition')} className={`py-3 px-4 text-sm ${activeTab === 'cognition' ? 'text-blue-400 font-medium border-b-2 border-blue-400' : 'text-gray-400'}`}>认知跃迁助手</button>
          {/* Other tabs */}
        </div>
        {/* Tab Content */}
      </div>

      {/* Graph Container */}
      <div className="flex-1 relative h-full overflow-hidden">
        <div id="knowledge-graph" className="w-full h-full bg-[radial-gradient(circle,rgba(9,21,64,0.2)_0%,rgba(2,7,33,0.5)_100%)] flex justify-center items-center">
          <p className="text-blue-400">正在加载三维知识图谱...</p>
        </div>
        {/* Graph Controls */}
      </div>

      {/* Resource Panel */}
      <div className={`absolute top-0 h-full w-[40%] bg-black/50 border-l border-blue-400/30 p-5 z-20 transition-all duration-300 ease-in-out ${isResourcePanelActive ? 'right-0' : '-right-full'}`}>
        <div className="flex justify-between items-center pb-2 border-b border-blue-400/30 mb-5">
          <h3 className="text-lg text-blue-400 flex items-center">Nyquist判据</h3>
          <button onClick={() => setResourcePanelActive(false)} className="text-gray-400 hover:text-white">×</button>
        </div>
        {/* Resource Tabs */}
        <div className="border-b border-blue-400/20 mb-5">
          <button onClick={() => setActiveResourceTab('knowledge')} className={`py-2 px-4 text-sm ${activeResourceTab === 'knowledge' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>知识维度</button>
          {/* Other resource tabs */}
        </div>
        {/* Resource Content */}
      </div>

      {/* Knowledge Workshop */}
      <div className="fixed right-8 bottom-32 z-30">
        <button onClick={() => setWorkshopMenu(!isWorkshopMenu)} className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full text-white text-2xl shadow-lg">
          ?
        </button>
        {isWorkshopMenu && (
          <div className="absolute bottom-16 right-0 w-72 bg-black/70 border border-blue-400/50 rounded-lg p-4 shadow-xl">
            {/* Workshop Menu Content */}
          </div>
        )}
      </div>

      {/* Sync Panel */}
      <div className="fixed bottom-0 left-0 right-0 h-[10vh] bg-black/40 border-t border-blue-400/30 px-8 flex items-center justify-between z-10">
        {/* Sync Status and Controls */}
      </div>
    </div>
  );
};

export default Knowledge;
