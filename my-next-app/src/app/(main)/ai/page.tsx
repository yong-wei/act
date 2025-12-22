'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

// Icons (assuming these are available or will be added)
import { 
  Bot, 
  Mic, 
  MessageSquare, 
  Image as ImageIcon, 
  RefreshCcw, 
  AlertTriangle, 
  Zap, 
  BookOpen, 
  Video, 
  HelpCircle, 
  Globe, 
  Cpu, 
  Scale, 
  DollarSign, 
  MapPin, 
  X, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  Paperclip, 
  Square, 
  Circle, 
  Minus, 
  Plus, 
  Award, 
  BarChart2, 
  Activity, 
  Database, 
  FileText, 
  PlayCircle, 
  Info, 
  Lightbulb, 
  Users, 
  Settings, 
  Clock, 
  Thermometer, 
  CloudLightning, 
  Wind, 
  Droplet, 
  Compass, 
  Target, 
  Shield, 
  Anchor, 
  Bell, 
  Star, 
  ZapOff, 
  CheckCircle, 
  RotateCcw, 
  Upload, 
  Download, 
  Link as LinkIcon, 
  Key, 
  Lock, 
  Unlock, 
  Tag, 
  Eye, 
  Heart, 
  ThumbsUp, 
  ThumbsDown, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Grid, 
  LayoutDashboard, 
  List, 
  Monitor, 
  PieChart, 
  Rss, 
  Share2, 
  Terminal, 
  Type, 
  User, 
  Wifi, 
  Zap as ZapIcon 
} from 'lucide-react';

