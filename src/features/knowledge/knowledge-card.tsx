
'use client';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { GovernedBlockMath } from '@/components/shared/governed-rich-text';
import {
  createGovernedRehypeKatexOptions,
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
} from '@/lib/governed-math';
import { ArrowLeftRight, Image as ImageIcon, Maximize2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import { slugifyTrackingTarget } from '@/features/interactive/hooks/resource-interaction-utils';
import { getBloomLabel, getKnowledgeDimLabel, getNodeTypeLabel } from '@/lib/knowledge-labels';
import { useMdxContent } from '@/hooks/use-mdx-content';

// Define standardized metadata structure (matches what we seeded)
export interface KnowledgeMetadata {
  type: string;
  content?: string;
  formulas?: {
    continuous?: string;
    discrete?: string;
  };
  learningObjectives?: string[];
  applications?: string[];
  lessonId?: string;
  phase?: string;
}

export interface KnowledgeCardSource {
  id?: string;
  name: string;
  description: string;
  nodeType: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  resources?: unknown[];
}

export interface KnowledgeInfographResource {
  type: 'infograph';
  path?: string;
  url?: string;
  title?: string;
  lessonId?: string;
  nodeId?: string;
}

export function extractMdxPaths(resources?: unknown[]): string[] {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const candidate = (item as { path?: string; url?: string }).path
          || (item as { path?: string; url?: string }).url;
        return typeof candidate === 'string' ? candidate : null;
      }
      return null;
    })
    .filter((path): path is string => !!path && path.endsWith('.md'));
}

export function extractInfographResource(resources?: unknown[]): KnowledgeInfographResource | null {
  if (!Array.isArray(resources)) return null;
  for (const item of resources) {
    if (!item || typeof item !== 'object') continue;
    const resource = item as Partial<KnowledgeInfographResource>;
    if (resource.type !== 'infograph') continue;
    const url = typeof resource.url === 'string' ? resource.url : null;
    const path = typeof resource.path === 'string' ? resource.path : null;
    if (!url && !path) continue;
    return {
      type: 'infograph',
      url: url ?? undefined,
      path: path ?? undefined,
      title: typeof resource.title === 'string' ? resource.title : '知识点信息图',
      lessonId: typeof resource.lessonId === 'string' ? resource.lessonId : undefined,
      nodeId: typeof resource.nodeId === 'string' ? resource.nodeId : undefined,
    };
  }
  return null;
}

export function resolveKnowledgeInfographSrc(resource: KnowledgeInfographResource | null) {
  if (!resource) return null;
  if (resource.url) return resource.url;
  if (!resource.path) return null;
  if (resource.path.startsWith('course-content/runtime/knowledge/')) {
    return resource.path.replace('course-content/runtime/knowledge/', '/course-runtime/knowledge/');
  }
  return resource.path.startsWith('/') ? resource.path : `/${resource.path}`;
}

export function normalizeKnowledgeMetadata({
  metadata,
  content,
  description,
}: {
  metadata?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  description?: string;
}): KnowledgeMetadata {
  const safeMetadata = (metadata ?? {}) as Record<string, unknown>;
  const legacyContent = (content ?? {}) as Record<string, unknown>;
  const formulas = (safeMetadata.formulas ?? {}) as Record<string, unknown>;

  return {
    type: 'rich-text',
    content: (safeMetadata.content as string)
      || (safeMetadata.explanation as string)
      || (legacyContent.explanation as string)
      || description
      || '',
    formulas: {
      continuous: (formulas.continuous as string)
        || (safeMetadata.formulaContinuous as string)
        || (legacyContent.formulaContinuous as string),
      discrete: (formulas.discrete as string)
        || (safeMetadata.formulaDiscrete as string)
        || (legacyContent.formulaDiscrete as string),
    },
    learningObjectives: (safeMetadata.learningObjectives as string[])
      || (legacyContent.learningObjectives as string[]),
    applications: (safeMetadata.applications as string[])
      || (legacyContent.applications as string[])
      || [],
    lessonId: (safeMetadata.lessonId as string)
      || (legacyContent.lessonId as string),
    phase: (safeMetadata.phase as string)
      || (legacyContent.phase as string),
  };
}

