/**
 * 方程生成器
 * Equation Generator for Physics Builder
 *
 * 根据节点图自动生成 LaTeX 格式的微分方程
 */

import type { Node, Edge } from 'reactflow';
import type { PhysicsNodeData, ComponentType } from '../types';

/**
 * 生成机械系统微分方程
 * 基于牛顿第二定律: ΣF = ma
 *
 * @param nodes React Flow 节点数组
 * @param edges React Flow 边数组
 * @returns LaTeX 格式的方程字符串
 */
export function generateMechanicalEquation(
  nodes: Node<PhysicsNodeData>[],
  edges: Edge[]
): string {
  // 找到质量块节点
  const massNode = nodes.find((n) => n.data?.type === 'mass');
  if (!massNode) {
    return ''; // 没有质量块，无法生成方程
  }

  // 收集连接到质量块的元件
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    if (edge.source === massNode.id) {
      connectedNodeIds.add(edge.target);
    }
    if (edge.target === massNode.id) {
      connectedNodeIds.add(edge.source);
    }
  });

  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id));

  // 构建方程项
  const terms: string[] = [];
  let hasForce = false;
  let forceSymbol = 'F';

  // 质量项 (惯性)
  const massSymbol = massNode.data?.params?.label || 'm';
  terms.push(`${massSymbol}\\ddot{x}`);

  // 遍历连接的元件
  connectedNodes.forEach((node) => {
    const type = node.data?.type;
    const label = node.data?.params?.label;

    switch (type) {
      case 'damper': {
        // 阻尼项: f·dx/dt
        const symbol = label || 'f';
        terms.push(`${symbol}\\dot{x}`);
        break;
      }
      case 'spring': {
        // 弹性项: k·x
        const symbol = label || 'k';
        terms.push(`${symbol}x`);
        break;
      }
      case 'force_source': {
        // 外力项
        forceSymbol = label || 'F';
        hasForce = true;
        break;
      }
    }
  });

  if (terms.length === 0) {
    return '';
  }

  // 组装方程: m*x'' + f*x' + k*x = F
  const leftSide = terms.join(' + ');
  const rightSide = hasForce ? forceSymbol : '0';

  return `${leftSide} = ${rightSide}`;
}

/**
 * 生成电路系统微分方程
 * 基于基尔霍夫电压定律 (KVL): Σu = 0
 *
 * @param nodes React Flow 节点数组
 * @param edges React Flow 边数组
 * @returns LaTeX 格式的方程字符串
 */
export function generateCircuitEquation(
  nodes: Node<PhysicsNodeData>[],
  edges: Edge[]
): string {
  // 检查是否有电压源
  const voltageSource = nodes.find((n) => n.data?.type === 'voltage_source');

  // 收集所有电路元件
  const components = nodes.filter((n) =>
    ['resistor', 'inductor', 'capacitor'].includes(n.data?.type || '')
  );

  if (components.length === 0) {
    return '';
  }

  // 构建方程项
  const terms: string[] = [];
  let hasVoltageSource = false;
  let voltageSymbol = 'u';

  components.forEach((node) => {
    const type = node.data?.type;
    const label = node.data?.params?.label;

    switch (type) {
      case 'inductor': {
        // 电感项: L·di/dt
        const symbol = label || 'L';
        terms.push(`${symbol}\\frac{di}{dt}`);
        break;
      }
      case 'resistor': {
        // 电阻项: R·i
        const symbol = label || 'R';
        terms.push(`${symbol}i`);
        break;
      }
      case 'capacitor': {
        // 电容项: (1/C)∫i·dt 或 u_C
        const symbol = label || 'C';
        terms.push(`\\frac{1}{${symbol}}\\int i\\,dt`);
        break;
      }
    }
  });

  if (voltageSource) {
    voltageSymbol = voltageSource.data?.params?.label || 'u';
    hasVoltageSource = true;
  }

  if (terms.length === 0) {
    return '';
  }

  // 组装方程: L*di/dt + R*i + (1/C)∫i·dt = u
  const leftSide = terms.join(' + ');
  const rightSide = hasVoltageSource ? voltageSymbol : '0';

  return `${leftSide} = ${rightSide}`;
}

/**
 * 格式化方程为更美观的显示形式
 */
export function formatEquation(equation: string): string {
  if (!equation) return '';

  // 添加 display math 环境
  return equation;
}

/**
 * 验证方程是否完整
 * 返回缺失的项列表
 */
export function validateMechanicalEquation(
  nodes: Node<PhysicsNodeData>[],
  targetEquation: string
): { isComplete: boolean; missing: string[] } {
  const missing: string[] = [];

  const hasMass = nodes.some((n) => n.data?.type === 'mass');
  const hasSpring = nodes.some((n) => n.data?.type === 'spring');
  const hasDamper = nodes.some((n) => n.data?.type === 'damper');
  const hasForce = nodes.some((n) => n.data?.type === 'force_source');

  if (!hasMass) missing.push('质量块 (惯性项)');
  if (!hasDamper) missing.push('阻尼器 (阻尼项)');
  if (!hasSpring) missing.push('弹簧 (弹性项)');
  if (!hasForce) missing.push('力源 (激励项)');

  return {
    isComplete: missing.length === 0,
    missing,
  };
}

/**
 * 验证电路方程是否完整
 */
export function validateCircuitEquation(
  nodes: Node<PhysicsNodeData>[],
  targetEquation: string
): { isComplete: boolean; missing: string[] } {
  const missing: string[] = [];

  const hasInductor = nodes.some((n) => n.data?.type === 'inductor');
  const hasResistor = nodes.some((n) => n.data?.type === 'resistor');
  const hasCapacitor = nodes.some((n) => n.data?.type === 'capacitor');
  const hasVoltageSource = nodes.some((n) => n.data?.type === 'voltage_source');

  if (!hasInductor) missing.push('电感 (惯性项)');
  if (!hasResistor) missing.push('电阻 (耗能项)');
  if (!hasCapacitor) missing.push('电容 (储能项)');
  if (!hasVoltageSource) missing.push('电压源 (激励项)');

  return {
    isComplete: missing.length === 0,
    missing,
  };
}

/**
 * 比较两个方程是否等价
 * 简化版本：仅检查关键项是否存在
 */
export function compareEquations(
  userEquation: string,
  targetEquation: string
): { isCorrect: boolean; feedback: string } {
  // 简化的检查逻辑
  const userNormalized = userEquation.toLowerCase().replace(/\s+/g, '');
  const targetNormalized = targetEquation.toLowerCase().replace(/\s+/g, '');

  // 检查关键符号
  const hasInertia = userNormalized.includes('ddot') || userNormalized.includes("''");
  const hasDamping = userNormalized.includes('dot') || userNormalized.includes("'");
  const hasStiffness = /[xqi](?!['\.])/i.test(userNormalized);

  if (userNormalized === targetNormalized) {
    return { isCorrect: true, feedback: '完全正确！' };
  }

  const issues: string[] = [];
  if (!hasInertia) issues.push('缺少惯性项（二阶导数）');
  if (!hasDamping) issues.push('缺少阻尼项（一阶导数）');
  if (!hasStiffness) issues.push('缺少弹性/储能项');

  if (issues.length > 0) {
    return {
      isCorrect: false,
      feedback: `方程不完整：${issues.join('、')}`,
    };
  }

  return {
    isCorrect: true,
    feedback: '方程结构正确！',
  };
}
