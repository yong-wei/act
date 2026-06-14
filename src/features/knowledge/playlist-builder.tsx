
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Search, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { KnowledgeNodeData } from './knowledge-graph-system';

interface PlaylistBuilderProps {
  initialData?: any; // For editing existing playlists
}

export function PlaylistBuilder({ initialData }: PlaylistBuilderProps) {
  const router = useRouter();
  const [nodes, setNodes] = useState<KnowledgeNodeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [playlistItems, setPlaylistItems] = useState<any[]>(initialData?.items || []);
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available nodes
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch('/api/knowledge/nodes');
        const data = await res.json();
        setNodes(data);
      } catch (e) {
        console.error('Failed to fetch nodes', e);
      }
    };
    fetchNodes();
  }, []);

  const filteredNodes = nodes.filter(n =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addItem = (node: KnowledgeNodeData) => {
    setPlaylistItems([...playlistItems, {
      nodeId: node.id,
      nodeName: node.name, // Temp for UI
      nodeType: node.nodeType,
      duration: 15, // Default 15 mins
      interactionMode: 'lecture'
    }]);
  };

  const removeItem = (index: number) => {
    const newItems = [...playlistItems];
    newItems.splice(index, 1);
    setPlaylistItems(newItems);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === playlistItems.length - 1) return;

    const newItems = [...playlistItems];
    const temp = newItems[index];
    newItems[index] = newItems[index + (direction === 'up' ? -1 : 1)];
    newItems[index + (direction === 'up' ? -1 : 1)] = temp;
    setPlaylistItems(newItems);
  };

  const handleSave = async () => {
    if (!title) return alert('请输入标题');
    setIsSaving(true);

    try {
      const res = await fetch('/api/knowledge/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          isPublic: true,
          items: playlistItems
        })
      });

      if (res.ok) {
        router.push('/playlists');
        router.refresh();
      } else {
        alert('保存失败');
      }
    } catch (e) {
      console.error(e);
      alert('保存出错');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
      {/* Left: Library */}
      <Card className="bg-[#0F172A] border-slate-700 flex flex-col h-full">
        <CardHeader>
          <CardTitle className="text-white">知识库</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input aria-label="搜索知识点..."
              type="text"
              placeholder="搜索知识点..."
              className="w-full bg-slate-900 border border-slate-700 rounded-md pl-8 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
          {filteredNodes.map(node => (
            <div key={node.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors">
              <div>
                <div className="font-medium text-slate-200">{node.name}</div>
                <div className="text-xs text-slate-400 truncate max-w-[200px]">{node.description}</div>
              </div>
              <button type="button"
                onClick={() => addItem(node)}
                className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Right: Playlist Timeline */}
      <Card className="bg-[#0F172A] border-slate-700 flex flex-col h-full">
        <CardHeader>
          <CardTitle className="text-white">课程编排</CardTitle>
          <div className="space-y-3">
             <input aria-label="课程标题"
              type="text"
              placeholder="课程标题"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-white font-bold focus:outline-none focus:border-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea aria-label="课程描述"
              placeholder="课程描述"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 resize-none h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
            {playlistItems.length === 0 && (
                <div className="text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-lg">
                    从左侧添加知识点开始编排
                </div>
            )}
            {playlistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <div className="text-slate-500 cursor-move">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="h-6 w-6 rounded-full bg-blue-900/50 flex items-center justify-center text-xs text-blue-400 font-bold border border-blue-500/30">
                        {idx + 1}
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-slate-200">{item.nodeName}</div>
                        <div className="flex gap-2 mt-1">
                            <select
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1"
                                value={item.interactionMode}
                                onChange={(e) => {
                                    const newItems = [...playlistItems];
                                    newItems[idx].interactionMode = e.target.value;
                                    setPlaylistItems(newItems);
                                }}
                            >
                                <option value="lecture">讲授</option>
                                <option value="quiz">测验</option>
                                <option value="discussion">讨论</option>
                            </select>
                            <input aria-label="选择知识节点"
                                type="number"
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded w-16 px-1 text-center"
                                value={item.duration}
                                onChange={(e) => {
                                    const newItems = [...playlistItems];
                                    newItems[idx].duration = parseInt(e.target.value) || 0;
                                    setPlaylistItems(newItems);
                                }}
                            />
                            <span className="text-xs text-slate-500 self-center">分钟</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <button type="button" onClick={() => moveItem(idx, 'up')} className="text-slate-400 hover:text-white disabled:opacity-30" disabled={idx === 0}>
                            <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => moveItem(idx, 'down')} className="text-slate-400 hover:text-white disabled:opacity-30" disabled={idx === playlistItems.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                        </button>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 ml-2">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </CardContent>
        <div className="p-4 border-t border-slate-700">
            <button type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            >
                <Save className="h-4 w-4" />
                {isSaving ? '保存中...' : '保存课程流'}
            </button>
        </div>
      </Card>
    </div>
  );
}