interface KnowledgeCardProps {
  name: string;
  description: string;
  nodeType: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata: KnowledgeMetadata;
  resources?: unknown[];
  trackingContext?: {
    resourceKey: string;
    lessonKey?: string | null;
    surface?: string;
    pageType?: string;
    targetType?: string;
    targetId?: string | null;
    targetLabel?: string | null;
    moduleId?: string | null;
    provider?: string | null;
  };
  /** 显示模式：full（完整）或 compact（紧凑） */
  variant?: 'full' | 'compact';
  className?: string;
  /** 关闭按钮回调（传入时显示关闭按钮） */
  onClose?: () => void;
  showSectionToggle?: boolean;
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function extractMarkdownSection(markdown: string, heading: string) {
  const normalized = stripFrontmatter(markdown);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm');
  const match = normalized.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function stripLeadingHeading(markdown: string) {
  return markdown.replace(/^\s{0,3}#{1,6}\s+.+?\n+/, '').trim();
}

function isRuntimeNodeCardPath(path: string) {
  return path.startsWith('course-content/runtime/knowledge/cards/nodes/') && path.endsWith('.md');
}

function RuntimeNodeCardSections({
  path,
  title,
  isLightTheme,
  onDetailOpen,
}: {
  path: string;
  title: string;
  isLightTheme: boolean;
  onDetailOpen?: () => void;
}) {
  return (
    <RuntimeNodeCardSectionsContent
      key={path}
      path={path}
      title={title}
      isLightTheme={isLightTheme}
      onDetailOpen={onDetailOpen}
    />
  );
}

function RuntimeNodeCardSectionsContent({
  path,
  title,
  isLightTheme,
  onDetailOpen,
}: {
  path: string;
  title: string;
  isLightTheme: boolean;
  onDetailOpen?: () => void;
}) {
  const { content, isLoading, error } = useMdxContent(path);
  const [view, setView] = useState<'overview' | 'detail'>('overview');

  const sections = useMemo(() => {
    const overview = stripLeadingHeading(extractMarkdownSection(content, '首页'));
    const detail = stripLeadingHeading(extractMarkdownSection(content, '详情'));
    return {
      overview,
      detail,
      active: view === 'detail' && detail ? detail : overview,
      hasDetail: Boolean(detail),
    };
  }, [content, view]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">正在加载知识卡片...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          {view === 'detail' ? '详情视图' : '概览视图'}
        </div>
        {sections.hasDetail ? (
          <button
            type="button"
            onClick={() => {
              setView((prev) => {
                const next = prev === 'overview' ? 'detail' : 'overview';
                if (next === 'detail') {
                  onDetailOpen?.();
                }
                return next;
              });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {view === 'overview' ? '详情' : '概览'}
          </button>
        ) : null}
      </div>
      <div className="max-h-[52vh] overflow-y-auto rounded-2xl border border-border/70 bg-muted/25 p-4">
        {sections.active ? (
          <div className={`max-w-none ${isLightTheme ? 'prose prose-slate' : 'prose prose-invert'} prose-p:leading-7 prose-li:leading-7`}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}>
              {sections.active}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">当前知识卡片暂未提供可展示内容。</div>
        )}
      </div>
    </div>
  );
}

export function KnowledgeCard({
  name,
  description,
  nodeType,
  bloomLevel,
  knowledgeDim,
  metadata,
  resources,
  trackingContext,
  variant = 'compact',
  className,
  onClose,
  showSectionToggle = true,
}: KnowledgeCardProps) {
  const [isLightTheme, setIsLightTheme] = useState(false);
  const bloomLabel = getBloomLabel(bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(knowledgeDim);
  const typeLabel = getNodeTypeLabel(nodeType);

  const mdxPaths = extractMdxPaths(resources);
  const infographResource = extractInfographResource(resources);
  const infographSrc = resolveKnowledgeInfographSrc(infographResource);
  const infographTitle = infographResource?.title ?? `${name} 信息图`;
  const runtimeNodeCardPath = mdxPaths.find((path) => isRuntimeNodeCardPath(path)) ?? null;
  const isCompact = variant === 'compact';
  const [isInfographOpen, setIsInfographOpen] = useState(false);
  const detailTracker = useResourceInteractionTracking({
    resourceKey: trackingContext?.resourceKey ?? `knowledge-card:${slugifyTrackingTarget(name)}`,
    lessonKey: trackingContext?.lessonKey ?? metadata.lessonId ?? null,
    surface: trackingContext?.surface ?? 'knowledge_card',
    pageType: trackingContext?.pageType ?? 'knowledge',
    targetType: trackingContext?.targetType ?? 'knowledge_card',
    targetId: trackingContext?.targetId ?? slugifyTrackingTarget(name),
    targetLabel: trackingContext?.targetLabel ?? name,
    moduleId: trackingContext?.moduleId ?? null,
    provider: trackingContext?.provider ?? 'knowledge-card',
  });

  // Helper to render type badge with Chinese label
  const renderTypeBadge = () => {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/75 px-2 py-0.5 text-xs font-medium text-foreground">
        {typeLabel || nodeType}
      </span>
    );
  };

  // 判断是否有 MDX 内容（如果有则不显示 metadata.content）
  const hasMdxContent = mdxPaths.length > 0;

  useEffect(() => {
    const updateTheme = () => {
      setIsLightTheme(document.documentElement.classList.contains('light'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const surfaceClassName = 'border-border bg-card text-card-foreground';
  const headingClassName = 'text-foreground';
  const descriptionClassName = 'text-muted-foreground';
  const subtlePanelClassName = 'border-border bg-muted/60 text-card-foreground';
  const subtleChipClassName = 'border-border bg-muted/75 text-card-foreground';

  return (
    <Card className={`relative w-full ${surfaceClassName} ${className || ''}`}>
      {/* 关闭按钮 - 仅在传入 onClose 时显示 */}
      {onClose && (
        <button type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <CardHeader className={`${isCompact ? 'pb-3' : 'pb-4'} ${onClose ? 'pr-12' : ''}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className={`${isCompact ? 'text-xl' : 'text-2xl'} ${headingClassName} flex items-center gap-2 font-bold flex-wrap`}>
              <span className="truncate">{name}</span>
              {renderTypeBadge()}
            </CardTitle>
            {!runtimeNodeCardPath && description.trim() ? (
              <CardDescription className={`${descriptionClassName} ${isCompact ? 'line-clamp-2' : ''}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}
                  components={{ p: ({ children }) => <span>{children}</span> }}
                >
                  {description}
                </ReactMarkdown>
              </CardDescription>
            ) : null}
          </div>
          {(bloomLabel || knowledgeLabel) && (
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {bloomLabel && (
                <span className="whitespace-nowrap rounded-full border border-border bg-muted/75 px-2 py-0.5 text-xs text-foreground">
                  认知：{bloomLabel}
                </span>
              )}
              {knowledgeLabel && (
                <span className="whitespace-nowrap rounded-full border border-border bg-muted/75 px-2 py-0.5 text-xs text-foreground">
                  知识：{knowledgeLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={isCompact ? 'space-y-3 pt-0' : 'space-y-5'}>
        {/* Main Content - 仅在没有 MDX 文件且不是 MDX 格式时显示纯文本 */}
        {runtimeNodeCardPath && showSectionToggle ? (
          <RuntimeNodeCardSections
            path={runtimeNodeCardPath}
            title={name}
            isLightTheme={isLightTheme}
            onDetailOpen={() => {
              if (!trackingContext) {
                return;
              }
              detailTracker.trackKnowledgeCardOpen();
            }}
          />
        ) : null}

        {metadata.content && !hasMdxContent && !runtimeNodeCardPath && (
          <div className={`max-w-none ${isLightTheme ? 'prose prose-slate' : 'prose prose-invert'} `}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}
            >
              {metadata.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Formulas - 仅在没有 MDX 内容时显示 */}
        {!hasMdxContent && !runtimeNodeCardPath && metadata.formulas && (metadata.formulas.continuous || metadata.formulas.discrete) && (
          <div className={`space-y-3 rounded-lg border ${subtlePanelClassName} ${isCompact ? 'p-3' : 'p-4'}`}>
            <h4 className={`text-sm font-semibold ${headingClassName}`}>数学表达</h4>
            {metadata.formulas.continuous && (
              <div>
                <div className={`mb-1 text-xs ${descriptionClassName}`}>连续时间</div>
                <GovernedBlockMath
                  latex={metadata.formulas.continuous}
                  macroProfileId={GOVERNED_KATEX_MACRO_PROFILE_ID}
                  macroProfileHash={GOVERNED_KATEX_MACRO_PROFILE_HASH}
                  accessibleLabel={metadata.formulas.continuous}
                  copyLatex={metadata.formulas.continuous}
                />
              </div>
            )}
            {metadata.formulas.discrete && (
              <div>
                <div className={`mb-1 text-xs ${descriptionClassName}`}>离散时间</div>
                <GovernedBlockMath
                  latex={metadata.formulas.discrete}
                  macroProfileId={GOVERNED_KATEX_MACRO_PROFILE_ID}
                  macroProfileHash={GOVERNED_KATEX_MACRO_PROFILE_HASH}
                  accessibleLabel={metadata.formulas.discrete}
                  copyLatex={metadata.formulas.discrete}
                />
              </div>
            )}
          </div>
        )}

        {/* Applications - 仅在没有 MDX 内容时显示 */}
        {!hasMdxContent && !runtimeNodeCardPath && metadata.applications && metadata.applications.length > 0 && (
          <div>
            <h4 className={`mb-2 text-sm font-semibold ${descriptionClassName}`}>应用领域</h4>
            <div className="flex flex-wrap gap-1.5">
              {metadata.applications.map((app, idx) => (
                <span key={idx} className={`rounded-md border px-2 py-0.5 text-xs ${subtleChipClassName}`}>
                  {app}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* MDX Content - 使用暗色主题和自适应尺寸 */}
        {mdxPaths.length > 0 && !runtimeNodeCardPath && (
          <div className="space-y-3">
            {mdxPaths.map((path) => (
              <MdxSlide key={path} path={path} theme={isLightTheme ? 'light' : 'dark'} size="adaptive" />
            ))}
          </div>
        )}

        {infographSrc ? (
          <figure className="overflow-hidden rounded-2xl border border-border bg-muted/30">
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              信息图
            </div>
            <button
              type="button"
              aria-label={`放大查看${infographTitle}`}
              onClick={() => setIsInfographOpen(true)}
              className="group relative block w-full bg-background text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image
                src={infographSrc}
                alt={infographTitle}
                width={1600}
                height={900}
                unoptimized
                className="h-auto w-full object-contain transition duration-200 group-hover:brightness-95"
                loading="lazy"
              />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-border backdrop-blur">
                <Maximize2 className="h-3.5 w-3.5" />
                查看大图
              </span>
            </button>
          </figure>
        ) : null}
      </CardContent>
      {infographSrc ? (
        <Dialog open={isInfographOpen} onOpenChange={setIsInfographOpen}>
          <DialogContent className="max-w-[min(96vw,1400px)] border-border bg-background p-0 text-foreground">
            <DialogHeader className="border-b border-border px-6 py-4">
              <DialogTitle className="text-foreground">{infographTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                放大查看知识卡片信息图。
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[82vh] overflow-auto bg-white p-3">
              <Image
                src={infographSrc}
                alt={infographTitle}
                width={1600}
                height={900}
                unoptimized
                className="mx-auto h-auto w-full max-w-none object-contain"
                priority
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}

interface KnowledgeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: KnowledgeCardSource;
}

export function KnowledgeCardDialog({
  open,
  onOpenChange,
  node,
}: KnowledgeCardDialogProps) {
  const tracker = useResourceInteractionTracking({
    resourceKey: `knowledge-card:${node.id ?? slugifyTrackingTarget(node.name)}`,
    lessonKey:
      typeof node.metadata?.lessonId === 'string'
        ? node.metadata.lessonId
        : null,
    surface: 'knowledge_card',
    pageType: 'knowledge',
    targetType: 'knowledge_card',
    targetId: node.id ?? slugifyTrackingTarget(node.name),
    targetLabel: node.name,
    provider: 'knowledge-card-dialog',
  });
  const metadata = normalizeKnowledgeMetadata({
    metadata: node.metadata,
    content: node.content,
    description: node.description,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    tracker.trackKnowledgeCardOpen();
  }, [open, tracker]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[75vh] max-w-2xl overflow-hidden border-border bg-background p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{node.name}</DialogTitle>
          <DialogDescription>{node.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto">
          <KnowledgeCard
            name={node.name}
            description={node.description}
            nodeType={node.nodeType}
            bloomLevel={node.bloomLevel}
            knowledgeDim={node.knowledgeDim}
            metadata={metadata}
            resources={node.resources}
            variant="compact"
            className="border-0 bg-transparent shadow-none"
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
