'use client';

import React, { useState } from 'react';
import { Search, BookOpen, Boxes, Presentation } from 'lucide-react';
import { InteractiveResourceList } from './resources/interactive-resource-list';
import { ClassroomComponentList } from './resources/classroom-component-list';
import { KnowledgeNodeManager } from './resources/knowledge-node-manager';

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

interface KnowledgeNodeLink {
  relation: string;
  targetNode?: { id: string; name: string; nodeType: string };
  sourceNode?: { id: string; name: string; nodeType: string };
}

interface KnowledgeNode {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  metadata: any;
  sourceLinks: KnowledgeNodeLink[];
  targetLinks: KnowledgeNodeLink[];
}

interface TeacherResourceManagerProps {
  resources: Resource[];
  knowledgeNodes: KnowledgeNode[];
}

type TabType = 'interactive' | 'classroom' | 'knowledge';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'interactive', label: '互动组件', icon: Boxes },
  { id: 'classroom', label: '课堂组件', icon: Presentation },
  { id: 'knowledge', label: '知识图谱', icon: BookOpen },
];

export function TeacherResourceManager({
  resources,
  knowledgeNodes,
}: TeacherResourceManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('interactive');
  const [searchQuery, setSearchQuery] = useState('');

  // 分离互动组件和课堂组件
  const interactiveResources = resources.filter(
    (r) => r.category !== 'CLASSROOM' && !['STATIC_TEXT', 'STATIC_MEDIA'].includes(r.type)
  );
  const classroomResources = resources.filter(
    (r) => r.category === 'CLASSROOM' || ['STATIC_TEXT', 'STATIC_MEDIA'].includes(r.type)
  );

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">教学资源管理</h1>
        <p className="mt-2 text-slate-400">管理互动组件、课堂组件和知识卡片</p>
      </div>

      {/* 搜索栏 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索资源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
        {activeTab === 'interactive' && (
          <InteractiveResourceList
            resources={interactiveResources}
            searchQuery={searchQuery}
          />
        )}
        {activeTab === 'classroom' && (
          <ClassroomComponentList
            resources={classroomResources}
            searchQuery={searchQuery}
          />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeNodeManager
            nodes={knowledgeNodes}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </main>
  );
}
