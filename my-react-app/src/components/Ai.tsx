import React, { useEffect, useState } from 'react';

const Ai = () => {
  const [sliderValue, setSliderValue] = useState(65);

  useEffect(() => {
    // Logic from the original script can be adapted here.
    // For example, handling the voice button click:
    const voiceBtn = document.getElementById('voice-btn');
    const voiceWaves = document.getElementById('voice-waves');
    if (voiceBtn && voiceWaves) {
      voiceBtn.addEventListener('click', () => {
        voiceBtn.classList.toggle('recording');
        voiceWaves.classList.toggle('active');
      });
    }
  }, []);

  return (
    <div className="bg-[#121e35] text-white h-screen overflow-hidden grid grid-rows-[20%_70%_10%] grid-cols-[40%_40%_20%] grid-areas-layout">
      {/* Header */}
      <header className="grid-area-header bg-gradient-to-b from-[#1c3166] to-[#4169E1] border-b-2 border-[#FFBF00] p-4 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-cover opacity-15 pointer-events-none" style={{ backgroundImage: "url('/api/placeholder/1920/300')" }}></div>
        <div className="flex justify-between mb-2 z-10">
          <h1 className="text-2xl font-bold flex items-center">
            <span className="text-[#FFBF00] mr-2">✧</span>
            AI助教工坊 - 智能问答与虚实联动的认知中枢
            <span className="text-[#FFBF00] ml-2">✧</span>
          </h1>
        </div>
        <div className="flex justify-between items-center z-10">
          <div className="flex gap-4">
            <button className="bg-white/10 border border-white/30 px-4 py-2 rounded-full text-white flex items-center hover:bg-[#FFBF00] hover:text-[#1c3166] active:bg-[#FFBF00] active:text-[#1c3166]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="mr-2"><path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z" /><path d="M0 10a8 8 0 1 1 15.547 2.661c-.442 1.253-1.845 1.602-2.932 1.25C11.309 13.488 9.475 13 8 13c-1.474 0-3.31.488-4.615.911-1.087.352-2.49.003-2.49 13.661-2.932 12.966a.5.5 0 0 0-.64.308l-1.5 4a.5.5 0 0 0 .6.64l4-1.5a.5.5 0 0 0 .308-.64A7.99 7.99 0 0 1 8 15a7.99 7.99 0 0 1-5.9-2.602z" /></svg>
              算法引航员
            </button>
            {/* Other buttons */}
          </div>
          <div className="bg-black/30 rounded-lg px-4 py-2 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 relative">
              <div className="absolute w-full h-full bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <span>已连接：数字孪生平台：雪龙号动力舱</span>
          </div>
        </div>
        <div className="mt-4 p-2 bg-white/10 rounded-lg flex flex-wrap justify-center gap-2 z-10">
          <div className="px-3 py-1 bg-royal-blue-300/30 rounded-full text-sm">PID参数</div>
          <div className="px-3 py-1 bg-[#FFBF00] text-[#1c3166] rounded-full text-sm">超调量</div>
          {/* Other tags */}
        </div>
      </header>

      {/* QA Section */}
      <section className="grid-area-qa-section bg-slate-800/80 border-r border-white/10 flex flex-col">
        {/* Tabs, content, etc. */}
      </section>

      {/* Cognitive Matrix */}
      <section className="grid-area-matrix relative flex justify-center items-center perspective-1000 overflow-hidden bg-gray-900/90">
        {/* Sphere, beacons, etc. */}
      </section>

      {/* Knowledge Sidebar */}
      <aside className="grid-area-sidebar bg-gray-900/90 border-l border-white/10 flex flex-col p-4 overflow-y-auto">
        {/* Sidebar content */}
      </aside>

      {/* Control Deck */}
      <footer className="grid-area-footer bg-[#1c3166] border-t border-white/10 px-5 py-2 flex justify-between items-center">
        {/* Controls */}
      </footer>

      {/* Ability Chart */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-gray-900/95 border border-[#FFBF00] rounded-2xl p-5 z-[1000] hidden flex-col animate-zoom-in">
        {/* Chart content */}
      </div>
    </div>
  );
};

export default Ai;
