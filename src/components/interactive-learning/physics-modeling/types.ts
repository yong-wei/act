/**
 * 物理建模工坊类型定义
 * Physics Modeling Workshop Type Definitions
 */

import type { Node, Edge } from 'reactflow';

// ===== 元件类型 =====

/** 机械元件类型 */
export type MechanicalComponentType =
  | 'mass'         // 质量块
  | 'spring'       // 弹簧
  | 'damper'       // 阻尼器
  | 'force_source' // 力源
  | 'ground';      // 固定端

/** 电路元件类型 */
export type ElectricalComponentType =
  | 'resistor'       // 电阻
  | 'inductor'       // 电感
  | 'capacitor'      // 电容
  | 'voltage_source' // 电压源
  | 'current_source' // 电流源
  | 'ground_elec';   // 电气地

/** 所有元件类型 */
export type ComponentType = MechanicalComponentType | ElectricalComponentType;

/** 建模模式 */
export type BuilderMode = 'mechanical' | 'electrical';

// ===== 物理节点数据 =====

/** 元件参数定义 */
export interface ComponentParams {
  // 机械参数
  mass?: number;      // 质量 (kg)
  stiffness?: number; // 刚度 (N/m)
  damping?: number;   // 阻尼系数 (N·s/m)
  force?: number;     // 力 (N)

  // 电气参数
  resistance?: number;   // 电阻 (Ω)
  inductance?: number;   // 电感 (H)
  capacitance?: number;  // 电容 (F)
  voltage?: number;      // 电压 (V)
  current?: number;      // 电流 (A)

  // 显示参数
  label?: string;        // 标签符号 (如 m, k, f, R, L, C)
}

/** 物理节点数据 */
export interface PhysicsNodeData {
  type: ComponentType;
  params: ComponentParams;
  label: string;
  symbol: string;  // LaTeX 符号
}

/** React Flow 节点类型 */
export type PhysicsNode = Node<PhysicsNodeData>;

/** React Flow 边类型 */
export type PhysicsEdge = Edge;

// ===== 教学阶段 =====

/** 教学阶段 */
export type TeachingPhase =
  | 'intro'      // 导入与拆解 (0-10分钟)
  | 'mechanical' // 机械系统建模 (10-40分钟)
  | 'electrical' // 电路系统建模 (40-60分钟)
  | 'analogy'    // 机电相似 (60-75分钟)
  | 'practice';  // 实战演练 (75-90分钟)

/** 阶段配置 */
export interface PhaseConfig {
  id: TeachingPhase;
  title: string;
  description: string;
  durationMinutes: number;
  objectives: string[];
}

/** 所有阶段配置 */
export const PHASE_CONFIGS: PhaseConfig[] = [
  {
    id: 'intro',
    title: '导入与拆解',
    description: '看见看不见的力 - 透视舵机的物理骨架',
    durationMinutes: 10,
    objectives: ['感受惯性、阻力和弹性对动态过程的影响'],
  },
  {
    id: 'mechanical',
    title: '机械系统建模',
    description: '物理工坊 - 搭建弹簧-质量-阻尼模型',
    durationMinutes: 30,
    objectives: ['掌握牛顿力学建模方法', '理解二阶系统的物理意义'],
  },
  {
    id: 'electrical',
    title: '电路系统建模',
    description: '物理工坊 - 建立RLC电路数学模型',
    durationMinutes: 20,
    objectives: ['掌握基尔霍夫电压定律', '理解电路动态方程'],
  },
  {
    id: 'analogy',
    title: '机电相似',
    description: '万物归一 - 发现数学灵魂的相通',
    durationMinutes: 15,
    objectives: ['理解机械-电气系统的相似性', '掌握广义坐标概念'],
  },
  {
    id: 'practice',
    title: '实战演练',
    description: '我是总设计师 - 独立建立微分方程',
    durationMinutes: 15,
    objectives: ['独立完成机理建模', '理解非线性与线性化'],
  },
];

// ===== 机电相似映射 =====

/** 相似映射项 */
export interface AnalogyMapping {
  id: string;
  mechanical: {
    name: string;
    symbol: string;
    unit: string;
  };
  electrical: {
    name: string;
    symbol: string;
    unit: string;
  };
  meaning: string;
  color: string;
}

