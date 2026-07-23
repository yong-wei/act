'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

/** 场景 chrome 中的"教学标注"开关按钮。 */
export function TeachingAnnotationsToggle({ className }: { readonly className?: string }) {
  const { showAnnotations, setShowAnnotations } = useTeachingAnnotations();
  return (
    <button
      type="button"
      className={className}
      aria-pressed={showAnnotations}
      data-teaching-annotations={showAnnotations}
      onClick={() => setShowAnnotations(!showAnnotations)}
    >
      {showAnnotations ? '隐藏教学标注' : '教学标注'}
    </button>
  );
}
