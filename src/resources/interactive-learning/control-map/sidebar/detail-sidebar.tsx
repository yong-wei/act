'use client';

import { X } from 'lucide-react';
import { FormulaDisplay } from './formula-display';
import { controlTheoryNodes, getRelatedNodes } from '../data/control-theory-nodes';
import { zoneConfigs } from '../types';

interface DetailSidebarProps {
  nodeId: string | null;
  isDiscrete: boolean;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const SECTION_TITLE_CLASS = 'mb-2 text-[11px] font-semibold tracking-[0.18em] text-platform-fg-muted';
const TAG_CLASS = 'rounded-md border border-platform-border bg-platform-canvas/60 px-2 py-0.5 text-[11px] text-platform-fg-secondary';

export function DetailSidebar({ nodeId, isDiscrete, onClose, onNavigate }: DetailSidebarProps) {
  const node = nodeId ? controlTheoryNodes.find((n) => n.id === nodeId) : null;

  if (!node) return null;

  const zoneConfig = zoneConfigs[node.zone];
  const formula = isDiscrete ? node.formulaDiscrete : node.formulaContinuous;
  const relatedIds = getRelatedNodes(node.id);
  const relatedNodes = relatedIds
    .map((id) => controlTheoryNodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <aside
      aria-label={`${node.nameCn} 详情`}
      data-control-map-detail={node.id}
      className="simulation-light-panel flex max-h-full w-[22rem] flex-col"
    >
      <div className="flex items-start justify-between gap-3 border-b border-platform-border p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-platform-fg-primary">{node.nameCn}</h2>
          <p className="text-sm text-platform-fg-secondary">{node.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-platform-fg-primary"
              style={{ backgroundColor: zoneConfig.bgColor, borderColor: zoneConfig.borderColor }}
            >
              {zoneConfig.nameCn}
            </span>
            <span className={TAG_CLASS}>
              {node.domain === 'time' ? '时域' : node.domain === 'frequency' ? '频域' : '时域/频域'}
            </span>
            <span className={TAG_CLASS}>
              {node.timeType === 'continuous' ? '连续' : node.timeType === 'discrete' ? '离散' : '连续/离散'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭详情"
          title="关闭（Esc）"
          className="rounded-md p-1.5 text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className={SECTION_TITLE_CLASS}>核心定义</h3>
          <p className="text-sm leading-relaxed text-platform-fg-primary">{node.definition}</p>
        </section>

        <section>
          <h3 className={SECTION_TITLE_CLASS}>通俗解释</h3>
          <p className="text-sm leading-relaxed text-platform-fg-secondary">{node.explanation}</p>
        </section>

        {formula && (
          <section>
            <h3 className={`${SECTION_TITLE_CLASS} flex items-center justify-between`}>
              <span>核心公式</span>
              <span className="tracking-normal text-platform-action-primary">{isDiscrete ? '离散' : '连续'}</span>
            </h3>
            <FormulaDisplay formula={formula} />
          </section>
        )}

        {node.applications.length > 0 && (
          <section>
            <h3 className={SECTION_TITLE_CLASS}>应用领域</h3>
            <ul className="space-y-1.5">
              {node.applications.map((app, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-platform-fg-secondary">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: zoneConfig.color }}
                  />
                  {app}
                </li>
              ))}
            </ul>
          </section>
        )}

        {relatedNodes.length > 0 && (
          <section>
            <h3 className={SECTION_TITLE_CLASS}>相关主题</h3>
            <div className="flex flex-wrap gap-1.5">
              {relatedNodes.map((related) => {
                if (!related) return null;
                const relatedZone = zoneConfigs[related.zone];
                return (
                  <button
                    type="button"
                    key={related.id}
                    onClick={() => onNavigate(related.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-platform-border bg-platform-surface px-2.5 py-1 text-xs text-platform-fg-primary transition-colors hover:border-platform-action-primary/50 hover:bg-platform-action-subtle"
                  >
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: relatedZone.color }} />
                    {related.nameCn}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
