'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Cpu,
  Globe,
  GraduationCap,
  Layers,
  Play,
  Ship,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ShipModelPreview } from '@/resources/simulations/ship-model-preview'
import { LoginModal } from '@/components/shared/login-modal'

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN'

const shipScenarios = [
  {
    id: 1,
    title: '海上半潜平台动力定位',
    description: '模拟半潜式钻井平台在复杂海况下的动力定位，学习多推进器协同与定点保持策略。',
    modelPath: '/assets/drilling-rig.glb',
    difficulty: '高级',
    participants: '2,847',
    tag: '定位控制',
    bgGradient: 'from-[#0b1f3a] via-[#112b55] to-[#0c1836]',
    ctaHref: '/simulations/drilling',
    ctaLabel: '开启任务链',
  },
  {
    id: 2,
    title: '雪龙号破冰船航行控制',
    description: '在极地环境中学习 Azipod 推进控制，体验冰阻力 Stick-Slip 效应导致的参数摄动。',
    modelPath: '/assets/icebreaker.glb',
    difficulty: '专家',
    participants: '1,234',
    tag: '极地任务',
    bgGradient: 'from-[#0b2832] via-[#0f3a4b] to-[#0c1d2b]',
    ctaHref: '/simulations/icebreaker',
    ctaLabel: '开启任务链',
  },
  {
    id: 3,
    title: '挖泥船精确定位作业',
    description: '学习挖泥船在施工中的精确定位技术，掌握多点锚泊系统的协调控制。',
    modelPath: '/assets/dredger.glb',
    difficulty: '中级',
    participants: '3,456',
    tag: '作业协同',
    bgGradient: 'from-[#102a2b] via-[#124237] to-[#0d231f]',
    ctaHref: '/simulations/dredger',
    ctaLabel: '开启任务链',
  },
  {
    id: 4,
    title: 'LNG船舶时滞控制',
    description: '体验大型 LNG 运输船的时滞控制挑战，学习 Smith 预估器与液货晃荡抑制技术。',
    modelPath: '/assets/Lng-carrier.glb',
    difficulty: '高级',
    participants: '1,876',
    tag: '时滞控制',
    bgGradient: 'from-[#1b1c3b] via-[#2c2753] to-[#1a1432]',
    ctaHref: '/simulations/lng',
    ctaLabel: '开启任务链',
  },
  {
    id: 5,
    title: 'MSC Tessa 集装箱船变质量控制',
    description: '体验超大型集装箱船的变质量控制挑战，学习增益调度PID策略与风载荷抑制技术。',
    modelPath: '/assets/container.glb',
    difficulty: '高级',
    participants: '4,123',
    tag: '增益调度',
    bgGradient: 'from-[#2b1b12] via-[#3a2316] to-[#26140a]',
    ctaHref: '/simulations/container',
    ctaLabel: '开启任务链',
  },
  {
    id: 6,
    title: '爱达·魔都号邮轮舒适度控制',
    description: '体验中国首艘国产大型豪华邮轮的舒适度控制，学习减摇鳍与陷波滤波器抑制致晕频段。',
    modelPath: '/assets/luxury-liner.glb',
    difficulty: '专家',
    participants: '987',
    tag: '频域舒适度',
    bgGradient: 'from-[#0d2b2c] via-[#0f4045] to-[#0a1f23]',
    ctaHref: '/simulations/cruise',
    ctaLabel: '开启任务链',
  },
  {
    id: 7,
    title: '军用驱逐舰战术机动',
    description: '体验军用舰艇的高机动性控制，学习战术环境下的快速响应控制策略。',
    modelPath: '/assets/destroyer.glb',
    difficulty: '专家',
    participants: '654',
    tag: '战术机动',
    bgGradient: 'from-[#1a1c20] via-[#2a2f3a] to-[#101419]',
    ctaHref: '/simulations/destroyer',
    ctaLabel: '开启任务链',
  },
]

const moduleLinks = [
  {
    title: '知识图谱',
    description: '三维关系网 · 学习路径 · 资源地图',
    href: '/knowledge',
    icon: Globe,
  },
  {
    title: '思政沙盘',
    description: '伦理决策 · 风险权衡 · 多维代价',
    href: '/ethics',
    icon: Compass,
  },
  {
    title: 'AI工坊',
    description: '多模态助教 · 学情分析 · 问答中枢',
    href: '/ai',
    icon: Cpu,
  },
  {
    title: '互动学习',
    description: '幅角原理 · 控制地图 · 交互探索',
    href: '/interactive-learning',
    icon: BookOpen,
  },
  {
    title: '评审入口',
    description: 'DevelopmentPlan 对齐 · 分支功能演示',
    href: '/review',
    icon: ClipboardCheck,
  },
]

