import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const Personal = () => {
  const radarChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (radarChartRef.current) {
      const ctx = radarChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['建模精度', '算法优化', '鲁棒性设计', '安全优先级', '生态评估', '责任追溯'],
            datasets: [
              {
                label: '技术能力',
                data: [85, 90, 78, 65, 70, 75],
                fill: true,
                backgroundColor: 'rgba(39, 174, 96, 0.2)',
                borderColor: 'rgba(39, 174, 96, 1)',
                pointBackgroundColor: 'rgba(39, 174, 96, 1)',
              },
              {
                label: '伦理决策',
                data: [70, 75, 80, 90, 85, 80],
                fill: true,
                backgroundColor: 'rgba(41, 128, 185, 0.2)',
                borderColor: 'rgba(41, 128, 185, 1)',
                pointBackgroundColor: 'rgba(41, 128, 185, 1)',
              },
            ],
          },
          options: {
            scales: {
              r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { color: 'rgba(255, 255, 255, 0.7)' },
                ticks: {
                  backdropColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.5)',
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
            },
          },
        });
      }
    }
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#0a2a43] to-[#1e3c52] text-white min-h-screen p-5">
      <div className="grid grid-cols-[20%_60%_20%] grid-rows-[auto_1fr_auto] gap-5 h-full">
        {/* Dashboard */}
        <div className="grid-area-dashboard bg-black/20 rounded-lg p-4 flex justify-between items-center">
          {/* Identity Badge and Data Panel */}
        </div>

        {/* Compass */}
        <div className="grid-area-compass bg-black/20 rounded-lg p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Compass sections */}
        </div>

        {/* Main Content */}
        <div className="grid-area-main flex flex-col gap-5 overflow-y-auto">
          <div className="bg-black/20 rounded-lg p-5 h-1/2">
            <h3 className="text-lg font-bold mb-4">能力进化图谱</h3>
            <div className="w-full h-full">
              <canvas ref={radarChartRef}></canvas>
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-5 h-1/2">
            <h3 className="text-lg font-bold mb-4">任务工卡矩阵</h3>
            {/* Task grid */}
          </div>
        </div>

        {/* Tools */}
        <div className="grid-area-tools flex flex-col gap-5">
          <div className="bg-black/20 rounded-lg p-4 flex-1">
            <h3 className="text-lg font-bold mb-4">虚实实验档案库</h3>
            {/* Archive content */}
          </div>
          <div className="bg-black/20 rounded-lg p-4 h-2/5">
            <h3 className="text-lg font-bold mb-4">船长工作室</h3>
            {/* Studio tools */}
          </div>
        </div>

        {/* Journal */}
        <div className="grid-area-journal bg-black/20 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-4">思政航海日志</h3>
          {/* Journal carousel */}
        </div>
      </div>
    </div>
  );
};

export default Personal;
