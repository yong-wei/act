
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { ArrowRightLeft } from 'lucide-react';

interface AnalogyMapperProps {
  leftEq: string;
  rightEq: string;
}

export default function AnalogyMapper({ leftEq, rightEq }: AnalogyMapperProps) {
  return (
    <Card className="p-6 bg-slate-900 border-slate-700 min-h-[400px]">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <ArrowRightLeft className="h-6 w-6 text-purple-400" />
        机电相似性映射台
      </h2>

      <div className="grid grid-cols-2 gap-8 relative">
         {/* Mechanical Side */}
         <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30">
            <h3 className="text-blue-400 font-bold mb-4">机械系统</h3>
            <div className="text-2xl font-mono text-white text-center py-8">{leftEq}</div>
            <div className="space-y-2">
                <div className="bg-blue-800/40 p-2 rounded text-center cursor-move">m (质量)</div>
                <div className="bg-blue-800/40 p-2 rounded text-center cursor-move">f (阻尼)</div>
                <div className="bg-blue-800/40 p-2 rounded text-center cursor-move">k (弹性)</div>
            </div>
         </div>

         {/* Electrical Side */}
         <div className="bg-yellow-900/20 p-6 rounded-xl border border-yellow-500/30">
            <h3 className="text-yellow-400 font-bold mb-4">电路系统</h3>
            <div className="text-2xl font-mono text-white text-center py-8">{rightEq}</div>
            <div className="space-y-2">
                <div className="bg-yellow-800/40 p-2 rounded text-center border-2 border-dashed border-yellow-600/50">L (电感)</div>
                <div className="bg-yellow-800/40 p-2 rounded text-center border-2 border-dashed border-yellow-600/50">R (电阻)</div>
                <div className="bg-yellow-800/40 p-2 rounded text-center border-2 border-dashed border-yellow-600/50">1/C (倒电容)</div>
            </div>
         </div>
         
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500">
             拖拽映射
         </div>
      </div>
    </Card>
  );
}
