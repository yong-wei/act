import type { ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SimulationLocalToolTemplateId =
  | 'heading-control'
  | 'dp-positioning'
  | 'comfort-frequency'
  | 'ice-propulsion';

interface SimulationLocalPanelConfig {
  title: string;
  summary: string;
  items: string[];
}

interface SimulationLocalToolTemplate {
  id: SimulationLocalToolTemplateId;
  family: string;
  leftPanel: SimulationLocalPanelConfig;
  rightPanel: SimulationLocalPanelConfig;
  hints: string[];
  commands: string[];
}

const simulationLocalToolTemplates: Record<SimulationLocalToolTemplateId, SimulationLocalToolTemplate> = {
  'heading-control': {
    id: 'heading-control',
    family: '航向控制',
    leftPanel: {
      title: '状态遥测',
      summary: '航向、航速、偏航率和扰动输入保持在场景侧读取。',
      items: ['航向误差', '转艏速率', '舵角/推力响应'],
    },
    rightPanel: {
      title: '控制与评价',
      summary: '控制参数、稳态误差和超调评价保持为仿真局部工具。',
      items: ['参数调节', '稳定裕度', '响应质量'],
    },
    hints: ['先确认航向误差收敛，再观察扰动后的恢复过程。'],
    commands: ['重置场景', '记录观察', '导出片段'],
  },
  'dp-positioning': {
    id: 'dp-positioning',
    family: '动力定位',
    leftPanel: {
      title: '定位状态',
      summary: '位置误差、艏向和环境载荷作为左侧状态流。',
      items: ['横向偏差', '纵向偏差', '风浪流扰动'],
    },
    rightPanel: {
      title: '推进分配',
      summary: '推进器分配、前馈补偿和能量约束属于局部控制面板。',
      items: ['推力分配', '前馈补偿', '能耗边界'],
    },
    hints: ['先收起非当前面板，保证定位误差曲线和场景姿态同屏可见。'],
    commands: ['锁定目标', '切换扰动', '保存工况'],
  },
  'comfort-frequency': {
    id: 'comfort-frequency',
    family: '舒适性/频域',
    leftPanel: {
      title: '舒适性状态',
      summary: '横摇、加速度和乘员舒适度指标作为场景伴随状态。',
      items: ['横摇角', '横摇角速度', '舒适度指标'],
    },
    rightPanel: {
      title: '频域与评价',
      summary: '减摇控制、频率响应和舒适性评价保持在右侧评价域。',
      items: ['频域响应', '减摇效果', '舒适性指标'],
    },
    hints: ['先观察公开海况下的横摇响应，再比较频域指标和舒适性变化。'],
    commands: ['切换海况', '观察频域', '记录结论'],
  },
  'ice-propulsion': {
    id: 'ice-propulsion',
    family: '冰区推进',
    leftPanel: {
      title: '冰阻状态',
      summary: '冰阻、速度和推进姿态作为破冰场景状态。',
      items: ['冰阻力', '航速保持', '姿态变化'],
    },
    rightPanel: {
      title: 'Azipod 控制',
      summary: '推进角、推力余量和鲁棒性观察作为局部控制面板。',
      items: ['推进角', '推力余量', '鲁棒性观察'],
    },
    hints: ['破冰场景先观察阻力突变，再比较推进角调整后的航速恢复。'],
    commands: ['切换冰况', '冻结视角', '记录恢复'],
  },
};

export function SimulationLocalToolWorkspace({
  templateId,
  children,
  className,
  panelLayout = 'side-rails',
}: {
  templateId: SimulationLocalToolTemplateId;
  children: ReactNode;
  className?: string;
  panelLayout?: 'side-rails' | 'stacked';
}) {
  const template = simulationLocalToolTemplates[templateId];

  return (
    <div
      className={cn(
        'grid min-h-[calc(100vh-10rem)] gap-3',
        panelLayout === 'side-rails' ? 'lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)_minmax(13rem,18rem)]' : 'grid-cols-1',
        className,
      )}
      data-simulation-local-workspace={template.id}
      data-simulation-local-tool-template={template.id}
      data-simulation-local-tool-family={template.family}
      data-simulation-local-panel-layout={panelLayout}
      data-simulation-mobile-secondary-controls="stacked-sheets"
      data-simulation-side-panels="collapsible"
    >
      <SimulationLocalPanel side="left" config={template.leftPanel} />
      <div className="order-1 flex min-w-0 flex-col gap-3" data-simulation-local-primary-column>
        <section data-commercial-workspace-zone="instrument-area" data-instrument-nonblank-contract="simulation-scene">
          {children}
        </section>
        <div
          className="rounded-lg border border-platform-border bg-platform-action-subtle px-4 py-3 text-xs leading-5 text-platform-fg-primary"
          data-simulation-local-hint-strip
        >
          {template.hints.map((hint) => (
            <p key={hint}>{hint}</p>
          ))}
        </div>
        <div
          role="group"
          aria-label="仿真局部工具"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-platform-border bg-platform-surface-raised/95 px-3 py-2 shadow-lg backdrop-blur"
          data-simulation-local-bottom-toolbar
          data-task-workspace-zone="bottom-tools"
        >
          {template.commands.map((command) => (
            <span
              key={command}
              className="inline-flex h-8 items-center rounded-md border border-platform-border bg-platform-surface px-3 text-xs font-medium text-platform-fg-secondary"
            >
              {command}
            </span>
          ))}
        </div>
      </div>
      <SimulationLocalPanel side="right" config={template.rightPanel} />
    </div>
  );
}

function SimulationLocalPanel({
  side,
  config,
}: {
  side: 'left' | 'right';
  config: SimulationLocalPanelConfig;
}) {
  return (
    <details
      open
      className={cn(
        'group min-w-0 rounded-lg border border-platform-border bg-platform-surface-overlay p-3 text-sm text-platform-fg-secondary shadow-sm',
        side === 'left' ? 'order-2 lg:order-first' : 'order-3 lg:order-last',
      )}
      data-simulation-local-panel={side}
      data-simulation-local-panel-zone={side === 'left' ? 'status-rail' : 'local-tools'}
      data-simulation-panel-collapsible="true"
      data-task-workspace-zone={side === 'left' ? 'status-rail' : 'local-tools'}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md font-semibold text-platform-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-platform-fg-tertiary transition-transform group-open:rotate-180"
        />
        {config.title}
        <span className="sr-only">可展开或收起</span>
      </summary>
      <p className="mt-2 text-xs leading-5">{config.summary}</p>
      <ul className="mt-3 space-y-2 text-xs">
        {config.items.map((item) => (
          <li key={item} className="rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
