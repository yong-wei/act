'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BookOpen, FileText, X, ArrowRight, Link2, ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';
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

interface RelatedNode {
  id: string;
  name: string;
  nodeType: string;
  relation: string;
  category: 'prerequisite' | 'follows' | 'related';
  strength?: number;
}

interface KnowledgeNodeDetail extends KnowledgeNodeData {
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
  relatedNodes?: RelatedNode[];
}

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
}

const RELATION_GROUP_ORDER: Array<RelatedNode['category']> = ['prerequisite', 'follows', 'related'];
const RELATION_GROUP_LABEL: Record<RelatedNode['category'], string> = {
  prerequisite: '前置关系',
  follows: '后续关系',
  related: '关联关系',
};

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
    && (
      value.startsWith('content/concepts/')
      || value.startsWith('course-content/runtime/knowledge/cards/')
    );
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
}: ResourcePanelProps) {
  if (!isOpen || !selectedNode) return null;

  return (
    <ResourcePanelContent
      key={selectedNode.id}
      selectedNode={selectedNode}
      onClose={onClose}
      onNodeClick={onNodeClick}
    />
  );
}

function ResourcePanelContent({
  selectedNode,
  onClose,
  onNodeClick,
}: Omit<ResourcePanelProps, 'isOpen' | 'selectedNode'> & { selectedNode: KnowledgeNodeData }) {
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeDetail | null>(() =>
    isChapterNodeId(selectedNode.id) ? selectedNode as KnowledgeNodeDetail : null
  );
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(() => !isChapterNodeId(selectedNode.id));
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [expandedRelationGroups, setExpandedRelationGroups] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (isChapterNodeId(selectedNode.id)) {
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${selectedNode.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setNodeDetail(data);
        }
      } catch (error) {
        console.error('Failed to fetch knowledge node detail:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedNode.id]);

  const displayNode = (nodeDetail || selectedNode) as KnowledgeNodeDetail | null;
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
      path.startsWith('content/concepts/')
      || path.startsWith('course-content/runtime/knowledge/cards/')
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

  const panelTheme = isLightTheme
    ? {
        shell: 'border border-platform-border bg-platform-surface text-platform-fg-primary',
        header: 'border-platform-border bg-platform-surface/95 text-platform-fg-primary',
        muted: 'text-platform-fg-muted',
        block: 'border-platform-border bg-platform-canvas-muted',
        blockTitle: 'text-platform-fg-primary',
        text: 'text-platform-fg-secondary',
      }
    : {
        shell: 'border border-platform-border bg-platform-surface text-platform-fg-primary',
        header: 'border-platform-border bg-platform-surface/95 text-platform-fg-primary',
        muted: 'text-platform-fg-muted',
        block: 'border-platform-border bg-platform-canvas-muted',
        blockTitle: 'text-platform-fg-primary',
        text: 'text-platform-fg-secondary',
      };

  return (
    <aside
      className={`absolute right-2 top-2 z-50 h-[calc(100%-1rem)] w-[min(22rem,calc(100vw-1rem))] transform overflow-y-auto rounded-lg shadow-lg transition-transform duration-300 ${panelTheme.shell} translate-x-0`}
      data-knowledge-local-panel="resource-panel"
    >
      <div className={`sticky top-0 z-10 flex items-center justify-between border-b p-4 ${panelTheme.header}`}>
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-sky-500" />
          <span className="truncate text-sm font-medium">{selectedNode.name}</span>
        </div>
        <button type="button"
          onClick={onClose}
          className={`shrink-0 transition-colors ${isLightTheme ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading && <div className={`p-4 text-center text-sm ${panelTheme.muted}`}>加载中...</div>}

      {!isLoading && (
        <div className="space-y-4 p-4">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-medium text-white">
                {isVirtualChapter ? '章节节点' : typeLabel}
              </span>
              {bloomLabel && !isVirtualChapter && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                  {bloomLabel}
                </span>
              )}
              {knowledgeLabel && !isVirtualChapter && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
                  {knowledgeLabel}
                </span>
              )}
              <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-500/40 bg-slate-700/30 text-slate-300'}`}>
                章节：{chapterName}
              </span>
              {difficulty !== null && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/15 text-amber-300'}`}>
                  难度：{difficulty}
                </span>
              )}
              {importance !== null && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700' : 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300'}`}>
                  重要性：{importance}
                </span>
              )}
            </div>

            <p className={`text-sm leading-relaxed ${panelTheme.text}`}>{displayNode.description}</p>
          </section>

          {infographSrc && (
            <section className={`overflow-hidden rounded-lg border ${panelTheme.block}`}>
              <div className={`flex items-center gap-2 border-b px-3 py-2 text-sm font-medium ${panelTheme.blockTitle} ${isLightTheme ? 'border-slate-200' : 'border-blue-500/20'}`}>
                <ImageIcon className="h-4 w-4 text-sky-500" />
                知识点信息图
              </div>
              <Image
                src={infographSrc}
                alt={infographResource?.title ?? `${displayNode.name} 信息图`}
                width={1600}
                height={900}
                unoptimized
                className="h-auto w-full bg-white object-contain"
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
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      isLightTheme
                        ? 'border-slate-300 bg-white text-slate-700'
                        : 'border-slate-600 bg-slate-800/70 text-slate-200'
                    }`}
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
                    className={`overflow-x-auto rounded-md border px-2 py-1 ${
                      isLightTheme ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-900/40'
                    }`}
                  >
                    <BlockMath
                      math={formula}
                      errorColor={isLightTheme ? '#dc2626' : '#f87171'}
                      renderError={() => <code className={panelTheme.text}>{formula}</code>}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isVirtualChapter && relationGroups.length > 0 && (
            <section className={`rounded-lg border p-3 ${panelTheme.block}`}>
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-sky-500" />
                <h3 className={`text-sm font-medium ${panelTheme.blockTitle}`}>关联知识点</h3>
              </div>
              <div className="space-y-2">
                {relationGroups.map((group) => {
                  const isExpanded =
                    expandedRelationGroups[group.category] ??
                    group.category === RELATION_GROUP_ORDER[0];
                  return (
                    <div
                      key={`relation-group-${group.category}`}
                      className={`rounded-md border ${
                        isLightTheme ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-900/35'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRelationGroups((prev) => ({
                            ...prev,
                            [group.category]: !isExpanded,
                          }))
                        }
                        className={`flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium ${
                          isLightTheme ? 'text-slate-700' : 'text-slate-200'
                        }`}
                      >
                        <span>{group.label}</span>
                        <span className="flex items-center gap-1">
                          <span className={panelTheme.muted}>{group.nodes.length}</span>
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      </button>

                      {isExpanded && (
                        <ul className="space-y-1 px-2 pb-2">
                          {group.nodes.map((node) => (
                            <li key={node.id}>
                              <button type="button"
                                onClick={() => onNodeClick?.(node.id)}
                                className={`group flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors ${
                                  isLightTheme ? 'bg-slate-50 hover:bg-slate-100' : 'bg-slate-800/50 hover:bg-slate-700/50'
                                }`}
                              >
                                <span
                                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${
                                    node.category === 'prerequisite'
                                      ? (isLightTheme ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')
                                      : node.category === 'follows'
                                        ? (isLightTheme ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400')
                                        : (isLightTheme ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-blue-500/30 bg-blue-500/10 text-blue-400')
                                  }`}
                                >
                                  {getRelationLabel(node.relation)}
                                </span>
                                <span className={`flex-1 truncate text-sm ${isLightTheme ? 'text-slate-700 group-hover:text-slate-900' : 'text-slate-200 group-hover:text-white'}`}>
                                  {node.name}
                                </span>
                                {typeof node.strength === 'number' && (
                                  <span className={`shrink-0 text-[10px] ${panelTheme.muted}`}>{node.strength.toFixed(1)}</span>
                                )}
                                <ArrowRight className={`h-3 w-3 shrink-0 ${panelTheme.muted}`} />
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
            <section className={`rounded-lg border p-3 ${panelTheme.block}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-sky-500" />
                  <h3 className={`text-sm font-medium ${panelTheme.blockTitle}`}>知识卡片</h3>
                </div>
                {hasKnowledgeCard ? (
                  <button
                    type="button"
                    onClick={() => setIsCardOpen(true)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                      isLightTheme ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                    }`}
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

          {!isVirtualChapter && (
            <section
              className="rounded-lg border border-platform-border bg-platform-surface p-3"
              data-resource-node-launch-contract="launch-return-evidence"
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
              </div>
            </section>
          )}
        </div>
      )}

      <KnowledgeCardDialog open={isCardOpen} onOpenChange={setIsCardOpen} node={displayNode} />
    </aside>
  );
}
