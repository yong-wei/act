'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KnowledgeNodeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: {
    id: string;
    name: string;
    description: string;
    metadata: any;
  } | null;
  onSave: (id: string, data: { name: string; description: string; metadata: any }) => Promise<void>;
}

export function KnowledgeNodeEditDialog({
  open,
  onOpenChange,
  node,
  onSave,
}: KnowledgeNodeEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && node) {
      setName(node.name);
      setDescription(node.description || '');
      setContent(node.metadata?.content || '');
    }
  }, [open, node]);

  const handleSave = async () => {
    if (!node) return;
    setIsSaving(true);
    try {
      const updatedMetadata = {
        ...node.metadata,
        content,
      };
      await onSave(node.id, { name, description, metadata: updatedMetadata });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save node:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">编辑知识节点</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
              placeholder="输入知识点名称"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:border-cyan-500 outline-none"
              placeholder="输入知识点描述"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">简介内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-32 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:border-cyan-500 outline-none"
              placeholder="输入知识点简介内容（支持 Markdown）"
            />
            <p className="text-xs text-slate-500">支持 Markdown 格式</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="px-4 py-2 text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
