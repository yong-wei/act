/**
 * seed-all-knowledge.mjs
 *
 * 统一的知识点种子脚本
 * 将所有 content/concepts/ 下的 MDX 文件关联到数据库中的 KnowledgeNode
 *
 * 运行方式: node scripts/seed-all-knowledge.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// 知识点定义
// ============================================================================

const KNOWLEDGE_NODES = [
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
    tags: ['lesson-03', 'laplace', 's-domain']
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
  }
];

// ============================================================================
// 知识点关系定义
// ============================================================================

const KNOWLEDGE_LINKS = [
  // Lesson 02 内部关系
  { sourceId: 'node-modeling-intro', targetId: 'node-newton-laws', relation: 'prerequisite' },
  { sourceId: 'node-modeling-intro', targetId: 'node-kvl-circuit', relation: 'prerequisite' },
  { sourceId: 'node-newton-laws', targetId: 'node-linearization', relation: 'follows' },
  { sourceId: 'node-kvl-circuit', targetId: 'node-linearization', relation: 'related' },

  // Lesson 03 关系
  { sourceId: 'node-laplace-transform', targetId: 'node-transfer-function', relation: 'prerequisite' },
  { sourceId: 'node-linearization', targetId: 'node-laplace-transform', relation: 'related' },

  // Lesson 05 关系
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

  // Lesson 13 舒适度控制
  { sourceId: 'node-pid-controller', targetId: 'node-multi-constraint-pid', relation: 'related' },
  { sourceId: 'node-iso-2631', targetId: 'node-multi-constraint-pid', relation: 'influences' }
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
