'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface LessonItemOverrideConfig {
  titleOverride?: string;
  descriptionOverride?: string;
}

interface LessonItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalTitle: string;
  originalDescription?: string;
  currentOverride?: LessonItemOverrideConfig;
  onSave: (config: LessonItemOverrideConfig) => void;
}

export function LessonItemEditDialog({
  open,
  onOpenChange,
  originalTitle,
  originalDescription,
  currentOverride,
  onSave,
}: LessonItemEditDialogProps) {
  const [titleOverride, setTitleOverride] = useState(currentOverride?.titleOverride || '');
  const [descriptionOverride, setDescriptionOverride] = useState(currentOverride?.descriptionOverride || '');

  useEffect(() => {
    if (open) {
      setTitleOverride(currentOverride?.titleOverride || '');
      setDescriptionOverride(currentOverride?.descriptionOverride || '');
    }
  }, [open, currentOverride]);

  const handleSave = () => {
    onSave({
      titleOverride: titleOverride || undefined,
      descriptionOverride: descriptionOverride || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">编辑课堂组件</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">标题覆盖</label>
            <input
              type="text"
              placeholder={originalTitle}
              value={titleOverride}
              onChange={(e) => setTitleOverride(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
            />
            <p className="text-xs text-slate-500">留空使用原标题: {originalTitle}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">描述覆盖</label>
            <textarea
              placeholder={originalDescription || '无描述'}
              value={descriptionOverride}
              onChange={(e) => setDescriptionOverride(e.target.value)}
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:border-cyan-500 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-slate-400 hover:text-white transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition"
          >
            保存
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
