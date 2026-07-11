'use client';

import type { ReactNode } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FlaskConical,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  Presentation,
  Swords,
  type LucideIcon,
} from 'lucide-react';

export type AdaptivePathTimelineNodeStatus =
  | 'current'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'locked'
  | 'next'
  | 'optional';

export interface AdaptivePathTimelineNode {
  nodeId: string;
  title: string;
  type: string;
  resourceLabel: string;
  status: AdaptivePathTimelineNodeStatus;
  estimatedMinutes: number;
}

interface AdaptivePathResourceVisual {
  label: string;
  Icon: LucideIcon;
  markerClass: string;
  accentClass: string;
  surfaceClass: string;
}

const COURSE_VISUAL: AdaptivePathResourceVisual = {
  label: '互动课程',
  Icon: BookOpenCheck,
  markerClass: 'border-platform-action-primary/40 text-platform-action-primary',
  accentClass: 'border-l-platform-action-primary/55',
  surfaceClass: 'bg-platform-action-primary/5',
};
const KNOWLEDGE_VISUAL: AdaptivePathResourceVisual = {
  label: '知识卡',
  Icon: BrainCircuit,
  markerClass: 'border-platform-brand-evidence/40 text-platform-brand-evidence',
  accentClass: 'border-l-platform-brand-evidence/55',
  surfaceClass: 'bg-platform-brand-evidence/5',
};
const ASSESSMENT_VISUAL: AdaptivePathResourceVisual = {
  label: '自适应练习',
  Icon: ClipboardCheck,
  markerClass: 'border-platform-evidence-context/45 text-platform-evidence-context',
  accentClass: 'border-l-platform-evidence-context/55',
  surfaceClass: 'bg-platform-evidence-context/5',
};
const INTERVENTION_VISUAL: AdaptivePathResourceVisual = {
  label: '控灵建议',
  Icon: Bot,
  markerClass: 'border-platform-brand-trace-accent/40 text-platform-brand-trace-accent',
  accentClass: 'border-l-platform-brand-trace-accent/55',
  surfaceClass: 'bg-platform-brand-trace-accent/5',
};

const RESOURCE_VISUALS: Record<string, AdaptivePathResourceVisual> = {
  interactive_lesson: COURSE_VISUAL,
  knowledge_card: KNOWLEDGE_VISUAL,
  textbook_section: {
    label: '教材',
    Icon: BookOpen,
    markerClass: 'border-platform-brand-evidence/40 text-platform-brand-evidence',
    accentClass: 'border-l-platform-brand-evidence/55',
    surfaceClass: 'bg-platform-brand-evidence/5',
  },
  slides: {
    label: '课件',
    Icon: Presentation,
    markerClass: 'border-platform-brand-evidence/40 text-platform-brand-evidence',
    accentClass: 'border-l-platform-brand-evidence/55',
    surfaceClass: 'bg-platform-brand-evidence/5',
  },
  adaptive_quiz: ASSESSMENT_VISUAL,
  checkpoint: {
    ...ASSESSMENT_VISUAL,
    label: '检查点',
    Icon: CheckCircle2,
  },
  simulation: {
    label: '虚拟仿真',
    Icon: FlaskConical,
    markerClass: 'border-platform-evidence-eligible/45 text-platform-evidence-eligible',
    accentClass: 'border-l-platform-evidence-eligible/55',
    surfaceClass: 'bg-platform-evidence-eligible/5',
  },
  control_workbench: {
    label: '控制工作台',
    Icon: Gauge,
    markerClass: 'border-platform-evidence-eligible/45 text-platform-evidence-eligible',
    accentClass: 'border-l-platform-evidence-eligible/55',
    surfaceClass: 'bg-platform-evidence-eligible/5',
  },
  arena_task: {
    label: 'Arena',
    Icon: Swords,
    markerClass: 'border-platform-action-primary/40 text-platform-action-primary',
    accentClass: 'border-l-platform-action-primary/55',
    surfaceClass: 'bg-platform-action-primary/5',
  },
  reflection: {
    label: '反思',
    Icon: MessageSquareText,
    markerClass: 'border-platform-brand-trace-accent/40 text-platform-brand-trace-accent',
    accentClass: 'border-l-platform-brand-trace-accent/55',
    surfaceClass: 'bg-platform-brand-trace-accent/5',
  },
  external_resource: {
    label: '外部资源',
    Icon: ExternalLink,
    markerClass: 'border-platform-evidence-context/45 text-platform-evidence-context',
    accentClass: 'border-l-platform-evidence-context/55',
    surfaceClass: 'bg-platform-evidence-context/5',
  },
  konling: INTERVENTION_VISUAL,
};

