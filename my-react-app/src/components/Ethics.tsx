import React, { useEffect, useState } from 'react';

const Ethics = () => {
  const [safety, setSafety] = useState(33);
  const [ecology, setEcology] = useState(33);
  const [economy, setEconomy] = useState(34);
  const [timePressure, setTimePressure] = useState(120);
  const [infoFog, setInfoFog] = useState(30);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlert(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[#1C2331] text-white h-screen overflow-hidden grid grid-cols-[30%_70%] grid-rows-[90%_10%] grid-areas-ethics">
      {/* Ethics Compass */}
      <div className="grid-area-left-panel bg-panel-bg border-r border-panel-border p-4 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">伦理罗盘导航仪</h2>
        <p className="text-sm text-gray-400 mb-4">通过调整参数辅助复杂伦理决策</p>

        {/* Value Sliders */}
        <div className="mb-5 pb-4 border-b border-white/20">
          <h3 className="text-[#7FFF00] mb-2 text-lg">价值观定向</h3>
          <div>
            <label>安全优先度</label>
            <div className="flex items-center">
              <input type="range" min="0" max="100" value={safety} onChange={(e) => setSafety(Number(e.target.value))} className="w-full mr-2" />
              <span>{safety}%</span>
            </div>
          </div>
          {/* Other sliders */}
        </div>
        
        {/* Other sections */}
      </div>

      {/* Main Scene */}
      <div className="grid-area-main-scene relative bg-black overflow-hidden">
        <div className="w-full h-full bg-cover" style={{ backgroundImage: "url('/api/placeholder/800/600')" }}>
          <div className="absolute top-2 left-2 bg-black/50 p-2 rounded">
            <h3>北极航道冰区紧急避险</h3>
            <p>当前任务：确定应对浮冰群的最佳航行方案</p>
          </div>
          {/* View Controls */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 p-2 rounded-full">
            <button className="bg-steel-blue-500/50 border border-[#4682B4] text-white px-4 py-2 rounded-full">船长室全局视角</button>
            {/* Other buttons */}
          </div>
        </div>
        {showAlert && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 border border-[#FF3B30] p-4 rounded max-w-3xl z-50">
            {/* Alert content */}
            <button onClick={() => setShowAlert(false)} className="absolute top-2 right-2 text-white">×</button>
          </div>
        )}
      </div>

      {/* Consequences Panel */}
      <div className={`absolute right-0 top-0 w-[30%] h-[90%] bg-panel-bg border-l border-panel-border transform transition-transform duration-500 ease-in-out z-40 p-4 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={() => setPanelOpen(!isPanelOpen)} className="absolute left-[-30px] top-1/2 -translate-y-1/2 bg-[#4682B4] text-white w-[30px] h-[60px] rounded-l-md">
          {isPanelOpen ? '≫' : '≪'}
        </button>
        <h2 className="text-xl font-bold">多维度代价沙盘</h2>
        {/* Panel content */}
      </div>

      {/* Case Library */}
      <div className="grid-area-case-library bg-panel-bg border-t border-panel-border p-2 overflow-x-auto whitespace-nowrap">
        <div className="flex gap-4 p-2">
          <div className="bg-white/10 rounded p-2 min-w-[200px] cursor-pointer">
            <h4 className="text-[#7FFF00]">威望号原油泄漏</h4>
            <p className="text-sm text-gray-400">2031年，选择经济优先导致生态灾难</p>
          </div>
          {/* Other cases */}
        </div>
      </div>
    </div>
  );
};

export default Ethics;
