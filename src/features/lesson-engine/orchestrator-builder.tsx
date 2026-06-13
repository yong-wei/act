
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BookOpen, Code, FileText, Video, Save, Trash2, Layout, Search, GripVertical, Eye,
  Boxes, Activity, GitBranch, Radio, Sliders, Shuffle, Sparkles, Presentation, Filter, Pencil, type LucideIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TeachingResource, LessonItemType, InteractiveCategory } from '@prisma/client';

// 组件分类配置
const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  SYSTEM_MODELING: { label: '系统建模', icon: Boxes, color: 'text-blue-400' },
  TIME_DOMAIN: { label: '时域分析', icon: Activity, color: 'text-emerald-400' },
  ROOT_LOCUS: { label: '根轨迹分析', icon: GitBranch, color: 'text-violet-400' },
  FREQUENCY_DOMAIN: { label: '频域分析', icon: Radio, color: 'text-cyan-400' },
  SYSTEM_CORRECTION: { label: '系统校正', icon: Sliders, color: 'text-amber-400' },
  NONLINEAR: { label: '非线性', icon: Shuffle, color: 'text-rose-400' },
  FUN_EXPLORATION: { label: '趣味探索', icon: Sparkles, color: 'text-fuchsia-400' },
  CLASSROOM: { label: '课堂组件', icon: Presentation, color: 'text-purple-400' },
};

// 扩展 TeachingResource 类型以包含新字段
type ExtendedTeachingResource = TeachingResource & {
  displayName: string | null;
  category: InteractiveCategory | null;
  displayOrder: number;
  teacherOnly: boolean;
};
import { KnowledgeCardDialog } from '@/features/knowledge/knowledge-card';
import type { KnowledgeNodeData } from '@/features/knowledge/knowledge-graph-system';
import { ResourceRenderer } from './resource-renderer';
import { LessonItemEditDialog, LessonItemOverrideConfig } from './lesson-item-edit-dialog';

// @dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// BOPPPS Stages Definition
const BOPPPS_STAGES = [
  { id: 'BRIDGE_IN', label: 'B - 导入 (Bridge-in)', color: 'border-blue-500' },
  { id: 'OBJECTIVE', label: 'O - 目标 (Objective)', color: 'border-green-500' },
  { id: 'PRE_ASSESSMENT', label: 'P - 前测 (Pre-assessment)', color: 'border-yellow-500' },
  { id: 'PARTICIPATORY', label: 'P - 参与式学习 (Participatory)', color: 'border-purple-500' },
  { id: 'POST_ASSESSMENT', label: 'P - 后测 (Post-assessment)', color: 'border-orange-500' },
  { id: 'SUMMARY', label: 'S - 总结 (Summary)', color: 'border-slate-500' },
] as const;

type StageId = typeof BOPPPS_STAGES[number]['id'];

interface LessonItemDraft {
  tempId: string;
  resourceTitle: string;
  itemType: LessonItemType;
  resourceId?: string | null;
  resourceType?: string | null;
  knowledgeNodeId?: string | null;
  knowledgeNodeType?: string | null;
  duration: number;
  overrideConfig?: LessonItemOverrideConfig;
}

interface DragPayload {
  itemType: LessonItemType;
  resource?: TeachingResource;
  knowledgeNode?: KnowledgeNodeData;
}

interface OrchestratorBuilderProps {
  initialData?: {
    id: string;
    title: string;
    items: any[];
  };
  returnPath?: string; // 保存后跳转路径，默认根据当前路径判断
  workbenchReturnUrl?: string;
  workbenchReturnLabel?: string;
}

function createEmptyPlanState(): Record<StageId, LessonItemDraft[]> {
  return {
    BRIDGE_IN: [],
    OBJECTIVE: [],
    PRE_ASSESSMENT: [],
    PARTICIPATORY: [],
    POST_ASSESSMENT: [],
    SUMMARY: [],
  };
}

