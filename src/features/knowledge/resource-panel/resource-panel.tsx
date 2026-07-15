'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BookOpen, FileText, X, ArrowRight, Link2, ChevronDown, ChevronRight, Image as ImageIcon, ListPlus, Target } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { extractInfographResource, extractMdxPaths, KnowledgeCardDialog } from '../knowledge-card';
import {
  getBloomLabel,
  getKnowledgeDimLabel,
  getNodeTypeLabel,
  getRelationLabel,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import { isChapterNodeId } from '../graph/filter-utils';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

interface RelatedNode {
  id: string;
  name: string;
  nodeType: string;
  relation?: string;
  canonicalType?: string;
  cycleState?: 'cyclic';
  relationId?: string;
  category: 'membership' | 'prerequisite' | 'follows' | 'related';
  direction?: 'parent-to-child' | 'earlier-to-later' | 'unordered';
  family?: 'child' | 'post-requisite' | 'association';
  inspectionSentence?: string;
  evidenceState?: 'available' | 'unavailable';
  rationale?: string;
  sourceDocument?: string;
  sourceId?: string;
  sourceMetadata?: Record<string, string | number>;
  targetId?: string;
  strength?: number;
}

interface KnowledgeNodeDetail extends KnowledgeNodeData {
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
  relatedNodes?: RelatedNode[];
  truncated?: {
    content?: boolean;
    metadata?: boolean;
    relatedNodes?: boolean;
    resources?: boolean;
  };
}

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  viewerRole?: PlatformRole;
  mobileHeaderControl?: ReactNode;
  mobileToolPanelOpen?: boolean;
}

interface ResourcePanelSelectionState {
  nodeDetail: KnowledgeNodeDetail | null;
  nodeDetailOwnerId: string | null;
  isLoading: boolean;
  isCardOpen: boolean;
  expandedRelationGroups: Record<string, boolean>;
}

const RELATION_GROUP_ORDER: Array<RelatedNode['category']> = ['membership', 'prerequisite', 'follows', 'related'];
const RELATION_GROUP_LABEL: Record<RelatedNode['category'], string> = {
  membership: '层级与包含关系',
  prerequisite: '前置关系',
  follows: '后续关系',
  related: '关联关系',
};
const MOBILE_INSPECTOR_QUERY = '(max-width: 1023px)';
const INSPECTOR_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function formatRelationEvidence(node: RelatedNode): string | null {
  if (node.rationale) return node.rationale;
  if (node.sourceDocument) return node.sourceDocument;
  if (!node.sourceMetadata) return null;
  const sourceChapter = node.sourceMetadata.source_chapter ?? node.sourceMetadata.sourceChapter;
  const targetChapter = node.sourceMetadata.target_chapter ?? node.sourceMetadata.targetChapter;
  if (sourceChapter !== undefined || targetChapter !== undefined) {
    return `章节依据：${sourceChapter ?? '未知'} → ${targetChapter ?? '未知'}`;
  }
  const title = node.sourceMetadata.title ?? node.sourceMetadata.documentId ?? node.sourceMetadata.section;
  if (title !== undefined) return `来源：${title}`;
  const first = Object.entries(node.sourceMetadata)[0];
  return first ? `来源元数据：${first[0]}=${first[1]}` : null;
}

