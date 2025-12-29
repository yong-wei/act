'use client';

/**
 * ResourcePanel - 知识图谱右侧资源面板
 */

import { useState } from 'react';
import { X, FileText, Beaker, Scale, BookOpen, GraduationCap } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { getLessonKnowledgeCard } from '../data/lesson-knowledge-cards';

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
}

type TabType = 'knowledge' | 'engineering' | 'ethics';

export function ResourcePanel({ isOpen, selectedNode, onClose }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('knowledge');

  if (!isOpen || !selectedNode) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'knowledge', label: '知识维度', icon: <FileText className="h-4 w-4" /> },
    { id: 'engineering', label: '工程维度', icon: <Beaker className="h-4 w-4" /> },
    { id: 'ethics', label: '伦理维度', icon: <Scale className="h-4 w-4" /> },
  ];

  return (
    <aside
      className={`absolute right-0 top-0 h-full w-[40%] min-w-[350px] max-w-[500px] transform overflow-y-auto border-l border-blue-500/30 bg-[#091540]/95 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-blue-500/30 p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          <span className="font-medium">{selectedNode.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              selectedNode.nodeType === 'THEORY'
                ? 'bg-blue-500/20 text-blue-400'
                : selectedNode.nodeType === 'SCENARIO'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-green-500/20 text-green-400'
            }`}
          >
            {selectedNode.nodeType === 'THEORY'
              ? '控制理论'
              : selectedNode.nodeType === 'SCENARIO'
                ? '船舶场景'
                : '伦理决策'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-blue-500/30">
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
          <KnowledgeContent node={selectedNode} />
        )}
        {activeTab === 'engineering' && (
          <EngineeringContent node={selectedNode} />
        )}
        {activeTab === 'ethics' && (
          <EthicsContent node={selectedNode} />
        )}
      </div>
    </aside>
  );
}