function createPlanStateFromInitialData(
  initialData: OrchestratorBuilderProps['initialData'],
): Record<StageId, LessonItemDraft[]> {
  const nextState = createEmptyPlanState();
  if (!initialData?.items) return nextState;

  initialData.items.forEach((item) => {
    if (!item.stage) return;

    const stage = item.stage as StageId;
    if (!nextState[stage]) return;

    const inferredType = item.knowledgeNodeId ? LessonItemType.KNOWLEDGE_NODE : LessonItemType.RESOURCE;
    const itemType = (item.itemType as LessonItemType | undefined) ?? inferredType;
    const resourceTitle = itemType === LessonItemType.KNOWLEDGE_NODE
      ? item.knowledgeNode?.name || 'Unknown Knowledge'
      : item.resource?.title || 'Unknown Resource';

    nextState[stage].push({
      tempId: item.id,
      itemType,
      resourceId: itemType === LessonItemType.RESOURCE ? item.resourceId : null,
      resourceTitle,
      resourceType: itemType === LessonItemType.RESOURCE ? item.resource?.type || 'UNKNOWN' : null,
      knowledgeNodeId: itemType === LessonItemType.KNOWLEDGE_NODE ? item.knowledgeNodeId : null,
      knowledgeNodeType: itemType === LessonItemType.KNOWLEDGE_NODE
        ? item.knowledgeNode?.nodeType || 'UNKNOWN'
        : null,
      duration: item.duration || 10,
      overrideConfig: item.overrideConfig || {},
    });
  });

  return nextState;
}

// SortableItem component for drag-and-drop reordering
interface SortableItemProps {
  item: LessonItemDraft;
  idx: number;
  onRemove: () => void;
  onDurationChange: (d: number) => void;
  onEdit: () => void;
}

function SortableItem({ item, idx, onRemove, onDurationChange, onEdit }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.tempId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-lg flex gap-4 animate-in slide-in-from-top-2 duration-300"
    >
      <div className="flex flex-col items-center gap-2 pt-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-700 rounded"
        >
          <GripVertical className="h-4 w-4 text-slate-500" />
        </div>
        <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-xs font-mono text-slate-500 border border-slate-700">
          {idx + 1}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-slate-200">
              {item.overrideConfig?.titleOverride || item.resourceTitle}
            </h4>
            {item.overrideConfig?.titleOverride && (
              <span className="text-[10px] text-cyan-400">已自定义标题</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="text-slate-500 hover:text-cyan-400" title="编辑">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onRemove} className="text-slate-500 hover:text-red-400" title="删除">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
            {item.itemType === LessonItemType.KNOWLEDGE_NODE
              ? item.knowledgeNodeType || 'KNOWLEDGE'
              : item.resourceType || 'RESOURCE'}
          </span>
          <div className="flex items-center gap-1">
            <span>时长:</span>
            <input
              type="number"
              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center focus:border-cyan-500 outline-none"
              value={item.duration}
              min={1}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value > 0) {
                  onDurationChange(value);
                }
              }}
            />
            <span>min</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrchestratorBuilder({
  initialData,
  returnPath,
  workbenchReturnUrl,
  workbenchReturnLabel,
}: OrchestratorBuilderProps) {
  return (
    <OrchestratorBuilderContent
      key={initialData?.id ?? 'new'}
      initialData={initialData}
      returnPath={returnPath}
      workbenchReturnUrl={workbenchReturnUrl}
      workbenchReturnLabel={workbenchReturnLabel}
    />
  );
}

