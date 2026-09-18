'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { platformLayerStyle } from '@/components/platform/platform-layers';

import {
  consumeTextbookModalSession,
  persistTextbookModalSessionInHistory,
} from './textbook-reader-link';

export function TextbookReaderModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    persistTextbookModalSessionInHistory();
  }, [pathname]);

  const closeModal = () => {
    const session = consumeTextbookModalSession();
    if (session && window.history.length > session.depth) {
      window.history.go(-session.depth);
      return;
    }
    if (session) {
      router.replace(session.sourceHref);
      return;
    }
    router.back();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => {
      if (!open) closeModal();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-foreground/80 backdrop-blur-sm dark:bg-foreground/20"
          style={platformLayerStyle('textbookWorkspace')}
          data-platform-layer="textbookWorkspace"
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 h-[min(92vh,980px)] w-full max-w-[min(96vw,1600px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus:outline-none [&:has([data-textbook-reader-maximized=true])]:h-screen [&:has([data-textbook-reader-maximized=true])]:max-h-none [&:has([data-textbook-reader-maximized=true])]:w-screen [&:has([data-textbook-reader-maximized=true])]:max-w-none [&:has([data-textbook-reader-maximized=true])]:rounded-none"
          style={platformLayerStyle('textbookWorkspace')}
          data-platform-layer="textbookWorkspace"
          data-textbook-reader-modal="true"
        >
          <DialogPrimitive.Title className="sr-only">教材阅读器</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            阅读当前教材结构单元，可使用目录、面包屑和相邻单元链接继续浏览。
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md bg-background/80 p-2 text-muted-foreground shadow ring-1 ring-border transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