export function resolveResourcePanelSelectionState(
  selectedNode: KnowledgeNodeData
): ResourcePanelSelectionState {
  const isChapterNode = isChapterNodeId(selectedNode.id);
  return {
    nodeDetail: isChapterNode ? selectedNode as KnowledgeNodeDetail : null,
    nodeDetailOwnerId: isChapterNode ? selectedNode.id : null,
    isLoading: !isChapterNode,
    isCardOpen: false,
    expandedRelationGroups: {},
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function resolveInfographSrc(resource: ReturnType<typeof extractInfographResource>) {
  if (!resource) return null;
  if (resource.url) return resource.url;
  if (!resource.path) return null;
  if (resource.path.startsWith('course-content/runtime/knowledge/')) {
    return resource.path.replace('course-content/runtime/knowledge/', '/course-runtime/knowledge/');
  }
  return resource.path.startsWith('/') ? resource.path : `/${resource.path}`;
}

function isKnowledgeCardPath(value: unknown): boolean {
  return typeof value === 'string'
    && value.startsWith('course-content/runtime/knowledge/cards/nodes/')
    && value.endsWith('.md');
}

function readLessonIdFromResources(resources: unknown[] | undefined): string | null {
  if (!Array.isArray(resources)) return null;
  for (const item of resources) {
    if (!item || typeof item !== 'object') continue;
    const lessonId = (item as Record<string, unknown>).lessonId;
    if (typeof lessonId === 'string' && lessonId.trim()) return lessonId.trim();
  }
  return null;
}

export function resolveKnowledgeResourceLaunch(node: KnowledgeNodeData | null) {
  if (!node) {
    return {
      href: null,
      label: '等待选择知识节点',
      reason: '请选择一个知识节点后再启动资源。',
      lessonId: null,
      hasKnowledgeCard: false,
    };
  }

  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  const lessonId = typeof metadata.lessonId === 'string' && metadata.lessonId.trim()
    ? metadata.lessonId.trim()
    : readLessonIdFromResources(node.resources);
  const hasKnowledgeCard = (Array.isArray(node.resources) && node.resources.some(isKnowledgeCardPath))
    || isKnowledgeCardPath(metadata.launchTarget)
    || isKnowledgeCardPath(metadata.renderTarget)
    || isKnowledgeCardPath(metadata.lessonEntry);
  const explicitTarget = metadata.launchTarget ?? metadata.renderTarget ?? metadata.lessonEntry;
  if (typeof explicitTarget === 'string' && explicitTarget.trim() && !isKnowledgeCardPath(explicitTarget)) {
    return {
      href: explicitTarget.startsWith('/') ? explicitTarget : `/${explicitTarget}`,
      label: '启动关联资源',
      reason: null,
      lessonId,
      hasKnowledgeCard,
    };
  }

  const resourcePath = Array.isArray(node.resources)
    ? node.resources.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : null;
  if (resourcePath && !hasKnowledgeCard) {
    const href = resourcePath.startsWith('course-content/runtime/knowledge/')
      ? resourcePath.replace('course-content/runtime/knowledge/', '/course-runtime/knowledge/')
      : resourcePath.startsWith('/')
        ? resourcePath
        : `/${resourcePath}`;
    return {
      href,
      label: resourcePath.includes('/cards/') ? '打开知识卡片资源' : '启动关联资源',
      reason: null,
      lessonId,
      hasKnowledgeCard,
    };
  }

  if (lessonId) {
    return {
      href: `/interactive-learning/courses/${lessonId}`,
      label: '进入关联课程',
      reason: null,
      lessonId,
      hasKnowledgeCard,
    };
  }

  return {
    href: null,
    label: hasKnowledgeCard ? '查看知识卡片' : '暂无可启动资源',
    reason: hasKnowledgeCard ? '该节点关联知识卡片，请使用上方知识卡片入口查看。' : '该节点尚未关联课程资源、仿真或证据入口。',
    lessonId,
    hasKnowledgeCard,
  };
}

export function ResourcePanel({
  isOpen,
  selectedNode,
  onClose,
  onNodeClick,
  viewerRole = 'student',
  mobileHeaderControl,
  mobileToolPanelOpen = false,
}: ResourcePanelProps) {
  if (!isOpen || !selectedNode) return null;

  return (
      <ResourcePanelContent
        selectedNode={selectedNode}
        onClose={onClose}
        onNodeClick={onNodeClick}
        viewerRole={viewerRole}
        mobileHeaderControl={mobileHeaderControl}
        mobileToolPanelOpen={mobileToolPanelOpen}
      />
  );
}

function ResourcePanelContent({
  selectedNode,
  onClose,
  onNodeClick,
  viewerRole = 'student',
  mobileHeaderControl,
  mobileToolPanelOpen = false,
}: Omit<ResourcePanelProps, 'isOpen' | 'selectedNode'> & { selectedNode: KnowledgeNodeData }) {
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeDetail | null>(
    () => resolveResourcePanelSelectionState(selectedNode).nodeDetail
  );
  const [nodeDetailOwnerId, setNodeDetailOwnerId] = useState<string | null>(
    () => resolveResourcePanelSelectionState(selectedNode).nodeDetailOwnerId
  );
  const [isCardOpen, setIsCardOpen] = useState(
    () => resolveResourcePanelSelectionState(selectedNode).isCardOpen
  );
  const [isLoading, setIsLoading] = useState(() => resolveResourcePanelSelectionState(selectedNode).isLoading);
  const [expandedRelationGroups, setExpandedRelationGroups] = useState<Record<string, boolean>>(
    () => resolveResourcePanelSelectionState(selectedNode).expandedRelationGroups
  );
  const inspectorRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const restoreCloseFocusAfterBreakpointRef = useRef(false);
  const [isMobileInspector, setIsMobileInspector] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_INSPECTOR_QUERY);
    const update = () => {
      restoreCloseFocusAfterBreakpointRef.current = document.activeElement === closeButtonRef.current;
      setIsMobileInspector(media.matches);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    if (!restoreCloseFocusAfterBreakpointRef.current) return;
    restoreCloseFocusAfterBreakpointRef.current = false;
    closeButtonRef.current?.focus();
  }, [isMobileInspector]);

  useEffect(() => {
    const nextSelectionState = resolveResourcePanelSelectionState(selectedNode);
    setNodeDetail(nextSelectionState.nodeDetail);
    setNodeDetailOwnerId(nextSelectionState.nodeDetailOwnerId);
    setIsLoading(nextSelectionState.isLoading);
    setIsCardOpen(nextSelectionState.isCardOpen);
    setExpandedRelationGroups(nextSelectionState.expandedRelationGroups);

    if (!nextSelectionState.isLoading) {
      return;
    }

    const selectedNodeId = selectedNode.id;
    let cancelled = false;
    const controller = new AbortController();
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${encodeURIComponent(selectedNodeId)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.id === selectedNodeId) {
          setNodeDetail(data);
          setNodeDetailOwnerId(selectedNodeId);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Failed to fetch knowledge node detail:', error);
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedNode]);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    return () => {
      const previous = previouslyFocusedElementRef.current;
      if (previous?.isConnected && previous !== document.body && previous !== document.documentElement) {
        previous.focus();
        return;
      }
      document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]')?.focus();
    };
  }, []);

  useEffect(() => {
    if (!isMobileInspector) return;
    let focusFrame = 0;
    const mountFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(mountFrame);
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
    };
  }, [isMobileInspector, mobileToolPanelOpen, selectedNode.id]);

  const handleInspectorKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !isMobileInspector) return;

    const inspectorFocusable = Array.from(
      inspectorRef.current?.querySelectorAll<HTMLElement>(INSPECTOR_FOCUSABLE_SELECTOR) ?? []
    ).filter((item) => !item.hasAttribute('disabled') && item.tabIndex !== -1);
    const focusable = [closeButtonRef.current, ...inspectorFocusable]
      .filter((item): item is HTMLElement => Boolean(item))
      .filter((item, index, items) => items.indexOf(item) === index);
    if (focusable.length === 0) {
      event.preventDefault();
      inspectorRef.current?.focus();
      return;
    }

    event.preventDefault();
    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
      : (activeIndex < 0 || activeIndex === focusable.length - 1 ? 0 : activeIndex + 1);
    focusable[nextIndex].focus();
  }, [isMobileInspector, onClose]);

  const handleCloseButtonKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    handleInspectorKeyDown(event);
  }, [handleInspectorKeyDown]);

  const currentNodeDetail = nodeDetailOwnerId === selectedNode.id ? nodeDetail : null;
  const displayNode = (currentNodeDetail || selectedNode) as KnowledgeNodeDetail | null;
  const metadata = (displayNode?.metadata ?? {}) as Record<string, unknown>;
  const relatedNodes = displayNode?.relatedNodes || [];

  const relationGroups = RELATION_GROUP_ORDER.map((category) => ({
    category,
    label: RELATION_GROUP_LABEL[category],
    nodes: relatedNodes.filter((item) => item.category === category),
  })).filter((group) => group.nodes.length > 0);

  if (!displayNode) return null;

  const chapterName = resolveChapterName(
    displayNode.chapter,
    (typeof displayNode.chapterName === 'string' ? displayNode.chapterName : null) ??
      (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
  );
  const mdxPaths = extractMdxPaths(displayNode.resources);
  const infographResource = extractInfographResource(displayNode.resources);
  const infographSrc = resolveInfographSrc(infographResource);
  const knowledgeCardPaths = mdxPaths.filter(
    (path) =>
      path.startsWith('course-content/runtime/knowledge/cards/nodes/')
      && path.endsWith('.md')
  );
  const hasKnowledgeCard = knowledgeCardPaths.length > 0;

  const typeLabel = getNodeTypeLabel(displayNode.nodeType);
  const bloomLabel = getBloomLabel(displayNode.bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(displayNode.knowledgeDim);
  const isVirtualChapter = isChapterNodeId(displayNode.id) || Boolean(metadata.isVirtualChapter);
  const launchAction = resolveKnowledgeResourceLaunch(displayNode);
  const returnHref = `/knowledge?node=${encodeURIComponent(displayNode.id)}`;
  const evidenceHref = launchAction.lessonId
    ? `/profile/evidence?lessonId=${encodeURIComponent(launchAction.lessonId)}`
    : '/profile/evidence';
  const addToPlaylistHref = `/playlists/new?nodeId=${encodeURIComponent(displayNode.id)}`;
  const learningTaskHref = `/assessment/adaptive-practice?nodeId=${encodeURIComponent(displayNode.id)}&intent=contextual-recommendation`;
  const canAddToCourseFlow = viewerRole === 'teacher' || viewerRole === 'admin';

  const examples = toStringArray(metadata.examples);
  const keywords = toStringArray(metadata.keywords);
  const formulas = toStringArray(metadata.formulas);
  const difficulty =
    typeof metadata.difficulty === 'number'
      ? metadata.difficulty
      : typeof metadata.difficult === 'number'
        ? metadata.difficult
        : null;
  const importance = typeof metadata.importance === 'number' ? metadata.importance : null;

  const panelTheme = {
    shell: 'border border-platform-border bg-platform-surface text-platform-fg-primary',
    header: 'border-platform-border bg-platform-surface/95 text-platform-fg-primary',
    muted: 'text-platform-fg-muted',
    block: 'border-platform-border bg-platform-canvas-muted',
    blockTitle: 'text-platform-fg-primary',
    text: 'text-platform-fg-secondary',
  };
  const mobilePortalActive = mobileToolPanelOpen && isMobileInspector;
  const inspectorCloseButton = (
    <button type="button"
      ref={closeButtonRef}
      onClick={onClose}
      onKeyDown={handleCloseButtonKeyDown}
      className={`shrink-0 text-platform-fg-muted transition-colors hover:text-platform-fg-primary ${mobilePortalActive ? 'fixed right-4 top-[4.75rem] z-[70] grid h-8 w-8 place-items-center rounded-md border border-platform-border bg-platform-surface shadow-md' : ''}`}
      aria-label="关闭知识节点检查器"
      data-knowledge-inspector-close-priority={mobilePortalActive ? 'above-mobile-tools' : 'inline'}
    >
      <X className="h-4 w-4" />
    </button>
  );

  return (
    <>
    <aside
      ref={inspectorRef}
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      onKeyDown={handleInspectorKeyDown}
      className={`fixed inset-x-2 bottom-20 z-50 max-h-[calc(72vh-4.5rem)] overflow-y-auto rounded-xl pb-16 shadow-xl transition-transform duration-300 lg:fixed lg:inset-x-auto lg:bottom-20 lg:right-[var(--knowledge-workspace-inset,1rem)] lg:top-[calc(18.625rem+var(--knowledge-workspace-inset,1rem))] lg:z-40 lg:max-h-none lg:w-[var(--knowledge-inspector-width,clamp(22.5rem,30vw,28.75rem))] lg:rounded-xl lg:pb-0 lg:shadow-2xl xl:top-[calc(72px+var(--knowledge-workspace-inset,1rem))] ${panelTheme.shell} translate-x-0`}
      data-knowledge-local-panel="resource-panel"
      data-knowledge-inspector="floating-right-edge"
      data-knowledge-inspector-responsive="desktop-floating-mobile-sheet"
      data-knowledge-inspector-focus-contract="mobile-trap-escape-return"
      data-knowledge-inspector-dock-safe-area="bottom-padding"
      aria-label="知识节点检查器"
    >
      <div
        className={`sticky top-0 z-10 border-b p-4 ${panelTheme.header}`}
        data-knowledge-inspector-section="header"
      >
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-platform-action-primary" />
            <span className="truncate text-sm font-medium">{selectedNode.name}</span>
          </div>
          {!mobilePortalActive && inspectorCloseButton}
        </div>
        {mobileHeaderControl && (
          <div className="mt-3 lg:hidden" data-knowledge-inspector-mobile-control="relation-family">
            {mobileHeaderControl}
          </div>
        )}
      </div>

      {isLoading && <div className={`p-4 text-center text-sm ${panelTheme.muted}`}>加载中...</div>}

      {!isLoading && (
        <div className="space-y-4 p-4">
          {nodeDetail?.truncated && Object.values(nodeDetail.truncated).some(Boolean) && (
            <div className="rounded-md border border-platform-evidence-context/35 bg-platform-evidence-context/10 p-2 text-xs text-platform-evidence-context" data-knowledge-detail-truncated="true">
              <p>节点详情数据受限：</p>
              <ul className="mt-1 list-disc pl-4">
                {nodeDetail.truncated.metadata && <li>元数据不完整</li>}
                {nodeDetail.truncated.content && <li>知识内容不完整</li>}
                {nodeDetail.truncated.resources && <li>关联资源不完整</li>}
                {nodeDetail.truncated.relatedNodes && <li>关系列表不完整</li>}
              </ul>
            </div>
          )}
          <section className="space-y-3" data-knowledge-inspector-section="semantic-metadata">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-platform-action-primary px-2.5 py-0.5 text-xs font-medium text-platform-fg-inverse">
                {isVirtualChapter ? '章节节点' : typeLabel}
              </span>
              {bloomLabel && !isVirtualChapter && (
                <span className="rounded-full border border-platform-evidence-eligible/40 bg-platform-evidence-eligible/10 px-2 py-0.5 text-xs text-platform-evidence-eligible">
                  {bloomLabel}
                </span>
              )}
              {knowledgeLabel && !isVirtualChapter && (
                <span className="rounded-full border border-platform-action-primary/40 bg-platform-action-subtle px-2 py-0.5 text-xs text-platform-action-primary">
                  {knowledgeLabel}
                </span>
              )}
              <span className="rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5 text-xs text-platform-fg-secondary">
                章节：{chapterName}
              </span>
              {difficulty !== null && (
                <span className="rounded-full border border-platform-evidence-context/40 bg-platform-evidence-context/10 px-2 py-0.5 text-xs text-platform-evidence-context">
                  难度：{difficulty}
                </span>
              )}
              {importance !== null && (
                <span className="rounded-full border border-platform-brand-report-output/40 bg-platform-brand-report-output/10 px-2 py-0.5 text-xs text-platform-brand-report-output">
                  重要性：{importance}
                </span>
              )}
            </div>

            <p className={`text-sm leading-relaxed ${panelTheme.text}`} data-knowledge-inspector-section="summary">
              {displayNode.description}
            </p>
          </section>

          {infographSrc && (
            <section className={`overflow-hidden rounded-lg border ${panelTheme.block}`} data-knowledge-inspector-section="infograph-preview">
              <div className={`flex items-center gap-2 border-b border-platform-border px-3 py-2 text-sm font-medium ${panelTheme.blockTitle}`}>
                <ImageIcon className="h-4 w-4 text-platform-action-primary" />
                知识点信息图
              </div>
              <Image
                src={infographSrc}
                alt={infographResource?.title ?? `${displayNode.name} 信息图`}
                width={1600}
                height={900}
                unoptimized
                className="h-auto w-full bg-platform-surface object-contain"
                loading="lazy"
              />
            </section>
          )}

          {examples.length > 0 && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`}>
              <h3 className={`mb-2 text-sm font-medium ${panelTheme.blockTitle}`}>示例</h3>
              <ul className={`list-disc space-y-1 pl-4 text-xs ${panelTheme.text}`}>
                {examples.map((line) => (
                  <li key={`example-${line}`}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {keywords.length > 0 && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`}>
              <h3 className={`mb-2 text-sm font-medium ${panelTheme.blockTitle}`}>关键词</h3>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((keyword) => (
                  <span
                    key={`keyword-${keyword}`}
                    className="rounded-full border border-platform-border bg-platform-surface px-2 py-0.5 text-xs text-platform-fg-secondary"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          )}

          {formulas.length > 0 && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`}>
              <h3 className={`mb-2 text-sm font-medium ${panelTheme.blockTitle}`}>公式</h3>
              <div className="space-y-2 text-sm">
                {formulas.map((formula, index) => (
                  <div
                    key={`formula-${index}`}
                    className="overflow-x-auto rounded-md border border-platform-border bg-platform-surface px-2 py-1"
                  >
                    <BlockMath
                      math={formula}
                      errorColor="hsl(var(--platform-evidence-unsupported))"
                      renderError={() => <code className={panelTheme.text}>{formula}</code>}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isVirtualChapter && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`} data-knowledge-inspector-section="evidence-sources">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-platform-action-primary" />
                  <h3 className={`text-sm font-medium ${panelTheme.blockTitle}`}>知识卡片</h3>
                </div>
                {hasKnowledgeCard ? (
                  <button
                    type="button"
                    onClick={() => setIsCardOpen(true)}
                    className="flex items-center gap-1.5 rounded-md bg-platform-action-subtle px-3 py-1.5 text-xs font-medium text-platform-action-primary hover:bg-platform-action-hover"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    查看卡片
                  </button>
                ) : (
                  <span className={`text-xs ${panelTheme.muted}`}>未关联</span>
                )}
              </div>
            </section>
          )}

          {!isVirtualChapter && relationGroups.length > 0 && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`} data-knowledge-inspector-section="relation-overview">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-platform-action-primary" />
                <h3 className={`text-sm font-medium ${panelTheme.blockTitle}`}>关联知识点</h3>
              </div>
              <div className="space-y-2">
                {relationGroups.map((group) => {
                  const isExpanded = expandedRelationGroups[group.category] ?? group.category === RELATION_GROUP_ORDER[0];
                  return (
                    <div key={`relation-group-${group.category}`} className="rounded-md border border-platform-border bg-platform-surface">
                      <button type="button" onClick={() => setExpandedRelationGroups((prev) => ({ ...prev, [group.category]: !isExpanded }))} className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium text-platform-fg-secondary hover:text-platform-fg-primary">
                        <span>{group.label}</span>
                        <span className="flex items-center gap-1"><span className={panelTheme.muted}>{group.nodes.length}</span>{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>
                      </button>
                      {isExpanded && (
                        <ul className="space-y-1 px-2 pb-2">
                          {group.nodes.map((node) => (
                            <li key={`${node.id}-${node.relationId ?? node.canonicalType ?? node.relation}`}>
                              <button type="button" onClick={() => onNodeClick?.(node.id)} className="group w-full rounded-md bg-platform-canvas-muted p-2 text-left text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary">
                                <span className="flex items-center gap-2">
                                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${node.category === 'prerequisite' ? 'border-platform-evidence-context/40 bg-platform-evidence-context/10 text-platform-evidence-context' : node.category === 'follows' ? 'border-platform-evidence-eligible/40 bg-platform-evidence-eligible/10 text-platform-evidence-eligible' : 'border-platform-action-primary/40 bg-platform-action-subtle text-platform-action-primary'}`}>{getRelationLabel(node.canonicalType ?? node.relation)}</span>
                                  <span className="flex-1 truncate text-sm text-platform-fg-secondary group-hover:text-platform-fg-primary">{node.name}</span>
                                  {typeof node.strength === 'number' && <span className={`shrink-0 text-[10px] ${panelTheme.muted}`}>{node.strength.toFixed(1)}</span>}
                                  <ArrowRight className={`h-3 w-3 shrink-0 ${panelTheme.muted}`} />
                                </span>
                                {node.inspectionSentence && (
                                  <span className={`mt-1 block text-xs ${panelTheme.text}`}>{node.inspectionSentence}</span>
                                )}
                                {node.cycleState === 'cyclic' && (
                                  <span className="mt-1 block text-xs font-medium text-platform-evidence-context">
                                    概念相互依赖，建议结合学习
                                  </span>
                                )}
                                {node.evidenceState && (
                                  <span className={`mt-1 block text-[11px] ${panelTheme.muted}`}>
                                    {formatRelationEvidence(node) ?? '关系依据未提供'}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!isVirtualChapter && (
            <section
              className="rounded-lg border border-platform-border bg-platform-surface p-3"
              data-resource-node-launch-contract="launch-return-evidence"
              data-knowledge-inspector-section="learning-actions"
            >
              <div className="mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-platform-action-primary" />
                <h3 className="text-sm font-medium text-platform-fg-primary">学习路径动作</h3>
              </div>
              <div className="grid gap-2">
                {launchAction.href ? (
                  <a
                    href={launchAction.href}
                    className="inline-flex items-center justify-between rounded-md border border-platform-border bg-platform-action-subtle px-3 py-2 text-xs font-medium text-platform-fg-primary transition-colors hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                    data-resource-node-action="launch"
                  >
                    {launchAction.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <div
                    className="rounded-md border border-platform-border bg-platform-action-subtle px-3 py-2 text-xs text-platform-fg-secondary"
                    data-resource-node-action="launch"
                    aria-disabled="true"
                  >
                    {launchAction.reason}
                  </div>
                )}
                <a
                  href={returnHref}
                  className="inline-flex items-center justify-between rounded-md border border-platform-border px-3 py-2 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                  data-resource-node-action="return-to-learning-path"
                >
                  返回当前知识路径
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href={evidenceHref}
                  className="inline-flex items-center justify-between rounded-md border border-platform-border px-3 py-2 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                  data-resource-node-action="review-evidence"
                >
                  {launchAction.lessonId ? '查看关联课次证据' : '进入证据浏览器'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                {canAddToCourseFlow ? (
                  <a
                    href={addToPlaylistHref}
                    className="inline-flex items-center justify-between rounded-md border border-platform-border px-3 py-2 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                    data-resource-node-action="add-to-course-flow"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ListPlus className="h-3.5 w-3.5" />
                      加入课程流
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <a
                  href={learningTaskHref}
                  className="inline-flex items-center justify-between rounded-md border border-platform-border px-3 py-2 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                  data-resource-node-action="create-learning-task"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    创建学习任务
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </section>
          )}
        </div>
      )}

      <KnowledgeCardDialog open={isCardOpen} onOpenChange={setIsCardOpen} node={displayNode} />
    </aside>
    {mobilePortalActive && typeof document !== 'undefined'
      ? createPortal(inspectorCloseButton, document.body)
      : null}
    </>
  );
}
