'use client';

import { useEffect, useRef, type PointerEvent } from 'react';

import { Button } from '@/components/ui/button';
import { simulationUi } from '../components/simulation-ui';

export function SketchPad({
  label,
  hint,
  onChange,
}: {
  label: string;
  hint: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moved = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  function publish() {
    const canvas = canvasRef.current;
    if (!canvas || moved.current < 8) {
      onChange('');
      return;
    }
    onChange(canvas.toDataURL('image/png'));
  }

  return (
    <div className="space-y-1">
      <span>{label}</span>
      <p className="text-platform-fg-muted">{hint}</p>
      <canvas
        ref={canvasRef}
        width={280}
        height={160}
        className="w-full max-w-xs rounded-md border border-platform-border bg-white"
        aria-label={label}
        onPointerDown={(event) => {
          const context = event.currentTarget.getContext('2d');
          const cursor = point(event);
          context?.beginPath();
          context?.moveTo(cursor.x, cursor.y);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          const context = event.currentTarget.getContext('2d');
          if (!context) return;
          const cursor = point(event);
          context.strokeStyle = '#1e3a5f';
          context.lineWidth = 2;
          context.lineCap = 'round';
          context.lineTo(cursor.x, cursor.y);
          context.stroke();
          moved.current += 1;
        }}
        onPointerUp={publish}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={simulationUi.buttonOutline}
        onClick={() => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d');
          if (!canvas || !context) return;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          moved.current = 0;
          onChange('');
        }}
      >
        清空手绘
      </Button>
    </div>
  );
}
