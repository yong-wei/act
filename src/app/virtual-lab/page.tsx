import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Ship, ArrowLeft, Play, Lock } from 'lucide-react'

const labModels = [
  {
    id: 'destroyer',
    name: '军用驱逐舰',
    focus: '战术机动与高速响应控制',
    modelPath: '/assets/destroyer.glb',
    status: '已开放',
    ctaLabel: '进入仿真',
    ctaHref: '/simulations/destroyer',
  },
  {
    id: 'icebreaker',
    name: '破冰船',
    focus: '极地航行与冰区操纵',
    modelPath: '/assets/icebreaker.glb',
    status: '筹备中',
  },
  {
    id: 'dredger',
    name: '挖泥船',
    focus: '精确定位与多点锚泊作业',
    modelPath: '/assets/dredger.glb',
    status: '筹备中',
  },
  {
    id: 'lng',
    name: 'LNG运输船',
    focus: '低温货物安全与航稳控制',
    modelPath: '/assets/Lng-carrier.glb',
    status: '筹备中',
  },
  {
    id: 'container',
    name: '集装箱船',
    focus: '港口作业与装卸协同控制',
    modelPath: '/assets/container.glb',
    status: '筹备中',
  },
  {
    id: 'luxury-liner',
    name: '豪华游轮',
    focus: '平稳航行与舒适性优化',
    modelPath: '/assets/luxury-liner.glb',
    status: '筹备中',
  },
  {
    id: 'drilling-rig',
    name: '半潜式钻井平台',
    focus: '海上动力定位与姿态保持',
    modelPath: '/assets/drilling-rig.glb',
    status: '筹备中',
  },
]

export default function VirtualLabPage() {
  return (
    <main className="min-h-screen bg-[#0b132b] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(63,94,251,0.15),_transparent_55%)]" />
        <div className="absolute -right-40 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative container mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-white hover:text-amber-alert">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-alert/20 text-amber-alert">
                  <Ship className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-wide">虚实实验室</h1>
                  <p className="text-sm text-slate-300">全量模型库 · 仿真入口 · 任务链状态</p>
                </div>
              </div>
            </div>
            <Button className="bg-amber-alert text-dark-blue hover:bg-yellow-500">
              申请开通新实验
            </Button>
          </div>
        </div>
      </div>

      <section className="container mx-auto px-6 pb-16">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">已上架模型</p>
            <p className="mt-3 text-3xl font-semibold">{labModels.length}</p>
            <p className="mt-2 text-xs text-slate-400">含 1 项可用仿真入口</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">当前开放</p>
            <p className="mt-3 text-3xl font-semibold">1</p>
            <p className="mt-2 text-xs text-slate-400">驱逐舰战术机动任务链</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">筹备中</p>
            <p className="mt-3 text-3xl font-semibold">{labModels.length - 1}</p>
            <p className="mt-2 text-xs text-slate-400">可在主页提交需求</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {labModels.map((model) => {
            const isOpen = model.status === '已开放'
            return (
              <div
                key={model.id}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-[#0f1b3d] p-6 shadow-[0_10px_35px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:border-amber-alert/50"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-amber-alert">{model.status}</div>
                  <div className="text-xs text-slate-400">模型文件：{model.modelPath}</div>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{model.name}</h2>
                <p className="mt-3 text-sm text-slate-300">{model.focus}</p>
                <div className="mt-6 flex items-center justify-between">
                  {isOpen ? (
                    <Button asChild className="bg-amber-alert text-dark-blue hover:bg-yellow-500">
                      <Link href={model.ctaHref ?? '/'} className="flex items-center">
                        <Play className="mr-2 h-4 w-4" />
                        {model.ctaLabel ?? '进入仿真'}
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" className="border-white/30 text-white/70">
                      <Lock className="mr-2 h-4 w-4" />
                      即将开放
                    </Button>
                  )}
                  <span className="text-xs text-slate-400">任务链：{isOpen ? '已部署' : '规划中'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
