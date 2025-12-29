'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';

// 动态导入 3D 图谱组件（客户端专用）
const KnowledgeGraphCanvas = dynamic(
  () => import('./graph/knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
  { ssr: false }
);

// 知识节点类型
export type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';

// 知识节点接口
export interface KnowledgeNodeData {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  content?: Record<string, unknown>;
  resources?: unknown[];
  ethicsContent?: Record<string, unknown>;
}

// 知识连接接口
export interface KnowledgeLinkData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
}

// 学习路径接口
export interface LearningPathItem {
  order: number;
  title: string;
  description: string;
  estimatedTime: number;
  priority: 'high' | 'medium' | 'low';
}

// 示例节点数据
const sampleNodes: KnowledgeNodeData[] = [
  // 控制理论节点 - 蓝色
  { id: '1', name: '传递函数', nodeType: 'THEORY', description: '描述系统输入输出动态关系的数学表达', positionX: 0, positionY: 0, positionZ: 0 },
  { id: '2', name: 'Nyquist判据', nodeType: 'THEORY', description: '用于分析闭环系统稳定性的频域方法', positionX: 30, positionY: 10, positionZ: 15 },
  { id: '3', name: 'PID控制器', nodeType: 'THEORY', description: '比例-积分-微分控制器，船舶控制系统常用控制器', positionX: -20, positionY: 5, positionZ: 25 },
  { id: '4', name: '鲁棒控制', nodeType: 'THEORY', description: '对系统参数变化和外部干扰具有不敏感性的控制方法', positionX: 15, positionY: -15, positionZ: -20 },
  { id: '5', name: 'Kalman滤波', nodeType: 'THEORY', description: '状态估计算法，用于船舶导航和位置估计', positionX: -25, positionY: 0, positionZ: -15 },
  { id: '6', name: '模糊控制', nodeType: 'THEORY', description: '基于模糊逻辑的非线性控制方法', positionX: 40, positionY: -10, positionZ: 0 },

  // 场景应用节点 - 红色
  { id: '7', name: '动力定位系统', nodeType: 'SCENARIO', description: '使用推进器自动维持船舶位置和航向的系统', positionX: -10, positionY: 30, positionZ: 0 },
  { id: '8', name: '船舶航向控制', nodeType: 'SCENARIO', description: '自动控制船舶按给定方向航行的系统', positionX: 20, positionY: 20, positionZ: -10 },
  { id: '9', name: '推进器配置优化', nodeType: 'SCENARIO', description: '根据船舶特性优化推进器布置和控制策略', positionX: -30, positionY: 15, positionZ: 10 },
  { id: '10', name: '破冰船控制系统', nodeType: 'SCENARIO', description: '适用于极地环境的特殊船舶控制系统', positionX: 25, positionY: -20, positionZ: 20 },
  { id: '11', name: '波浪补偿系统', nodeType: 'SCENARIO', description: '抵消海浪对船舶影响的控制系统', positionX: -15, positionY: -25, positionZ: 15 },

  // 伦理决策节点 - 绿色
  { id: '12', name: '极地生态保护', nodeType: 'ETHICS', description: '在北极航行时的环境保护伦理决策', positionX: 0, positionY: -10, positionZ: 40 },
  { id: '13', name: '能源效率优化', nodeType: 'ETHICS', description: '平衡控制精度和能源消耗的伦理决策', positionX: -40, positionY: 0, positionZ: 30 },
  { id: '14', name: '碰撞风险评估', nodeType: 'ETHICS', description: '在多目标环境中的避碰伦理决策框架', positionX: 35, positionY: 30, positionZ: 5 },
];

// 示例连接数据
const sampleLinks: KnowledgeLinkData[] = [
  { id: 'l1', sourceId: '1', targetId: '2', relation: '提供理论基础' },
  { id: 'l2', sourceId: '1', targetId: '3', relation: '理论分析' },
  { id: 'l3', sourceId: '2', targetId: '8', relation: '稳定性分析' },
  { id: 'l4', sourceId: '3', targetId: '7', relation: '控制算法应用' },
  { id: 'l5', sourceId: '3', targetId: '8', relation: '控制算法应用' },
  { id: 'l6', sourceId: '4', targetId: '10', relation: '抗干扰分析' },
  { id: 'l7', sourceId: '4', targetId: '11', relation: '鲁棒性保证' },
  { id: 'l8', sourceId: '5', targetId: '7', relation: '状态估计' },
  { id: 'l9', sourceId: '6', targetId: '9', relation: '非线性优化' },
  { id: 'l10', sourceId: '7', targetId: '13', relation: '实施约束' },
  { id: 'l11', sourceId: '7', targetId: '14', relation: '安全保障' },
  { id: 'l12', sourceId: '8', targetId: '14', relation: '决策支持' },
  { id: 'l13', sourceId: '10', targetId: '12', relation: '环境影响' },
  { id: 'l14', sourceId: '3', targetId: '6', relation: '互补应用' },
  { id: 'l15', sourceId: '2', targetId: '4', relation: '稳定性理论' },
  { id: 'l16', sourceId: '9', targetId: '13', relation: '效率优化' },
];