/** 预定义映射关系 */
export const ANALOGY_MAPPINGS: AnalogyMapping[] = [
  {
    id: 'inertia',
    mechanical: { name: '质量', symbol: 'm', unit: 'kg' },
    electrical: { name: '电感', symbol: 'L', unit: 'H' },
    meaning: '惯性元件',
    color: '#f59e0b', // amber
  },
  {
    id: 'dissipation',
    mechanical: { name: '阻尼', symbol: 'f', unit: 'N·s/m' },
    electrical: { name: '电阻', symbol: 'R', unit: 'Ω' },
    meaning: '耗能元件',
    color: '#ef4444', // red
  },
  {
    id: 'storage',
    mechanical: { name: '弹簧', symbol: 'k', unit: 'N/m' },
    electrical: { name: '电容倒数', symbol: '1/C', unit: '1/F' },
    meaning: '储能元件',
    color: '#22c55e', // green
  },
  {
    id: 'source',
    mechanical: { name: '力', symbol: 'F', unit: 'N' },
    electrical: { name: '电压', symbol: 'u', unit: 'V' },
    meaning: '激励源',
    color: '#3b82f6', // blue
  },
  {
    id: 'displacement',
    mechanical: { name: '位移', symbol: 'x', unit: 'm' },
    electrical: { name: '电荷', symbol: 'q', unit: 'C' },
    meaning: '广义坐标',
    color: '#8b5cf6', // violet
  },
  {
    id: 'velocity',
    mechanical: { name: '速度', symbol: 'v', unit: 'm/s' },
    electrical: { name: '电流', symbol: 'i', unit: 'A' },
    meaning: '广义流量',
    color: '#06b6d4', // cyan
  },
];

// ===== 场景配置 =====

/** 场景配置 */
export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  targetEquation: string;  // LaTeX 格式的标准答案
  hints: string[];
  initialNodes?: PhysicsNode[];
  initialEdges?: PhysicsEdge[];
}

/** 预定义场景 */
export const SCENARIOS: Record<string, ScenarioConfig> = {
  rudder: {
    id: 'rudder',
    name: '舵机系统',
    description: '052D 驱逐舰电液伺服舵机的弹簧-质量-阻尼模型',
    targetEquation: 'm\\ddot{x} + f\\dot{x} + kx = F',
    hints: [
      '舵叶的惯性用质量 m 表示',
      '海水阻力用阻尼 f 表示',
      '液压刚度用弹簧 k 表示',
    ],
  },
  rlcCircuit: {
    id: 'rlc-circuit',
    name: 'RLC 电路',
    description: '直流电机电枢回路的RLC模型',
    targetEquation: 'L\\frac{di}{dt} + Ri + \\frac{1}{C}\\int i\\,dt = u',
    hints: [
      '电感产生感抗 L·di/dt',
      '电阻产生压降 R·i',
      '电容产生电压 (1/C)∫i·dt',
    ],
  },
  missileLauncher: {
    id: 'missile-launcher',
    name: '导弹发射架',
    description: '舰载导弹发射架俯仰系统（含重力矩）',
    targetEquation: 'J\\ddot{\\theta} + f\\dot{\\theta} + mgl\\sin\\theta = T',
    hints: [
      '转动惯量 J 对应惯性项',
      '摩擦力矩产生阻尼项',
      '重力项是非线性的 (sinθ)',
      '小偏差线性化：sinθ ≈ θ',
    ],
  },
};

// ===== 课程状态 =====

/** 课程状态 */
export interface LessonState {
  /** 当前阶段 */
  currentPhase: TeachingPhase;

  /** 各阶段进度 (0-100) */
  phaseProgress: Record<TeachingPhase, number>;

  /** 海况等级 (1-9) */
  seaState: number;

  /** 机械模型图数据 */
  mechanicalModel: {
    nodes: PhysicsNode[];
    edges: PhysicsEdge[];
  };

  /** 电路模型图数据 */
  electricalModel: {
    nodes: PhysicsNode[];
    edges: PhysicsEdge[];
  };

  /** 用户完成的映射 */
  completedMappings: string[];

  /** 实战练习答案 */
  practiceAnswer: string;

  /** AI 消息历史 */
  aiMessages: AIMessage[];