function OrchestratorBuilderContent({
  initialData,
  returnPath,
  workbenchReturnUrl,
  workbenchReturnLabel,
}: OrchestratorBuilderProps) {
  const router = useRouter();
  const [resources, setResources] = useState<ExtendedTeachingResource[]>([]);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNodeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [planState, setPlanState] = useState<Record<StageId, LessonItemDraft[]>>(
    () => createPlanStateFromInitialData(initialData),
  );
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [isSaving, setIsSaving] = useState(false);

  // Preview state
  const [previewResource, setPreviewResource] = useState<TeachingResource | null>(null);
  const [previewKnowledge, setPreviewKnowledge] = useState<KnowledgeNodeData | null>(null);

  // Edit dialog state
  const [editingItem, setEditingItem] = useState<{ stage: StageId; index: number; item: LessonItemDraft } | null>(null);

  // DnD Kit sensors for sortable
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering items within a stage
  const handleSortEnd = useCallback((event: DragEndEvent, stage: StageId) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlanState(prev => {
        const items = prev[stage];
        const oldIndex = items.findIndex(i => i.tempId === active.id);
        const newIndex = items.findIndex(i => i.tempId === over.id);
        return { ...prev, [stage]: arrayMove(items, oldIndex, newIndex) };
      });
    }
  }, []);

  // Fetch Resources (include teacher-only for orchestrator)
  useEffect(() => {
    const controller = new AbortController();
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/resources?includeTeacherOnly=true', { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) {
            setResources(data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to fetch lesson resources:', error);
        }
      }
    };
    fetchResources();
    return () => controller.abort();
  }, []);

  // Fetch Knowledge Nodes
  useEffect(() => {
    const controller = new AbortController();
    const fetchKnowledgeNodes = async () => {
      try {
        const res = await fetch('/api/knowledge/nodes', { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) {
            setKnowledgeNodes(data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to fetch knowledge nodes:', error);
        }
      }
    };
    fetchKnowledgeNodes();
    return () => controller.abort();
  }, []);

  const handleResourceDragStart = (e: React.DragEvent, resource: TeachingResource) => {
      const payload: DragPayload = { itemType: LessonItemType.RESOURCE, resource };
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
  };

  const handleKnowledgeDragStart = (e: React.DragEvent, knowledgeNode: KnowledgeNodeData) => {
      const payload: DragPayload = { itemType: LessonItemType.KNOWLEDGE_NODE, knowledgeNode };
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, stage: StageId) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      const payload = JSON.parse(data) as DragPayload;
      if (payload.itemType === LessonItemType.KNOWLEDGE_NODE && payload.knowledgeNode) {
          const newItem: LessonItemDraft = {
              tempId: Math.random().toString(36),
              itemType: LessonItemType.KNOWLEDGE_NODE,
              knowledgeNodeId: payload.knowledgeNode.id,
              knowledgeNodeType: payload.knowledgeNode.nodeType,
              resourceTitle: payload.knowledgeNode.name,
              duration: 10 // default
          };

          setPlanState(prev => ({
              ...prev,
              [stage]: [...prev[stage], newItem]
          }));
          return;
      }

      if (payload.itemType === LessonItemType.RESOURCE && payload.resource) {
          const newItem: LessonItemDraft = {
              tempId: Math.random().toString(36),
              itemType: LessonItemType.RESOURCE,
              resourceId: payload.resource.id,
              resourceTitle: payload.resource.title,
              resourceType: payload.resource.type,
              duration: 10 // default
          };

          setPlanState(prev => ({
              ...prev,
              [stage]: [...prev[stage], newItem]
          }));
      }
  };

  const removeFromStage = (stage: StageId, index: number) => {
      setPlanState(prev => {
          const newItems = [...prev[stage]];
          newItems.splice(index, 1);
          return { ...prev, [stage]: newItems };
      });
  };

  const updateItemDuration = (stage: StageId, index: number, newDuration: number) => {
      setPlanState(prev => {
          const newItems = [...prev[stage]];
          newItems[index] = { ...newItems[index], duration: newDuration };
          return { ...prev, [stage]: newItems };
      });
  };

  const updateItemOverride = (stage: StageId, index: number, overrideConfig: LessonItemOverrideConfig) => {
      setPlanState(prev => {
          const newItems = [...prev[stage]];
          newItems[index] = { ...newItems[index], overrideConfig };
          return { ...prev, [stage]: newItems };
      });
  };

  const savePlan = async () => {
      if (!title) return alert('请输入教案标题');
      setIsSaving(true);
      
      const itemsToSave: {
        itemType: LessonItemType;
        resourceId?: string | null;
        knowledgeNodeId?: string | null;
        stage: string;
        order: number;
        duration: number;
        overrideConfig?: LessonItemOverrideConfig;
      }[] = [];
      for (const stage of Object.keys(planState)) {
          const items = planState[stage as StageId];
          items.forEach((item, idx) => {
              itemsToSave.push({
                  itemType: item.itemType,
                  resourceId: item.itemType === LessonItemType.RESOURCE ? item.resourceId || null : null,
                  knowledgeNodeId: item.itemType === LessonItemType.KNOWLEDGE_NODE ? item.knowledgeNodeId || null : null,
                  stage: stage,
                  order: idx + 1,
                  duration: item.duration,
                  overrideConfig: item.overrideConfig || {}
              });
          });
      }

      try {
        const url = initialData ? `/api/lesson-plans/${initialData.id}` : '/api/lesson-plans';
        const method = initialData ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title,
                items: itemsToSave
            })
        });

        if (res.ok) {
            // 根据 returnPath 或当前路径判断跳转目标
            const redirectPath = returnPath ||
              (window.location.pathname.startsWith('/teacher') ? '/teacher/lesson-plans' : '/admin/lesson-plans');
            router.push(redirectPath);
            router.refresh();
        } else {
            const errorData = await res.json().catch(() => ({}));
            if (res.status === 401) {
                alert('登录已过期，请重新登录');
                window.location.href = '/login';
            } else {
                alert(`保存失败: ${errorData.error || res.statusText}`);
            }
        }
      } catch (e) {
        console.error(e);
        alert('保存失败，请检查网络连接');
      } finally {
        setIsSaving(false);
      }
  };

  // Filter resources by search query and category
  const filteredResources = resources.filter(r => {
    const displayText = r.displayName || r.title;
    const matchesSearch = displayText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredKnowledgeNodes = knowledgeNodes.filter((node) =>
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group resources by category
  const resourcesByCategory: Record<string, ExtendedTeachingResource[]> = {};
  for (const resource of filteredResources) {
    const category = resource.category || 'OTHER';
    if (!resourcesByCategory[category]) {
      resourcesByCategory[category] = [];
    }
    resourcesByCategory[category].push(resource);
  }

  // Sort each category by displayOrder
  for (const category of Object.keys(resourcesByCategory)) {
    resourcesByCategory[category].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  // Category order for display
  const categoryOrder = [
    'SYSTEM_MODELING', 'TIME_DOMAIN', 'ROOT_LOCUS',
    'FREQUENCY_DOMAIN', 'SYSTEM_CORRECTION', 'NONLINEAR', 'CLASSROOM'
  ];

  // Legacy groups for static resources (backward compatibility)
  const staticResources = filteredResources.filter(r => ['STATIC_TEXT', 'STATIC_MEDIA'].includes(r.type));

  const renderResourceIcon = (type: string) => {
      if (['STATIC_TEXT', 'STATIC_MEDIA'].includes(type)) return <FileText className="h-4 w-4 text-blue-400"/>;
      if (type === 'SIMULATION_APP') return <Code className="h-4 w-4 text-purple-400"/>;
      return <Video className="h-4 w-4 text-green-400"/>;
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
        {/* Left: Resource Library */}
        <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
            <div className="p-4 border-b border-slate-800 space-y-3">
                {workbenchReturnUrl && (
                  <Link
                    href={workbenchReturnUrl}
                    className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-cyan-400"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {workbenchReturnLabel ?? '返回教师工作台'}
                  </Link>
                )}
                <h2 className="font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                    资源库
                </h2>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="搜索资源或知识卡片..."
                        className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-2 text-sm focus:border-cyan-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                {/* Category Filter */}
                <div className="flex flex-wrap gap-1">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                            !selectedCategory
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        全部
                    </button>
                    {categoryOrder.map(cat => {
                        const config = CATEGORY_CONFIG[cat];
                        if (!config) return null;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedCategory === cat
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {config.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Static Resources */}
                {staticResources.length > 0 && !selectedCategory && (
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">静态资源</h3>
                        <div className="space-y-2">
                            {staticResources.map(res => (
                                <div
                                    key={res.id}
                                    draggable
                                    onDragStart={(e) => handleResourceDragStart(e, res)}
                                    className="p-3 rounded border border-slate-700 bg-slate-800 hover:border-cyan-500 cursor-grab active:cursor-grabbing transition-colors group flex items-center gap-3 shadow-sm"
                                >
                                    {renderResourceIcon(res.type)}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{res.displayName || res.title}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{res.type}</div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewResource(res);
                                        }}
                                        className="p-1 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="预览资源"
                                    >
                                        <Eye className="h-4 w-4 text-slate-400 hover:text-cyan-400" />
                                    </button>
                                    <GripVertical className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Interactive Resources by Category */}
                {categoryOrder.map(category => {
                    const categoryItems = resourcesByCategory[category];
                    if (!categoryItems || categoryItems.length === 0) return null;
                    // Skip static resources (already shown above)
                    const interactiveItems = categoryItems.filter(r =>
                        !['STATIC_TEXT', 'STATIC_MEDIA'].includes(r.type)
                    );
                    if (interactiveItems.length === 0) return null;

                    const config = CATEGORY_CONFIG[category];
                    const Icon = config?.icon || Boxes;

                    return (
                        <div key={category}>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${config?.color || 'text-slate-500'}`}>
                                <Icon className="h-3.5 w-3.5" />
                                {config?.label || category}
                            </h3>
                            <div className="space-y-2">
                                {interactiveItems.map(res => (
                                    <div
                                        key={res.id}
                                        draggable
                                        onDragStart={(e) => handleResourceDragStart(e, res)}
                                        className="p-3 rounded border border-slate-700 bg-slate-800 hover:border-cyan-500 cursor-grab active:cursor-grabbing transition-colors group flex items-center gap-3 shadow-sm"
                                    >
                                        {renderResourceIcon(res.type)}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{res.displayName || res.title}</div>
                                            {res.teacherOnly && (
                                                <span className="text-[10px] text-purple-400">教师专用</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewResource(res);
                                            }}
                                            className="p-1 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="预览资源"
                                        >
                                            <Eye className="h-4 w-4 text-slate-400 hover:text-cyan-400" />
                                        </button>
                                        <GripVertical className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Knowledge Nodes */}
                {filteredKnowledgeNodes.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            知识卡片
                        </h3>
                        <div className="space-y-2">
                            {filteredKnowledgeNodes.map(node => (
                                <div
                                    key={node.id}
                                    draggable
                                    onDragStart={(e) => handleKnowledgeDragStart(e, node)}
                                    className="p-3 rounded border border-slate-700 bg-slate-800 hover:border-emerald-500 cursor-grab active:cursor-grabbing transition-colors group flex items-center gap-3 shadow-sm"
                                >
                                    <BookOpen className="h-4 w-4 text-emerald-400" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{node.name}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{node.nodeType}</div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewKnowledge(node);
                                        }}
                                        className="p-1 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="预览知识卡片"
                                    >
                                        <Eye className="h-4 w-4 text-slate-400 hover:text-emerald-400" />
                                    </button>
                                    <GripVertical className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
             <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 z-10">
                <div className="flex items-center gap-4 flex-1 max-w-xl">
                    <Layout className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="输入教案标题..."
                        className="bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none text-lg font-bold w-full text-white placeholder:text-slate-500 px-3 py-1.5 rounded"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                </div>
                <button
                    onClick={savePlan}
                    disabled={isSaving}
                    className="ml-4 flex-shrink-0 flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? '保存中...' : '保存教案'}
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
                {/* Waterfall / Vertical Flow Layout */}
                <div className="max-w-4xl mx-auto space-y-6 pb-20">
                    {BOPPPS_STAGES.map(stage => (
                        <div 
                            key={stage.id}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage.id)}
                            className={`rounded-xl border-2 border-dashed transition-all duration-200 ${
                                planState[stage.id].length > 0 
                                ? 'border-slate-700 bg-slate-900/30' 
                                : 'border-slate-800 bg-slate-900/10 hover:border-cyan-500/50 hover:bg-slate-900/20'
                            }`}
                        >
                            <div className={`px-4 py-3 border-b border-slate-800/50 flex items-center justify-between ${stage.color.replace('border-', 'text-')}`}>
                                <h3 className="font-bold flex items-center gap-2">
                                    <div className={`w-2 h-8 rounded-full ${stage.color.replace('border-', 'bg-')}`}></div>
                                    {stage.label}
                                </h3>
                                <span className="text-xs font-mono text-slate-500">{planState[stage.id].length} items</span>
                            </div>
                            
                            <div className="p-4 space-y-3 min-h-[100px]">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(e) => handleSortEnd(e, stage.id)}
                                >
                                    <SortableContext
                                        items={planState[stage.id].map(i => i.tempId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {planState[stage.id].map((item, idx) => (
                                            <SortableItem
                                                key={item.tempId}
                                                item={item}
                                                idx={idx}
                                                onRemove={() => removeFromStage(stage.id, idx)}
                                                onDurationChange={(d) => updateItemDuration(stage.id, idx, d)}
                                                onEdit={() => setEditingItem({ stage: stage.id, index: idx, item })}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                                {planState[stage.id].length === 0 && (
                                    <div className="h-20 flex flex-col items-center justify-center text-slate-600 text-sm">
                                        <p>拖拽资源到此处</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>

        {/* Resource Preview Modal */}
        <Dialog open={!!previewResource} onOpenChange={() => setPreviewResource(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900">
                <DialogHeader>
                    <DialogTitle>{previewResource?.title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto min-h-0">
                    {previewResource && (
                        <ResourceRenderer resource={previewResource} enableAIPanel={false} />
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {/* Knowledge Node Preview Modal */}
        {previewKnowledge && (
            <KnowledgeCardDialog
                open
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewKnowledge(null);
                    }
                }}
                node={previewKnowledge}
            />
        )}

        {/* Lesson Item Edit Dialog */}
        {editingItem && (
            <LessonItemEditDialog
                open={!!editingItem}
                onOpenChange={(open) => {
                    if (!open) setEditingItem(null);
                }}
                originalTitle={editingItem.item.resourceTitle}
                originalDescription={undefined}
                currentOverride={editingItem.item.overrideConfig}
                onSave={(config) => {
                    updateItemOverride(editingItem.stage, editingItem.index, config);
                    setEditingItem(null);
                }}
            />
        )}
    </div>
  );
}
