// 控制地图模块类型定义

export type ZoneType =
  | 'modeling'      // 建模与仿真 - 红/粉
  | 'analysis'      // 系统分析 - 绿
  | 'classic'       // 经典控制 - 蓝/青
  | 'modern'        // 现代控制 - 紫
  | 'nonlinear';    // 非线性/智能 - 黄/橙

export type DomainType = 'time' | 'frequency' | 'both';
export type TimeType = 'continuous' | 'discrete' | 'both';

export interface ControlTheoryNode {
  id: string;
  name: string;
  nameCn: string;              // 中文名称
  zone: ZoneType;
  domain: DomainType;
  timeType: TimeType;

  // 位置（用于 React Flow）
  position: { x: number; y: number };

  // 内容
  definition: string;          // 一句话定义
  explanation: string;         // 通俗解释
  formulaContinuous?: string;  // 连续时间LaTeX公式
  formulaDiscrete?: string;    // 离散时间LaTeX公式
  applications: string[];      // 应用领域

  // 关系
  prerequisites: string[];     // 前置节点ID
  relatedTopics: string[];     // 相关节点ID

  // 视觉
  icon?: string;               // Lucide图标名称
  importance: 'core' | 'advanced' | 'specialized';
}

export interface ControlTheoryEdge {
  id: string;
  source: string;
  target: string;
  relation: string;            // 关系描述
  relationCn: string;          // 中文关系描述
}

export interface ZoneConfig {
  id: ZoneType;
  name: string;
  nameCn: string;
  color: string;               // 主色调
  bgColor: string;             // 背景色（带透明度）
  borderColor: string;         // 边框色
}

export const zoneConfigs: Record<ZoneType, ZoneConfig> = {
  modeling: {
    id: 'modeling',
    name: 'Modeling & Simulation',
    nameCn: '建模与仿真',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  analysis: {
    id: 'analysis',
    name: 'System Analysis',
    nameCn: '系统分析',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  classic: {
    id: 'classic',
    name: 'Classic Control',
    nameCn: '经典控制',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  modern: {
    id: 'modern',
    name: 'Modern & Optimal Control',
    nameCn: '现代与最优控制',
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  nonlinear: {
    id: 'nonlinear',
    name: 'Nonlinear & Intelligent',
    nameCn: '非线性与智能控制',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
};

export interface ViewState {
  showTimeDomain: boolean;
  showFreqDomain: boolean;
  showContinuous: boolean;
  showDiscrete: boolean;
  searchQuery: string;
  selectedNode: string | null;
  hoveredNode: string | null;
}

export interface SidebarContent {
  node: ControlTheoryNode | null;
  isOpen: boolean;
}

// 默认视图状态
export const defaultViewState: ViewState = {
  showTimeDomain: true,
  showFreqDomain: true,
  showContinuous: true,
  showDiscrete: true,
  searchQuery: '',
  selectedNode: null,
  hoveredNode: null,
};
