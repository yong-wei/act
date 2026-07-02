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
        'relative flex min-h-[calc(100vh-10rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-lg',
        panelLayout === 'side-rails' ? 'lg:block' : 'grid grid-cols-1',
        className,
      )}
      data-simulation-local-workspace={template.id}
      data-simulation-theme-template="local-tools"
      data-simulation-local-tool-template={template.id}
      data-simulation-local-tool-family={template.family}
      data-simulation-local-panel-layout={panelLayout}
      data-simulation-mobile-secondary-controls="stacked-sheets"
      data-simulation-side-panels="collapsible"
      data-product-design-concept-reference="concept-2-command-deck-shell"
      data-command-deck-composition="scene-primary-glass-panels-bottom-tools"
    >
      <div className="order-1 flex min-w-0 flex-1 flex-col" data-simulation-local-primary-column>
        <section
          className="relative min-h-[560px] overflow-hidden rounded-lg lg:min-h-[calc(100vh-10rem)] [&_[data-sim-ui]]:h-[560px] [&_[data-sim-ui]]:min-h-[560px] lg:[&_[data-sim-ui]]:h-[calc(100vh-10rem)] lg:[&_[data-sim-ui]]:min-h-[620px]"
          data-commercial-workspace-zone="instrument-area"
          data-instrument-nonblank-contract="simulation-scene"
          data-command-deck-scene-primacy="true"
        >
          {children}
          <div
            className="absolute inset-x-3 bottom-[4.75rem] z-30 rounded-lg border border-platform-border-strong bg-platform-action-subtle/90 px-4 py-3 text-xs leading-5 text-platform-fg-primary shadow-lg backdrop-blur lg:inset-x-[min(24rem,26vw)]"
            data-simulation-local-hint-strip
            data-simulation-dock-offset-anchor="hint-strip"
            data-simulation-state-role="hint"
            data-command-deck-hint-placement="above-bottom-toolbar"
          >
            {template.hints.map((hint) => (
              <p key={hint}>{hint}</p>
            ))}
          </div>
        </section>
        <div
          role="group"
          aria-label="仿真局部工具"
          className="order-2 mt-3 flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-platform-border-strong bg-platform-surface/92 px-3 py-2 shadow-lg"
          data-simulation-local-bottom-toolbar
          data-simulation-local-bottom-toolbar-status="visible"
          data-simulation-dock-offset-anchor="bottom-toolbar"
          data-simulation-state-role="replay"
          data-task-workspace-zone="bottom-tools"
          data-command-deck-bottom-tools="edge-adjacent"
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
      <SimulationLocalPanel side="left" config={template.leftPanel} panelLayout={panelLayout} />
      <SimulationLocalPanel side="right" config={template.rightPanel} panelLayout={panelLayout} />
    </div>
  );
}

function SimulationLocalPanel({
  side,
  config,
  panelLayout,
}: {
  side: 'left' | 'right';
  config: SimulationLocalPanelConfig;
  panelLayout: 'side-rails' | 'stacked';
}) {
  return (
    <details
      open
      className={cn(
        'group z-30 min-w-0 rounded-lg border border-platform-border-strong bg-platform-surface-overlay/86 p-3 text-sm text-platform-fg-secondary shadow-2xl backdrop-blur',
        side === 'left' && panelLayout === 'side-rails' ? 'order-2 lg:hidden' : null,
        side === 'left' && panelLayout === 'stacked' ? 'order-2' : null,
        side === 'right' && panelLayout === 'side-rails' ? 'order-3 lg:hidden' : null,
        side === 'right' && panelLayout === 'stacked' ? 'order-3' : null,
      )}
      data-simulation-local-panel={side}
      data-simulation-local-panel-zone={side === 'left' ? 'status-rail' : 'local-tools'}
      data-simulation-panel-collapsible="true"
      data-command-deck-glass-surface="true"
      data-task-workspace-zone={side === 'left' ? 'status-rail' : 'local-tools'}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md font-semibold text-platform-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-platform-fg-secondary transition-transform group-open:rotate-180"
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
