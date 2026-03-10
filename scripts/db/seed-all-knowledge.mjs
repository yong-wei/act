/**
 * seed-all-knowledge.mjs
 *
 * 统一的知识点种子脚本
 * 将所有 content/concepts/ 下的 MDX 文件关联到数据库中的 KnowledgeNode
 *
 * 运行方式: node scripts/db/seed-all-knowledge.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// 知识点定义
// ============================================================================

const KNOWLEDGE_NODES = [
  // Lesson 01: 反馈控制
  {
    id: 'node-feedback-core',
    name: '反馈的核心思想',
    filename: 'feedback-core.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '通过输出反馈与误差信号实现自我修正。',
    position: { x: -10, y: 5, z: 0 },
    tags: ['lesson-01', 'feedback', 'closed-loop']
  },
  {
    id: 'node-control-system-components',
    name: '控制系统四要素',
    filename: 'control-system-components.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '对象、控制器、执行器与传感器构成闭环系统。',
    position: { x: 0, y: 10, z: 0 },
    tags: ['lesson-01', 'structure', 'components']
  },
  {
    id: 'node-open-closed-loop',
    name: '开环与闭环',
    filename: 'open-closed-loop.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '开环无反馈，闭环依赖误差信号纠偏。',
    position: { x: 10, y: 12, z: 0 },
    tags: ['lesson-01', 'open-loop', 'closed-loop']
  },
  {
    id: 'node-feedback-benefits',
    name: '反馈的价值',
    filename: 'feedback-benefits.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: '反馈可抵御扰动、提升鲁棒性与稳态精度。',
    position: { x: 20, y: 8, z: 0 },
    tags: ['lesson-01', 'robustness', 'disturbance']
  },
  // Lesson 02: 机理建模（微分方程）
  {
    id: 'node-modeling-intro',
    name: '为什么需要建模',
    filename: 'modeling-intro.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '建模是将物理系统抽象为数学描述的过程，是控制系统设计的基础。',
    position: { x: 10, y: 0, z: 0 },
    tags: ['lesson-02', 'modeling', 'fundamentals']
  },
  {
    id: 'node-newton-laws',
    name: '牛顿定律应用',
    filename: 'newton-laws.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '牛顿力学在旋转体和平移系统中的应用，是机械系统建模的基础。',
    position: { x: 0, y: 20, z: 0 },
    tags: ['lesson-02', 'mechanics', 'newton']
  },
  {
    id: 'node-kvl-circuit',
    name: 'KVL与动态电路',
    filename: 'kvl-dynamic-circuit.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '基尔霍夫电压定律在含有电容、电感的动态电路中的应用。',
    position: { x: 20, y: 20, z: 0 },
    tags: ['lesson-02', 'circuit', 'kvl']
  },
  {
    id: 'node-linearization',
    name: '非线性线性化',
    filename: 'linearization.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将非线性系统在工作点附近线性化的技术，是经典控制理论的基础。',
    position: { x: 10, y: 30, z: 0 },
    tags: ['lesson-02', 'linearization', 'taylor-series']
  },

  // Lesson 03: 建模（结构化步骤）
  {
    id: 'node-laplace-transform',
    name: '拉普拉斯变换',
    filename: 'laplace-transform.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将时域微分方程转换为s域代数方程的数学工具。',
    position: { x: 10, y: 10, z: 5 },
    tags: ['lesson-02', 'lesson-03', 'laplace', 's-domain']
  },
  {
    id: 'node-laplace-interpretation',
    name: 's平面直觉',
    filename: 'laplace-interpretation.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '实部决定衰减，虚部决定振荡频率的工程直觉。',
    position: { x: 15, y: 14, z: 5 },
    tags: ['lesson-02', 'laplace', 's-plane']
  },
  {
    id: 'node-laplace-properties',
    name: '拉氏变换常用定理',
    filename: 'laplace-properties.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '线性、微分、积分、位移与卷积定理的核心公式。',
    position: { x: 20, y: 16, z: 5 },
    tags: ['lesson-02', 'laplace', 'properties']
  },
  {
    id: 'node-inverse-laplace-methods',
    name: '拉氏反变换方法',
    filename: 'inverse-laplace-methods.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '部分分式、待定系数与留数法的工程用法。',
    position: { x: 25, y: 18, z: 5 },
    tags: ['lesson-02', 'laplace', 'inverse']
  },
  {
    id: 'node-transfer-function',
    name: '传递函数',
    filename: 'transfer-function.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '描述线性时不变系统输入输出关系的s域表示。',
    position: { x: 20, y: 20, z: 5 },
    tags: ['lesson-03', 'transfer-function', 's-domain']
  },
  {
    id: 'node-differential-equation-model',
    name: '微分方程模型',
    filename: 'differential-equation-model.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '用输入/输出的导数关系描述系统动态。',
    position: { x: 30, y: 10, z: 5 },
    tags: ['lesson-03', 'differential-equation', 'modeling']
  },
  {
    id: 'node-modeling-methods',
    name: '机理建模方法',
    filename: 'modeling-methods.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '基于物理与化学定律建立系统运动方程。',
    position: { x: 40, y: 12, z: 5 },
    tags: ['lesson-03', 'modeling', 'laws']
  },
  {
    id: 'node-black-box-modeling',
    name: '黑箱建模（系统辨识）',
    filename: 'black-box-modeling.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '通过输入输出数据拟合系统模型。',
    position: { x: 50, y: 14, z: 5 },
    tags: ['lesson-03', 'identification', 'modeling']
  },
  {
    id: 'node-system-model-types',
    name: '控制系统模型类型',
    filename: 'system-model-types.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '时域、s 域与频率域模型的不同表达。',
    position: { x: 60, y: 16, z: 5 },
    tags: ['lesson-03', 'modeling', 'domain']
  },
  {
    id: 'node-differential-modeling-steps',
    name: '微分方程建模步骤',
    filename: 'differential-modeling-steps.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '确定变量、列方程、消元并整理为标准形式。',
    position: { x: 70, y: 18, z: 5 },
    tags: ['lesson-03', 'modeling', 'workflow']
  },
  {
    id: 'node-modeling-examples',
    name: '典型建模案例',
    filename: 'modeling-examples.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: 'RLC、电机与机械系统的建模链路。',
    position: { x: 80, y: 20, z: 5 },
    tags: ['lesson-03', 'modeling', 'examples']
  },
  {
    id: 'node-linearization-equilibrium',
    name: '非线性模型线性化',
    filename: 'linearization-equilibrium.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '在均衡点附近做泰勒展开并保留一阶项。',
    position: { x: 90, y: 22, z: 5 },
    tags: ['lesson-03', 'linearization', 'taylor-series']
  },
  {
    id: 'node-motion-modes',
    name: '运动模态与齐次解',
    filename: 'motion-modes.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '齐次微分方程解是各运动模态的线性组合。',
    position: { x: 100, y: 24, z: 5 },
    tags: ['lesson-03', 'dynamics', 'modes']
  },

  // Lesson 04: 传递函数与控制系统数学模型
  {
    id: 'node-transfer-function-definition',
    name: '传递函数定义',
    filename: 'transfer-function-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '零初始条件下输出拉氏变换与输入拉氏变换之比。',
    position: { x: 110, y: 10, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'definition']
  },
  {
    id: 'node-zero-initial-condition',
    name: '零初始条件',
    filename: 'zero-initial-condition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '传递函数定义成立的前提假设。',
    position: { x: 120, y: 12, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'assumption']
  },
  {
    id: 'node-differential-to-transfer',
    name: '微分方程→传递函数',
    filename: 'differential-to-transfer.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '拉氏变换并整理为输入/输出比值。',
    position: { x: 130, y: 14, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'derivation']
  },
  {
    id: 'node-pole-zero-form',
    name: '零极点形式',
    filename: 'pole-zero-form.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '传函可写成零点与极点的乘积形式。',
    position: { x: 140, y: 16, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'pole-zero']
  },
  {
    id: 'node-characteristic-polynomial',
    name: '特征多项式与系统阶次',
    filename: 'characteristic-polynomial.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '分母多项式阶次即系统阶次。',
    position: { x: 150, y: 18, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'order']
  },
  {
    id: 'node-transfer-function-properties',
    name: '传递函数性质',
    filename: 'transfer-function-properties.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '线性定常系统可串并联/反馈组合。',
    position: { x: 160, y: 20, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'properties']
  },
  {
    id: 'node-typical-elements',
    name: '典型环节',
    filename: 'typical-elements.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '比例、积分、微分、一阶惯性、二阶振荡等标准形式。',
    position: { x: 170, y: 22, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'elements']
  },
  {
    id: 'node-rlc-transfer-example',
    name: 'RLC 电路传递函数',
    filename: 'rlc-transfer-example.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '从 KVL 方程得到二阶传函。',
    position: { x: 180, y: 24, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'rlc']
  },
  {
    id: 'node-mechanical-motor-transfer',
    name: '机械/电机系统传递函数',
    filename: 'mechanical-motor-transfer.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '弹簧-阻尼与电机系统可统一为标准传函。',
    position: { x: 190, y: 26, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'mechanical', 'motor']
  },
  {
    id: 'node-matlab-transfer-toolbox',
    name: 'MATLAB 传递函数工具',
    filename: 'matlab-transfer-toolbox.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    description: '用 tf/zpk/step/bode 快速建模与分析。',
    position: { x: 200, y: 28, z: 8 },
    tags: ['lesson-04', 'transfer-function', 'matlab']
  },

  // Lesson 05: 方框图、信号流图与梅森公式
  {
    id: 'node-block-diagram-elements',
    name: '方框图四元素',
    filename: 'block-diagram-elements.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '信号线、引出点、综合点与方框构成结构图语言。',
    position: { x: 60, y: 30, z: 10 },
    tags: ['lesson-05', 'block-diagram', 'elements']
  },
  {
    id: 'node-block-diagram-causal-chain',
    name: '由微分方程到结构图',
    filename: 'block-diagram-causal-chain.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '按因果顺序连接动态结构图。',
    position: { x: 70, y: 34, z: 10 },
    tags: ['lesson-05', 'block-diagram', 'modeling']
  },
  {
    id: 'node-block-diagram-equivalents',
    name: '串并联与反馈等效',
    filename: 'block-diagram-equivalents.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '串联相乘、并联相加、反馈闭环的等效规则。',
    position: { x: 80, y: 30, z: 10 },
    tags: ['lesson-05', 'block-diagram', 'equivalent']
  },
  {
    id: 'node-block-diagram-move-points',
    name: '引出点与综合点移位',
    filename: 'block-diagram-move-points.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '移位需乘除跨越传递函数，保持信号不变。',
    position: { x: 90, y: 34, z: 10 },
    tags: ['lesson-05', 'block-diagram', 'move-rule']
  },
  {
    id: 'node-block-diagram-simplify-strategy',
    name: '结构图化简策略',
    filename: 'block-diagram-simplify-strategy.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '找典型、解交叉、由内向外是化简主线。',
    position: { x: 100, y: 30, z: 10 },
    tags: ['lesson-05', 'block-diagram', 'simplify']
  },
  {
    id: 'node-signal-flow-basics',
    name: '信号流图节点与支路',
    filename: 'signal-flow-basics.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '节点表示变量，支路表示传递关系。',
    position: { x: 60, y: 42, z: 12 },
    tags: ['lesson-05', 'signal-flow', 'basics']
  },
  {
    id: 'node-signal-flow-node-types',
    name: '输入/输出/混合节点',
    filename: 'signal-flow-node-types.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '只出不入为输入，只入不出为输出，出入兼具为混合节点。',
    position: { x: 70, y: 46, z: 12 },
    tags: ['lesson-05', 'signal-flow', 'node-type']
  },
  {
    id: 'node-signal-flow-paths-loops',
    name: '前向通路与回路增益',
    filename: 'signal-flow-paths-loops.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: '前向通路与回路增益是梅森公式的关键输入。',
    position: { x: 80, y: 42, z: 12 },
    tags: ['lesson-05', 'signal-flow', 'path-loop']
  },
  {
    id: 'node-signal-flow-conversion',
    name: '结构图转信号流图',
    filename: 'signal-flow-conversion.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '标变量、定出入、列节点、连支路。',
    position: { x: 90, y: 46, z: 12 },
    tags: ['lesson-05', 'signal-flow', 'conversion']
  },
  {
    id: 'node-signal-flow-equation',
    name: '由方程组绘制信号流图',
    filename: 'signal-flow-equation.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '代数式与初始条件可直接转为支路表达。',
    position: { x: 100, y: 42, z: 12 },
    tags: ['lesson-05', 'signal-flow', 'equation']
  },
  {
    id: 'node-mason-formula',
    name: '梅森增益公式',
    filename: 'mason-formula.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '总增益由前向通路与余子式加权求和。',
    position: { x: 70, y: 58, z: 14 },
    tags: ['lesson-05', 'mason', 'formula']
  },
  {
    id: 'node-mason-delta',
    name: '特征式 Delta',
    filename: 'mason-delta.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '回路与互不接触回路乘积交替加减。',
    position: { x: 80, y: 62, z: 14 },
    tags: ['lesson-05', 'mason', 'delta']
  },
  {
    id: 'node-mason-cofactor',
    name: '余子式 Delta_k',
    filename: 'mason-cofactor.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '剔除与某前向通路相接触回路后的特征式。',
    position: { x: 90, y: 58, z: 14 },
    tags: ['lesson-05', 'mason', 'cofactor']
  },

  // Lesson 05: PID 控制
  {
    id: 'node-pid-controller',
    name: 'PID控制器',
    filename: 'pid-controller.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '最广泛应用的反馈控制器：比例-积分-微分控制。',
    position: { x: 30, y: 30, z: 10 },
    tags: ['lesson-05', 'pid', 'controller']
  },

  // Lesson 02: 机理建模（机电类比）
  {
    id: 'node-electromechanical-analogy',
    name: '机电类比映射',
    filename: 'electromechanical-analogy.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '机械系统与电气系统在数学形式上的对偶关系。',
    position: { x: 20, y: 0, z: 5 },
    tags: ['lesson-02', 'analogy', 'modeling']
  },

  // Lesson 06: 指标裁判席
  {
    id: 'node-time-domain-metrics',
    name: '时域性能指标',
    filename: 'time-domain-metrics.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '上升时间、超调量与调节时间等指标用于评价响应。',
    position: { x: 40, y: 5, z: 5 },
    tags: ['lesson-06', 'time-domain', 'metrics']
  },
  {
    id: 'node-metric-judgement',
    name: '指标裁判规则',
    filename: 'metric-judgement.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '将速度、稳定与精度转化为可解释的评分逻辑。',
    position: { x: 50, y: 5, z: 5 },
    tags: ['lesson-06', 'assessment', 'metrics']
  },

  // Lesson 07: 欠阻尼二阶系统
  {
    id: 'node-second-order-classification',
    name: '二阶系统标准型与分类',
    filename: 'second-order-classification.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '通过阻尼比划分欠阻尼、临界阻尼与过阻尼。',
    position: { x: 35, y: 20, z: 5 },
    tags: ['lesson-07', 'second-order', 'classification']
  },
  {
    id: 'node-second-order-standard-form',
    name: '标准二阶系统参数',
    filename: 'second-order-standard-form.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '阻尼比与自然频率决定二阶系统响应形态。',
    position: { x: 45, y: 20, z: 5 },
    tags: ['lesson-07', 'second-order', 'standard-form']
  },
  {
    id: 'node-damping-wn-tradeoff',
    name: '阻尼比与自然频率权衡',
    filename: 'damping-wn-tradeoff.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '响应速度与超调之间的折中关系。',
    position: { x: 50, y: 25, z: 5 },
    tags: ['lesson-07', 'time-domain', 'tradeoff']
  },

  // Lesson 08: 稳定性与稳态误差
  {
    id: 'node-stability-concept',
    name: '稳定性的概念',
    filename: 'stability-concept.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '用极点位置区分稳定、临界稳定与不稳定。',
    position: { x: 60, y: 10, z: 5 },
    tags: ['lesson-08', 'stability']
  },
  {
    id: 'node-routh-criterion',
    name: '劳斯判据',
    filename: 'routh-criterion.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '通过劳斯表首列符号判断稳定性。',
    position: { x: 70, y: 10, z: 5 },
    tags: ['lesson-08', 'routh', 'stability']
  },
  {
    id: 'node-routh-special-cases',
    name: '劳斯判据特殊情况',
    filename: 'routh-special-cases.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '首项为零与全零行的处理方法。',
    position: { x: 80, y: 10, z: 5 },
    tags: ['lesson-08', 'routh', 'special-cases']
  },
  {
    id: 'node-routh-table-construction',
    name: '劳斯表构造',
    filename: 'routh-table-construction.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '劳斯表的填表规则与递推公式。',
    position: { x: 70, y: 20, z: 5 },
    tags: ['lesson-08', 'routh', 'table']
  },
  {
    id: 'node-steady-error-flow',
    name: '稳态误差计算流程',
    filename: 'steady-error-flow.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '从误差传递函数到终值定理的计算路径。',
    position: { x: 60, y: 20, z: 5 },
    tags: ['lesson-08', 'steady-error']
  },
  {
    id: 'node-static-error-coefficients',
    name: '静态误差系数',
    filename: 'static-error-coefficients.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: 'Kp/Kv/Ka 与系统型别的对应关系。',
    position: { x: 50, y: 20, z: 5 },
    tags: ['lesson-08', 'steady-error', 'coefficients']
  },

  // Lesson 09: 校正与时域综合
  {
    id: 'node-pd-vs-velocity-feedback',
    name: 'PD 与输出微分反馈',
    filename: 'pd-vs-velocity-feedback.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '比较串联 PD 与输出反馈的阻尼改善路径。',
    position: { x: 70, y: 30, z: 8 },
    tags: ['lesson-09', 'correction', 'pd']
  },
  {
    id: 'node-pid-tuning-strategy',
    name: 'PID 参数整定直觉',
    filename: 'pid-tuning-strategy.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '理解 Kp/Ki/Kd 对响应指标的典型影响。',
    position: { x: 80, y: 30, z: 8 },
    tags: ['lesson-09', 'pid', 'tuning']
  },
  {
    id: 'node-feedforward-disturbance',
    name: '前馈补偿与扰动补偿',
    filename: 'feedforward-disturbance.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '前馈补偿与扰动补偿的作用路径与差异。',
    position: { x: 90, y: 30, z: 8 },
    tags: ['lesson-09', 'compensation', 'feedforward']
  },
  {
    id: 'node-time-domain-tradeoff',
    name: '时域性能权衡',
    filename: 'time-domain-tradeoff.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '速度、超调与稳态误差之间的权衡关系。',
    position: { x: 80, y: 35, z: 8 },
    tags: ['lesson-09', 'time-domain', 'tradeoff']
  },
  {
    id: 'node-time-domain-synthesis',
    name: '时域综合流程',
    filename: 'time-domain-synthesis.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '从稳定范围到场景验证的时域综合步骤。',
    position: { x: 90, y: 35, z: 8 },
    tags: ['lesson-09', 'synthesis', 'time-domain']
  },

  // Lesson 10: 根轨迹法
  {
    id: 'node-root-locus-definition',
    name: '根轨迹定义与起终点',
    filename: 'root-locus-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '根轨迹描述闭环极点随参数变化的轨迹。',
    position: { x: 100, y: 10, z: 10 },
    tags: ['lesson-10', 'root-locus']
  },
  {
    id: 'node-root-locus-conditions',
    name: '根轨迹条件',
    filename: 'root-locus-conditions.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '模值条件与相角条件用于确定轨迹上的点。',
    position: { x: 110, y: 10, z: 10 },
    tags: ['lesson-10', 'root-locus', 'conditions']
  },
  {
    id: 'node-root-locus-rules',
    name: '根轨迹基本法则',
    filename: 'root-locus-rules.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '分支数、实轴段与渐近线等绘制规则。',
    position: { x: 110, y: 20, z: 10 },
    tags: ['lesson-10', 'root-locus', 'rules']
  },
  {
    id: 'node-root-locus-detail-corrections',
    name: '分离点与出射角',
    filename: 'root-locus-detail-corrections.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '定位分离点与复极点出射角等细节。',
    position: { x: 120, y: 20, z: 10 },
    tags: ['lesson-10', 'root-locus', 'details']
  },

  // Lesson 12: 频率特性与伯德图
  {
    id: 'node-frequency-response-definition',
    name: '频率响应的定义',
    filename: 'frequency-response-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '正弦输入稳态响应下的幅值比与相位差。',
    position: { x: 130, y: 8, z: 12 },
    tags: ['lesson-12', 'frequency-response', 'bode']
  },
  {
    id: 'node-bode-log-scale',
    name: 'Bode 图与对数坐标',
    filename: 'bode-log-scale.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '对数频率与分贝坐标让斜率叠加更直观。',
    position: { x: 140, y: 14, z: 12 },
    tags: ['lesson-12', 'bode', 'log-scale']
  },
  {
    id: 'node-typical-link-slopes',
    name: '典型环节斜率规律',
    filename: 'bode-typical-slopes.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '零极点对斜率的贡献可直接叠加。',
    position: { x: 150, y: 18, z: 12 },
    tags: ['lesson-12', 'bode', 'slope']
  },
  {
    id: 'node-bode-approx-steps',
    name: '伯德图绘制步骤',
    filename: 'bode-approx-steps.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '尾 1 标准型 → 转折频率 → 叠加作图 → 修正。',
    position: { x: 160, y: 22, z: 12 },
    tags: ['lesson-12', 'bode', 'workflow']
  },
  {
    id: 'node-resonance-peak',
    name: '振荡环节与谐振峰',
    filename: 'resonance-peak.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '欠阻尼二阶系统在共振频率附近出现峰值。',
    position: { x: 170, y: 18, z: 12 },
    tags: ['lesson-12', 'bode', 'resonance']
  },
  {
    id: 'node-bode-from-plot',
    name: '根据伯德图反推传函',
    filename: 'bode-from-plot.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '根据斜率变化与转折频率推断零极点结构。',
    position: { x: 180, y: 22, z: 12 },
    tags: ['lesson-12', 'bode', 'identification']
  },

  // Lesson 13: 幅相特性与稳定判据
  {
    id: 'node-nyquist-definition',
    name: '开环幅相特性定义',
    filename: 'nyquist-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '开环频率响应在复平面形成的极坐标轨迹。',
    position: { x: 190, y: 8, z: 14 },
    tags: ['lesson-13', 'nyquist', 'frequency-domain']
  },
  {
    id: 'node-nyquist-start-end',
    name: '起点与终点',
    filename: 'nyquist-start-end.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    description: '低频起点与高频终点决定曲线的总体走向。',
    position: { x: 200, y: 10, z: 14 },
    tags: ['lesson-13', 'nyquist', 'feature-points']
  },
  {
    id: 'node-nyquist-crossing',
    name: '负实轴交点与穿越频率',
    filename: 'nyquist-crossing.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    description: '相位穿越频率与幅值穿越频率共同决定负实轴交点。',
    position: { x: 210, y: 12, z: 14 },
    tags: ['lesson-13', 'nyquist', 'crossing']
  },
  {
    id: 'node-nyquist-feature-points',
    name: '特征点求法',
    filename: 'nyquist-feature-points.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '通过实部/虚部分析锁定交点并判断轨迹趋势。',
    position: { x: 220, y: 14, z: 14 },
    tags: ['lesson-13', 'nyquist', 'feature-points']
  },
  {
    id: 'node-nyquist-sketch-steps',
    name: '概略绘制步骤',
    filename: 'nyquist-sketch-steps.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '求频响、找特征点、概略连线三步完成草图。',
    position: { x: 230, y: 16, z: 14 },
    tags: ['lesson-13', 'nyquist', 'workflow']
  },
  {
    id: 'node-argument-principle',
    name: '幅角原理',
    filename: 'argument-principle.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '映射曲线的旋转圈数与零极点数量相关。',
    position: { x: 240, y: 18, z: 14 },
    tags: ['lesson-13', 'nyquist', 'theory']
  },
  {
    id: 'node-nyquist-criterion',
    name: '奈奎斯特稳定判据',
    filename: 'nyquist-criterion.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '根据包围 -1 点次数判断闭环稳定性。',
    position: { x: 250, y: 20, z: 14 },
    tags: ['lesson-13', 'nyquist', 'stability']
  },
  {
    id: 'node-log-stability-criterion',
    name: '对数稳定判据',
    filename: 'log-stability-criterion.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'PROCEDURAL',
    description: '将 Nyquist 判据转换为 Bode 图穿越关系。',
    position: { x: 260, y: 22, z: 14 },
    tags: ['lesson-13', 'nyquist', 'bode']
  },

  // Lesson 14: 稳定裕度与三频段
  {
    id: 'node-stability-margin-definition',
    name: '稳定裕度',
    filename: 'stability-margin-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '相角裕度与幅值裕度构成系统的稳定储备量。',
    position: { x: 270, y: 8, z: 16 },
    tags: ['lesson-14', 'stability-margin', 'frequency-domain']
  },
  {
    id: 'node-phase-margin',
    name: '相角裕度',
    filename: 'phase-margin.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    description: '增益穿越频率处相位与 -180° 的距离。',
    position: { x: 280, y: 10, z: 16 },
    tags: ['lesson-14', 'stability-margin', 'phase-margin']
  },
  {
    id: 'node-gain-margin',
    name: '幅值裕度',
    filename: 'gain-margin.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    description: '相位穿越频率处幅值距离 1 的倍率。',
    position: { x: 290, y: 12, z: 16 },
    tags: ['lesson-14', 'stability-margin', 'gain-margin']
  },
  {
    id: 'node-margin-bode-estimation',
    name: 'Bode 图估算稳定裕度',
    filename: 'margin-bode-estimation.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '从 0 dB 与 -180° 穿越点读取稳定裕度。',
    position: { x: 300, y: 14, z: 16 },
    tags: ['lesson-14', 'bode', 'stability-margin']
  },
  {
    id: 'node-three-band-theory',
    name: '三频段理论',
    filename: 'three-band-theory.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '低、中、高频段分别对应稳态、动态与抗噪性能。',
    position: { x: 310, y: 16, z: 16 },
    tags: ['lesson-14', 'three-band', 'frequency-domain']
  },
  {
    id: 'node-low-frequency-band',
    name: '低频段与稳态误差',
    filename: 'low-frequency-band.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: '低频增益决定稳态误差与抗扰能力。',
    position: { x: 320, y: 18, z: 16 },
    tags: ['lesson-14', 'three-band', 'low-frequency']
  },
  {
    id: 'node-mid-frequency-band',
    name: '中频段与动态性能',
    filename: 'mid-frequency-band.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '中频段形状影响超调与调节时间。',
    position: { x: 330, y: 20, z: 16 },
    tags: ['lesson-14', 'three-band', 'mid-frequency']
  },
  {
    id: 'node-high-frequency-band',
    name: '高频段与抗噪鲁棒性',
    filename: 'high-frequency-band.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '高频衰减用于抑制噪声与未建模动态。',
    position: { x: 340, y: 22, z: 16 },
    tags: ['lesson-14', 'three-band', 'high-frequency']
  },

  // Lesson 15: 串联校正与滞后超前
  {
    id: 'node-series-compensation',
    name: '串联校正',
    filename: 'series-compensation.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '通过串联校正网络调整开环幅相特性以满足性能指标。',
    position: { x: 350, y: 8, z: 18 },
    tags: ['lesson-15', 'series-compensation', 'frequency-domain']
  },
  {
    id: 'node-lead-network-feature',
    name: '超前网络特性',
    filename: 'lead-network-features.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '相角超前、幅值抬升，提升相角裕度与响应速度。',
    position: { x: 360, y: 10, z: 18 },
    tags: ['lesson-15', 'lead', 'series-compensation']
  },
  {
    id: 'node-lead-max-phase',
    name: '最大超前角',
    filename: 'lead-max-phase.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '一级超前网络可提供的最大相角超前由参数 a 决定。',
    position: { x: 370, y: 12, z: 18 },
    tags: ['lesson-15', 'lead', 'phase-margin']
  },
  {
    id: 'node-lead-design-steps',
    name: '超前网络设计步骤',
    filename: 'lead-design-steps.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '按相角裕度目标确定 a、T 并布置零极点。',
    position: { x: 380, y: 14, z: 18 },
    tags: ['lesson-15', 'lead', 'workflow']
  },
  {
    id: 'node-lag-network-feature',
    name: '滞后网络特性',
    filename: 'lag-network-features.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '低频增益提升、高频衰减并带来相位滞后。',
    position: { x: 360, y: 18, z: 18 },
    tags: ['lesson-15', 'lag', 'series-compensation']
  },
  {
    id: 'node-lag-design-steps',
    name: '滞后网络设计步骤',
    filename: 'lag-design-steps.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '根据稳态误差目标选择 b 并配置滞后零极点。',
    position: { x: 370, y: 20, z: 18 },
    tags: ['lesson-15', 'lag', 'workflow']
  },
  {
    id: 'node-lag-lead-compensation',
    name: '滞后-超前联合校正',
    filename: 'lag-lead-compensation.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '稳态精度与相角裕度同时不足时的双目标校正方案。',
    position: { x: 380, y: 22, z: 18 },
    tags: ['lesson-15', 'lag-lead', 'series-compensation']
  },
  {
    id: 'node-lag-lead-workflow',
    name: '滞后-超前设计流程',
    filename: 'lag-lead-workflow.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '先超前后滞后的联合设计与验证流程。',
    position: { x: 390, y: 24, z: 18 },
    tags: ['lesson-15', 'lag-lead', 'workflow']
  },

  // Lesson 13: 豪华邮轮舒适度控制
  {
    id: 'node-multi-constraint-pid',
    name: '多约束 PID 设计',
    filename: 'multi-constraint-pid.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'METACOGNITIVE',
    description: '在速度、舒适与安全之间进行控制权衡。',
    position: { x: 15, y: 5, z: 15 },
    tags: ['lesson-13', 'pid', 'comfort']
  },

  // Lesson 13: 豪华邮轮舒适度控制（已有，更新 resources）
  {
    id: 'node-iso-2631',
    name: 'ISO 2631 舒适度标准',
    filename: 'iso-2631.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '国际标准化组织制定的关于人体承受全身振动评价的标准。',
    position: { x: 0, y: 0, z: 15 },
    tags: ['lesson-13', 'iso', 'comfort']
  },
  {
    id: 'node-fin-stabilizer',
    name: '主动减摇鳍',
    filename: 'fin-stabilizer.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    description: '安装在船体两侧的翼状装置，通过改变攻角产生升力。',
    position: { x: 10, y: 0, z: 15 },
    tags: ['lesson-13', 'fin-stabilizer', 'ship']
  },
  {
    id: 'node-comfort-index',
    name: '舒适度指数',
    filename: 'comfort-index.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '综合考虑加速度、频率和暴露时间的量化指标。',
    position: { x: 0, y: 10, z: 15 },
    tags: ['lesson-13', 'comfort-index', 'vibration']
  },
  {
    id: 'node-roll-damping',
    name: '横摇阻尼',
    filename: 'roll-damping.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '船舶在横摇运动中受到的阻力矩。',
    position: { x: 10, y: 10, z: 15 },
    tags: ['lesson-13', 'roll-damping', 'ship-dynamics']
  },
  {
    id: 'node-trade-off',
    name: '工程折衷',
    filename: 'trade-off.mdx',
    nodeType: 'ETHICS',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'METACOGNITIVE',
    description: '在相互冲突的工程目标之间进行权衡的决策过程。',
    position: { x: 5, y: 5, z: 20 },
    tags: ['lesson-13', 'ethics', 'trade-off']
  },

  // Lesson 16: 非线性系统与描述函数基础
  {
    id: 'node-nonlinear-ubiquity',
    name: '非线性系统的普遍性',
    filename: 'nonlinear-ubiquity.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '实际控制系统普遍存在饱和、死区、间隙等非线性。',
    position: { x: 110, y: 0, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'overview']
  },
  {
    id: 'node-nonlinear-special-properties',
    name: '非线性系统的特殊性质',
    filename: 'nonlinear-special-properties.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '不满足叠加原理，稳定性与初始条件和外作用有关。',
    position: { x: 120, y: 0, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'properties']
  },
  {
    id: 'node-harmonic-linearization',
    name: '谐波线性化',
    filename: 'harmonic-linearization.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '用输出基波近似非线性响应，得到等效频域特性。',
    position: { x: 130, y: 5, z: 10 },
    tags: ['lesson-16', 'describing-function', 'harmonic']
  },
  {
    id: 'node-describing-function-definition',
    name: '描述函数定义',
    filename: 'describing-function-definition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '描述函数为输出基波与输入正弦的复数比。',
    position: { x: 140, y: 5, z: 10 },
    tags: ['lesson-16', 'describing-function', 'definition']
  },
  {
    id: 'node-ideal-relay-describing',
    name: '理想继电器描述函数',
    filename: 'ideal-relay-describing.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '理想继电器的描述函数与输入幅值成反比。',
    position: { x: 120, y: 15, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'relay']
  },
  {
    id: 'node-saturation-describing',
    name: '饱和特性描述函数',
    filename: 'saturation-describing.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '饱和特性的描述函数体现限幅对幅值的影响。',
    position: { x: 130, y: 15, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'saturation']
  },
  {
    id: 'node-dead-zone-describing',
    name: '死区特性描述函数',
    filename: 'dead-zone-describing.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '死区特性导致小幅输入无法产生输出。',
    position: { x: 140, y: 15, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'dead-zone']
  },
  {
    id: 'node-hysteresis-backlash',
    name: '滞环与间隙特性',
    filename: 'hysteresis-backlash.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '滞环/间隙导致描述函数出现复数相位滞后。',
    position: { x: 150, y: 15, z: 10 },
    tags: ['lesson-16', 'nonlinear', 'hysteresis']
  },

  // Lesson 17: 描述函数分析法与自振判别
  {
    id: 'node-describing-function-assumptions',
    name: '描述函数法的基本假设',
    filename: 'describing-function-assumptions.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '单一非线性+低通线性部分的适用条件。',
    position: { x: 110, y: 30, z: 12 },
    tags: ['lesson-17', 'describing-function', 'assumptions']
  },
  {
    id: 'node-negative-inverse-describing',
    name: '负倒描述函数',
    filename: 'negative-inverse-describing.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将 -1/N(A) 绘制在复平面用于交点判别。',
    position: { x: 120, y: 30, z: 12 },
    tags: ['lesson-17', 'describing-function', 'negative-inverse']
  },
  {
    id: 'node-nonlinear-stability-criterion',
    name: '非线性系统稳定性判据',
    filename: 'nonlinear-stability-criterion.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: 'G(jω) 包围关系决定闭环稳定性。',
    position: { x: 130, y: 30, z: 12 },
    tags: ['lesson-17', 'describing-function', 'stability']
  },
  {
    id: 'node-limit-cycle-condition',
    name: '自振存在条件',
    filename: 'limit-cycle-condition.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '交点满足 N(A)G(jω)=-1，是自振必要条件。',
    position: { x: 140, y: 30, z: 12 },
    tags: ['lesson-17', 'limit-cycle', 'condition']
  },
  {
    id: 'node-limit-cycle-stability',
    name: '自振稳定性判别',
    filename: 'limit-cycle-stability.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '微小扰动分析用于判断交点稳定性。',
    position: { x: 150, y: 30, z: 12 },
    tags: ['lesson-17', 'limit-cycle', 'stability']
  },
  {
    id: 'node-negative-inverse-plot',
    name: '负倒描述函数绘制',
    filename: 'negative-inverse-plot.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '典型非线性对应的 -1/N(A) 轨迹形态。',
    position: { x: 120, y: 40, z: 12 },
    tags: ['lesson-17', 'describing-function', 'plot']
  },
  {
    id: 'node-limit-cycle-solving',
    name: '自振参数求解',
    filename: 'limit-cycle-solving.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '通过幅值/相位方程求解 A 与 ω。',
    position: { x: 140, y: 40, z: 12 },
    tags: ['lesson-17', 'limit-cycle', 'solving']
  }
];

// ============================================================================
// 知识点关系定义
// ============================================================================

const KNOWLEDGE_LINKS = [
  // Lesson 01 内部关系
  { sourceId: 'node-feedback-core', targetId: 'node-control-system-components', relation: 'prerequisite' },
  { sourceId: 'node-feedback-core', targetId: 'node-open-closed-loop', relation: 'explains' },
  { sourceId: 'node-open-closed-loop', targetId: 'node-feedback-benefits', relation: 'follows' },
  { sourceId: 'node-feedback-benefits', targetId: 'node-stability-concept', relation: 'related' },

  // Lesson 02 内部关系
  { sourceId: 'node-modeling-intro', targetId: 'node-newton-laws', relation: 'prerequisite' },
  { sourceId: 'node-modeling-intro', targetId: 'node-kvl-circuit', relation: 'prerequisite' },
  { sourceId: 'node-newton-laws', targetId: 'node-linearization', relation: 'follows' },
  { sourceId: 'node-kvl-circuit', targetId: 'node-linearization', relation: 'related' },

  // Lesson 03 关系
  { sourceId: 'node-laplace-transform', targetId: 'node-transfer-function', relation: 'prerequisite' },
  { sourceId: 'node-laplace-transform', targetId: 'node-laplace-interpretation', relation: 'explains' },
  { sourceId: 'node-laplace-transform', targetId: 'node-laplace-properties', relation: 'enables' },
  { sourceId: 'node-laplace-properties', targetId: 'node-inverse-laplace-methods', relation: 'supports' },
  { sourceId: 'node-laplace-interpretation', targetId: 'node-inverse-laplace-methods', relation: 'related' },
  { sourceId: 'node-linearization', targetId: 'node-laplace-transform', relation: 'related' },
  { sourceId: 'node-differential-equation-model', targetId: 'node-system-model-types', relation: 'follows' },
  { sourceId: 'node-modeling-methods', targetId: 'node-differential-modeling-steps', relation: 'follows' },
  { sourceId: 'node-black-box-modeling', targetId: 'node-system-model-types', relation: 'related' },
  { sourceId: 'node-differential-modeling-steps', targetId: 'node-modeling-examples', relation: 'follows' },
  { sourceId: 'node-modeling-examples', targetId: 'node-linearization-equilibrium', relation: 'related' },
  { sourceId: 'node-linearization-equilibrium', targetId: 'node-motion-modes', relation: 'follows' },
  { sourceId: 'node-modeling-intro', targetId: 'node-differential-equation-model', relation: 'related' },

  // Lesson 04 关系
  { sourceId: 'node-laplace-transform', targetId: 'node-transfer-function-definition', relation: 'prerequisite' },
  { sourceId: 'node-transfer-function', targetId: 'node-transfer-function-definition', relation: 'related' },
  { sourceId: 'node-transfer-function-definition', targetId: 'node-zero-initial-condition', relation: 'prerequisite' },
  { sourceId: 'node-zero-initial-condition', targetId: 'node-differential-to-transfer', relation: 'prerequisite' },
  { sourceId: 'node-differential-to-transfer', targetId: 'node-pole-zero-form', relation: 'follows' },
  { sourceId: 'node-pole-zero-form', targetId: 'node-characteristic-polynomial', relation: 'related' },
  { sourceId: 'node-characteristic-polynomial', targetId: 'node-transfer-function-properties', relation: 'follows' },
  { sourceId: 'node-transfer-function-properties', targetId: 'node-typical-elements', relation: 'follows' },
  { sourceId: 'node-typical-elements', targetId: 'node-rlc-transfer-example', relation: 'related' },
  { sourceId: 'node-rlc-transfer-example', targetId: 'node-mechanical-motor-transfer', relation: 'related' },
  { sourceId: 'node-transfer-function-definition', targetId: 'node-matlab-transfer-toolbox', relation: 'related' },

  // Lesson 05 关系
  { sourceId: 'node-block-diagram-elements', targetId: 'node-block-diagram-equivalents', relation: 'prerequisite' },
  { sourceId: 'node-block-diagram-equivalents', targetId: 'node-block-diagram-move-points', relation: 'follows' },
  { sourceId: 'node-block-diagram-move-points', targetId: 'node-block-diagram-simplify-strategy', relation: 'follows' },
  { sourceId: 'node-block-diagram-simplify-strategy', targetId: 'node-signal-flow-conversion', relation: 'enables' },
  { sourceId: 'node-signal-flow-basics', targetId: 'node-signal-flow-node-types', relation: 'related' },
  { sourceId: 'node-signal-flow-basics', targetId: 'node-signal-flow-paths-loops', relation: 'follows' },
  { sourceId: 'node-signal-flow-conversion', targetId: 'node-signal-flow-equation', relation: 'related' },
  { sourceId: 'node-signal-flow-paths-loops', targetId: 'node-mason-formula', relation: 'prerequisite' },
  { sourceId: 'node-mason-formula', targetId: 'node-mason-delta', relation: 'prerequisite' },
  { sourceId: 'node-mason-delta', targetId: 'node-mason-cofactor', relation: 'follows' },
  { sourceId: 'node-transfer-function', targetId: 'node-pid-controller', relation: 'prerequisite' },

  // Lesson 13 内部关系
  { sourceId: 'node-roll-damping', targetId: 'node-comfort-index', relation: 'influences' },
  { sourceId: 'node-fin-stabilizer', targetId: 'node-roll-damping', relation: 'implements' },
  { sourceId: 'node-iso-2631', targetId: 'node-comfort-index', relation: 'defines' },
  { sourceId: 'node-trade-off', targetId: 'node-fin-stabilizer', relation: 'governs' },

  // 跨课程关系
  { sourceId: 'node-pid-controller', targetId: 'node-fin-stabilizer', relation: 'related' },
  { sourceId: 'node-transfer-function', targetId: 'node-roll-damping', relation: 'related' },

  // Lesson 02 机电类比
  { sourceId: 'node-newton-laws', targetId: 'node-electromechanical-analogy', relation: 'related' },
  { sourceId: 'node-kvl-circuit', targetId: 'node-electromechanical-analogy', relation: 'related' },

  // Lesson 06 指标裁判席
  { sourceId: 'node-time-domain-metrics', targetId: 'node-metric-judgement', relation: 'follows' },

  // Lesson 07 欠阻尼二阶系统
  { sourceId: 'node-second-order-classification', targetId: 'node-second-order-standard-form', relation: 'prerequisite' },
  { sourceId: 'node-second-order-standard-form', targetId: 'node-time-domain-metrics', relation: 'related' },
  { sourceId: 'node-damping-wn-tradeoff', targetId: 'node-time-domain-metrics', relation: 'related' },

  // Lesson 08 稳定性与稳态误差
  { sourceId: 'node-stability-concept', targetId: 'node-routh-criterion', relation: 'prerequisite' },
  { sourceId: 'node-routh-criterion', targetId: 'node-routh-table-construction', relation: 'follows' },
  { sourceId: 'node-routh-criterion', targetId: 'node-routh-special-cases', relation: 'related' },
  { sourceId: 'node-steady-error-flow', targetId: 'node-static-error-coefficients', relation: 'follows' },

  // Lesson 09 校正与时域综合
  { sourceId: 'node-pd-vs-velocity-feedback', targetId: 'node-pid-tuning-strategy', relation: 'related' },
  { sourceId: 'node-feedforward-disturbance', targetId: 'node-time-domain-synthesis', relation: 'related' },
  { sourceId: 'node-time-domain-tradeoff', targetId: 'node-time-domain-synthesis', relation: 'related' },

  // Lesson 10 根轨迹法
  { sourceId: 'node-transfer-function', targetId: 'node-root-locus-definition', relation: 'prerequisite' },
  { sourceId: 'node-root-locus-definition', targetId: 'node-root-locus-conditions', relation: 'prerequisite' },
  { sourceId: 'node-root-locus-definition', targetId: 'node-root-locus-rules', relation: 'follows' },
  { sourceId: 'node-root-locus-rules', targetId: 'node-root-locus-detail-corrections', relation: 'follows' },
  { sourceId: 'node-routh-criterion', targetId: 'node-root-locus-detail-corrections', relation: 'related' },

  // Lesson 12 频率特性与伯德图
  { sourceId: 'node-frequency-response-definition', targetId: 'node-bode-log-scale', relation: 'follows' },
  { sourceId: 'node-bode-log-scale', targetId: 'node-bode-approx-steps', relation: 'follows' },
  { sourceId: 'node-bode-log-scale', targetId: 'node-typical-link-slopes', relation: 'related' },
  { sourceId: 'node-typical-link-slopes', targetId: 'node-resonance-peak', relation: 'related' },
  { sourceId: 'node-bode-approx-steps', targetId: 'node-bode-from-plot', relation: 'follows' },

  // Lesson 13 幅相特性与稳定判据
  { sourceId: 'node-frequency-response-definition', targetId: 'node-nyquist-definition', relation: 'follows' },
  { sourceId: 'node-nyquist-definition', targetId: 'node-nyquist-start-end', relation: 'follows' },
  { sourceId: 'node-nyquist-start-end', targetId: 'node-nyquist-crossing', relation: 'follows' },
  { sourceId: 'node-nyquist-crossing', targetId: 'node-nyquist-feature-points', relation: 'follows' },
  { sourceId: 'node-nyquist-feature-points', targetId: 'node-nyquist-sketch-steps', relation: 'follows' },
  { sourceId: 'node-argument-principle', targetId: 'node-nyquist-criterion', relation: 'prerequisite' },
  { sourceId: 'node-nyquist-criterion', targetId: 'node-log-stability-criterion', relation: 'follows' },

  // Lesson 14 稳定裕度与三频段
  { sourceId: 'node-log-stability-criterion', targetId: 'node-stability-margin-definition', relation: 'follows' },
  { sourceId: 'node-stability-margin-definition', targetId: 'node-phase-margin', relation: 'follows' },
  { sourceId: 'node-phase-margin', targetId: 'node-gain-margin', relation: 'related' },
  { sourceId: 'node-gain-margin', targetId: 'node-margin-bode-estimation', relation: 'follows' },
  { sourceId: 'node-margin-bode-estimation', targetId: 'node-three-band-theory', relation: 'follows' },
  { sourceId: 'node-three-band-theory', targetId: 'node-low-frequency-band', relation: 'follows' },
  { sourceId: 'node-three-band-theory', targetId: 'node-mid-frequency-band', relation: 'follows' },
  { sourceId: 'node-three-band-theory', targetId: 'node-high-frequency-band', relation: 'follows' },

  // Lesson 15 串联校正与滞后超前
  { sourceId: 'node-margin-bode-estimation', targetId: 'node-series-compensation', relation: 'follows' },
  { sourceId: 'node-series-compensation', targetId: 'node-lead-network-feature', relation: 'follows' },
  { sourceId: 'node-lead-network-feature', targetId: 'node-lead-max-phase', relation: 'follows' },
  { sourceId: 'node-lead-max-phase', targetId: 'node-lead-design-steps', relation: 'follows' },
  { sourceId: 'node-series-compensation', targetId: 'node-lag-network-feature', relation: 'follows' },
  { sourceId: 'node-lag-network-feature', targetId: 'node-lag-design-steps', relation: 'follows' },
  { sourceId: 'node-lead-design-steps', targetId: 'node-lag-lead-compensation', relation: 'related' },
  { sourceId: 'node-lag-design-steps', targetId: 'node-lag-lead-compensation', relation: 'related' },
  { sourceId: 'node-lag-lead-compensation', targetId: 'node-lag-lead-workflow', relation: 'follows' },

  // Lesson 13 舒适度控制
  { sourceId: 'node-pid-controller', targetId: 'node-multi-constraint-pid', relation: 'related' },
  { sourceId: 'node-iso-2631', targetId: 'node-multi-constraint-pid', relation: 'influences' },

  // Lesson 16 非线性系统与描述函数基础
  { sourceId: 'node-nonlinear-ubiquity', targetId: 'node-nonlinear-special-properties', relation: 'follows' },
  { sourceId: 'node-nonlinear-special-properties', targetId: 'node-harmonic-linearization', relation: 'follows' },
  { sourceId: 'node-harmonic-linearization', targetId: 'node-describing-function-definition', relation: 'follows' },
  { sourceId: 'node-describing-function-definition', targetId: 'node-ideal-relay-describing', relation: 'example' },
  { sourceId: 'node-describing-function-definition', targetId: 'node-saturation-describing', relation: 'example' },
  { sourceId: 'node-describing-function-definition', targetId: 'node-dead-zone-describing', relation: 'example' },
  { sourceId: 'node-describing-function-definition', targetId: 'node-hysteresis-backlash', relation: 'example' },

  // Lesson 17 描述函数分析法与自振判别
  { sourceId: 'node-describing-function-definition', targetId: 'node-describing-function-assumptions', relation: 'follows' },
  { sourceId: 'node-describing-function-assumptions', targetId: 'node-negative-inverse-describing', relation: 'follows' },
  { sourceId: 'node-negative-inverse-describing', targetId: 'node-nonlinear-stability-criterion', relation: 'follows' },
  { sourceId: 'node-negative-inverse-describing', targetId: 'node-limit-cycle-condition', relation: 'follows' },
  { sourceId: 'node-limit-cycle-condition', targetId: 'node-limit-cycle-stability', relation: 'follows' },
  { sourceId: 'node-negative-inverse-describing', targetId: 'node-negative-inverse-plot', relation: 'supports' },
  { sourceId: 'node-limit-cycle-condition', targetId: 'node-limit-cycle-solving', relation: 'follows' }
];

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🌱 开始同步所有知识点...\n');

  const contentDir = path.join(process.cwd(), 'content', 'concepts');

  // 1. 同步知识节点
  console.log('📚 同步知识节点...');
  for (const node of KNOWLEDGE_NODES) {
    console.log(`  处理: ${node.name}`);

    // 读取 MDX 文件内容
    const filePath = path.join(contentDir, node.filename);
    let mdxContent = '';
    try {
      mdxContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`  ⚠️ 无法读取文件 ${node.filename}，使用描述作为内容`);
      mdxContent = node.description;
    }

    const metadata = {
      type: 'mdx',
      content: mdxContent,
      lessonId: node.tags.find(t => t.startsWith('lesson-')) || 'general',
    };

    const resources = [
      { path: `content/concepts/${node.filename}`, type: 'mdx' }
    ];

    await prisma.knowledgeNode.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        nodeType: node.nodeType,
        description: node.description,
        bloomLevel: node.bloomLevel,
        knowledgeDim: node.knowledgeDim,
        positionX: node.position.x,
        positionY: node.position.y,
        positionZ: node.position.z,
        metadata: metadata,
        resources: resources,
        tags: node.tags,
        isActive: true
      },
      create: {
        id: node.id,
        name: node.name,
        nodeType: node.nodeType,
        description: node.description,
        bloomLevel: node.bloomLevel,
        knowledgeDim: node.knowledgeDim,
        positionX: node.position.x,
        positionY: node.position.y,
        positionZ: node.position.z,
        metadata: metadata,
        resources: resources,
        tags: node.tags,
        isActive: true
      }
    });
  }
  console.log(`  ✅ 已同步 ${KNOWLEDGE_NODES.length} 个知识节点\n`);

  // 2. 同步知识关系
  console.log('🔗 同步知识关系...');
  for (const link of KNOWLEDGE_LINKS) {
    console.log(`  处理: ${link.sourceId} → ${link.targetId} (${link.relation})`);

    // 验证源和目标节点存在
    const sourceExists = await prisma.knowledgeNode.findUnique({ where: { id: link.sourceId } });
    const targetExists = await prisma.knowledgeNode.findUnique({ where: { id: link.targetId } });

    if (!sourceExists || !targetExists) {
      console.warn(`  ⚠️ 跳过: 源节点或目标节点不存在`);
      continue;
    }

    await prisma.knowledgeLink.upsert({
      where: {
        sourceId_targetId: {
          sourceId: link.sourceId,
          targetId: link.targetId
        }
      },
      update: {
        relation: link.relation
      },
      create: {
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: link.relation
      }
    });
  }
  console.log(`  ✅ 已同步 ${KNOWLEDGE_LINKS.length} 个知识关系\n`);

  // 3. 输出统计信息
  const nodeCount = await prisma.knowledgeNode.count({ where: { isActive: true } });
  const linkCount = await prisma.knowledgeLink.count();
  console.log('📊 统计信息:');
  console.log(`  - 知识节点总数: ${nodeCount}`);
  console.log(`  - 知识关系总数: ${linkCount}`);
  console.log('\n✨ 知识点同步完成!');
}

main()
  .catch((e) => {
    console.error('❌ 同步失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
