'use client';

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Moon, Settings, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers/theme-provider';

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

const THEME_CONTROL: PageFloatingControlMenuItem = {
  id: 'theme',
  label: '主题切换',
  priority: 0,
};

export function buildFloatingControlMenu(
  registrations: PageFloatingControlRegistration[],
): PageFloatingControlMenuItem[] {
  return [
    THEME_CONTROL,
    ...registrations
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((left, right) => (left.priority ?? 50) - (right.priority ?? 50)),
  ];
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
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menu = buildFloatingControlMenu(registrations);
  const isDark = theme === 'dark';
  const primaryControl = menu.find((item) => item.id !== 'theme');
  const triggerLabel = primaryControl?.label.includes('控灵') ? '控灵' : primaryControl ? '工具' : '工具';

  useEffect(() => {
    if (!isMenuOpen) return;
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
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
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

  if (!mounted || behavior === 'hidden') {
    return null;
  }

  const renderItemIcon = (item: PageFloatingControlMenuItem) => {
    if (item.id === 'theme') {
      return isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-sky-600" />;
    }
    return item.icon ?? <Settings className="h-4 w-4 text-muted-foreground" />;
  };

  const handleSelect = (item: PageFloatingControlMenuItem) => {
    if (item.disabled) return;

    if (item.id === 'theme') {
      toggleTheme();
      setIsMenuOpen(false);
      return;
    }

    item.onSelect?.();
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className="no-print fixed bottom-4 right-6 z-[120] flex flex-col items-end"
      data-page-floating-controls="true"
      data-platform-floating-dock={behavior === 'collapsed' ? 'collapsed' : 'enabled'}
      data-platform-floating-dock-safe-area="bottom-right"
    >
      {isMenuOpen ? (
        <div
          ref={panelRef}
          className="mb-3 max-h-[min(70vh,28rem)] w-56 overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-2 text-sm text-foreground shadow-2xl backdrop-blur"
          data-platform-floating-dock-expanded-panel
        >
          {menu.map((item) => (
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
              {item.id === 'theme' ? (
                <span className="text-xs text-muted-foreground">{isDark ? '浅色' : '深色'}</span>
              ) : (
                item.badge
              )}
            </button>
          ))}
        </div>
      ) : null}

      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-label={`打开${triggerLabel}与页面工具菜单`}
        className="btn-ghost-themed h-10 w-auto gap-2 rounded-full border px-3 text-xs font-semibold shadow-lg"
        data-platform-floating-dock-trigger-label={triggerLabel}
      >
        {primaryControl ? renderItemIcon(primaryControl) : <Settings className="h-4 w-4" />}
        <span>{triggerLabel}</span>
      </Button>
    </div>
  );
}
