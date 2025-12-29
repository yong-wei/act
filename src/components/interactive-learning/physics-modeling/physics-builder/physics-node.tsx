'use client';

/**
 * 物理元件节点组件
 * Physics Component Node for React Flow
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { PhysicsNodeData, ComponentType } from '../types';

/** 元件图标 SVG */
const ComponentIcons: Record<ComponentType, React.ReactNode> = {
  // 机械元件
  mass: (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <rect
        x="8"
        y="14"
        width="32"
        height="20"
        rx="2"
        fill="currentColor"
        opacity="0.2"
      />
      <rect
        x="8"
        y="14"
        width="32"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="bold"
      >
        m
      </text>
    </svg>
  ),
  spring: (
    <svg viewBox="0 0 64 32" className="h-full w-full">
      <path
        d="M4 16 L12 16 L14 8 L18 24 L22 8 L26 24 L30 8 L34 24 L38 8 L42 24 L46 8 L50 24 L52 16 L60 16"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  ),
  damper: (
    <svg viewBox="0 0 64 32" className="h-full w-full">
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="2" />
      <rect
        x="20"
        y="6"
        width="24"
        height="20"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <line x1="32" y1="6" x2="32" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="44" y1="16" x2="60" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  force_source: (
    <svg viewBox="0 0 48 32" className="h-full w-full">
      <line x1="8" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="2" />
      <polygon points="40,16 32,10 32,22" fill="currentColor" />
    </svg>
  ),
  ground: (
    <svg viewBox="0 0 32 32" className="h-full w-full">
      <line x1="16" y1="4" x2="16" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="26" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),

  // 电气元件
  resistor: (
    <svg viewBox="0 0 64 32" className="h-full w-full">
      <path
        d="M4 16 L12 16 L14 8 L18 24 L22 8 L26 24 L30 8 L34 24 L38 8 L42 24 L46 8 L50 16 L60 16"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  ),
  inductor: (
    <svg viewBox="0 0 64 32" className="h-full w-full">
      <path
        d="M4 16 L12 16 Q16 16 16 12 Q16 8 20 8 Q24 8 24 12 Q24 16 28 16 Q28 16 28 12 Q28 8 32 8 Q36 8 36 12 Q36 16 40 16 Q40 16 40 12 Q40 8 44 8 Q48 8 48 12 Q48 16 52 16 L60 16"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  ),
  capacitor: (
    <svg viewBox="0 0 48 32" className="h-full w-full">
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="28" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="4" x2="28" y2="28" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="16" x2="44" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  voltage_source: (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
      <text x="24" y="20" textAnchor="middle" fill="currentColor" fontSize="14">
        +
      </text>
      <line x1="18" y1="32" x2="30" y2="32" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  current_source: (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="16" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="2" />
      <polygon points="32,24 26,20 26,28" fill="currentColor" />
    </svg>
  ),
  ground_elec: (
    <svg viewBox="0 0 32 32" className="h-full w-full">
      <line x1="16" y1="4" x2="16" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="26" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

/** 元件颜色主题 */
const ComponentColors: Record<ComponentType, string> = {
  mass: 'text-amber-500 border-amber-500/50 bg-amber-500/10',
  spring: 'text-green-500 border-green-500/50 bg-green-500/10',
  damper: 'text-red-500 border-red-500/50 bg-red-500/10',
  force_source: 'text-blue-500 border-blue-500/50 bg-blue-500/10',
  ground: 'text-slate-400 border-slate-400/50 bg-slate-400/10',
  resistor: 'text-red-500 border-red-500/50 bg-red-500/10',
  inductor: 'text-amber-500 border-amber-500/50 bg-amber-500/10',
  capacitor: 'text-green-500 border-green-500/50 bg-green-500/10',
  voltage_source: 'text-blue-500 border-blue-500/50 bg-blue-500/10',
  current_source: 'text-cyan-500 border-cyan-500/50 bg-cyan-500/10',
  ground_elec: 'text-slate-400 border-slate-400/50 bg-slate-400/10',
};

/** 物理节点组件 */
function PhysicsNodeComponent({ data, selected }: NodeProps<PhysicsNodeData>) {
  const { type, params, label } = data;
  const colorClass = ComponentColors[type] || 'text-slate-400 border-slate-400/50';
  const icon = ComponentIcons[type];

  // 判断是否为接地元件（只有输入端口）
  const isGround = type === 'ground' || type === 'ground_elec';

  return (
    <div
      className={`
        relative rounded-lg border-2 p-2 transition-all duration-200
        ${colorClass}
        ${selected ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-slate-900' : ''}
      `}
    >
      {/* 输入端口 */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-800"
      />

      {/* 输出端口（接地元件没有输出端口） */}
      {!isGround && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-800"
        />
      )}

      {/* 元件图标 */}
      <div className="flex h-12 w-16 items-center justify-center">{icon}</div>

      {/* 元件标签 */}
      <div className="mt-1 text-center text-xs font-medium">{label}</div>

      {/* 参数显示 */}
      {params?.label && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
          {params.label}
          {params.mass && ` = ${params.mass} kg`}
          {params.stiffness && ` = ${params.stiffness} N/m`}
          {params.damping && ` = ${params.damping} N·s/m`}
          {params.resistance && ` = ${params.resistance} Ω`}
          {params.inductance && ` = ${params.inductance} H`}
          {params.capacitance && ` = ${params.capacitance} F`}
        </div>
      )}
    </div>
  );
}

export const PhysicsNode = memo(PhysicsNodeComponent);

/** 节点类型映射 */
export const nodeTypes = {
  mass: PhysicsNode,
  spring: PhysicsNode,
  damper: PhysicsNode,
  force_source: PhysicsNode,
  ground: PhysicsNode,
  resistor: PhysicsNode,
  inductor: PhysicsNode,
  capacitor: PhysicsNode,
  voltage_source: PhysicsNode,
  current_source: PhysicsNode,
  ground_elec: PhysicsNode,
};
