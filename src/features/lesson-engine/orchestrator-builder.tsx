
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, Code, FileText, Video, Save, Trash2, Layout, Search, GripVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeachingResource, ResourceType } from '@prisma/client';

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
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  duration: number;
}

interface OrchestratorBuilderProps {
  initialData?: {
    id: string;
    title: string;
    items: any[];
  };
}

export function OrchestratorBuilder({ initialData }: OrchestratorBuilderProps) {
  const router = useRouter();
  const [resources, setResources] = useState<TeachingResource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [planState, setPlanState] = useState<Record<StageId, LessonItemDraft[]>>({
    BRIDGE_IN: [],
    OBJECTIVE: [],
    PRE_ASSESSMENT: [],
    PARTICIPATORY: [],
    POST_ASSESSMENT: [],
    SUMMARY: []
  });
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize state from initialData
  useEffect(() => {
      if (initialData?.items) {
          const newState = {
            BRIDGE_IN: [],
            OBJECTIVE: [],
            PRE_ASSESSMENT: [],
            PARTICIPATORY: [],
            POST_ASSESSMENT: [],
            SUMMARY: []
          } as any;

          // Group items by stage
          initialData.items.forEach(item => {
              if (item.stage) {
                  if (!newState[item.stage]) newState[item.stage] = [];
                  newState[item.stage].push({
                      tempId: item.id, // Use real ID
                      resourceId: item.resourceId,
                      resourceTitle: item.resource?.title || 'Unknown Resource',
                      resourceType: item.resource?.type || 'UNKNOWN',
                      duration: item.duration || 10
                  });
              }
          });
          setPlanState(newState);
      }
  }, [initialData]);

  // Fetch Resources
  useEffect(() => {
    const fetchResources = async () => {
       const res = await fetch('/api/resources');
       if (res.ok) {
           setResources(await res.json());
       }
    };
    fetchResources();
  }, []);

  const handleDragStart = (e: React.DragEvent, resource: TeachingResource) => {
      e.dataTransfer.setData('application/json', JSON.stringify(resource));
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

      const resource = JSON.parse(data) as TeachingResource;
      const newItem: LessonItemDraft = {
          tempId: Math.random().toString(36),
          resourceId: resource.id,
          resourceTitle: resource.title,
          resourceType: resource.type,
          duration: 10 // default
      };

      setPlanState(prev => ({
          ...prev,
          [stage]: [...prev[stage], newItem]
      }));
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

  const savePlan = async () => {
      if (!title) return alert('请输入教案标题');
      setIsSaving(true);
      
      const itemsToSave: { resourceId: string; stage: string; order: number; duration: number }[] = [];
      for (const stage of Object.keys(planState)) {
          const items = planState[stage as StageId];
          items.forEach((item, idx) => {
              itemsToSave.push({
                  resourceId: item.resourceId,
                  stage: stage,
                  order: idx + 1,
                  duration: item.duration
              });
          });
      }

      try {
        const url = initialData ? `/api/lesson-plans/${initialData.id}` : '/api/lesson-plans';
        const method = initialData ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                items: itemsToSave
            })
        });

        if (res.ok) {
            router.push('/admin/lesson-plans');
            router.refresh();
        } else {
            alert('保存失败');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
  };

  // Group resources by category
  const filteredResources = resources.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resourceGroups = {
      'Static': filteredResources.filter(r => ['STATIC_TEXT', 'STATIC_MEDIA'].includes(r.type)),
      'Interactive': filteredResources.filter(r => ['INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO'].includes(r.type))
  };

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
                <h2 className="font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                    资源库
                </h2>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="搜索资源..."
                        className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-2 text-sm focus:border-cyan-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {Object.entries(resourceGroups).map(([groupName, groupItems]) => (
                    <div key={groupName}>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{groupName}</h3>
                        <div className="space-y-2">
                            {groupItems.map(res => (
                                <div 
                                    key={res.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, res)}
                                    className="p-3 rounded border border-slate-700 bg-slate-800 hover:border-cyan-500 cursor-grab active:cursor-grabbing transition-colors group flex items-center gap-3 shadow-sm"
                                >
                                    {renderResourceIcon(res.type)}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{res.title}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{res.type}</div>
                                    </div>
                                    <GripVertical className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
             <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 z-10">
                <div className="flex items-center gap-4 flex-1">
                    <Layout className="h-5 w-5 text-cyan-400" />
                    <input 
                        type="text" 
                        placeholder="输入教案标题..." 
                        className="bg-transparent border-none focus:outline-none text-lg font-bold w-full text-white placeholder:text-slate-600"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                </div>
                <button 
                    onClick={savePlan}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
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
                                {planState[stage.id].map((item, idx) => (
                                    <div key={item.tempId} className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-lg flex gap-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex flex-col items-center gap-2 pt-1">
                                            <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-xs font-mono text-slate-500 border border-slate-700">
                                                {idx + 1}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between">
                                                <h4 className="font-medium text-slate-200">{item.resourceTitle}</h4>
                                                <button onClick={() => removeFromStage(stage.id, idx)} className="text-slate-500 hover:text-red-400">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">{item.resourceType}</span>
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
                                                                updateItemDuration(stage.id, idx, value);
                                                            }
                                                        }}
                                                    />
                                                    <span>min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
    </div>
  );
}

