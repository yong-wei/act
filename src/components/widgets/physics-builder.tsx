
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';

interface PhysicsBuilderProps {
  mode: 'mechanical' | 'electrical';
  initialItems?: string[];
}

export default function PhysicsBuilder({ mode, initialItems = [] }: PhysicsBuilderProps) {
  const [equation, setEquation] = useState('');

  return (
    <Card className="p-6 bg-slate-900 border-slate-700 min-h-[400px] flex flex-col">
      <h2 className="text-xl font-bold text-white mb-4">
        {mode === 'mechanical' ? '🛠 机械建模工坊' : '⚡ 电路建模工坊'}
      </h2>
      
      <div className="flex flex-1 gap-4">
        {/* Sidebar */}
        <div className="w-48 bg-slate-800 rounded-lg p-3 space-y-2">
           <h3 className="text-sm font-medium text-slate-400 mb-2">元件库</h3>
           {initialItems.map(item => (
             <div key={item} className="p-2 bg-slate-700 rounded text-slate-200 text-sm cursor-move hover:bg-slate-600">
               {item}
             </div>
           ))}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-950/50 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center">
            <span className="text-slate-500">拖拽元件到此处构建系统</span>
        </div>
      </div>

      {/* Equation Output */}
      <div className="mt-4 p-4 bg-black rounded font-mono text-green-400 text-center text-lg">
         {equation || '等待构建...'}
      </div>
    </Card>
  );
}
