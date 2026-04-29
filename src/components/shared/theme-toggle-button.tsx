'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers/theme-provider';

export function ThemeToggleButton() {
  const { mounted, theme, toggleTheme } = useTheme();
  const [hasLessonFloatingTools, setHasLessonFloatingTools] = useState(false);

  useEffect(() => {
    const update = () => {
      setHasLessonFloatingTools(Boolean(document.querySelector('[data-lesson-floating-tools="true"]')));
    };
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  if (!mounted || hasLessonFloatingTools) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className="fixed bottom-4 right-4 z-[120]">
      <Button
        type="button"
        variant="ghost"
        onClick={toggleTheme}
        className="btn-ghost-themed h-10 rounded-full border px-4 shadow-lg"
        aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
      >
        {isDark ? <Sun className="mr-2 h-4 w-4 text-amber-500" /> : <Moon className="mr-2 h-4 w-4 text-sky-600" />}
        <span className="text-xs font-medium">{isDark ? '浅色' : '深色'}</span>
      </Button>
    </div>
  );
}
