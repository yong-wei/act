'use client';

/**
 * KnowledgeSidebar - 知识图谱左侧导航栏
 */

import { Search } from 'lucide-react';
import type { KnowledgeNodeData, LearningPathItem } from '../knowledge-graph-system';

interface KnowledgeSidebarProps {
  activeTab: 'cognitive' | 'style' | 'ethics';
  onTabChange: (tab: 'cognitive' | 'style' | 'ethics') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  learningPath: LearningPathItem[];
  onNodeSelect: (node: KnowledgeNodeData) => void;
  nodes: KnowledgeNodeData[];
}

export function KnowledgeSidebar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  learningPath,
}: KnowledgeSidebarProps) {
  const tabs = [
    { id: 'cognitive' as const, label: '认知跃迁助手' },
    { id: 'style' as const, label: '学习风格适配' },
    { id: 'ethics' as const, label: '思政融合筛选' },
  ];

  return (
    <aside className="w-[30%] min-w-[280px] max-w-[400px] overflow-y-auto border-r border-blue-500/30 bg-[#091540]/80 p-5">
      {/* 头部标题 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-xl font-medium text-blue-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          船舶知识图谱导航
        </h2>
      </div>

      {/* 标签页 */}
      <div className="mb-5 flex border-b border-blue-500/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-4 py-3 text-sm transition-colors ${
              activeTab === tab.id
                ? 'font-medium text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* 认知跃迁助手 */}
      {activeTab === 'cognitive' && (
        <div className="space-y-5">
          {/* 搜索框 */}
          <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-[#0c1d4f]/60 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="输入学习目标，如'掌握动力定位原理'"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>

          {/* 学习路径 */}
          <div className="rounded-lg bg-[#1a2958]/50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium text-blue-400">动力定位系统学习路径</span>
              <span className="text-sm text-slate-400">推荐时长：3.5小时</span>
            </div>

            <div className="space-y-1">
              {learningPath.map((item) => (
                <div
                  key={item.order}
                  className="flex items-center gap-3 border-b border-dashed border-blue-500/20 py-3 last:border-0"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-xs text-blue-400">
                    {item.order}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{item.title}</div>
                    <div className="text-xs text-slate-400">
                      {item.description} | 优先级：
                      <span
                        className={
                          item.priority === 'high'
                            ? 'text-red-400'
                            : item.priority === 'medium'
                              ? 'text-amber-400'
                              : 'text-green-400'
                        }
                      >
                        {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 学习风格适配 */}
      {activeTab === 'style' && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-4 text-sm text-slate-400">根据学习风格选择内容展示形式</h3>
            <div className="space-y-3">
              {[
                { id: 'visual', label: '视觉型学习者（优先显示三维模型）', checked: true },
                { id: 'text', label: '文本型学习者（优先显示工艺文档）', checked: false },
                { id: 'interactive', label: '实践型学习者（优先显示交互式演示）', checked: true },
                { id: 'audio', label: '听觉型学习者（优先显示讲解视频）', checked: false },
                { id: 'logical', label: '逻辑型学习者（优先显示推导过程）', checked: true },
              ].map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={option.checked}
                    className="h-4 w-4 rounded border-blue-500 bg-transparent text-blue-500 focus:ring-blue-500/50"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-[#1a2958]/50 p-4">
            <div className="mb-3 font-medium text-blue-400">个性化资源推荐</div>
            <div className="space-y-3">
              {[
                { title: '动力定位三维交互模型', desc: '适合视觉型学习者' },
                { title: 'PID参数实时调整实验', desc: '适合实践型学习者' },
                { title: '传递函数数学推导过程', desc: '适合逻辑型学习者' },
              ].map((item, i) => (
                <div key={i} className="border-b border-dashed border-blue-500/20 pb-3 last:border-0">
                  <div className="text-sm">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 思政融合筛选 */}
      {activeTab === 'ethics' && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-4 text-sm text-slate-400">思政融合主题筛选</h3>
            <div className="space-y-3">
              {[
                { id: 'polar', label: '北极生态保护约束', checked: true },
                { id: 'energy', label: '船舶能源节约与环保', checked: true },
                { id: 'safety', label: '海上安全与应急决策', checked: true },
                { id: 'tech', label: '船舶工程技术自主创新', checked: false },
                { id: 'international', label: '国际海事合作与规范', checked: false },
              ].map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={option.checked}
                    className="h-4 w-4 rounded border-blue-500 bg-transparent text-blue-500 focus:ring-blue-500/50"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-[#1a2958]/50 p-4">
            <div className="mb-3 font-medium text-blue-400">思政融合结点</div>
            <div className="space-y-3">
              {[
                { title: '北极航道决策系统伦理规范', desc: '关联：破冰航行、环保约束' },
                { title: '南海石油平台防撞伦理决策', desc: '关联：动力定位、安全预警' },
                { title: '船舶减摇与船员安全平衡', desc: '关联：节能优化、人员保护' },
              ].map((item, i) => (
                <div key={i} className="border-b border-dashed border-blue-500/20 pb-3 last:border-0">
                  <div className="text-sm">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
