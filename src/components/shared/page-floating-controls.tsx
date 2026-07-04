'use client';

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type PageFloatingControlRegistration = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  priority?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onSelect: () => void;
};

export type PageFloatingDockBehavior = 'enabled' | 'collapsed' | 'hidden';

type PageFloatingControlMenuItem = Omit<PageFloatingControlRegistration, 'onSelect'> & {
  onSelect?: () => void;
};

type PageFloatingControlsContextValue = {
  registerControl: (control: PageFloatingControlRegistration) => () => void;
  setRouteDockBehavior: (behavior: PageFloatingDockBehavior) => () => void;
};

const PageFloatingControlsContext = createContext<PageFloatingControlsContextValue | null>(null);

export function buildFloatingControlMenu(
  registrations: PageFloatingControlRegistration[],
): PageFloatingControlMenuItem[] {
  return registrations
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => (left.priority ?? 50) - (right.priority ?? 50));
}

export function PageFloatingControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<Record<string, PageFloatingControlRegistration>>({});
  const [routeDockBehavior, setRouteDockBehaviorState] = useState<PageFloatingDockBehavior>('enabled');

  const registerControl = useCallback((control: PageFloatingControlRegistration) => {
    setControls((prev) => ({ ...prev, [control.id]: control }));
    return () => {
      setControls((prev) => {
        const next = { ...prev };
        delete next[control.id];
        return next;
      });
    };
  }, []);

  const setRouteDockBehavior = useCallback((behavior: PageFloatingDockBehavior) => {
    setRouteDockBehaviorState(behavior);
    return () => setRouteDockBehaviorState('enabled');
  }, []);

  const value = useMemo(() => ({ registerControl, setRouteDockBehavior }), [registerControl, setRouteDockBehavior]);

  return (
    <PageFloatingControlsContext.Provider value={value}>
      {children}
      <PageFloatingControls registrations={Object.values(controls)} behavior={routeDockBehavior} />
    </PageFloatingControlsContext.Provider>
  );
}

export function usePageFloatingControls() {
  const context = useContext(PageFloatingControlsContext);
  if (!context) {
    throw new Error('usePageFloatingControls must be used within PageFloatingControlsProvider');
  }
  return context;
}

export function useOptionalPageFloatingControls() {
  return useContext(PageFloatingControlsContext);
}

function PageFloatingControls({
  registrations,
  behavior,
}: {
  registrations: PageFloatingControlRegistration[];
  behavior: PageFloatingDockBehavior;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const secondaryTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('页面浮动控件已就绪。');
  const menu = buildFloatingControlMenu(registrations);
  const konlingControls = menu.filter((item) => isKonlingControl(item));
  const konlingControl = konlingControls.at(-1);
  const primaryControl = konlingControl ?? null;
  const secondaryControls = primaryControl
    ? menu.filter((item) => item.id !== primaryControl.id)
    : menu;
  const triggerLabel = primaryControl ? '控灵' : '';
  const panelId = 'page-floating-controls-panel';
  const panelTitleId = 'page-floating-controls-title';
  const [knowledgeInspectorAvoidanceActive, setKnowledgeInspectorAvoidanceActive] = useState(false);

  useEffect(() => {
    const syncKnowledgeInspectorAvoidance = () => {
      setKnowledgeInspectorAvoidanceActive(
        window.matchMedia('(min-width: 1024px)').matches
        && Boolean(document.querySelector('[data-knowledge-inspector="floating-right-edge"]')),
      );
    };
    syncKnowledgeInspectorAvoidance();
    const observer = new MutationObserver(syncKnowledgeInspectorAvoidance);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', syncKnowledgeInspectorAvoidance);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncKnowledgeInspectorAvoidance);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    setAnnouncement('页面辅助控件菜单已打开。');
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    });

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setAnnouncement('页面浮动控件菜单已关闭。');
        window.requestAnimationFrame(() => {
          if (secondaryTriggerRef.current) {
            secondaryTriggerRef.current.focus();
          } else {
            triggerRef.current?.focus();
          }
        });
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  if (behavior === 'hidden' || (!primaryControl && secondaryControls.length === 0)) {
    return null;
  }

  const renderItemIcon = (item: PageFloatingControlMenuItem) => {
    return item.icon ?? <Settings className="h-4 w-4 text-muted-foreground" />;
  };

  const handleSelect = (item: PageFloatingControlMenuItem) => {
    if (item.disabled) return;

    item.onSelect?.();
    setIsMenuOpen(false);
    setAnnouncement(`${item.label}已打开。`);
  };

  return (
    <div
      ref={menuRef}
      className="no-print fixed bottom-4 right-6 z-[120] flex flex-col items-end"
      style={knowledgeInspectorAvoidanceActive ? {
        right: 'calc(1.5rem + var(--knowledge-inspector-width, clamp(22.5rem, 30vw, 28.75rem)))',
      } : undefined}
      data-page-floating-controls="true"
      data-platform-floating-dock={behavior === 'collapsed' ? 'collapsed' : 'enabled'}
      data-platform-floating-dock-safe-area="bottom-right"
      data-platform-floating-dock-inspector-avoidance={knowledgeInspectorAvoidanceActive ? 'active' : undefined}
    >
      {isMenuOpen && secondaryControls.length > 0 ? (
        <div
          ref={panelRef}
          id={panelId}
          className="mb-3 max-h-[min(70vh,28rem)] w-56 overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-2 text-sm text-foreground shadow-2xl backdrop-blur"
          data-platform-floating-dock-expanded-panel
          role="region"
          aria-labelledby={panelTitleId}
        >
          <div id={panelTitleId} className="sr-only">
            页面辅助控件菜单
          </div>
          {secondaryControls.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              disabled={item.disabled}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={item.ariaLabel ?? item.label}
            >
              {renderItemIcon(item)}
              <span className="flex-1">{item.label}</span>
              {item.badge}
            </button>
          ))}
        </div>
      ) : null}

      {secondaryControls.length > 0 ? (
        <Button
          ref={secondaryTriggerRef}
          type="button"
          variant="ghost"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? panelId : undefined}
          aria-label="打开页面辅助控件菜单"
          title="页面辅助控件"
          className="btn-ghost-themed mb-2 h-9 w-9 rounded-full border p-0 shadow-lg"
          data-platform-floating-dock-secondary-trigger="true"
        >
          <Settings className="h-4 w-4" />
        </Button>
      ) : null}
      {primaryControl ? (
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          onClick={() => handleSelect(primaryControl)}
          disabled={primaryControl.disabled}
          aria-label={`打开${triggerLabel}`}
          className="btn-ghost-themed h-10 w-auto gap-2 rounded-full border px-3 text-xs font-semibold shadow-lg"
          data-platform-floating-dock-trigger-label={triggerLabel}
          data-platform-floating-dock-primary="konling"
          data-platform-floating-dock-direct-action="true"
        >
          {renderItemIcon(primaryControl)}
          <span>{triggerLabel}</span>
        </Button>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite" data-platform-floating-dock-status>
        {announcement}
      </span>
    </div>
  );
}

function isKonlingControl(item: PageFloatingControlMenuItem) {
  const id = item.id.toLowerCase();
  return id.includes('konling') || item.label.includes('控灵');
}
