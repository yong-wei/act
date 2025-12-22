'use client';

import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Icons (assuming these are available or will be added)
import {
  Trophy, BarChart2, Users, FlaskConical, Compass, BookOpen, 
  Zap, Waves, Shield, Search, Leaf, Medal, Clock, Award, 
  Folder, FileText, PlayCircle, Settings, User, Lightbulb, 
  ChevronRight, ChevronLeft, CheckSquare, TrendingUp, DollarSign, 
  MapPin, AlertTriangle, Cpu, Scale, Globe, Anchor, Bell, Star, 
  ZapOff, CheckCircle, RotateCcw, Upload, Download, Link as LinkIcon, 
  Key, Lock, Unlock, Tag, Eye, Heart, ThumbsUp, ThumbsDown, Volume2, 
  VolumeX, Maximize, Minimize, Grid, LayoutDashboard, List, Monitor, 
  PieChart, Rss, Share2, Terminal, Type, Wifi, Send, Paperclip, Edit, Bookmark, Gem, Layers
} from 'lucide-react';

export default function PersonalPage() {
  const radarChartRef = useRef<HTMLCanvasElement>(null);
  const [activeChartTab, setActiveChartTab] = useState('radar');
  const [activeArchiveTab, setActiveArchiveTab] = useState('params');

  useEffect(() => {
    if (radarChartRef.current) {
      const ctx = radarChartRef.current.getContext('2d');
      if (ctx) {
        const radarChart = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['建模精度', '算法优化', '鲁棒性设计', '安全优先级', '生态评估', '责任追溯'],
            datasets: [
              {
                label: '技术能力',
                data: [85, 90, 78, 65, 70, 75],
                fill: true,
                backgroundColor: 'rgba(39, 174, 96, 0.2)',
                borderColor: 'rgba(39, 174, 96, 1)',
                pointBackgroundColor: 'rgba(39, 174, 96, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(39, 174, 96, 1)'
              },
              {
                label: '伦理决策',
                data: [70, 75, 80, 90, 85, 80],
                fill: true,
                backgroundColor: 'rgba(41, 128, 185, 0.2)',
                borderColor: 'rgba(41, 128, 185, 1)',
                pointBackgroundColor: 'rgba(41, 128, 185, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(41, 128, 185, 1)'
              },
              {
                label: '班级均值',
                data: [75, 72, 68, 70, 65, 60],
                fill: false,
                backgroundColor: 'rgba(255, 255, 255, 0)',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                pointBackgroundColor: 'rgba(255, 255, 255, 0.5)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 255, 255, 0.5)',
                borderDash: [5, 5]
              }
            ]
          },
          options: {
            elements: {
              line: {
                borderWidth: 3
              }
            },
            scales: {
              r: {
                angleLines: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                pointLabels: {
                  color: 'rgba(255, 255, 255, 0.7)',
                  font: {
                    size: 12
                  }
                },
                ticks: {
                  backdropColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.5)'
                }
              }
            },
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });
        return () => radarChart.destroy();
      }
    }
  }, []);

  return (
    <div className="bg-gradient-to-br from-personal-deep-blue to-[#1e3c52] text-white min-h-screen p-5">
      <div className="grid grid-cols-1 md:grid-cols-[20%_60%_20%] md:grid-rows-[auto_1fr_auto] gap-5 h-full"
        style={{ gridTemplateAreas: '"dashboard dashboard dashboard" "compass main tools" "journal journal journal"' }}>

        {/* 1. Dashboard */}
        <div className="grid-area-dashboard bg-personal-deep-blue/80 rounded-lg p-4 shadow-lg flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-col bg-personal-mid-blue/70 p-3 rounded-md border-l-4 border-personal-gold">
            <div className="font-bold text-lg text-personal-gold mb-1">视觉型领航员</div>
            <div className="text-sm text-white/90">L3级：多系统集成能力</div>
            <div className="text-sm text-white/90">极地探险队No.2</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 md:mt-0">
            <div className="bg-personal-mid-blue/50 rounded-md p-3 text-center transition-all hover:translate-y-[-2px] hover:shadow-md">
              <div className="text-xs text-white/70 mb-2">昨日学习时长</div>
              <div className="text-lg font-bold">3.15h</div>
              <div className="text-xs text-white/80">实验操作2.3h / 伦理决策45min</div>
            </div>
            <div className="bg-personal-mid-blue/50 rounded-md p-3 text-center transition-all hover:translate-y-[-2px] hover:shadow-md">
              <div className="text-xs text-white/70 mb-2">累计解锁船舶数</div>
              <div className="text-lg font-bold">12/36艘</div>
              <div className="text-xs text-white/80">雪龙号需双S评级</div>
            </div>
            <div className="bg-personal-mid-blue/50 rounded-md p-3 text-center transition-all hover:translate-y-[-2px] hover:shadow-md">
              <div className="text-xs text-white/70 mb-2">今日AI推荐指数</div>
              <div className="text-lg font-bold">92%</div>
              <div className="text-xs text-white/80">学习效能预测</div>
            </div>
          </div>
        </div>

        {/* 2. Compass */}
        <div className="grid-area-compass bg-personal-deep-blue/70 rounded-lg p-4 shadow-lg flex flex-col gap-4 overflow-y-auto">
          <div className="bg-personal-mid-blue/50 rounded-md p-3">
            <h3 className="font-bold text-personal-light-blue mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-personal-light-blue before:rounded-full">成长航线图</h3>
            <div className="flex flex-col gap-4 relative before:content-[''] before:absolute before:left-[7px] before:top-0 before:h-full before:w-0.5 before:bg-white/20">
              <div className="relative pl-6 text-sm before:content-[''] before:absolute before:left-0 before:top-1 before:w-4 before:h-4 before:rounded-full before:bg-personal-gold before:z-10">掌握动力定位</div>
              <div className="relative pl-6 text-sm before:content-[''] before:absolute before:left-0 before:top-1 before:w-4 before:h-4 before:rounded-full before:bg-personal-light-blue before:z-10 before:shadow-[0_0_0_4px_rgba(52,152,219,0.3)]">解锁AGV协同</div>
              <div className="relative pl-6 text-sm before:content-[''] before:absolute before:left-0 before:top-1 before:w-4 before:h-4 before:rounded-full before:bg-personal-mid-blue before:z-10">获企业认证</div>
              <div className="relative pl-6 text-sm before:content-[''] before:absolute before:left-0 before:top-1 before:w-4 before:h-4 before:rounded-full before:bg-personal-mid-blue before:z-10">完成深水作业模拟</div>
            </div>
          </div>
          <div className="bg-personal-mid-blue/50 rounded-md p-3">
            <h3 className="font-bold text-personal-light-blue mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-personal-light-blue before:rounded-full">AI航线规划</h3>
            <select className="w-full bg-personal-dark-gray/70 text-white p-2 border border-personal-light-blue/50 rounded-md mt-2 text-sm">
              <option>选择学习目标</option>
              <option>速通模式</option>
              <option>深度研究</option>
              <option>多领域交叉</option>
            </select>
          </div>
          <div className="bg-personal-mid-blue/50 rounded-md p-3">
            <h3 className="font-bold text-personal-light-blue mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-personal-light-blue before:rounded-full">紧急避障预警</h3>
            <div className="bg-personal-warning-red/20 border-l-4 border-personal-warning-red p-2 text-xs rounded-sm">
              您的根轨迹设计失败率高于均值37%，建议复习L2工卡
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid-area-main flex flex-col gap-5 overflow-y-auto">
          {/* 3. Evolution Chart */}
          <div className="bg-personal-deep-blue/70 rounded-lg p-5 shadow-lg h-1/2 flex flex-col">
            <Tabs defaultValue="radar" className="flex flex-col h-full">
              <TabsList className="flex mb-4 border-b-2 border-white/10 rounded-none">
                <TabsTrigger value="radar" onClick={() => setActiveChartTab('radar')} className={`flex-1 py-2 text-sm ${activeChartTab === 'radar' ? 'text-white border-b-2 border-personal-light-blue' : 'text-white/70'}`}>能力雷达图</TabsTrigger>
                <TabsTrigger value="ladder" onClick={() => setActiveChartTab('ladder')} className={`flex-1 py-2 text-sm ${activeChartTab === 'ladder' ? 'text-white border-b-2 border-personal-light-blue' : 'text-white/70'}`}>舰船成长阶梯</TabsTrigger>
              </TabsList>
              <TabsContent value="radar" className="flex-1 flex justify-center items-center relative">
                <canvas ref={radarChartRef} className="w-full h-full"></canvas>
                <div className="absolute top-2 right-2 bg-personal-deep-blue/80 p-2 rounded-md text-xs">
                  <div className="flex items-center mb-1"><div className="w-3 h-3 rounded-full bg-personal-progress-green mr-1"></div><span>技术能力</span></div>
                  <div className="flex items-center mb-1"><div className="w-3 h-3 rounded-full bg-personal-ethics-blue mr-1"></div><span>伦理决策</span></div>
                  <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-white/50 mr-1"></div><span>班级均值</span></div>
                </div>
              </TabsContent>
              <TabsContent value="ladder" className="flex-1 flex justify-center items-center">舰船成长阶梯内容</TabsContent>
            </Tabs>
          </div>

          {/* 6. Task Matrix */}
          <div className="bg-personal-deep-blue/70 rounded-lg p-5 shadow-lg h-1/2 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">任务工卡矩阵</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-personal-mid-blue/50 rounded-md p-4 h-36 relative flex flex-col justify-between border-2 border-personal-gold cursor-pointer transition-all hover:translate-y-[-3px] hover:shadow-md">
                <div className="absolute top-2 right-2 bg-personal-deep-blue/80 rounded-md px-2 py-1 text-xs">L3</div>
                <h4 className="font-bold text-sm mb-1">天鲸号动力分配调优</h4>
                <p className="text-xs text-white/80 mb-2">优化推进器能量分配，降低波浪干扰影响</p>
                <div className="text-xs text-personal-gold">⏱️ 剩余时间: 72小时</div>
              </div>
              <div className="bg-personal-mid-blue/50 rounded-md p-4 h-36 relative flex flex-col justify-between cursor-pointer transition-all hover:translate-y-[-3px] hover:shadow-md">
                <div className="absolute top-2 right-2 bg-personal-deep-blue/80 rounded-md px-2 py-1 text-xs">L3</div>
                <h4 className="font-bold text-sm mb-1">海上环境感知训练</h4>
                <p className="text-xs text-white/80 mb-2">多传感器融合优化，提高10%精度</p>
                <div className="text-xs text-personal-gold">⏱️ 剩余时间: 5天</div>
              </div>
              <div className="bg-personal-dark-gray/50 text-white/50 rounded-md p-4 h-36 relative flex flex-col justify-between">
                <div className="absolute top-2 right-2 bg-personal-deep-blue/80 rounded-md px-2 py-1 text-xs">L4</div>
                <h4 className="font-bold text-sm mb-1">深潜器控制模块</h4>
                <p className="text-xs mb-2">1000米级深潜设备独立操作训练</p>
                <div className="text-xs">🔒 需完成3项L4伦理决策解锁</div>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-lg mb-4 flex items-center gap-2 before:content-['🏆']">历史成就</h4>
              <div className="flex gap-3 overflow-x-auto pb-3">
                <div className="w-20 h-20 rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--personal-gold),var(--personal-dark-gray))] flex items-center justify-center flex-shrink-0 relative shadow-md group">
                  <Zap size={24} className="text-white" />
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-personal-deep-blue/90 p-1.5 rounded-md text-xs whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">快速响应勋章: PID调试时间缩短40%</div>
                </div>
                <div className="w-20 h-20 rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--personal-gold),var(--personal-dark-gray))] flex items-center justify-center flex-shrink-0 relative shadow-md group">
                  <Waves size={24} className="text-white" />
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-personal-deep-blue/90 p-1.5 rounded-md text-xs whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">海浪���服者: 完成8级海况模拟</div>
                </div>
              </div>
              <div className="mt-4 bg-personal-mid-blue/50 rounded-md p-3 text-sm">
                <p>🏆 我的鲁棒性设计超越86%同层学员</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Tools */}
        <div className="grid-area-tools flex flex-col gap-4">
          {/* Experiment Archive */}
          <div className="bg-personal-deep-blue/70 rounded-lg p-4 shadow-lg flex-1 overflow-y-auto">
            <h3 className="font-bold text-personal-light-blue mb-4 flex items-center gap-2 before:content-['📁']">虚实实验档案库</h3>
            <Tabs defaultValue="params" className="flex flex-col h-full">
              <TabsList className="flex mb-4 border-b-2 border-white/10 rounded-none">
                <TabsTrigger value="params" onClick={() => setActiveArchiveTab('params')} className={`flex-1 py-2 text-sm ${activeArchiveTab === 'params' ? 'text-white border-b-2 border-personal-light-blue' : 'text-white/70'}`}>参数调试历史</TabsTrigger>
                <TabsTrigger value="ethics" onClick={() => setActiveArchiveTab('ethics')} className={`flex-1 py-2 text-sm ${activeArchiveTab === 'ethics' ? 'text-white border-b-2 border-personal-light-blue' : 'text-white/70'}`}>伦理沙盘回放</TabsTrigger>
                <TabsTrigger value="events" onClick={() => setActiveArchiveTab('events')} className={`flex-1 py-2 text-sm ${activeArchiveTab === 'events' ? 'text-white border-b-2 border-personal-light-blue' : 'text-white/70'}`}>异常事件簿</TabsTrigger>
              </TabsList>
              <TabsContent value="params" className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                  <div className="bg-personal-mid-blue/50 p-3 rounded-md cursor-pointer transition-all hover:bg-personal-mid-blue/70 hover:translate-x-0.5">
                    <h4 className="font-bold text-sm mb-1">波浪补偿PID参数优化</h4>
                    <div className="text-xs text-white/60">2023-06-12 14:30</div>
                    <div className="text-xs text-white/80 mt-1">超调量降低27%，AI评分：92分</div>
                  </div>
                  <div className="bg-personal-mid-blue/50 p-3 rounded-md cursor-pointer transition-all hover:bg-personal-mid-blue/70 hover:translate-x-0.5">
                    <h4 className="font-bold text-sm mb-1">动态定位误差补偿实验</h4>
                    <div className="text-xs text-white/60">2023-06-10 09:15</div>
                    <div className="text-xs text-white/80 mt-1">位置偏差降至0.3m以内，满足L4要求</div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="ethics" className="flex-1 overflow-y-auto">伦理沙盘回放内容</TabsContent>
              <TabsContent value="events" className="flex-1 overflow-y-auto">异常事件簿内容</TabsContent>
            </Tabs>
          </div>

          {/* 7. Captain Studio */}
          <div className="bg-personal-deep-blue/70 rounded-lg p-4 shadow-lg h-2/5">
            <h3 className="font-bold text-personal-light-blue mb-4 flex items-center gap-2 before:content-['🧭']">船长工作室</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-personal-mid-blue/50 text-white p-3 rounded-md text-sm flex flex-col items-center gap-1 transition-all hover:bg-personal-mid-blue/80 hover:translate-y-[-2px]">
                <Search size={24} />
                舰船自检仪
              </Button>
              <Button className="bg-personal-mid-blue/50 text-white p-3 rounded-md text-sm flex flex-col items-center gap-1 transition-all hover:bg-personal-mid-blue/80 hover:translate-y-[-2px]">
                <Settings size={24} />
                实验速建
              </Button>
              <Button className="bg-personal-mid-blue/50 text-white p-3 rounded-md text-sm flex flex-col items-center gap-1 transition-all hover:bg-personal-mid-blue/80 hover:translate-y-[-2px]">
                <Users size={24} />
                跨海协作
              </Button>
              <Button className="bg-personal-mid-blue/50 text-white p-3 rounded-md text-sm flex flex-col items-center gap-1 transition-all hover:bg-personal-mid-blue/80 hover:translate-y-[-2px]">
                <BarChart2 size={24} />
                数据分析
              </Button>
            </div>
          </div>
        </div>

        {/* 5. Journal */}
        <div className="grid-area-journal bg-personal-deep-blue/70 rounded-lg p-4 shadow-lg">
          <h3 className="font-bold text-personal-light-blue mb-4 flex items-center gap-2 before:content-['📔']">思政航海日志</h3>
          <div className="flex overflow-x-auto gap-4 pb-3 scroll-smooth">
            <div className="flex-shrink-0 w-64 bg-personal-mid-blue/50 rounded-md p-4 cursor-pointer transition-all hover:bg-personal-mid-blue/70 hover:translate-y-[-3px]">
              <h4 className="font-bold text-personal-gold text-sm mb-2">北极航道生物保护决策</h4>
              <p className="text-xs text-white/90 mb-2">在极地航道选择中，综合考虑燃油效率与海洋生物迁徙路线保护，成功实现双赢方案设计。</p>
              <div className="flex justify-between text-xs text-white/60">
                <span>完成时间: 2023-06-01</span>
                <span>评分: A+</span>
              </div>
            </div>
            <div className="flex-shrink-0 w-64 bg-personal-mid-blue/50 rounded-md p-4 cursor-pointer transition-all hover:bg-personal-mid-blue/70 hover:translate-y-[-3px] border border-personal-gold">
              <h4 className="font-bold text-personal-gold text-sm mb-2">中船集团实习证书</h4>
              <p className="text-xs text-white/90 mb-2">完成"智能船舶动力系统优化"项目，获得行业专家一致好评，颁发企业实习证明。</p>
              <div className="flex justify-between text-xs text-white/60">
                <span>颁发日期: 2023-05-15</span>
                <span>证书编号: CSSC-2023-0426</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
