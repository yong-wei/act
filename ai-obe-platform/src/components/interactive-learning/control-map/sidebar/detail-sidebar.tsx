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
    <div className="flex h-full w-80 flex-col border-l border-slate-700 bg-slate-900/95 backdrop-blur-md">
      {/* 头部 */}
      <div className="flex items-start justify-between border-b border-slate-700 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{node.nameCn}</h2>
          <p className="text-sm text-slate-400">{node.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: zoneConfig.bgColor,
                color: zoneConfig.color,
              }}
            >
              {zoneConfig.nameCn}
            </span>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {node.domain === 'time' ? '时域' : node.domain === 'frequency' ? '频域' : '时域/频域'}
            </span>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {node.timeType === 'continuous' ? '连续' : node.timeType === 'discrete' ? '离散' : '连续/离散'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* 定义 */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            核心定义
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{node.definition}</p>
        </section>

        {/* 解释 */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            通俗解释
          </h3>
          <p className="text-sm leading-relaxed text-slate-400">{node.explanation}</p>
        </section>

        {/* 公式 */}
        {formula && (
          <section>
            <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>核心公式</span>
              <span className="text-amber-400">{isDiscrete ? '离散' : '连续'}</span>
            </h3>
            <FormulaDisplay formula={formula} />
          </section>
        )}

        {/* 应用领域 */}
        {node.applications.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              应用领域
            </h3>
            <ul className="space-y-1.5">
              {node.applications.map((app, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {app}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 相关主题 */}
        {relatedNodes.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              相关主题
            </h3>
            <div className="flex flex-wrap gap-2">
              {relatedNodes.map((related) => {
                if (!related) return null;
                const relatedZone = zoneConfigs[related.zone];
                return (
                  <button
                    key={related.id}
                    onClick={() => onNavigate(related.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-slate-800"
                    style={{
                      borderColor: relatedZone.borderColor,
                      color: relatedZone.color,
                    }}
                  >
                    {related.nameCn}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
