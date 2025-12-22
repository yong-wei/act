'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';

// Icons (assuming these are available or will be added)
import {
  Compass, Scale, Clock, CloudFog, Play, BookOpen, Users, Folder, X, ChevronLeft, ChevronRight, AlertTriangle, Medal, Lightbulb, DollarSign, Globe, MapPin, Shield, Zap
} from 'lucide-react';

export default function EthicsPage() {
  const [safetyPriority, setSafetyPriority] = useState(33);
  const [ecologyPriority, setEcologyPriority] = useState(33);
  const [economyPriority, setEconomyPriority] = useState(34);
  const [timePressure, setTimePressure] = useState(120);
  const [infoFog, setInfoFog] = useState(30);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const [logContent, setLogContent] = useState<string[]>([]);

  useEffect(() => {
    const alertTimer = setTimeout(() => setShowAlert(true), 5000);
    return () => clearTimeout(alertTimer);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0 && timePressure > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      // Handle decision time reached
    }
    return () => clearInterval(timer);
  }, [countdown, timePressure]);

  const handleGenerateTree = () => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogContent((prev) => [...prev, `<div class="log-timestamp">${timestamp}</div><div class="log-text">基于规则生成合规决策选项</div>`]);
    // Simulate decision options appearing
  };

  return (
    <div className="bg-dark-bg text-white h-screen overflow-hidden grid grid-cols-[30%_70%] grid-rows-[90%_10%]" style={{ gridTemplateAreas: '"left-panel main-scene" "case-library case-library"' }}>
      {/* Left Ethics Compass */}
      <div className="grid-area-left-panel bg-[rgba(28,35,49,0.85)] border-r border-[rgba(70,130,180,0.5)] p-4 overflow-y-auto relative">
        <h2 className="text-2xl font-bold mb-2">伦理罗盘导航仪</h2>
        <p className="text-sm text-gray-400 mb-4">通过调整参数辅助复杂伦理决策</p>

        {/* Value Sliders */}
        <div className="mb-5 pb-4 border-b border-white/20">
          <h3 className="text-accent-color mb-2 text-lg">价值观定向</h3>
          <div className="mb-4">
            <label className="block mb-1">安全优先度</label>
            <div className="flex items-center">
              <Slider defaultValue={[safetyPriority]} max={100} step={1} onValueChange={(val) => setSafetyPriority(val[0])} className="flex-1 mr-2" />
              <span className="w-10 text-center font-bold">{safetyPriority}%</span>
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-1">生态优先度</label>
            <div className="flex items-center">
              <Slider defaultValue={[ecologyPriority]} max={100} step={1} onValueChange={(val) => setEcologyPriority(val[0])} className="flex-1 mr-2" />
              <span className="w-10 text-center font-bold">{ecologyPriority}%</span>
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-1">经济优先度</label>
            <div className="flex items-center">
              <Slider defaultValue={[economyPriority]} max={100} step={1} onValueChange={(val) => setEconomyPriority(val[0])} className="flex-1 mr-2" />
              <span className="w-10 text-center font-bold">{economyPriority}%</span>
            </div>
          </div>
        </div>

        {/* Decision Tree Generator */}
        <div className="mb-5 pb-4 border-b border-white/20">
          <h3 className="text-accent-color mb-2 text-lg">决策树生成器</h3>
          <div className="bg-black/20 rounded p-3">
            <div className="flex items-center mb-2">
              <Checkbox id="rule1" className="mr-2" />
              <label htmlFor="rule1" className="text-sm">极地航行守则2.3 - 保护海洋生物多样性</label>
            </div>
            <div className="flex items-center mb-2">
              <Checkbox id="rule2" className="mr-2" />
              <label htmlFor="rule2" className="text-sm">船员安全规程5.7 - 极端天气应对</label>
            </div>
            <Button onClick={handleGenerateTree} className="mt-3 bg-primary-color text-white px-3 py-1 rounded text-sm">生成合规选项</Button>
          </div>
        </div>

        {/* Pressure Simulator */}
        <div className="mb-5 pb-4 border-b border-white/20">
          <h3 className="text-accent-color mb-2 text-lg">压力模拟器</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block mb-1">时间压力（秒）</label>
              <div className="flex items-center">
                <Slider defaultValue={[timePressure]} min={30} max={300} step={1} onValueChange={(val) => setTimePressure(val[0])} className="flex-1 mr-2" />
                <span className="w-10 text-center font-bold">{timePressure}</span>
              </div>
            </div>
            <div>
              <label className="block mb-1">信息迷雾度</label>
              <div className="flex items-center">
                <Slider defaultValue={[infoFog]} max={100} step={1} onValueChange={(val) => setInfoFog(val[0])} className="flex-1 mr-2" />
                <span className="w-10 text-center font-bold">{infoFog}%</span>
              </div>
            </div>
            <Button className="mt-3 bg-accent-color text-black px-3 py-1 rounded text-sm">开始模拟</Button>
          </div>
        </div>

        {/* Scholar Think Tank */}
        <div className="mb-5 pb-4">
          <h3 className="text-accent-color mb-2 text-lg">学者智囊团</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded p-2 cursor-pointer transition-all duration-300 hover:bg-white/20">
              <h4 className="font-bold">环保专家</h4>
              <p className="text-xs text-gray-300">生态系统恢复力分析</p>
            </div>
            <div className="bg-white/10 rounded p-2 cursor-pointer transition-all duration-300 hover:bg-white/20">
              <h4 className="font-bold">伦理学家</h4>
              <p className="text-xs text-gray-300">后��主义vs义务论</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Scene */}
      <div className="grid-area-main-scene relative bg-black overflow-hidden">
        <div className="w-full h-full bg-cover" style={{ backgroundImage: "url('/api/placeholder/800/600')" }}>
          <div className="absolute top-2 left-2 bg-black/50 p-2 rounded">
            <h3 className="text-lg font-bold">北极航道冰区紧急避险</h3>
            <p className="text-sm">当前任务：确定应对浮冰群的最佳航行方案</p>
          </div>

          {/* View Controls */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 p-2 rounded-full">
            <Button className="bg-[rgba(70,130,180,0.5)] border border-primary-color text-white px-4 py-2 rounded-full text-sm">船长室全局视角</Button>
            <Button className="bg-[rgba(70,130,180,0.5)] border border-primary-color text-white px-4 py-2 rounded-full text-sm">轮机舱实操视角</Button>
          </div>

          {/* Countdown Timer */}
          <div className={`absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-1 rounded-full text-lg ${countdown < 30 ? 'text-danger-color font-bold' : ''}`}>
            决策倒计时：{`${Math.floor(countdown / 60).toString().padStart(2, '0')}:${(countdown % 60).toString().padStart(2, '0')}`}
          </div>

          {/* Decision Log */}
          <div className="absolute top-2 right-2 bg-black/70 p-3 rounded z-40 max-w-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-primary-color font-bold">决策航海日志</h3>
              <Button variant="ghost" size="icon" className="text-white"><Minus size={16} /></Button>
            </div>
            <div className="max-h-52 overflow-y-auto text-sm">
              {logContent.map((entry, index) => (
                <div key={index} className="py-1 border-b border-white/10 last:border-b-0" dangerouslySetInnerHTML={{ __html: entry }}></div>
              ))}
            </div>
          </div>
        </div>

        {/* Ethical Alert */}
        {showAlert && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 border border-danger-color p-4 rounded max-w-3xl z-50 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-danger-color font-bold">伦理冲突警报</h3>
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setShowAlert(false)}><X size={16} /></Button>
            </div>
            <div className="max-h-36 overflow-y-auto mb-2">
              <div className="p-2 my-1 rounded-xl bg-green-500/30 text-sm"><strong>轮机长观点：</strong> 强制破冰可能导致动力系统过载，危及全船安全。</div>
              <div className="p-2 my-1 rounded-xl bg-red-500/30 text-sm ml-auto"><strong>科考队长观点：</strong> 延误将错过关键观测窗口，导致整个科考任务失败。</div>
            </div>
            <div>
              <h4 className="font-bold">文化敏感度警告：</h4>
              <p className="text-sm">当前航线穿越伊努特人传统海域，可能引发外交争议。</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Consequences Panel */}
      <div className={`absolute right-0 top-0 w-[30%] h-[90%] bg-[rgba(28,35,49,0.85)] border-l border-[rgba(70,130,180,0.5)] p-4 z-40 transition-transform duration-500 ease-in-out ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <Button variant="ghost" size="icon" className="absolute left-[-30px] top-1/2 -translate-y-1/2 bg-primary-color text-white w-8 h-16 rounded-l-md" onClick={() => setIsPanelOpen(!isPanelOpen)}>
          {isPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
        <h2 className="text-xl font-bold mb-4">多维度代价沙盘</h2>
        {/* Cost Sections */}
        <div className="mb-5 pb-4 border-b border-white/20">
          <h4 className="text-white font-bold mb-2">人本成本</h4>
          <div className="h-20 bg-black/20 rounded mb-2 flex items-center justify-center text-sm">船员安全系数可视化</div>
          <div className="text-sm text-gray-300">船员安全系数：76% (临界值)</div>
        </div>
      </div>

      {/* Bottom Case Library */}
      <div className="grid-area-case-library bg-[rgba(28,35,49,0.85)] border-t border-[rgba(70,130,180,0.5)] p-3 overflow-x-auto whitespace-nowrap">
        <div className="flex gap-4 p-2">
          <div className="bg-white/10 rounded p-3 min-w-[200px] cursor-pointer transition-all duration-300 hover:bg-white/20">
            <h4 className="text-accent-color font-bold mb-1">威望号原油泄漏</h4>
            <p className="text-sm text-gray-400">2031年，选择经济优先导致生态灾难</p>
          </div>
          <div className="bg-white/10 rounded p-3 min-w-[200px] cursor-pointer transition-all duration-300 hover:bg-white/20">
            <h4 className="text-accent-color font-bold mb-1">极地科考站撤离事件</h4>
            <p className="text-sm text-gray-400">2029年，18名科学家因船只未能按时到达被迫紧急撤离</p>
          </div>
        </div>
      </div>
    </div>
  );
}
