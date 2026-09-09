'use client';

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { RotateCcw, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { platformLayerStyle } from '@/components/platform/platform-layers';
import { useFloatingDockPosition } from './use-floating-dock-position';

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

export type PageFloatingControlMenuItem = Omit<PageFloatingControlRegistration, 'onSelect'> & {
  onSelect?: () => void;
};

type PageFloatingControlsContextValue = {
  registerControl: (control: PageFloatingControlRegistration) => () => void;
  setRouteDockBehavior: (behavior: PageFloatingDockBehavior) => () => void;
  setWorkspaceDockSuppressed: (suppressed: boolean) => () => void;
};

const PageFloatingControlsContext = createContext<PageFloatingControlsContextValue | null>(null);

export function buildFloatingControlMenu(
  registrations: PageFloatingControlRegistration[],
): PageFloatingControlMenuItem[] {
  return registrations
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => (left.priority ?? 50) - (right.priority ?? 50));
}

export function selectPrimaryFloatingControl(
  menu: PageFloatingControlMenuItem[],
): PageFloatingControlMenuItem | null {
  const konlingControls = menu.filter((item) => isKonlingControl(item));
  return konlingControls.filter((item) => !item.disabled).at(-1) ?? konlingControls.at(-1) ?? null;
}

export function PageFloatingControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<Record<string, PageFloatingControlRegistration>>({});
  const [routeDockBehavior, setRouteDockBehaviorState] = useState<PageFloatingDockBehavior>('enabled');
  const [workspaceDockSuppressed, setWorkspaceDockSuppressedState] = useState(false);

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

  const setWorkspaceDockSuppressed = useCallback((suppressed: boolean) => {
    setWorkspaceDockSuppressedState(suppressed);
    return () => setWorkspaceDockSuppressedState(false);
  }, []);

  const value = useMemo(
    () => ({ registerControl, setRouteDockBehavior, setWorkspaceDockSuppressed }),
    [registerControl, setRouteDockBehavior, setWorkspaceDockSuppressed],
  );

  return (
    <PageFloatingControlsContext.Provider value={value}>
      {children}
      <PageFloatingControls
        registrations={Object.values(controls)}
        behavior={workspaceDockSuppressed ? 'hidden' : routeDockBehavior}
      />
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
  const dockPosition = useFloatingDockPosition(menuRef);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const secondaryTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('页面浮动控件已就绪。');
  const menu = buildFloatingControlMenu(registrations);
  const primaryControl = selectPrimaryFloatingControl(menu);
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

  const dockRect = menuRef.current?.getBoundingClientRect();
  const menuBelow = dockRect && dockRect.top < window.innerHeight / 2;
  const menuRoom = dockRect ? (menuBelow ? window.innerHeight - dockRect.bottom : dockRect.top) - 24 : undefined;
  const menuRight = dockRect ? Math.min(0, dockRect.right - 236) : 0;

  return (
    <div
      ref={menuRef}
      className="no-print fixed bottom-4 right-6 z-[120] flex flex-col items-end"
      style={{
        ...platformLayerStyle('floatingDock'),
        ...(dockPosition.position ?? (knowledgeInspectorAvoidanceActive ? {
          right: 'calc(1.5rem + var(--knowledge-inspector-width, clamp(22.5rem, 30vw, 28.75rem)))',
        } : {})),
      }}
      data-page-floating-controls="true"
      data-platform-layer="floatingDock"
      data-platform-floating-dock={behavior === 'collapsed' ? 'collapsed' : 'enabled'}
      data-platform-floating-dock-safe-area={dockPosition.position ? 'custom' : 'bottom-right'}
      data-platform-floating-dock-inspector-avoidance={knowledgeInspectorAvoidanceActive ? 'active' : undefined}
    >
      {isMenuOpen && secondaryControls.length > 0 ? (
        <div
          ref={panelRef}
          id={panelId}
          className="absolute max-h-[min(70vh,28rem)] w-56 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-2 text-sm text-foreground shadow-2xl backdrop-blur"
          style={{ right: menuRight, ...(menuBelow ? { top: 'calc(100% + 0.75rem)' } : { bottom: 'calc(100% + 0.75rem)' }), ...(menuRoom !== undefined ? { maxHeight: Math.max(0, menuRoom) } : {}) }}
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
        <div className="flex items-center gap-1">
        {dockPosition.position ? (
          <button type="button" onClick={dockPosition.resetPosition} aria-label="恢复控灵默认位置"
            className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          {...dockPosition.dragHandlers}
          onClick={(event) => { if (!dockPosition.consumeClick(event)) handleSelect(primaryControl); }}
          disabled={primaryControl.disabled}
          aria-label={`打开${triggerLabel}`}
          title="点击打开控灵，拖动调整位置"
          style={{ touchAction: 'none' }}
          className="btn-ghost-themed h-10 w-auto gap-2 rounded-full border px-3 text-xs font-semibold shadow-lg"
          data-platform-floating-dock-trigger-label={triggerLabel}
          data-platform-floating-dock-primary="konling"
          data-platform-floating-dock-direct-action="true"
        >
          {renderItemIcon(primaryControl)}
          <span>{triggerLabel}</span>
        </Button>
        </div>
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