// 示例学习路径
const sampleLearningPath: LearningPathItem[] = [
  { order: 1, title: '船舶传递函数基础', description: '掌握时间：45分钟', estimatedTime: 45, priority: 'high' },
  { order: 2, title: 'Nyquist判据应用', description: '掌握时间：60分钟', estimatedTime: 60, priority: 'high' },
  { order: 3, title: '多推进器耦合控制', description: '掌握时间：90分钟', estimatedTime: 90, priority: 'medium' },
  { order: 4, title: '极地环境适应性调整', description: '掌握时间：30分钟', estimatedTime: 30, priority: 'low' },
];

interface KnowledgeGraphSystemProps {
  nodes?: KnowledgeNodeData[];
  links?: KnowledgeLinkData[];
  learningPath?: LearningPathItem[];
}

export function KnowledgeGraphSystem({
  nodes = sampleNodes,
  links = sampleLinks,
  learningPath = sampleLearningPath,
}: KnowledgeGraphSystemProps) {
  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNodeData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cognitive' | 'style' | 'ethics'>('cognitive');
  const [searchQuery, setSearchQuery] = useState('');

  // 节点点击处理
  const handleNodeClick = useCallback((node: KnowledgeNodeData) => {
    setSelectedNode(node);
    setIsPanelOpen(true);
  }, []);

  // 节点悬停处理
  const handleNodeHover = useCallback((node: KnowledgeNodeData | null) => {
    setHoveredNode(node);
  }, []);

  // 关闭资源面板
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // 搜索节点
  const filteredNodes = searchQuery
    ? nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : nodes;

  return (
    <div className="flex h-screen w-full bg-[#020721] text-slate-200">
      {/* 左侧导航侧边栏 */}
      <KnowledgeSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        learningPath={learningPath}
        onNodeSelect={handleNodeClick}
        nodes={nodes}
      />

      {/* 中央图谱区域 */}
      <div className="relative flex-1">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
                <div className="text-blue-400">正在加载三维知识图谱...</div>
                <div className="mt-2 text-sm text-slate-500">加载船舶控制系统节点关系...</div>
              </div>
            </div>
          }
        >
          <KnowledgeGraphCanvas
            nodes={filteredNodes}
            links={links}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        </Suspense>

        {/* 节点图例 */}
        <div className="absolute bottom-20 left-4 rounded-lg border border-blue-500/30 bg-[#091540]/80 p-4">
          <div className="mb-2 text-sm text-slate-400">节点类型</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#f5544f]" />
              <span className="text-xs">船舶场景节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#4f86c6]" />
              <span className="text-xs">控制理论节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#50c38a]" />
              <span className="text-xs">伦理决策节点</span>
            </div>
          </div>
        </div>

        {/* 悬停提示 */}
        {hoveredNode && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-lg border border-blue-500/50 bg-[#091540]/95 p-4 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-100">{hoveredNode.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  hoveredNode.nodeType === 'THEORY'
                    ? 'bg-blue-500/20 text-blue-400'
                    : hoveredNode.nodeType === 'SCENARIO'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-green-500/20 text-green-400'
                }`}
              >
                {hoveredNode.nodeType === 'THEORY'
                  ? '控制理论'
                  : hoveredNode.nodeType === 'SCENARIO'
                    ? '船舶场景'
                    : '伦理决策'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{hoveredNode.description}</p>
          </div>
        )}
      </div>

      {/* 右侧资源面板 */}
      <ResourcePanel
        isOpen={isPanelOpen}
        selectedNode={selectedNode}
        onClose={handleClosePanel}
      />
    </div>
  );
}

export default KnowledgeGraphSystem;
