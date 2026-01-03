'use client';

import React from 'react';
import { Presentation, Info } from 'lucide-react';

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

interface ClassroomComponentListProps {
  resources: Resource[];
  searchQuery: string;
}

export function ClassroomComponentList({
  resources,
  searchQuery,
}: ClassroomComponentListProps) {
  // 过滤资源
  const filteredResources = resources.filter((r) => {
    const displayText = r.displayName || r.title;
    const matchesSearch =
      displayText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 提示横幅 */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <Info className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-200">
          课堂组件的编辑功能正在开发中。目前仅支持查看组件列表。
        </p>
      </div>

      {/* 组件列表 */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredResources.map((resource) => (
          <div
            key={resource.id}
            className="rounded-lg border border-slate-700 bg-purple-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Presentation className="h-5 w-5 text-purple-400" />
              </div>
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
                  <span className="px-2 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
                    {resource.type}
                  </span>
                  {resource.teacherOnly && (
                    <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                      教师专用
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredResources.length === 0 && (
        <div className="py-12 text-center text-slate-500">
          <Presentation className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-2">没有找到匹配的课堂组件</p>
        </div>
      )}
    </div>
  );
}
