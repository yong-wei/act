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
  color: string;               // 主色调（CSS 颜色表达式）
  bgColor: string;             // 背景色（带透明度）
  borderColor: string;         // 边框色
}

/** 区域色取自平台语义色 token，深浅主题各自取值。 */
function zoneColor(token: string, alpha?: number) {
  return alpha === undefined ? `hsl(var(${token}))` : `hsl(var(${token}) / ${alpha})`;
}

export const zoneConfigs: Record<ZoneType, ZoneConfig> = {
  modeling: {
    id: 'modeling',
    name: 'Modeling & Simulation',
    nameCn: '建模与仿真',
    color: zoneColor('--platform-brand-danger'),
    bgColor: zoneColor('--platform-brand-danger', 0.14),
    borderColor: zoneColor('--platform-brand-danger', 0.55),
  },
  analysis: {
    id: 'analysis',
    name: 'System Analysis',
    nameCn: '系统分析',
    color: zoneColor('--platform-chart-3'),
    bgColor: zoneColor('--platform-chart-3', 0.14),
    borderColor: zoneColor('--platform-chart-3', 0.55),
  },
  classic: {
    id: 'classic',
    name: 'Classic Control',
    nameCn: '经典控制',
    color: zoneColor('--platform-chart-1'),
    bgColor: zoneColor('--platform-chart-1', 0.14),
    borderColor: zoneColor('--platform-chart-1', 0.55),
  },
  modern: {
    id: 'modern',
    name: 'Modern & Optimal Control',
    nameCn: '现代与最优控制',
    color: zoneColor('--platform-chart-5'),
    bgColor: zoneColor('--platform-chart-5', 0.14),
    borderColor: zoneColor('--platform-chart-5', 0.55),
  },
  nonlinear: {
    id: 'nonlinear',
    name: 'Nonlinear & Intelligent',
    nameCn: '非线性与智能控制',
    color: zoneColor('--platform-chart-6'),
    bgColor: zoneColor('--platform-chart-6', 0.14),
    borderColor: zoneColor('--platform-chart-6', 0.55),
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
