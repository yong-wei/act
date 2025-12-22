'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';

// Icons (assuming these are available or will be added)
import {
  BookOpen, Search, FlaskConical, Settings, X, Plus, Minus, ChevronRight, ChevronLeft, 
  Circle, Square, Triangle, Zap, Award, BarChart2, Activity, Database, FileText, PlayCircle, 
  Info, Lightbulb, Users, Clock, Thermometer, CloudLightning, Wind, Droplet, Compass, Target, 
  Shield, Anchor, Bell, Star, ZapOff, CheckCircle, RotateCcw, Upload, Download, Link as LinkIcon, 
  Key, Lock, Unlock, Tag, Eye, Heart, ThumbsUp, ThumbsDown, Volume2, VolumeX, Maximize, Minimize, 
  Grid, LayoutDashboard, List, Monitor, PieChart, Rss, Share2, Terminal, Type, User, Wifi, 
  Send, Paperclip, Edit, Bookmark, Gem, Layers, Globe, Cpu, Scale, DollarSign, MapPin
} from 'lucide-react';

export default function KnowledgePage() {
  const [activeSidebarTab, setActiveSidebarTab] = useState('cognition');
  const [activeResourceTab, setActiveResourceTab] = useState('knowledge');
  const [isResourcePanelActive, setResourcePanelActive] = useState(false);
  const [isWorkshopMenuOpen, setWorkshopMenuOpen] = useState(false);

  useEffect(() => {
    // Simulate opening resource panel after a delay
    const timer = setTimeout(() => setResourcePanelActive(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-knowledge-bg text-knowledge-text h-screen flex relative">
      {/* Left Sidebar */}
      <div className="w-[30%] bg-sidebar-bg border-r border-sidebar-border p-5 overflow-y-auto z-10">
        <div className="mb-6">
          <h2 className="text-xl knowledge-blue mb-1 flex items-center">
            <BookOpen className="mr-2" size={20} />
            船舶知识图谱导航
          </h2>
        </div>

        <Tabs defaultValue="cognition" className="flex flex-col h-full">
          <TabsList className="flex border-b border-sidebar-border mb-5">
            <TabsTrigger value="cognition" onClick={() => setActiveSidebarTab('cognition')} className={`flex-1 py-3 px-4 text-sm ${activeSidebarTab === 'cognition' ? 'text-knowledge-blue font-medium border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>认知跃迁助手</TabsTrigger>
            <TabsTrigger value="style" onClick={() => setActiveSidebarTab('style')} className={`flex-1 py-3 px-4 text-sm ${activeSidebarTab === 'style' ? 'text-knowledge-blue font-medium border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>学习风格适配</TabsTrigger>
            <TabsTrigger value="ethics" onClick={() => setActiveSidebarTab('ethics')} className={`flex-1 py-3 px-4 text-sm ${activeSidebarTab === 'ethics' ? 'text-knowledge-blue font-medium border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>思政融合筛选</TabsTrigger>
          </TabsList>

          <TabsContent value="cognition" className="flex-1 px-0">
            <div className="bg-formula-bg border border-sidebar-border rounded-md p-3 flex items-center mb-5">
              <Search size={16} className="text-search-placeholder mr-2" />
              <Input placeholder="输入学习目标，如'掌握动力定位原理'" className="bg-transparent border-none text-knowledge-text w-full outline-none text-sm placeholder:text-search-placeholder" />
            </div>

            <div className="bg-resource-card-bg rounded-lg p-4 mb-5">
              <div className="flex justify-between mb-4">
                <h4 className="text-knowledge-blue font-medium">动力定位系统学习路径</h4>
                <span className="text-knowledge-light-blue text-sm">推荐时长：3.5小时</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center pb-2 border-b border-sidebar-border/50 last:border-b-0">
                  <div className="w-6 h-6 bg-sidebar-border/30 rounded-full flex items-center justify-center mr-3 text-xs text-knowledge-blue">1</div>
                  <div>
                    <div className="text-sm">船舶传递函数基础</div>
                    <div className="text-xs text-knowledge-light-blue">掌握时间：45分钟 | 优先级：高</div>
                  </div>
                </div>
                {/* Other learning path items */}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style" className="flex-1 px-0">
            <div className="mb-5">
              <h3 className="mb-4 text-knowledge-light-blue text-sm">根据学习风格选择内容展示形式</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <Checkbox id="visual" className="mr-2 border-knowledge-blue data-[state=checked]:bg-knowledge-blue data-[state=checked]:text-white" />
                  <label htmlFor="visual" className="text-sm cursor-pointer">视觉型学习者（优先显示三维模型）</label>
                </div>
                <div className="flex items-center">
                  <Checkbox id="text" className="mr-2 border-knowledge-blue data-[state=checked]:bg-knowledge-blue data-[state=checked]:text-white" />
                  <label htmlFor="text" className="text-sm cursor-pointer">文本型学习者（优先显示工艺文档）</label>
                </div>
              </div>
            </div>
            <div className="bg-resource-card-bg rounded-lg p-4 mt-8">
              <div className="mb-4">
                <h4 className="text-knowledge-blue font-medium">个性化资源��荐</h4>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center pb-2 border-b border-sidebar-border/50 last:border-b-0">
                  <div>
                    <div className="text-sm">动力定位三维交互模型</div>
                    <div className="text-xs text-knowledge-light-blue">适合视觉型学习者</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ethics" className="flex-1 px-0">
            <div className="mb-5">
              <h3 className="mb-4 text-knowledge-light-blue text-sm">思政融合主题筛选</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <Checkbox id="ethics-polar" className="mr-2 border-knowledge-blue data-[state=checked]:bg-knowledge-blue data-[state=checked]:text-white" />
                  <label htmlFor="ethics-polar" className="text-sm cursor-pointer">北极生态保护约束</label>
                </div>
              </div>
            </div>
            <div className="bg-resource-card-bg rounded-lg p-4 mt-8">
              <div className="mb-4">
                <h4 className="text-knowledge-blue font-medium">思政融合结点</h4>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center pb-2 border-b border-sidebar-border/50 last:border-b-0">
                  <div>
                    <div className="text-sm">北极航道决策系统伦理规范</div>
                    <div className="text-xs text-knowledge-light-blue">关联：破冰航行、环保约束</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Central Graph Container */}
      <div className="flex-1 relative h-full overflow-hidden">
        <div id="knowledge-graph" className="w-full h-full bg-[radial-gradient(circle,rgba(9,21,64,0.2)_0%,rgba(2,7,33,0.5)_100%)] flex justify-center items-center">
          <div className="text-center">
            <div className="text-lg knowledge-blue mb-4">知识图谱已加载</div>
            <div className="text-sm knowledge-light-blue">
              实际部署时，此区域将由Three.js渲染<br />
              显示三维船舶模型及关联知识节点
            </div>
          </div>
        </div>

        {/* Graph Controls */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex bg-sidebar-bg rounded-full p-2 z-10">
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="放大"><Plus size={16} /></Button>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="缩小"><Minus size={16} /></Button>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="重置视图"><RefreshCcw size={16} /></Button>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="宏观视图"><Square size={16} /></Button>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="中观视图"><Circle size={16} /></Button>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:bg-sidebar-border/30 hover:text-knowledge-blue" title="微观视图"><Target size={16} /></Button>
        </div>

        {/* Node Legend */}
        <div className="absolute top-5 right-5 bg-sidebar-bg border border-sidebar-border rounded-lg p-3 z-10">
          <div className="text-sm text-knowledge-light-blue mb-2">节点类型</div>
          <div className="flex items-center mb-2"><div className="w-3 h-3 rounded-sm bg-scenario-color mr-2"></div><span className="text-xs">船舶场景节点</span></div>
          <div className="flex items-center mb-2"><div className="w-3 h-3 rounded-sm bg-theory-color mr-2"></div><span className="text-xs">控制理论节点</span></div>
          <div className="flex items-center"><div className="w-3 h-3 rounded-sm bg-ethics-color mr-2"></div><span className="text-xs">伦理决策节点</span></div>
        </div>

        {/* Node Tooltip (Hidden by default) */}
        <div className="absolute bg-workshop-menu-bg border border-workshop-menu-border rounded-lg p-4 w-80 shadow-lg z-50 hidden">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <h4 className="text-base font-medium text-knowledge-text">Nyquist判据</h4>
              <span className="text-xs px-2 py-1 rounded-full bg-theory-color/20 text-theory-color ml-2">控制理论</span>
            </div>
            <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:text-knowledge-blue"><X size={16} /></Button>
          </div>
          <p className="text-sm leading-relaxed mb-4 text-resource-text">用于分析闭环系统稳定性的频域方法，通过分析开环传递函数Nyquist曲线是否包围-1点来判断系统稳定性。在船舶航向控制中广泛应用。</p>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-sidebar-border/30 text-knowledge-blue hover:bg-sidebar-border/50 text-xs">查看详情</Button>
            <Button variant="outline" className="bg-sidebar-border/30 text-knowledge-blue hover:bg-sidebar-border/50 text-xs">添加到路径</Button>
            <Button variant="outline" className="bg-sidebar-border/30 text-knowledge-blue hover:bg-sidebar-border/50 text-xs">相关资源</Button>
          </div>
        </div>
      </div>

      {/* Right Resource Panel */}
      <div className={`absolute top-0 h-full w-[40%] bg-workshop-menu-bg border-l border-sidebar-border p-5 z-20 transition-all duration-400 ease-in-out ${isResourcePanelActive ? 'right-0' : '-right-full'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-sidebar-border mb-5">
          <h3 className="text-lg font-medium knowledge-blue flex items-center">
            <FileText className="mr-2" size={18} />
            Nyquist判据
          </h3>
          <Button variant="ghost" size="icon" className="text-knowledge-light-blue hover:text-knowledge-blue" onClick={() => setResourcePanelActive(false)}><X size={18} /></Button>
        </div>

        <Tabs defaultValue="knowledge" className="flex flex-col h-full">
          <TabsList className="flex border-b border-sidebar-border/50 mb-5">
            <TabsTrigger value="knowledge" onClick={() => setActiveResourceTab('knowledge')} className={`flex-1 py-2 px-4 text-sm ${activeResourceTab === 'knowledge' ? 'text-knowledge-blue border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>知识维度</TabsTrigger>
            <TabsTrigger value="engineering" onClick={() => setActiveResourceTab('engineering')} className={`flex-1 py-2 px-4 text-sm ${activeResourceTab === 'engineering' ? 'text-knowledge-blue border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>工程维度</TabsTrigger>
            <TabsTrigger value="ethics" onClick={() => setActiveResourceTab('ethics')} className={`flex-1 py-2 px-4 text-sm ${activeResourceTab === 'ethics' ? 'text-knowledge-blue border-b-2 border-knowledge-blue' : 'text-knowledge-light-blue'}`}>伦理维度</TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge" className="flex-1 px-0 overflow-y-auto">
            <div className="bg-resource-card-bg rounded-lg p-4 mb-4">
              <h4 className="text-base font-medium text-knowledge-text mb-3">Nyquist判据基本原理</h4>
              <p className="text-sm leading-relaxed text-resource-text">Nyquist判据是一种频域分析方法，用于判断具有反馈的控制系统的稳定性。根据Nyquist判据，如果开环传递函数G(s)H(s)的Nyquist图在临界点(-1,0)右侧的顺时针环绕数量等于开环不稳定极点数量，则闭环系统稳定。</p>
              <div className="bg-formula-bg rounded-md p-3 my-4 overflow-x-auto text-center font-serif text-knowledge-text">
                Z = N + P
              </div>
              <p className="text-sm leading-relaxed text-resource-text">其中，Z为闭环系统右半平面极点数量（不稳定极点），N为Nyquist曲线对(-1,0)点的顺时针环绕次数，P为开环传递函数右半平面极点数量。</p>
            </div>
            {/* Other knowledge content */}
          </TabsContent>

          <TabsContent value="engineering" className="flex-1 px-0 overflow-y-auto">
            <div className="bg-resource-card-bg rounded-lg p-4 mb-4">
              <h4 className="text-base font-medium text-knowledge-text mb-3">航向控制器PID参数整定</h4>
              <p className="text-sm leading-relaxed text-resource-text">基于Nyquist判据设计的船舶航向控制器，可以通过调整PID参数实现不同的控制性能。下面是交互式PID参数调整工具，可观察不同参数对系统稳定性和响应特性的影响。</p>
              <div className="my-4">
                <div className="flex items-center mb-2">
                  <label className="w-24 text-sm text-knowledge-light-blue">比例系数 Kp</label>
                  <Slider defaultValue={[3.5]} max={10} step={0.1} className="flex-1" />
                  <span className="w-10 text-right text-sm text-knowledge-blue">3.5</span>
                </div>
              </div>
              <div className="h-64 bg-formula-bg rounded-md my-4 flex items-center justify-center text-knowledge-light-blue text-sm">
                系统响应可视化<br /><br />[动态响应曲线将根据参数变化实时绘制]
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ethics" className="flex-1 px-0 overflow-y-auto">
            <div className="bg-resource-card-bg rounded-lg p-4 mb-4">
              <h4 className="text-base font-medium text-knowledge-text mb-3">船舶控制伦理决策框架</h4>
              <p className="text-sm leading-relaxed text-resource-text">在Nyquist判据应用于船舶控制系统设计时，需要考虑多重伦理约束，包括能源效率、环境保护、航行安全等多方面因素。</p>
              <ul className="list-disc pl-5 my-4 text-sm leading-relaxed text-resource-text">
                <li>位置保持精度与能源消耗的平衡</li>
                <li>极端天气条件下的安全撤离策略</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Knowledge Workshop Floating Button */}
      <div className="fixed right-8 bottom-32 z-30 flex flex-col items-center">
        <Button onClick={() => setWorkshopMenuOpen(!isWorkshopMenuOpen)} className="w-14 h-14 rounded-full bg-gradient-to-br from-workshop-bubble-gradient-start to-workshop-bubble-gradient-end text-white text-2xl shadow-lg transition-all duration-300 hover:scale-105">
          <Info size={24} />
        </Button>
        {isWorkshopMenuOpen && (
          <div className="absolute bottom-20 right-0 w-72 bg-workshop-menu-bg border border-workshop-menu-border rounded-xl p-4 shadow-xl animate-in fade-in zoom-in-90 duration-200 origin-bottom-right">
            <div className="text-base font-medium knowledge-blue mb-4 flex items-center">
              <Lightbulb className="mr-2" size={18} />
              知识工坊
            </div>
            <div className="bg-formula-bg border border-sidebar-border rounded-full p-1 flex items-center mb-4">
              <Input placeholder="提问（如：如何设计船舶航向控制器？）" className="bg-transparent border-none text-knowledge-text w-full outline-none text-sm" />
              <Button variant="ghost" size="icon" className="text-knowledge-blue hover:text-knowledge-blue"><Send size={16} /></Button>
            </div>
            {/* Workshop options */}
            <div className="space-y-2">
              <div className="p-3 rounded-lg flex items-center cursor-pointer transition-all duration-200 hover:bg-sidebar-border/10">
                <div className="w-8 h-8 bg-sidebar-border/30 rounded-md flex items-center justify-center mr-3 text-knowledge-blue"><Bookmark size={16} /></div>
                <div>
                  <div className="text-sm">学习路径书签</div>
                  <div className="text-xs text-knowledge-light-blue">保存和管理自定义学习路径</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sync Panel */}
      <div className="fixed bottom-0 left-0 right-0 h-[10vh] bg-sync-panel-bg border-t border-sync-panel-border px-8 flex items-center justify-between z-10">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-sidebar-border/30 rounded-md flex items-center justify-center mr-4 text-knowledge-blue"><Activity size={20} /></div>
          <div>
            <div className="text-sm">当前学习：动力定位系统</div>
            <div className="text-xs text-knowledge-light-blue">完成度：75% | 已解锁：学习主体模块</div>
          </div>
        </div>
        <div className="flex items-center">
          <Button className="bg-gradient-to-br from-workshop-bubble-gradient-start to-workshop-bubble-gradient-end text-white px-4 py-2 rounded flex items-center mr-5 text-sm hover:shadow-md">
            <FlaskConical className="mr-2" size={16} />
            一键跳转实验室
          </Button>
          <div className="flex items-center">
            <span className="text-sm text-knowledge-light-blue">学习进度</span>
            <div className="w-[150px] h-1.5 bg-sidebar-border/20 rounded-sm mx-2 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[75%] bg-gradient-to-r from-knowledge-blue to-[#6fa8e7] rounded-sm"></div>
            </div>
            <span className="text-sm knowledge-blue">75%</span>
            <div className="w-8 h-8 bg-badge-bg rounded-full flex items-center justify-center text-badge-color ml-2" title="海洋工程师徽章"><Award size={16} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
