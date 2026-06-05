'use client';

import { MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import type { KonlingTeachingAssistantEntryPoint } from '@/lib/konling-agent-runtime';

export function KonlingEntryPointButton({
  entryPoint,
  label,
}: {
  entryPoint: KonlingTeachingAssistantEntryPoint;
  label: string;
}) {
  const { openAssistantEntryPoint } = useGlobalAI();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openAssistantEntryPoint(entryPoint)}
      data-konling-mode={entryPoint.mode}
    >
      <MessageSquare className="mr-2 size-4" />
      {label}
    </Button>
  );
}
