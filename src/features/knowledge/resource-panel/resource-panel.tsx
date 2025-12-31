'use client';

/**
 * ResourcePanel - 知识图谱右侧资源面板
 */

import { useEffect, useState } from 'react';
import { X, FileText, Beaker, Scale, BookOpen, GraduationCap } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { KnowledgeCard } from '../knowledge-card';

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
}

type TabType = 'knowledge' | 'engineering' | 'ethics';

export function ResourcePanel({ isOpen, selectedNode, onClose }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('knowledge');
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeData | null>(null);

  useEffect(() => {
    if (!selectedNode) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${selectedNode.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as KnowledgeNodeData;
        setNodeDetail(data);
      } catch (error) {
        console.error('Failed to fetch knowledge node detail:', error);
      }
    };

    setNodeDetail(null);
    fetchDetail();
  }, [selectedNode]);

  if (!isOpen || !selectedNode) return null;
  const displayNode = nodeDetail || selectedNode;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'knowledge', label: '知识维度', icon: <FileText className="h-4 w-4" /> },
    { id: 'engineering', label: '工程维度', icon: <Beaker className="h-4 w-4" /> },
    { id: 'ethics', label: '伦理维度', icon: <Scale className="h-4 w-4" /> },
  ];

  return (
    <aside
      className={`absolute right-0 top-0 h-full w-[40%] min-w-[350px] max-w-[600px] transform overflow-y-auto border-l border-blue-500/30 bg-[#091540]/95 transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-blue-500/30 p-4 sticky top-0 bg-[#091540]/95 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          <span className="font-medium truncate max-w-[200px]">{selectedNode.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-blue-500/30 sticky top-[60px] bg-[#091540]/95 z-10 backdrop-blur-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {activeTab === 'knowledge' && (
          <KnowledgeContent node={displayNode} />
        )}
        {activeTab === 'engineering' && (
          <EngineeringContent node={displayNode} />
        )}
        {activeTab === 'ethics' && (
          <EthicsContent node={displayNode} />
        )}
      </div>
    </aside>
  );
}

// 知识维度内容
function KnowledgeContent({ node }: { node: KnowledgeNodeData }) {
  // 适配层：将节点数据转换为 KnowledgeCard 需要的格式
  // 优先使用 node.metadata，如果不存在则回退到 legacy 逻辑
  
  const metadata = node.metadata || {
      type: 'rich-text',
      content: node.description, // Fallback
      formulas: {},
      applications: [],
  };

  // 如果有旧的 content 字段 (legacy)，尝试合并
  if (!node.metadata && node.content) {
      if (node.content.explanation) metadata.content = node.content.explanation as string;
      if (node.content.formulaContinuous) metadata.formulas.continuous = node.content.formulaContinuous as string;
      if (node.content.applications) metadata.applications = node.content.applications as string[];
  }

  return (
    <div className="space-y-4">
       <KnowledgeCard 
         name={node.name}
         description={node.description}
         nodeType={node.nodeType}
         bloomLevel={node.bloomLevel}
         knowledgeDim={node.knowledgeDim}
         metadata={metadata}
         resources={node.resources}
         className="border-none bg-transparent p-0"
       />

      {/* 船舶应用 (Generic fallback if not in metadata) */}
      {!metadata.applications && (
        <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
            <h3 className="mb-3 font-medium text-blue-400">船舶控制中的应用</h3>
            <p className="text-sm leading-relaxed text-slate-300">
            在船舶控制系统设计中，{node.name}用于分析系统稳定性并指导控制器的设计。
            </p>
        </div>
      )}
    </div>
  );
}

// 工程维度内容
function EngineeringContent({ node }: { node: KnowledgeNodeData }) {
  return (
    <div className="space-y-4">
      {/* PID 参数调节 */}
      <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-4 font-medium text-blue-400">交互式参数调节</h3>

        <div className="space-y-4">
          {/* Kp 滑块 */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-400">比例增益 Kp</span>
              <span className="text-blue-400">1.0</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              defaultValue="1"
              className="w-full accent-blue-500"
            />
          </div>
          
           {/* Ki 滑块 */}
           <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-400">积分增益 Ki</span>
              <span className="text-blue-400">0.1</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              defaultValue="0.1"
              className="w-full accent-blue-500"
            />
          </div>

          {/* Kd 滑块 */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-400">微分增益 Kd</span>
              <span className="text-blue-400">0.5</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              defaultValue="0.5"
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 响应曲线占位 */}
      <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-3 font-medium text-blue-400">阶跃响应曲线</h3>
        <div className="flex h-40 items-center justify-center rounded-lg bg-[#020721]">
          <span className="text-sm text-slate-500">响应曲线图表（待集成）</span>
        </div>
      </div>

      {/* 跳转仿真按钮 */}
      <button className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-500">
        一键跳转仿真实验室
      </button>
    </div>
  );
}

// 伦理维度内容
function EthicsContent({ node }: { node: KnowledgeNodeData }) {
  return (
    <div className="space-y-4">
      {/* 伦理考量 */}
      <div className="rounded-lg border border-green-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-3 font-medium text-green-400">伦理考量</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          在{node.name}的工程实践中，需要关注以下伦理问题：
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>系统失效时的安全保障机制</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>能源消耗与环境影响的平衡</span>
          </li>
        </ul>
      </div>

      {/* 跳转伦理沙盘 */}
      <button className="w-full rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-500">
        进入伦理决策沙盘
      </button>
    </div>
  );
}
