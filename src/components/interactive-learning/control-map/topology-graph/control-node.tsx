'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { zoneConfigs, type ZoneType } from '../types';

export interface ControlNodeData {
  nameCn: string;
  name: string;
  zone: ZoneType;
  importance: 'core' | 'advanced' | 'specialized';
  isSelected: boolean;
  isHovered: boolean;
  isRelated: boolean;
  isDimmed: boolean;
}

function ControlNodeComponent({ data }: NodeProps<ControlNodeData>) {
  const { nameCn, name, zone, importance, isSelected, isHovered, isRelated, isDimmed } = data;
  const zoneConfig = zoneConfigs[zone];

  // 根据重要性确定尺寸
  const sizeClass = importance === 'core'
    ? 'min-w-[140px] py-3'
    : importance === 'advanced'
    ? 'min-w-[120px] py-2.5'
    : 'min-w-[100px] py-2';

  // 确定样式
  const isHighlighted = isSelected || isHovered || isRelated;
  const opacity = isDimmed ? 'opacity-30' : 'opacity-100';

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-slate-900 !bg-slate-600"
      />

      <div
        className={`
          rounded-xl border-2 px-4 text-center transition-all duration-200
          ${sizeClass} ${opacity}
          ${isSelected
            ? 'scale-110 shadow-lg shadow-amber-500/30'
            : isHovered
            ? 'scale-105'
            : isRelated
            ? 'scale-102'
            : ''
          }
        `}
        style={{
          backgroundColor: isHighlighted ? zoneConfig.bgColor : 'rgba(30, 41, 59, 0.8)',
          borderColor: isHighlighted ? zoneConfig.color : 'rgba(71, 85, 105, 0.5)',
          boxShadow: isSelected ? `0 0 20px ${zoneConfig.color}40` : undefined,
        }}
      >
        <div
          className="text-sm font-medium"
          style={{ color: isHighlighted ? zoneConfig.color : '#e2e8f0' }}
        >
          {nameCn}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          {name}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-slate-900 !bg-slate-600"
      />
    </>
  );
}

export const ControlNode = memo(ControlNodeComponent);
