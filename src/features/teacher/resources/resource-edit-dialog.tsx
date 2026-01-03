'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ResourceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: {
    id: string;
    title: string;
    displayName: string | null;
    description: string | null;
  } | null;
  onSave: (id: string, data: { displayName: string; description: string }) => Promise<void>;
}

export function ResourceEditDialog({
  open,
  onOpenChange,
  resource,
  onSave,
}: ResourceEditDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && resource) {
      setDisplayName(resource.displayName || resource.title);
      setDescription(resource.description || '');
    }
  }, [open, resource]);

  const handleSave = async () => {
    if (!resource) return;
    setIsSaving(true);
    try {
      await onSave(resource.id, { displayName, description });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save resource:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">编辑资源</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
              placeholder="输入显示名称"
            />
            <p className="text-xs text-slate-500">
              原始标题: {resource?.title}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:border-cyan-500 outline-none"
              placeholder="输入资源描述"
            />
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
