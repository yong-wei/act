'use client';

import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { platformLayerStyle } from '@/components/platform/platform-layers';
import { parsePublishedResourceHref } from '@/lib/published-resource-reference';
import { KnowledgeCard, normalizeKnowledgeMetadata } from '../knowledge-card';
import { canEmbedResourceHref } from './embed-policy';
import { subscribeResourceViewer } from './open-resource-viewer';
import type { UniversalResourceViewerDescriptor } from './types';

function ViewerBody({ descriptor }: { descriptor: UniversalResourceViewerDescriptor }) {
  const kind = descriptor.resourceKind.toLowerCase();
  const published = descriptor.href ? parsePublishedResourceHref(descriptor.href) : null;
  if (!published && (kind === '知识卡' || kind === 'card')) {
    const node = descriptor.node ?? {
      name: descriptor.title,
      description: descriptor.title,
      nodeType: 'KnowledgeStatement',
    };
    return (
      <div className="h-full overflow-y-auto p-4">
        <KnowledgeCard
          name={node.name}
          description={node.description}
          nodeType={node.nodeType}
          bloomLevel={node.bloomLevel}
          knowledgeDim={node.knowledgeDim}
          metadata={normalizeKnowledgeMetadata(node)}
          resources={node.resources}
          variant="compact"
          className="mx-auto max-w-4xl"
        />
      </div>
    );
  }
  if (!published && (kind === '信息图' || kind === 'infographic')) {
    return descriptor.imageSrc ? (
      <div className="relative h-full w-full bg-black">
        <Image
          src={descriptor.imageSrc}
          alt={descriptor.title}
          fill
          sizes="96vw"
          className="object-contain"
          unoptimized
        />
      </div>
    ) : (
      <div className="grid h-full place-items-center text-sm text-platform-fg-muted">
        当前信息图暂无可显示图像。
      </div>
    );
  }
  if (descriptor.href?.startsWith('/arena/') || descriptor.href?.startsWith('/simulations/')) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-platform-fg-primary">{descriptor.title}</p>
          <p className="mt-2 text-sm text-platform-fg-secondary">该沉浸式资源将在完整页面中运行。</p>
        </div>
      </div>
    );
  }
  if (canEmbedResourceHref(descriptor.href)) {
    return (
      <iframe
        src={descriptor.href!}
        title={descriptor.title}
        className="h-full w-full border-0 bg-background"
      />
    );
  }
  return (
    <div className="grid h-full place-items-center p-8 text-center text-sm text-platform-fg-muted">
      {descriptor.href
        ? '该资源请通过「打开完整页」查看，查看器不嵌入原始文件。'
        : '当前资源暂无可显示内容。'}
    </div>
  );
}

export function UniversalResourceViewerHost() {
  const [descriptor, setDescriptor] = useState<UniversalResourceViewerDescriptor | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => subscribeResourceViewer((request) => {
    openerRef.current = request.opener;
    setDescriptor(request.descriptor);
  }), []);

  useEffect(() => {
    setFullscreenEnabled(document.fullscreenEnabled);
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === contentRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const close = () => {
    if (document.fullscreenElement === contentRef.current) void document.exitFullscreen();
    setDescriptor(null);
    queueMicrotask(() => openerRef.current?.focus());
  };

  const toggleFullscreen = async () => {
    if (!contentRef.current) return;
    if (document.fullscreenElement === contentRef.current) await document.exitFullscreen();
    else await contentRef.current.requestFullscreen();
  };

  const openFullPage = () => {
    const href = descriptor?.href;
    if (!href) return;
    close();
    window.location.assign(href);
  };

  return (
    <>
      <span className="hidden" data-universal-resource-viewer-host="true" />
      <DialogPrimitive.Root open={Boolean(descriptor)} onOpenChange={(open) => {
        if (!open) close();
      }}>
        <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-foreground/80 backdrop-blur-sm dark:bg-foreground/20"
          style={platformLayerStyle('textbookWorkspace')}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          className={fullscreen
            ? 'fixed inset-0 h-screen w-screen max-w-none overflow-hidden border border-border bg-background focus:outline-none'
            : 'fixed left-1/2 top-1/2 h-[min(92vh,980px)] w-full max-w-[min(96vw,1600px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus:outline-none'}
          style={platformLayerStyle('textbookWorkspace')}
          data-universal-resource-viewer="true"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{descriptor?.title ?? '资源查看器'}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            在当前页面查看资源，也可进入完整页面。
          </DialogPrimitive.Description>
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <p className="truncate text-sm font-medium text-platform-fg-primary">{descriptor?.title}</p>
            <div className="flex items-center gap-2">
              {fullscreenEnabled ? (
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"
                >
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {fullscreen ? '退出全屏' : '全屏'}
                </button>
              ) : null}
              {descriptor?.href ? (
                <button
                  type="button"
                  onClick={openFullPage}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  打开完整页
                </button>
              ) : null}
              <DialogPrimitive.Close
                className="rounded-md border border-border p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"
                aria-label="关闭资源查看器"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="h-[calc(100%-3rem)]">
            {descriptor ? <ViewerBody descriptor={descriptor} /> : null}
          </div>
        </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
