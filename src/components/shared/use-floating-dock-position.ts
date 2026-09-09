'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';

export const FLOATING_DOCK_POSITION_KEY = 'act:konling-dock-position:v1';
export interface FloatingDockPosition { right: number; bottom: number }

export function constrainFloatingDockPosition(
  position: FloatingDockPosition,
  viewport: { width: number; height: number },
  dock: { width: number; height: number },
): FloatingDockPosition {
  return {
    right: Math.max(12, Math.min(position.right, Math.max(12, viewport.width - dock.width - 12))),
    bottom: Math.max(12, Math.min(position.bottom, Math.max(12, viewport.height - dock.height - 12))),
  };
}

function readPosition(): FloatingDockPosition | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FLOATING_DOCK_POSITION_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const point = value as Partial<FloatingDockPosition>;
    return typeof point.right === 'number' && Number.isFinite(point.right)
      && typeof point.bottom === 'number' && Number.isFinite(point.bottom)
      ? { right: point.right, bottom: point.bottom } : null;
  } catch { return null; }
}

export function useFloatingDockPosition(dockRef: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<FloatingDockPosition | null>(null);
  const positionRef = useRef(position);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number; x: number; y: number; origin: FloatingDockPosition;
    previous: FloatingDockPosition | null; moved: boolean;
  } | null>(null);

  const constrain = (point: FloatingDockPosition) => constrainFloatingDockPosition(
    point, { width: window.innerWidth, height: window.innerHeight },
    dockRef.current?.getBoundingClientRect() ?? { width: 112, height: 40 },
  );
  const apply = (point: FloatingDockPosition | null) => {
    positionRef.current = point;
    setPosition(point);
  };

  useEffect(() => {
    const clamp = (point: FloatingDockPosition) => constrainFloatingDockPosition(
      point, { width: window.innerWidth, height: window.innerHeight },
      dockRef.current?.getBoundingClientRect() ?? { width: 112, height: 40 },
    );
    const restore = () => {
      const saved = readPosition();
      const next = saved ? clamp(saved) : null;
      positionRef.current = next;
      setPosition(next);
    };
    const resize = () => {
      if (!positionRef.current) return;
      const next = clamp(positionRef.current);
      positionRef.current = next;
      setPosition(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === FLOATING_DOCK_POSITION_KEY || event.key === null) restore();
    };
    restore();
    window.addEventListener('resize', resize);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('storage', storage);
    };
  }, [dockRef]);

  // Registrations and the reset control can appear after the saved position is read.
  // Measure their final width before paint instead of relying on the initial fallback.
  useLayoutEffect(() => {
    const point = positionRef.current;
    if (!point || !dockRef.current) return;
    const next = constrain(point);
    if (next.right !== point.right || next.bottom !== point.bottom) apply(next);
  });

  const resetPosition = () => {
    apply(null);
    try { window.localStorage.removeItem(FLOATING_DOCK_POSITION_KEY); } catch { /* Position still resets for this page. */ }
  };
  const cancelDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    suppressClickRef.current = drag.moved;
    if (drag.moved) apply(drag.previous);
  };

  return {
    position,
    resetPosition,
    consumeClick(event: MouseEvent<HTMLButtonElement>) {
      const suppress = suppressClickRef.current && event.detail !== 0;
      suppressClickRef.current = false;
      if (suppress) { event.preventDefault(); event.stopPropagation(); }
      return suppress;
    },
    dragHandlers: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0 || event.isPrimary === false) return;
        const rect = dockRef.current?.getBoundingClientRect();
        if (!rect) return;
        event.stopPropagation();
        suppressClickRef.current = false;
        dragRef.current = {
          pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false,
          previous: positionRef.current,
          origin: { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom },
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        event.preventDefault();
        event.stopPropagation();
        apply(constrain({ right: drag.origin.right - dx, bottom: drag.origin.bottom - dy }));
      },
      onPointerUp(event: PointerEvent<HTMLButtonElement>) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        suppressClickRef.current = drag.moved;
        if (drag.moved && positionRef.current) {
          event.preventDefault();
          event.stopPropagation();
          try { window.localStorage.setItem(FLOATING_DOCK_POSITION_KEY, JSON.stringify(positionRef.current)); } catch { /* Keep session position when storage is unavailable. */ }
        }
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: cancelDrag,
      onLostPointerCapture: cancelDrag,
    },
  };
}
