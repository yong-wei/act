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

type PageFloatingControlMenuItem = Omit<PageFloatingControlRegistration, 'onSelect'> & {
  onSelect?: () => void;
};

type PageFloatingControlsContextValue = {
  registerControl: (control: PageFloatingControlRegistration) => () => void;
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

  const value = useMemo(() => ({ registerControl }), [registerControl]);

  return (
    <PageFloatingControlsContext.Provider value={value}>
      {children}
      <PageFloatingControls registrations={Object.values(controls)} />
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

function PageFloatingControls({ registrations }: { registrations: PageFloatingControlRegistration[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { mounted, theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menu = buildFloatingControlMenu(registrations);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  if (!mounted) {
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
    >
      {isMenuOpen ? (
        <div className="mb-3 w-56 rounded-2xl border border-border/70 bg-background/95 p-2 text-sm text-foreground shadow-2xl backdrop-blur">
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
        type="button"
        variant="ghost"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-label="打开页面工具菜单"
        className="btn-ghost-themed h-10 w-10 rounded-full border p-0 shadow-lg"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
