'use client';

import React, { useState } from 'react';
import {
  Boxes, Activity, GitBranch, Radio, Sliders, Shuffle, Sparkles, Pencil,
} from 'lucide-react';
import { ResourceEditDialog } from './resource-edit-dialog';
import { useRouter } from 'next/navigation';

interface Resource {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  type: string;
  registryId: string | null;
  category: string | null;
  teacherOnly: boolean;
  displayOrder: number;
}

interface InteractiveResourceListProps {
  resources: Resource[];
  searchQuery: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  SYSTEM_MODELING: { label: '系统建模', icon: Boxes, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  TIME_DOMAIN: { label: '时域分析', icon: Activity, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  ROOT_LOCUS: { label: '根轨迹分析', icon: GitBranch, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
  FREQUENCY_DOMAIN: { label: '频域分析', icon: Radio, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  SYSTEM_CORRECTION: { label: '系统校正', icon: Sliders, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  NONLINEAR: { label: '非线性', icon: Shuffle, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
  FUN_EXPLORATION: { label: '趣味探索', icon: Sparkles, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/10' },
};

export function InteractiveResourceList({
  resources,
  searchQuery,
}: InteractiveResourceListProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // 过滤资源
  const filteredResources = resources.filter((r) => {
    const displayText = r.displayName || r.title;
    const matchesSearch =
      displayText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = !selectedCategory || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 按分类分组
  const resourcesByCategory: Record<string, Resource[]> = {};
  for (const resource of filteredResources) {
    const category = resource.category || 'OTHER';
    if (!resourcesByCategory[category]) {
      resourcesByCategory[category] = [];
    }
    resourcesByCategory[category].push(resource);
  }

  // 分类顺序
  const categoryOrder = Object.keys(CATEGORY_CONFIG);

  const handleSaveResource = async (id: string, data: { displayName: string; description: string }) => {
    const res = await fetch(`/api/resources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error('Failed to update resource');
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            !selectedCategory
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          全部
        </button>
        {categoryOrder.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === cat
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* 资源列表 */}
      {categoryOrder.map((category) => {
        const items = resourcesByCategory[category];
        if (!items || items.length === 0) return null;

        const config = CATEGORY_CONFIG[category];
        const Icon = config?.icon || Boxes;

        return (
          <div key={category} className="space-y-3">
            <h3 className={`flex items-center gap-2 text-sm font-semibold ${config?.color || 'text-slate-400'}`}>
              <Icon className="h-4 w-4" />
              {config?.label || category}
              <span className="text-slate-500 font-normal">({items.length})</span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((resource) => (
                <div
                  key={resource.id}
                  className={`rounded-lg border border-slate-700 p-4 transition-colors hover:border-slate-600 ${config?.bgColor || 'bg-slate-800/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {resource.displayName || resource.title}
                      </h4>
                      {resource.description && (
                        <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {resource.registryId && (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-400 rounded">
                            {resource.registryId}
                          </span>
                        )}
                        {resource.teacherOnly && (
                          <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                            教师专用
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingResource(resource)}
                      className="ml-2 p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-slate-700 rounded transition-colors"
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filteredResources.length === 0 && (
        <div className="py-12 text-center text-slate-500">
          <Boxes className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-2">没有找到匹配的互动组件</p>
        </div>
      )}

      {/* 编辑对话框 */}
      <ResourceEditDialog
        open={!!editingResource}
        onOpenChange={(open) => {
          if (!open) setEditingResource(null);
        }}
        resource={editingResource}
        onSave={handleSaveResource}
      />
    </div>
  );
}
