'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Gauge, Map, Ship, Wrench } from 'lucide-react';

const modules = [
  {
    id: 'argument-principle',
    title: '幅角原理',
    titleEn: 'Argument Principle',
    description: '通过双平面可视化工具，直观理解复变函数的幅角原理。支持多种包围线类型，实时计算绕原点圈数。',
    href: '/interactive-learning/argument-principle',
    icon: Compass,
    color: 'blue',
    features: ['双平面同步映射', '多种包围线类型', '实时绕数计算'],
  },
  {
    id: 'control-map',
    title: '控制地图',
    titleEn: 'Control Theory Map',
    description: '探索控制理论的全景知识图谱。从经典PID到现代最优控制，通过交互式拓扑图建立完整的知识架构。',
    href: '/interactive-learning/control-map',
    icon: Map,
    color: 'amber',
    features: ['交互式拓扑图', '五大知识区域', '公式与应用详解'],
  },
  {
    id: 'pid-simulator',
    title: 'PID 仿真器',
    titleEn: 'PID Simulator',
    description: '针对多类船舶控制对象进行 PID 参数试验，实时观察系统响应与设定值变化。',
    href: '/interactive-learning/pid-simulator',
    icon: Gauge,
    color: 'emerald',
    features: ['多对象控制模型', '响应曲线可视化', 'Kp/Ki/Kd 调参'],
  },
  {
    id: 'physics-modeling',
    title: '物理建模工坊',
    titleEn: 'Physics Modeling Workshop',
    description: '从零搭建弹簧-质量-阻尼模型和RLC电路，通过拖拽元件理解微分方程的物理意义。含机电相似映射和AI批改。',
    href: '/interactive-learning/physics-modeling',
    icon: Wrench,
    color: 'violet',
    features: ['拖拽式建模', '实时方程生成', '机电相似映射', 'AI 方程批改'],
  },
];

const colorClasses = {
  blue: {
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    border: 'border-blue-500/30 hover:border-blue-500/60',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    badge: 'bg-amber-500/20 text-amber-400',
  },
  emerald: {
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-400',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    badge: 'bg-emerald-500/20 text-emerald-400',
  },
  violet: {
    iconBg: 'bg-violet-500/20',
    iconText: 'text-violet-400',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    badge: 'bg-violet-500/20 text-violet-400',
  },
};

export default function InteractiveLearningPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* 顶部导航 */}
      <nav className="border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">AI-OBE船舶智控平台</div>
              <div className="text-xs text-white/50">Mission Control for Maritime Education</div>
            </div>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            进入驾驶舱
          </Link>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-6 py-12">
        {/* 页面标题 */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">互动学习</h1>
          <p className="text-lg text-slate-400">
            通过可视化交互工具，深入理解控制理论核心概念
          </p>
        </div>

        {/* 模块卡片网格 */}
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {modules.map((module) => {
            const colors = colorClasses[module.color as keyof typeof colorClasses];
            const Icon = module.icon;

            return (
              <Link
                key={module.id}
                href={module.href}
                className={`group relative overflow-hidden rounded-2xl border bg-slate-900/60 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${colors.border}`}
              >
                {/* 背景装饰 */}
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-white/5 to-transparent" />

                {/* 图标 */}
                <div className={`mb-6 inline-flex rounded-xl p-4 ${colors.iconBg}`}>
                  <Icon className={`h-8 w-8 ${colors.iconText}`} />
                </div>

                {/* 标题 */}
                <h2 className="mb-2 text-2xl font-semibold text-white">{module.title}</h2>
                <p className="mb-1 text-sm text-slate-500">{module.titleEn}</p>

                {/* 描述 */}
                <p className="mb-6 text-slate-400">{module.description}</p>

                {/* 特性标签 */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {module.features.map((feature) => (
                    <span
                      key={feature}
                      className={`rounded-full px-3 py-1 text-xs ${colors.badge}`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* 进入按钮 */}
                <div className="flex items-center gap-2 text-sm font-medium text-white/80 transition-colors group-hover:text-white">
                  <span>开始探索</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500">
            更多互动模块正在开发中，敬请期待...
          </p>
        </div>
      </main>
    </div>
  );
}