export default function HomePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const totalSlides = shipScenarios.length

  const routeByRole = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        router.push('/admin')
        break
      case 'TEACHER':
        router.push('/teacher')
        break
      default:
        router.push('/dashboard')
    }
  }

  const handleEnterCockpit = () => {
    if (!session) {
      setShowLoginModal(true)
      return
    }
    routeByRole(session.user?.role as UserRole)
  }

  const handleLoginSuccess = (role: UserRole) => {
    setShowLoginModal(false)
    routeByRole(role)
  }

  useEffect(() => {
    if (isDragging) {
      return
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 6000)
    return () => clearInterval(timer)
  }, [isDragging, totalSlides])

  const nextSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
  }

  const prevSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }

  const currentScenario = shipScenarios[currentSlide]

  return (
    <div
      className="min-h-screen bg-[#0b1024] text-white"
      style={{ fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}
    >
      <div className="relative overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${currentScenario.bgGradient} transition-all duration-1000`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

        <nav className="relative z-10 border-b border-white/10">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-alert/15 text-amber-alert">
                <Ship className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-wide">AI-OBE船舶智控平台</div>
                <div className="text-xs text-white/60">Mission Control for Maritime Education</div>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-white/80 md:flex">
              <Link href="/simulations" className="hover:text-amber-alert">虚拟仿真</Link>
              <Link href="/knowledge" className="hover:text-amber-alert">知识图谱</Link>
              <Link href="/ethics" className="hover:text-amber-alert">思政沙盘</Link>
              <Link href="/ai" className="hover:text-amber-alert">AI工坊</Link>
              <Link href="/interactive-learning" className="hover:text-amber-alert">互动学习</Link>
              <Link href="/review" className="hover:text-amber-alert">评审入口</Link>
            </div>
            <div className="flex items-center gap-3">
              {session ? (
                <Button
                  onClick={handleEnterCockpit}
                  className="bg-amber-alert text-dark-blue hover:bg-yellow-500"
                >
                  进入驾驶舱
                </Button>
              ) : (
                <Button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-amber-alert text-dark-blue hover:bg-yellow-500"
                >
                  进入驾驶舱
                </Button>
              )}
            </div>
          </div>
        </nav>

        <section className="relative z-10">
          <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                <Sparkles className="h-4 w-4 text-amber-alert" />
                {currentScenario.tag} · {currentScenario.difficulty} · {currentScenario.participants}人参与
              </div>
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                {currentScenario.title}
              </h1>
              <p className="text-lg text-white/80">{currentScenario.description}</p>
              <div className="flex flex-wrap gap-3">
                {currentScenario.ctaHref ? (
                  <Button asChild className="bg-amber-alert text-dark-blue hover:bg-yellow-500">
                    <Link href={currentScenario.ctaHref}>
                      <Play className="mr-2 h-4 w-4" />
                      {currentScenario.ctaLabel ?? '开启任务链'}
                    </Link>
                  </Button>
                ) : (
                  <Button className="bg-amber-alert text-dark-blue hover:bg-yellow-500">
                    <Play className="mr-2 h-4 w-4" />
                    {currentScenario.ctaLabel ?? '开启任务链'}
                  </Button>
                )}
                <Button variant="outline" className="border-white/30 text-white/80 hover:bg-white/10">
                  了解课程设计
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: '任务链覆盖', value: '18类海事任务' },
                  { label: '仿真模型库', value: '7种主力船型' },
                  { label: 'AI分析维度', value: '24项指标' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/60">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>可拖拽旋转模型</span>
                <span>虚拟视角：战术俯视</span>
              </div>
              <ShipModelPreview
                modelPath={currentScenario.modelPath}
                onInteractionStart={() => setIsDragging(true)}
                onInteractionEnd={() => setIsDragging(false)}
              />
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
                <span>当前任务：{currentScenario.tag}</span>
                <span>响应窗口：6秒轮播</span>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1600px] px-6 pb-12">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">任务序列</div>
                  <div className="text-xs text-white/50">{currentSlide + 1}/{totalSlides}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {shipScenarios.map((scenario, index) => (
                    <button
                      key={scenario.id}
                      onClick={() => setCurrentSlide(index)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        currentSlide === index
                          ? 'bg-amber-alert/20 text-amber-alert'
                          : 'bg-white/0 text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{scenario.title}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">平台入口矩阵</div>
                  <div className="text-xs text-white/50">五大核心模块</div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {moduleLinks.map((module) => (
                    <Link
                      key={module.title}
                      href={module.href}
                      className="group rounded-xl border border-white/10 bg-[#0f1b3d] p-4 transition hover:-translate-y-1 hover:border-amber-alert/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-amber-alert">
                          <module.icon className="h-5 w-5" />
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-amber-alert" />
                      </div>
                      <div className="mt-4 text-sm font-semibold">{module.title}</div>
                      <div className="mt-2 text-xs text-white/60">{module.description}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 pb-12">
            <div className="flex items-center gap-3 text-xs text-white/70">
              <GraduationCap className="h-4 w-4 text-amber-alert" />
              今日推荐任务：半潜平台动力定位挑战 · 预计时长 90 分钟
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextSlide}
                className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}
