'use client';

import { Lock, Unlock } from 'lucide-react';
import { useMemo } from 'react';

import { ARENA_CHALLENGE_OBJECTS, getArenaChallengeObject } from '../data/seed-challenges';
import { inferArenaObjectCapabilities } from './capabilities';
import type { ChallengeObject, WorkspaceMode } from '../types';

interface ModelSelectorPanelProps {
  currentObjectId?: string;
  locked: boolean;
  workspaceMode: WorkspaceMode;
  onSelectObject?: (objectId: string) => void;
}

const SOURCE_GROUPS: Array<{ label: string; source: string }> = [
  { label: '典型对象', source: 'typical' },
  { label: '作业对象', source: 'homework' },
  { label: '控制奥德赛', source: 'control-odyssey' },
  { label: '虚拟仿真对象', source: 'virtual-simulation' },
  { label: '前沿拓展对象', source: 'frontier' },
];

function isCompatibleWithMultiRepresentation(caps: ReturnType<typeof inferArenaObjectCapabilities>): boolean {
  return caps.isLti && caps.isSiso && caps.hasTransferFunction && caps.supportsRootLocus && caps.supportsBode;
}

function incompatibilityReason(caps: ReturnType<typeof inferArenaObjectCapabilities>): string {
  if (!caps.hasTransferFunction) return '非白箱传递函数对象，无法显示根轨迹/Bode/Nyquist';
  if (!caps.isLti) return '非LTI系统，多表征串联校正面板不支持';
  if (!caps.isSiso) return '非SISO系统，多表征工作台不支持MIMO';
  if (!caps.supportsBode) return '不支持频域分析，多表征工作台不支持';
  return '';
}

function recommendedWorkspaceLabel(object: ChallengeObject): string {
  if (object.visibility === 'black-box') return '建议进入辨识 + 控制工作台';
  if (object.source === 'control-odyssey') return '建议进入控制奥德赛工作台';
  return '建议进入对应工作台';
}

export function ArenaModelSelectorPanel({
  currentObjectId,
  locked,
  workspaceMode,
  onSelectObject,
}: ModelSelectorPanelProps) {
  const groupedObjects = useMemo(() => {
    return SOURCE_GROUPS
      .map((group) => ({
        ...group,
        objects: ARENA_CHALLENGE_OBJECTS.filter((obj) => obj.source === group.source),
      }))
      .filter((group) => group.objects.length > 0);
  }, []);

  if (locked && currentObjectId) {
    const currentObject = getArenaChallengeObject(currentObjectId);
    if (!currentObject) return null;
    const caps = inferArenaObjectCapabilities(currentObject);

    return (
      <div className="premium-lesson-panel px-5 py-4">
        <div className="premium-lesson-kicker flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" />
          当前挑战模型（锁定）
        </div>
        <div className="mt-3 space-y-1">
          <p className="premium-lesson-title text-lg">{currentObject.name}</p>
          <p className="premium-lesson-muted text-sm">{currentObject.model?.display ?? '无传递函数'}</p>
          <p className="premium-lesson-muted text-sm">
            来源：{currentObject.source} | {currentObject.visibility} | {currentObject.modelType ?? 'unknown'}
          </p>
          <p className="premium-lesson-muted text-sm">
            支持方法：{[caps.supportsPid ? 'PID' : null, caps.supportsSerialCorrection ? '串联校正' : null]
              .filter(Boolean).join('、') || '无'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-panel px-5 py-4">
      <div className="premium-lesson-kicker flex items-center gap-2">
        <Unlock className="h-3.5 w-3.5" />
        选择基础模型
      </div>
      <div className="mt-3 space-y-4">
        {groupedObjects.map((group) => (
          <div key={group.source}>
            <div className="premium-lesson-caption mb-2 text-xs font-medium uppercase tracking-wide">
              {group.label}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.objects.map((obj) => {
                const caps = inferArenaObjectCapabilities(obj);
                const compatible = isCompatibleWithMultiRepresentation(caps);
                const reason = incompatibilityReason(caps);
                const isActive = obj.id === currentObjectId;

                const cardContent = (
                  <>
                    <div className="text-sm font-medium">{obj.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {obj.model?.display ?? '无传函数据'}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{obj.visibility}</span>
                      {!compatible && (
                        <>
                          <span className="text-amber-600">· 不兼容</span>
                          <span className="block text-[11px] text-amber-600/80">{reason}</span>
                        </>
                      )}
                    </div>
                  </>
                );

                if (!compatible) {
                  return (
                    <div
                      key={obj.id}
                      title={reason}
                      className="cursor-not-allowed rounded-lg border border-border/30 p-3 text-left opacity-50"
                    >
                      {cardContent}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {recommendedWorkspaceLabel(obj)}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={obj.id}
                    type="button"
                    disabled={isActive}
                    onClick={() => isActive ? undefined : onSelectObject?.(obj.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-sky-500/60 bg-sky-50 dark:bg-sky-950/20'
                        : 'border-border/60 hover:border-sky-400/40 hover:bg-muted/50'
                    }`}
                  >
                    {cardContent}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
