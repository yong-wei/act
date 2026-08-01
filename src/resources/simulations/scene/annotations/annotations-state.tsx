'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { GraduationCap } from 'lucide-react';

import { ChromePopoverButton } from '../chrome';

import { DEFAULT_TEACHING_ANNOTATIONS_VISIBLE } from './annotation-logic';

interface TeachingAnnotationsContextValue {
  readonly showAnnotations: boolean;
  readonly setShowAnnotations: (visible: boolean) => void;
}

const TeachingAnnotationsContext = createContext<TeachingAnnotationsContextValue | null>(null);

/** 教学标注开关状态：默认关闭（实际航迹线不受其控制，始终显示）。 */
export function TeachingAnnotationsProvider({ children }: { readonly children: ReactNode }) {
  const [showAnnotations, setShowAnnotations] = useState(DEFAULT_TEACHING_ANNOTATIONS_VISIBLE);
  const value = useMemo(() => ({ showAnnotations, setShowAnnotations }), [showAnnotations]);
  return (
    <TeachingAnnotationsContext.Provider value={value}>
      {children}
    </TeachingAnnotationsContext.Provider>
  );
}

export function useTeachingAnnotations(): TeachingAnnotationsContextValue {
  const value = useContext(TeachingAnnotationsContext);
  if (!value) throw new Error('useTeachingAnnotations must be used within TeachingAnnotationsProvider');
  return value;
}

/** 标注控制（底部 chrome 家族弹出式）：网格与教学标注两行独立开关（合并控件）。 */
export function AnnotationsGridToggle({
  className,
  gridEnabled,
  onToggleGrid,
}: {
  readonly className?: string;
  readonly gridEnabled?: boolean;
  readonly onToggleGrid?: () => void;
}) {
  const { showAnnotations, setShowAnnotations } = useTeachingAnnotations();
  const stateLabel = showAnnotations && gridEnabled ? '双开' : showAnnotations ? '标注' : gridEnabled ? '网格' : '关';
  return (
    <div className={className} data-teaching-annotations={showAnnotations} data-simulation-local-bottom-tool-segment="annotations-grid-toggle">
      <ChromePopoverButton
        icon={<GraduationCap className="h-4 w-4" />}
        label="标注"
        currentLabel={stateLabel}
        tooltip={`标注：网格与教学标注独立开关（网格：${gridEnabled ? '开' : '关'}；教学标注：${showAnnotations ? '开' : '关'}）`}
        options={[]}
        currentId={null}
        onSelect={() => undefined}
        dataHook="annotations"
        ariaLabel="标注"
        tail={(
          <div className="min-w-28">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(gridEnabled)}
              data-grid-toggle="true"
              onClick={onToggleGrid}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-platform-fg-muted hover:text-platform-fg-primary"
            >
              <span>网格</span>
              <span className={gridEnabled ? 'font-medium text-platform-fg-primary' : ''}>{gridEnabled ? '开' : '关'}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={showAnnotations}
              data-teaching-annotations={showAnnotations}
              onClick={() => setShowAnnotations(!showAnnotations)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-platform-fg-muted hover:text-platform-fg-primary"
            >
              <span>教学标注</span>
              <span className={showAnnotations ? 'font-medium text-platform-fg-primary' : ''}>{showAnnotations ? '开' : '关'}</span>
            </button>
          </div>
        )}
      />
    </div>
  );
}