export default function AiPage() {
  const [sliderValue, setSliderValue] = useState(65);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'ai', content: '我是您的AI助教工坊，请问有什么可以帮助您？您可以询问我关于船舶控制、PID参数调优或其他相关问题。' },
    { type: 'user', content: '如何优化AGV避撞参数？' },
    { type: 'ai', content: '优化AGV避撞参数需考虑以下关键因素：<br><br>1. <strong>传感器融合策略</strong>：结合激光雷达和视觉传感器数据，提高环境感知精度<br>2. <strong>PID控制参数调整</strong>：<br>- 减小比例系数(Kp)可降低避障响应的急剧性<br>- 适当增加微分系数(Kd)可提前预测障碍物运动趋势<br>3. <strong>动态安全距离计算</strong>：根据AGV当前速度和障碍物相对速度动态调整<br><br>您希望我详细解释其中的哪个方面，或者需要具体的参数推��范围吗？' },
  ]);

  const handleVoiceClick = () => {
    setIsRecording(!isRecording);
    // Simulate voice recognition process
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        const newMessage = {
          type: 'user', 
          content: '请解释Nyquist稳定性判据的实际应用'
        };
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        // Simulate AI response
        setTimeout(() => {
          const aiResponse = {
            type: 'ai', 
            content: '<p>Nyquist稳定性判据在船舶控制中有广泛应用：</p><ol><li><strong>减摇鳍控制系统</strong>：通过分析开环传递函数在频域中的特性，可以评估系统稳定裕度。</li><li><strong>动力定位系统</strong>：确保在海流干扰下控制器不会产生振荡或不稳定响应。</li><li><strong>实际应用步骤</strong>：<ul><li>绘制系统Bode图或Nyquist图</li><li>检查-1点包络情况</li><li>计算相位裕度和幅值裕度</li><li>根据裕度调整控制参数</li></ul></li></ol><p>这对您完成当前的挖泥船动力分配调优工卡非常关键。</p>'
          };
          setMessages((prevMessages) => [...prevMessages, aiResponse]);
        }, 1500);
      }, 3000);
    }
  };

  return (
    <div className="bg-[#121e35] text-white h-screen overflow-hidden grid grid-rows-[20%_70%_10%] grid-cols-[40%_40%_20%]" style={{ gridTemplateAreas: '"header header header" "qa-section matrix sidebar" "footer footer footer"' }}>
      {/* 1. Header */}
      <header className="grid-area-header bg-gradient-to-b from-dark-blue to-primary-blue border-b-2 border-amber-alert p-4 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/api/placeholder/1920/300')] bg-cover opacity-15 pointer-events-none"></div>
        <div className="flex justify-between mb-2 z-10">
          <h1 className="text-2xl font-bold flex items-center">
            <span className="text-amber-alert mr-2">✧</span>
            AI助教工坊 - 智能问答与虚实联动的认知中枢
            <span className="text-amber-alert ml-2">✧</span>
          </h1>
        </div>
        <div className="flex justify-between items-center z-10">
          <div className="flex gap-4">
            <Button className="bg-white/10 border border-white/30 px-4 py-2 rounded-full text-white flex items-center hover:bg-amber-alert hover:text-dark-blue active:bg-amber-alert active:text-dark-blue">
              <Cpu className="mr-2" size={16} />
              算法引航员
            </Button>
            <Button className="bg-white/10 border border-white/30 px-4 py-2 rounded-full text-white flex items-center hover:bg-amber-alert hover:text-dark-blue">
              <Scale className="mr-2" size={16} />
              伦理大副
            </Button>
            <Button className="bg-white/10 border border-white/30 px-4 py-2 rounded-full text-white flex items-center hover:bg-amber-alert hover:text-dark-blue">
              <Compass className="mr-2" size={16} />
              导航长
            </Button>
          </div>
          <div className="bg-black/30 rounded-lg px-4 py-2 flex items-center">
            <div className="w-3 h-3 bg-success-green rounded-full mr-2 relative">
              <div className="absolute inset-0 bg-success-green rounded-full animate-pulse"></div>
            </div>
            <span>已连接：数字孪生平台：雪龙号动力舱</span>
          </div>
        </div>
        <div className="mt-4 p-2 bg-white/10 rounded-lg flex flex-wrap justify-center gap-2 z-10">
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">PID参数</span>
          <span className="px-3 py-1 bg-amber-alert text-dark-blue rounded-full text-sm">超调量</span>
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">稳态误差</span>
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">生态评估</span>
          <span className="px-3 py-1 bg-amber-alert text-dark-blue rounded-full text-sm">Nyquist判据</span>
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">鲁棒性</span>
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">频率响应</span>
          <span className="px-3 py-1 bg-primary-blue/30 rounded-full text-sm">相位裕度</span>
        </div>
      </header>

      {/* 2. QA Section */}
      <section className="grid-area-qa-section bg-[#1c3166]/80 border-r border-white/10 flex flex-col">
        <Tabs defaultValue="voice" className="flex flex-col h-full">
          <TabsList className="flex bg-dark-blue border-b border-white/10 rounded-none">
            <TabsTrigger value="voice" className="flex-1 py-3 data-[state=active]:border-b-amber-alert data-[state=active]:border-b-2 data-[state=active]:text-white data-[state=active]:bg-transparent text-white/70">
              <Mic className="mr-2" size={16} />
              语音舵轮
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 py-3 data-[state=active]:border-b-amber-alert data-[state=active]:border-b-2 data-[state=active]:text-white data-[state=active]:bg-transparent text-white/70">
              <MessageSquare className="mr-2" size={16} />
              文本航海日志
            </TabsTrigger>
            <TabsTrigger value="vision" className="flex-1 py-3 data-[state=active]:border-b-amber-alert data-[state=active]:border-b-2 data-[state=active]:text-white data-[state=active]:bg-transparent text-white/70">
              <ImageIcon className="mr-2" size={16} />
              视觉扫描仪
            </TabsTrigger>
          </TabsList>
          <TabsContent value="voice" className="flex-1 p-4 overflow-y-auto flex flex-col">
            <div className="flex-1 overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div key={index} className={`mb-4 flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-xl max-w-[80%] ${msg.type === 'user' ? 'bg-primary-blue text-white' : 'bg-white/10 text-white'}`} dangerouslySetInnerHTML={{ __html: msg.content }}></div>
                </div>
              ))}
            </div>
            <div className="flex justify-center items-center">
              <Button onClick={handleVoiceClick} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-danger-red animate-pulse' : 'bg-white/10 hover:bg-amber-alert hover:text-dark-blue'}`}>
                <Mic size={24} />
              </Button>
            </div>
            {isRecording && (
              <div className="flex justify-center gap-1 mt-4">
                <div className="w-1 h-5 bg-amber-alert rounded-sm animate-[wave_1s_ease-in-out_infinite]"></div>
                <div className="w-1 h-5 bg-amber-alert rounded-sm animate-[wave_1s_ease-in-out_0.1s_infinite]"></div>
                <div className="w-1 h-5 bg-amber-alert rounded-sm animate-[wave_1s_ease-in-out_0.2s_infinite]"></div>
                <div className="w-1 h-5 bg-amber-alert rounded-sm animate-[wave_1s_ease-in-out_0.3s_infinite]"></div>
                <div className="w-1 h-5 bg-amber-alert rounded-sm animate-[wave_1s_ease-in-out_0.4s_infinite]"></div>
              </div>
            )}
            <div className="flex justify-center gap-2 mt-4">
              <Button className="bg-white/10 hover:bg-amber-alert hover:text-dark-blue rounded-full px-3 py-1 text-sm">详解PID避障参数调优方法</Button>
              <Button className="bg-white/10 hover:bg-amber-alert hover:text-dark-blue rounded-full px-3 py-1 text-sm">查看典型场景的参数配置</Button>
            </div>
            <div className="relative bg-white/10 rounded-lg p-1 mt-4">
              <Input placeholder="在此输入问题或使用语音舵轮..." className="w-full bg-transparent border-none text-white pr-10 resize-none min-h-[60px] font-mono" />
              <div className="absolute right-2 bottom-2 flex gap-2">
                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white"><Paperclip size={16} /></Button>
                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white"><Send size={16} /></Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="text" className="flex-1 p-4 overflow-y-auto">文本航海日志内容</TabsContent>
          <TabsContent value="vision" className="flex-1 p-4 overflow-y-auto">视觉扫描仪内容</TabsContent>
        </Tabs>
      </section>

      {/* 3. Cognitive Matrix */}
      <section className="grid-area-matrix relative flex justify-center items-center perspective-1000 overflow-hidden bg-[#121e35]/90">
        <div className="relative w-[500px] h-[500px] transform-style-preserve-3d animate-[rotate-slowly_120s_linear_infinite]">
          {/* Beacons */}
          <div className="absolute w-20 h-20 bg-white/10 rounded-md flex flex-col justify-center items-center p-2 cursor-pointer transition-all duration-300 transform-style-preserve-3d hover:bg-amber-alert/30 hover:scale-110" style={{ transform: 'translateX(120px) translateY(-80px) translateZ(50px)' }}>
            <Compass size={24} className="mb-1" />
            <span className="text-xs text-center">挖泥船动力分配调优</span>
          </div>
          <div className="absolute w-20 h-20 bg-amber-alert text-dark-blue rounded-md flex flex-col justify-center items-center p-2 cursor-pointer transition-all duration-300 transform-style-preserve-3d shadow-amber-alert/50 shadow-lg hover:scale-110" style={{ transform: 'translateX(-100px) translateY(50px) translateZ(150px)' }}>
            <Zap size={24} className="mb-1" />
            <span className="text-xs text-center">PID参数优化</span>
          </div>
          {/* Other beacons */}
        </div>
        {/* Learning Path, Buoy, Ethics Prompt */}
      </section>

      {/* 4. Knowledge Sidebar */}
      <aside className="grid-area-sidebar bg-[#121e35]/90 border-l border-white/10 flex flex-col p-4 overflow-y-auto">
        <h2 className="text-lg text-amber-alert mb-4 flex items-center justify-between">
          船载智库
          <Button variant="ghost" size="icon" className="text-white hover:text-amber-alert"><X size={16} /></Button>
        </h2>
        {/* Resource Sections */}
      </aside>

      {/* 5. Control Deck */}
      <footer className="grid-area-footer bg-dark-blue border-t border-white/10 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button className="bg-primary-blue text-white font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-amber-alert hover:text-dark-blue">
            <RefreshCcw size={16} />
            参数同步
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">历史版本：</span>
            <select className="bg-white/10 text-white text-sm p-1 rounded">
              <option>v2.3.1 - 当前版本</option>
              <option>v2.3.0 - 2023-07-15</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70">生态保护权重：</span>
          <Slider defaultValue={[65]} max={100} step={1} className="w-[150px]" onValueChange={(value) => setSliderValue(value[0])} />
          <span>{sliderValue}%</span>
        </div>
        <Button className="bg-danger-red text-white font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-red-700">
          <AlertTriangle size={16} />
          紧急制动
        </Button>
      </footer>

      {/* 6. Ability Chart (Modal/Overlay) */}
      {/* This would typically be a separate component or a dialog from shadcn/ui */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] hidden">
        <div className="bg-[#121e35]/95 border border-amber-alert rounded-xl p-5 w-[600px] h-[500px] flex flex-col animate-zoom-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-amber-alert">能力星图 - 技术与伦理导航</h3>
            <Button variant="ghost" size="icon" className="text-white hover:text-amber-alert"><X size={20} /></Button>
          </div>
          {/* Chart content */}
        </div>
      </div>
    </div>
  );
}
