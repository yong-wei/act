'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { zoneConfigs, type ZoneType } from '../types';

export interface ControlNodeData extends Record<string, unknown> {
  nameCn: string;
  name: string;
  zone: ZoneType;
  importance: 'core' | 'advanced' | 'specialized';
  isSelected: boolean;
  isHovered: boolean;
  isRelated: boolean;
  isDimmed: boolean;
}

/** v12 类型：完整的节点类型定义 */
export type ControlNodeType = Node<ControlNodeData, 'controlNode'>;

const HANDLE_CLASS = '!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-platform-border-strong';

function ControlNodeComponent({ data }: NodeProps<ControlNodeType>) {
  const { nameCn, name, zone, importance, isSelected, isHovered, isRelated, isDimmed } = data;
  const zoneConfig = zoneConfigs[zone];

  const sizeClass = importance === 'core'
    ? 'min-w-[140px] py-2.5'
    : importance === 'advanced'
    ? 'min-w-[120px] py-2'
    : 'min-w-[104px] py-1.5';

  const emphasized = isSelected || isHovered || isRelated;

  return (
    <>
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />

      <div
        data-control-map-node={zone}
        data-selected={isSelected ? 'true' : undefined}
        className={cn(
          'relative overflow-hidden rounded-lg border bg-platform-surface pl-4 pr-3 text-left shadow-sm transition-all duration-200',
          sizeClass,
          isDimmed ? 'opacity-25' : 'opacity-100',
          isSelected ? 'scale-105' : isHovered ? 'scale-[1.03]' : '',
        )}
        style={{
          borderColor: emphasized ? zoneConfig.color : 'hsl(var(--platform-border))',
          backgroundImage: emphasized ? `linear-gradient(90deg, ${zoneConfig.bgColor}, transparent 70%)` : undefined,
          boxShadow: isSelected ? `0 0 0 3px ${zoneConfig.bgColor}, 0 10px 24px -12px ${zoneConfig.borderColor}` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: zoneConfig.color }}
        />
        <div className={cn('font-semibold text-platform-fg-primary', importance === 'core' ? 'text-sm' : 'text-[13px]')}>
          {nameCn}
        </div>
        <div className="mt-0.5 truncate text-[10px] leading-3 text-platform-fg-muted">{name}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    </>
  );
}

export const ControlNode = memo(ControlNodeComponent);