  /** 当前生成的方程 */
  generatedEquation: string;
}

/** AI 消息 */
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 初始状态 */
export const INITIAL_LESSON_STATE: LessonState = {
  currentPhase: 'intro',
  phaseProgress: {
    intro: 0,
    mechanical: 0,
    electrical: 0,
    analogy: 0,
    practice: 0,
  },
  seaState: 3,
  mechanicalModel: { nodes: [], edges: [] },
  electricalModel: { nodes: [], edges: [] },
  completedMappings: [],
  practiceAnswer: '',
  aiMessages: [],
  generatedEquation: '',
};

// ===== 元件库配置 =====

/** 元件定义 */
export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  symbol: string;
  icon: string;  // SVG path 或图标名
  defaultParams: ComponentParams;
  category: 'mechanical' | 'electrical';
}

/** 机械元件库 */
export const MECHANICAL_COMPONENTS: ComponentDefinition[] = [
  {
    type: 'mass',
    name: '质量块',
    symbol: 'm',
    icon: 'square',
    defaultParams: { mass: 10, label: 'm' },
    category: 'mechanical',
  },
  {
    type: 'spring',
    name: '弹簧',
    symbol: 'k',
    icon: 'zigzag',
    defaultParams: { stiffness: 100, label: 'k' },
    category: 'mechanical',
  },
  {
    type: 'damper',
    name: '阻尼器',
    symbol: 'f',
    icon: 'piston',
    defaultParams: { damping: 5, label: 'f' },
    category: 'mechanical',
  },
  {
    type: 'force_source',
    name: '力源',
    symbol: 'F',
    icon: 'arrow-right',
    defaultParams: { force: 100, label: 'F' },
    category: 'mechanical',
  },
  {
    type: 'ground',
    name: '固定端',
    symbol: '⊥',
    icon: 'ground',
    defaultParams: {},
    category: 'mechanical',
  },
];

/** 电气元件库 */
export const ELECTRICAL_COMPONENTS: ComponentDefinition[] = [
  {
    type: 'resistor',
    name: '电阻',
    symbol: 'R',
    icon: 'resistor',
    defaultParams: { resistance: 10, label: 'R' },
    category: 'electrical',
  },
  {
    type: 'inductor',
    name: '电感',
    symbol: 'L',
    icon: 'inductor',
    defaultParams: { inductance: 0.1, label: 'L' },
    category: 'electrical',
  },
  {
    type: 'capacitor',
    name: '电容',
    symbol: 'C',
    icon: 'capacitor',
    defaultParams: { capacitance: 0.001, label: 'C' },
    category: 'electrical',
  },
  {
    type: 'voltage_source',
    name: '电压源',
    symbol: 'u',
    icon: 'battery',
    defaultParams: { voltage: 12, label: 'u' },
    category: 'electrical',
  },
  {
    type: 'ground_elec',
    name: '电气地',
    symbol: '⏚',
    icon: 'ground-elec',
    defaultParams: {},
    category: 'electrical',
  },
];

// ===== AI 提示配置 =====

/** AI 角色提示 */
export const AI_SYSTEM_PROMPTS = {
  /** 建模导师 */
  modelingMentor: `你是一位控制系统建模导师，名叫"建模导师"。你的风格是严谨但富有启发性。

你的职责：
1. 引导学生理解物理系统的数学建模过程
2. 当学生漏掉重要物理项时，用反问的方式引导
3. 解释惯性、阻尼、弹性等物理概念的工程意义
4. 不直接给出答案，而是通过苏格拉底式提问引导学生思考

当学生的模型不完整时，可以这样提问：
- "如果没有阻尼，系统会怎样运动？"
- "想想看，舵叶在海水中运动会受到什么阻力？"
- "弹簧在平衡位置时储存能量吗？"`,

  /** 方程验证器 */
  equationValidator: `你是自动控制原理助教，专门检查物理建模方程。

判断规则：
1. 检查是否包含所有必要项（惯性项、阻尼项、弹性项）
2. 检查符号是否正确（正负号、导数阶次）
3. 检查物理量是否对应正确的系数

如果错误，指出具体问题但不要直接给答案，要引导学生思考。
使用友好的语气，鼓励学生继续尝试。`,
};
