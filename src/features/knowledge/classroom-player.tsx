
'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Home, List } from 'lucide-react';
import { KnowledgeCard } from './knowledge-card';
import { useRouter } from 'next/navigation';

interface PlayerProps {
  playlist: any; // Using any for simplicity in rapid dev, strict type is better
}

export function ClassroomPlayer({ playlist }: PlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showList, setShowList] = useState(false);

  const items = playlist.items || [];
  const currentItem = items[currentIndex];
  const currentNode = currentItem?.node;
  // const currentMission = currentItem?.mission;

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (!currentItem) {
      return <div className="text-white">Empty Playlist</div>;
  }

  return (
    <div className="relative w-full h-screen bg-[#020721] overflow-hidden flex flex-col">
      {/* Header / Progress */}
      <div className="h-14 bg-[#091540] border-b border-blue-900/50 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
            <button onClick={() => router.push('/playlists')} className="text-slate-400 hover:text-white">
                <Home className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-medium text-white">{playlist.title}</h1>
            <span className="text-sm text-slate-500">
                {currentIndex + 1} / {items.length}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowList(!showList)}
                className={`p-2 rounded hover:bg-slate-800 ${showList ? 'text-blue-400' : 'text-slate-400'}`}
            >
                <List className="h-5 w-5" />
            </button>
            <button onClick={toggleFullscreen} className="text-slate-400 hover:text-white p-2">
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
         {/* Drawer / Playlist Sidebar */}
         <div className={`bg-[#0F172A] border-r border-slate-700 transition-all duration-300 overflow-y-auto ${showList ? 'w-64' : 'w-0'}`}>
            <div className="p-4 space-y-2">
                {items.map((item: any, idx: number) => (
                    <div 
                        key={item.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`p-3 rounded cursor-pointer text-sm ${idx === currentIndex ? 'bg-blue-900/50 border border-blue-500/50 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        <div className="font-medium truncate">{item.node?.name || item.mission?.title || 'Unknown Item'}</div>
                        <div className="text-xs opacity-60 mt-1 flex justify-between">
                            <span>{item.interactionMode}</span>
                            <span>{item.duration} min</span>
                        </div>
                    </div>
                ))}
            </div>
         </div>

         {/* Stage */}
         <div className="flex-1 relative flex items-center justify-center bg-slate-900/50 p-8 overflow-y-auto">
            {currentNode && (
                <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <KnowledgeCard 
                        name={currentNode.name}
                        description={currentNode.description}
                        nodeType={currentNode.nodeType}
                        bloomLevel={currentNode.bloomLevel}
                        knowledgeDim={currentNode.knowledgeDim}
                        metadata={currentNode.metadata || {}}
                        className="border-slate-700/50 shadow-2xl bg-[#0F172A]"
                    />
                </div>
            )}
            
            {/* Mission Placeholder - Would integrate with Simulation Engine here */}
            {currentItem.missionId && (
                <div className="text-center">
                    <div className="text-2xl text-white mb-4">仿真任务: {currentItem.missionId}</div>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold">
                        启动仿真环境
                    </button>
                </div>
            )}
         </div>
      </div>

      {/* Footer Controls */}
      <div className="h-20 bg-[#091540] border-t border-blue-900/50 flex items-center justify-center gap-8 z-10">
        <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
            <ChevronLeft className="h-5 w-5" />
            上一节
        </button>

        <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div 
                className="h-full bg-blue-500 transition-all duration-300" 
                style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
        </div>

        <button 
            onClick={handleNext}
            disabled={currentIndex === items.length - 1}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
        >
            下一节
            <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
