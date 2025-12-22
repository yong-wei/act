'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Icons (assuming these are available or will be added)
import {
  Settings, HelpCircle, Gauge, AlertTriangle, FlaskConical, LayoutDashboard, 
  Cog, ScrollText, Bot, Cloud, TreePalm, Book, Plug, BarChart2, 
  Users, CheckSquare, TrendingUp, DollarSign, Shield, Globe, X
} from 'lucide-react';

export default function BackgroundPage() {
  const [showGhostProtocol, setShowGhostProtocol] = useState(false);
  const [techDimension, setTechDimension] = useState(87);
  const [ethicsDimension, setEthicsDimension] = useState(62);
  const [simulationSliderValue, setSimulationSliderValue] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTechDimension(prev => Math.max(70, Math.min(95, prev + (Math.random() > 0.5 ? 1 : -1))));
      setEthicsDimension(prev => Math.max(55, Math.min(85, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const predictedKnowledgeRate = 76 + simulationSliderValue / 3;

  return (
    <div className="bg-bg-bg-dark text-bg-light h-screen grid grid-rows-[140px_1fr_120px] grid-cols-[250px_1fr_250px] lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[60px_1fr]" style={{ gridTemplateAreas: '"header header header" "sidebar main rightpanel" "footer footer footer"' }}>
      {/* Header */}
      <header className="grid-area-header bg-gradient-to-b from-bg-bg-dark to-bg-primary p-4 border-b-2 border-bg-accent flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl">船舶虚拟仿真教师管理后台</h1>
          <div className="flex gap-4">
            <Button className="bg-bg-secondary text-bg-light px-3 py-1 rounded"><HelpCircle className="mr-2" size={16} />帮助</Button>
            <Button className="bg-bg-accent text-bg-dark px-3 py-1 rounded"><Settings className="mr-2" size={16} />系统设置</Button>
          </div>
        </div>
        <div className="flex gap-3 h-[70px]">
          <div className="flex-grow-[2] bg-bg-accent/10 border border-bg-accent rounded-md p-2 flex flex-col justify-between">
            <div className="text-sm">实时战力图</div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-bg-accent grid place-items-center">
                <div className="w-10 h-10 rounded-full" style={{ background: `conic-gradient(var(--bg-success) ${techDimension}%, var(--bg-warning) ${techDimension}%)` }}></div>
              </div>
              <div>
                <div>技术维度: <span className="text-bg-success">{techDimension}%</span></div>
                <div>伦理维度: <span className="text-bg-warning">{ethicsDimension}%</span></div>
              </div>
            </div>
          </div>
          <div className="flex-grow-[2] bg-bg-warning/10 border border-bg-warning rounded-md p-2 overflow-hidden">
            <div className="text-sm">异常警报面板</div>
            <div className="animate-[scroll_15s_linear_infinite]">
              <div className="text-bg-warning text-sm mb-1">⚠️ 张明（1933021）连续3次伦理决策偏差</div>
              <div className="text-bg-warning text-sm mb-1">⚠️ B组推进系统实验超调量达23%</div>
              <div className="text-bg-warning text-sm mb-1">⚠️ 李涵（1933047）连续两天未完成强制案例</div>
              <div className="text-bg-warning text-sm">⚠️ A组舵机调试异常中断5次</div>
            </div>
          </div>
          <div className="flex-grow-[3] bg-bg-accent/10 border border-bg-accent rounded-md p-2 flex flex-col">
            <div className="text-sm">教学沙盘推演</div>
            <div className="flex flex-col flex-grow">
              <div className="flex justify-between text-sm">
                <span>知识掌握率预测</span>
                <span>当前: 76% → 预计: {predictedKnowledgeRate.toFixed(0)}%</span>
              </div>
              <Slider defaultValue={[simulationSliderValue]} max={21} step={1} onValueChange={(val) => setSimulationSliderValue(val[0])} className="w-full mt-2" />
              <div className="flex justify-between text-xs mt-1">
                <span>当前</span><span>1周后</span><span>2周后</span><span>3周后</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="grid-area-sidebar bg-bg-primary p-4 border-r border-bg-secondary flex flex-col gap-3 lg:w-[60px] lg:items-center">
        <div className="mb-2">
          <div className="text-bg-accent font-semibold mb-1 flex items-center gap-2 lg:justify-center">
            <Cog size={16} />
            <span className="lg:hidden">实验工卡工厂</span>
          </div>
          <div className="flex flex-col gap-1 pl-5 lg:pl-0">
            <div className="text-sm p-2 rounded transition-all cursor-pointer hover:bg-bg-secondary flex items-center gap-2 active:bg-bg-accent active:text-bg-dark">
              <ScrollText size={16} />
              <span className="lg:hidden">实验序列编辑器</span>
            </div>
            <div className="text-sm p-2 rounded transition-all cursor-pointer bg-bg-accent text-bg-dark flex items-center gap-2">
              <Search size={16} />
              <span className="lg:hidden">参数阈值设置</span>
            </div>
            <div className="text-sm p-2 rounded transition-all cursor-pointer hover:bg-bg-secondary flex items-center gap-2">
              <Bot size={16} />
              <span className="lg:hidden">AI介入规则</span>
            </div>
          </div>
        </div>
        {/* Other nav groups */}
      </nav>

      {/* Main Content */}
      <main className="grid-area-main p-4 overflow-y-auto bg-[#233445] bg-[size:20px_20px] bg-[linear-gradient(rgba(65,182,230,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(65,182,230,0.05)_1px,transparent_1px)] relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">动力定位系统专题教学</h2>
          <div className="flex gap-2">
            <Button className="bg-bg-secondary text-bg-light px-3 py-1 rounded">重置</Button>
            <Button className="bg-bg-accent text-bg-dark px-3 py-1 rounded">保存配置</Button>
            <Button onClick={() => setShowGhostProtocol(true)} className="bg-bg-warning text-bg-light px-3 py-1 rounded">应急模式</Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1 bg-bg-secondary/15 border border-bg-secondary rounded-md p-4 flex flex-col min-h-[200px]">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-bg-accent/30">
                <h3 className="font-semibold text-bg-accent text-sm">学员舰队编组</h3>
                <Button className="bg-bg-secondary text-bg-light px-2 py-1 rounded text-xs">编辑组队</Button>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between mb-2 text-sm">
                  <div className="bg-bg-accent/20 px-2 py-1 rounded border border-bg-accent">A组 (技术: 高, 伦理: 中)</div>
                  <div className="bg-bg-accent/20 px-2 py-1 rounded border border-bg-accent">B组 (技术: 中, 伦理: 高)</div>
                </div>
                <div className="flex-1 bg-bg-accent/5 border border-bg-accent/30 rounded grid place-items-center text-sm">
                  拖拽学员至此区域进行分组
                </div>
              </div>
            </div>
            <div className="flex-1 bg-bg-secondary/15 border border-bg-secondary rounded-md p-4 flex flex-col min-h-[200px]">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-bg-accent/30">
                <h3 className="font-semibold text-bg-accent text-sm">认知航道规划</h3>
                <Button className="bg-bg-secondary text-bg-light px-2 py-1 rounded text-xs">调整路径</Button>
              </div>
              <div className="flex-1 w-full overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-5 flex justify-between text-xs">
                  <span>第1周</span><span>第2周</span><span>第3周</span><span>第4周</span>
                </div>
                <div className="mt-5 w-full h-[calc(100%-20px)] flex flex-col justify-around">
                  <div className="w-full h-0.5 bg-bg-accent relative">
                    <div className="absolute -top-2 w-4 h-4 rounded-full bg-bg-accent left-[20%]"></div>
                    <div className="absolute -top-2 w-4 h-4 rounded-full bg-bg-accent left-[40%]"></div>
                    <div className="absolute -top-2 w-4 h-4 rounded-full bg-bg-warning left-[60%]"></div>
                    <div className="absolute -top-2 w-4 h-4 rounded-full bg-bg-accent left-[80%]"></div>
                  </div>
                  <div className="text-xs text-bg-warning text-center">
                    必修思政案例: 海上环保责任与国际公约
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-bg-secondary/15 border border-bg-secondary rounded-md p-4 flex flex-col min-h-[200px]">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-bg-accent/30">
                <h3 className="font-semibold text-bg-accent text-sm">AI助教训练营</h3>
                <Button className="bg-bg-secondary text-bg-light px-2 py-1 rounded text-xs">调参</Button>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="bg-bg-accent/5 rounded-md p-2">
                  <div className="mb-1 text-sm">伦理权重调参台</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-sm">
                      <span>安全决策</span>
                      <Slider defaultValue={[75]} max={100} step={1} className="w-[60%]" />
                      <span>75%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>生态决策</span>
                      <Slider defaultValue={[60]} max={100} step={1} className="w-[60%]" />
                      <span>60%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>经济决策</span>
                      <Slider defaultValue={[40]} max={100} step={1} className="w-[60%]" />
                      <span>40%</span>
                    </div>
                  </div>
                </div>
                <Button className="bg-bg-accent text-bg-dark px-3 py-1 rounded self-center">标注训练数据</Button>
              </div>
            </div>
            <div className="flex-1 bg-bg-secondary/15 border border-bg-secondary rounded-md p-4 flex flex-col min-h-[200px]">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-bg-accent/30">
                <h3 className="font-semibold text-bg-accent text-sm">实验状态监控</h3>
                <Button className="bg-bg-secondary text-bg-light px-2 py-1 rounded text-xs">详情</Button>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex gap-2 text-sm">
                  <div className="flex-1 h-16 bg-bg-success/20 rounded-md p-2 flex flex-col justify-center">
                    <div>在线学员</div>
                    <div className="text-lg font-semibold">28/32</div>
                  </div>
                  <div className="flex-1 h-16 bg-bg-accent/20 rounded-md p-2 flex flex-col justify-center">
                    <div>平均完成度</div>
                    <div className="text-lg font-semibold">73%</div>
                  </div>
                </div>
                <div className="flex-1 bg-bg-accent/5 rounded-md p-2 flex flex-col gap-1 text-sm">
                  <div className="text-xs">当前任务进度</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-bg-success"></div>
                    <div>建模阶段</div>
                    <div className="ml-auto">100%</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-bg-accent"></div>
                    <div>控制阶段</div>
                    <div className="ml-auto">65%</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-bg-light"></div>
                    <div>验证阶段</div>
                    <div className="ml-auto">0%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel */}
      <aside className="grid-area-rightpanel bg-bg-primary p-4 border-l border-bg-secondary flex flex-col gap-3 fixed right-[-250px] top-[140px] bottom-[120px] w-[250px] z-50 transition-all duration-300 hover:right-0 lg:static lg:w-auto lg:right-auto lg:top-auto lg:bottom-auto lg:hover:right-auto">
        <Tabs defaultValue="params" className="flex flex-col h-full">
          <TabsList className="flex border-b border-bg-secondary mb-3 rounded-none">
            <TabsTrigger value="params" className="flex-1 py-2 text-xs data-[state=active]:border-b-bg-accent data-[state=active]:border-b-2 data-[state=active]:text-bg-accent text-bg-light/70">参数显微镜</TabsTrigger>
            <TabsTrigger value="ethics" className="flex-1 py-2 text-xs data-[state=active]:border-b-bg-accent data-[state=active]:border-b-2 data-[state=active]:text-bg-accent text-bg-light/70">伦理光谱仪</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 py-2 text-xs data-[state=active]:border-b-bg-accent data-[state=active]:border-b-2 data-[state=active]:text-bg-accent text-bg-light/70">时空回溯仪</TabsTrigger>
          </TabsList>
          <TabsContent value="params" className="flex-1 overflow-y-auto">
            <div className="bg-bg-secondary/15 border border-bg-secondary rounded-md p-3 mb-3">
              <h4 className="text-bg-accent font-semibold text-sm mb-2">超调量分布分析</h4>
              <div className="h-24 flex items-end gap-1 pt-2">
                <div className="flex-1 h-[40%] bg-bg-accent rounded-t-sm"></div>
                <div className="flex-1 h-[60%] bg-bg-accent rounded-t-sm"></div>
                <div className="flex-1 h-[75%] bg-bg-warning rounded-t-sm"></div>
                <div className="flex-1 h-[30%] bg-bg-accent rounded-t-sm"></div>
                <div className="flex-1 h-[20%] bg-bg-accent rounded-t-sm"></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>0-5%</span><span>5-10%</span><span>10-15%</span><span>15-20%</span><span>&gt;20%</span>
              </div>
            </div>
            {/* Other analysis tools */}
          </TabsContent>
          <TabsContent value="ethics" className="flex-1 overflow-y-auto">伦理光谱仪内容</TabsContent>
          <TabsContent value="history" className="flex-1 overflow-y-auto">时空回溯仪内容</TabsContent>
        </Tabs>
      </aside>

      {/* Footer */}
      <footer className="grid-area-footer bg-bg-primary p-4 border-t border-bg-secondary">
        <div className="flex gap-4 overflow-x-auto pb-2">
          <div className="min-w-[150px] h-20 bg-bg-secondary/30 border border-bg-secondary rounded-md p-2 flex flex-col justify-between transition-all cursor-pointer hover:border-bg-accent hover:translate-y-[-3px]">
            <div className="font-semibold text-sm">模型军械库</div>
            <div className="flex justify-between items-end text-xs">
              <span>84个模型</span>
              <Button className="bg-bg-secondary text-bg-light px-2 py-1 rounded text-xs">管理</Button>
            </div>
          </div>
          {/* Other resource cards */}
        </div>
      </footer>

      {/* Ghost Protocol Console */}
      {showGhostProtocol && (
        <div className="fixed bottom-36 right-5 bg-bg-warning/20 border border-bg-warning rounded-md p-4 w-72 z-50 animate-pulse">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-bg-warning/50">
            <h3 className="text-bg-warning font-semibold">幽灵协议控制台</h3>
            <Button onClick={() => setShowGhostProtocol(false)} className="bg-bg-warning text-bg-light px-2 py-1 rounded text-xs">关闭</Button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="bg-bg-warning/10 border border-bg-warning/30 rounded-md p-2 cursor-pointer transition-all hover:bg-bg-warning/30">
              <div className="font-semibold text-sm mb-1">认知重启协议</div>
              <div className="text-xs">重置学员知识状态（需教务审批）</div>
            </div>
            {/* Other protocol tools */}
          </div>
        </div>
      )}
    </div>
  );
}