const RESOURCE_ALIASES: Record<string, string> = {
  'interactive-lesson': 'interactive_lesson',
  'knowledge-node': 'knowledge_card',
  quiz: 'adaptive_quiz',
  ai_intervention: 'konling',
  intervention: 'konling',
};

const FALLBACK_VISUAL: AdaptivePathResourceVisual = {
  label: '学习资源',
  Icon: FileText,
  markerClass: 'border-platform-border-strong text-foreground',
  accentClass: 'border-l-platform-border-strong',
  surfaceClass: 'bg-muted/20',
};

export function getAdaptivePathResourceVisual(type: string): AdaptivePathResourceVisual {
  const normalizedType = RESOURCE_ALIASES[type] ?? type;
  return RESOURCE_VISUALS[normalizedType] ?? FALLBACK_VISUAL;
}

function nodeStatusPresentation(status: AdaptivePathTimelineNodeStatus) {
  if (status === 'current') return { label: '当前节点', Icon: Circle, className: 'border-primary text-primary' };
  if (status === 'completed') return { label: '已完成', Icon: CheckCircle2, className: 'border-platform-evidence-eligible/45 text-platform-evidence-eligible' };
  if (status === 'skipped') return { label: '已跳过', Icon: Circle, className: 'border-platform-evidence-context/45 text-platform-evidence-context' };
  if (status === 'blocked') return { label: '待复核', Icon: LockKeyhole, className: 'border-platform-evidence-context/45 text-platform-evidence-context' };
  if (status === 'locked') return { label: '稍后解锁', Icon: LockKeyhole, className: 'border-border text-subtle' };
  return { label: '等待前置节点', Icon: Circle, className: 'border-border text-subtle' };
}

function formatEstimatedMinutes(minutes: number): string {
  if (minutes <= 0) return '待估算';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

interface AdaptivePathTimelineProps<TNode extends AdaptivePathTimelineNode> {
  nodes: TNode[];
  focusedNodeId: string | null;
  onFocus: (nodeId: string) => void;
  renderExpandedContent: (node: TNode) => ReactNode;
}

export function AdaptivePathTimeline<TNode extends AdaptivePathTimelineNode>({
  nodes,
  focusedNodeId,
  onFocus,
  renderExpandedContent,
}: AdaptivePathTimelineProps<TNode>) {
  return (
    <ol className="grid gap-2" data-adaptive-path-route-flow="connected">
      {nodes.map((node, index) => {
        const focused = focusedNodeId === node.nodeId;
        const visual = getAdaptivePathResourceVisual(node.type);
        const status = nodeStatusPresentation(node.status);
        const ResourceIcon = visual.Icon;
        const StatusIcon = status.Icon;
        const detailId = `adaptive-path-node-detail-${node.nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        return (
          <li
            key={node.nodeId}
            className="relative pl-9"
            data-adaptive-path-node={node.nodeId}
            data-adaptive-path-resource-type={RESOURCE_ALIASES[node.type] ?? node.type}
            data-adaptive-path-node-state={node.status}
          >
            {index < nodes.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute bottom-[-0.5rem] left-[1.125rem] top-9 w-px bg-border"
                data-adaptive-path-route-connector="adaptive"
              />
            ) : null}
            <span className={`absolute left-0 top-3 z-10 grid size-9 place-items-center rounded-full border bg-background ${visual.markerClass}`}>
              <ResourceIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">{visual.label}</span>
            </span>
            <article className={`overflow-hidden rounded-lg border border-l-2 border-border ${visual.accentClass} ${visual.surfaceClass} ${focused ? 'ring-2 ring-primary/25' : ''}`}>
              <button
                type="button"
                onClick={() => onFocus(node.nodeId)}
                aria-expanded={focused}
                aria-controls={focused ? detailId : undefined}
                aria-pressed={focused}
                data-adaptive-path-node-selectable="true"
                className="flex min-h-16 w-full items-start gap-3 p-3 text-left transition hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-subtle">第 {index + 1} 步 · {visual.label}</span>
                  <span className="mt-1 block break-words text-sm font-semibold text-foreground">{node.title}</span>
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border bg-background/75 px-2 py-1 text-xs ${status.className}`}>
                  <StatusIcon className="size-3" aria-hidden="true" />
                  {status.label}
                </span>
              </button>
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-xs text-subtle">
                <span>{node.resourceLabel || visual.label}</span>
                <span>预计 {formatEstimatedMinutes(node.estimatedMinutes)}</span>
              </div>
              {focused ? (
                <div id={detailId} className="border-t border-border bg-background/60 p-4" data-adaptive-path-node-detail="inline">
                  {renderExpandedContent(node)}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
