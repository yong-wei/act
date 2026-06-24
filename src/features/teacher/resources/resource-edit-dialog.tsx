'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

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
            <label htmlFor="resource-edit-dialog-control-1" className="text-sm font-medium text-slate-300">显示名称</label>
            <input id="resource-edit-dialog-control-1" aria-label="输入显示名称"
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
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              使用影响
            </div>
            保存后会影响引用该资源的教案编排、课堂资源展示和后续证据回放中的资源名称与描述。若资源已经用于正在进行的课堂，请先在教案或 ResourceNode 管理中复核引用关系。
          </div>
          <div className="space-y-2">
            <label htmlFor="resource-edit-dialog-control-2" className="text-sm font-medium text-slate-300">描述</label>
            <textarea id="resource-edit-dialog-control-2" aria-label="输入资源描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:border-cyan-500 outline-none"
              placeholder="输入资源描述"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="px-4 py-2 text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            取消
          </button>
          <button type="button"
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