// 知识维度内容
function KnowledgeContent({ node }: { node: KnowledgeNodeData }) {
  // 检查是否为课程知识卡片
  const lessonCard = getLessonKnowledgeCard(node.id);
  const isLessonCard = !!lessonCard;

  return (
    <div className="space-y-4">
      {/* 课程知识卡片标签 */}
      {isLessonCard && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
          <GraduationCap className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-400">
            课程知识卡片 · {lessonCard.lessonId === 'lesson-02' ? '第2课：微分方程建模' : lessonCard.lessonId}
          </span>
        </div>
      )}

      {/* 基本原理 */}
      <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-3 font-medium text-blue-400">
          {isLessonCard ? '核心概念' : `${node.name}基本原理`}
        </h3>
        <p className="text-sm leading-relaxed text-slate-300">{node.description}</p>

        {/* 详细解释（课程知识卡片） */}
        {isLessonCard && lessonCard.explanation && (
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{lessonCard.explanation}</p>
        )}

        {/* 公式显示 */}
        {isLessonCard && lessonCard.formulaContinuous && (
          <div className="mt-4 rounded-lg bg-[#020721] p-4">
            <div className="mb-2 text-xs text-slate-500">核心公式</div>
            <code className="block text-center font-mono text-lg text-emerald-400">
              {formatLatexForDisplay(lessonCard.formulaContinuous)}
            </code>
          </div>
        )}

        {/* 示例公式（非课程卡片） */}
        {!isLessonCard && node.nodeType === 'THEORY' && (
          <div className="mt-4 rounded-lg bg-[#020721] p-4 text-center">
            <span className="font-serif text-lg text-slate-200">
              {node.name === 'Nyquist判据' && 'Z = N + P'}
              {node.name === '传递函数' && 'G(s) = Y(s) / X(s)'}
              {node.name === 'PID控制器' && 'u(t) = Kp·e(t) + Ki·∫e(t)dt + Kd·de(t)/dt'}
              {node.name === 'Kalman滤波' && 'x̂k = Ax̂k-1 + Bu + K(z - Hx̂k-1)'}
              {node.name === '鲁棒控制' && '||T(s)||∞ < γ'}
              {node.name === '模糊控制' && 'IF x is A THEN y is B'}
            </span>
          </div>
        )}
      </div>

      {/* 应用领域（课程知识卡片） */}
      {isLessonCard && lessonCard.applications && lessonCard.applications.length > 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
          <h3 className="mb-3 font-medium text-blue-400">应用领域</h3>
          <div className="flex flex-wrap gap-2">
            {lessonCard.applications.map((app, index) => (
              <span
                key={index}
                className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-300"
              >
                {app}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 船舶应用 */}
      <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-3 font-medium text-blue-400">船舶控制中的应用</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          在船舶控制系统设计中，{node.name}用于分析系统稳定性并指导控制器的设计。
          通过该方法可确定控制器参数范围，保证闭环系统稳定性。
        </p>
      </div>

      {/* 参数表格 */}
      {node.nodeType === 'THEORY' && (
        <div className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
          <h3 className="mb-3 font-medium text-blue-400">典型船型参数</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-500/20 text-left text-slate-400">
                  <th className="pb-2">船型</th>
                  <th className="pb-2">K值范围</th>
                  <th className="pb-2">T值(s)</th>
                  <th className="pb-2">稳定裕度</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-blue-500/10">
                  <td className="py-2">大型油轮</td>
                  <td>0.8 - 1.2</td>
                  <td>120 - 180</td>
                  <td className="text-amber-400">中等</td>
                </tr>
                <tr className="border-b border-blue-500/10">
                  <td className="py-2">集装箱船</td>
                  <td>1.0 - 1.5</td>
                  <td>80 - 120</td>
                  <td className="text-green-400">良好</td>
                </tr>
                <tr className="border-b border-blue-500/10">
                  <td className="py-2">深潜器</td>
                  <td>1.2 - 1.8</td>
                  <td>30 - 60</td>
                  <td className="text-green-400">极高</td>
                </tr>
                <tr>
                  <td className="py-2">动力定位平台</td>
                  <td>0.5 - 1.0</td>
                  <td>200 - 250</td>
                  <td className="text-red-400">较低</td>
                </tr>
              </tbody>
            </table>
          </div>
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
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>极端条件下的决策优先级</span>
          </li>
        </ul>
      </div>

      {/* 案例分析 */}
      <div className="rounded-lg border border-green-500/20 bg-[#0c1d4f]/50 p-4">
        <h3 className="mb-3 font-medium text-green-400">典型伦理案例</h3>
        <div className="space-y-3">
          <div className="rounded-lg bg-[#020721] p-3">
            <div className="mb-1 text-sm font-medium text-slate-200">北极航道紧急避险</div>
            <div className="text-xs text-slate-400">
              涉及：环境保护 vs 人员安全 vs 经济损失
            </div>
          </div>
          <div className="rounded-lg bg-[#020721] p-3">
            <div className="mb-1 text-sm font-medium text-slate-200">石油平台防撞决策</div>
            <div className="text-xs text-slate-400">
              涉及：设备保护 vs 环境污染 vs 作业连续性
            </div>
          </div>
        </div>
      </div>

      {/* 跳转伦理沙盘 */}
      <button className="w-full rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-500">
        进入伦理决策沙盘
      </button>
    </div>
  );
}

/**
 * 将 LaTeX 公式转换为可读显示格式
 * 简单替换常见的 LaTeX 符号为 Unicode/HTML 等价物
 */
function formatLatexForDisplay(latex: string): string {
  return latex
    // 希腊字母
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\pi/g, 'π')
    // 导数符号
    .replace(/\\ddot\{([^}]+)\}/g, '$1̈')
    .replace(/\\dot\{([^}]+)\}/g, '$1̇')
    // 分数
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    // 积分
    .replace(/\\int/g, '∫')
    // 三角函数
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    // 约等于
    .replace(/\\approx/g, '≈')
    // 小于小于
    .replace(/\\ll/g, '≪')
    // 移除剩余的反斜杠命令
    .replace(/\\quad/g, '  ')
    .replace(/\\,/g, ' ')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
}
