'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Layers,
  Menu,
  Play,
  Ship,
  Sparkles,
  Trophy,
  User,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getShipModelPosterPath } from '@/resources/simulations/ship-model-assets'
import { LoginModal } from '@/components/shared/login-modal'
import { useTheme } from '@/components/providers/theme-provider'
import { resolveHomeModelRenderMode, type ConnectionHint } from '@/lib/model-render-policy'
import { getHomepageScenarioBackgroundClass } from '@/lib/homepage-theme'
import {
  getCommercialStudentEntryIntentGroups,
  getPlatformCockpitHref,
  getStudentLearningIntentNavigationGroups,
  resolveCommercialEntryHref,
  type PlatformNavigationIconKey,
} from '@/lib/platform-role-navigation'

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

const homepageStudentEntries = getStudentLearningIntentNavigationGroups().flatMap((group) => group.entries)
const homepageEntryIntentGroups = getCommercialStudentEntryIntentGroups()

const homepageIconMap: Partial<Record<PlatformNavigationIconKey, LucideIcon>> = {
  adaptive: Sparkles,
  arena: Trophy,
  interactive: GraduationCap,
  knowledge: Globe,
  profile: User,
  ship: Ship,
  workbench: Wrench,
}

const ShipModelPreview = dynamic(
  () => import('@/resources/simulations/ship-model-preview').then((module) => module.ShipModelPreview),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="rounded-full border border-white/20 bg-slate-900/70 px-3 py-1 text-xs text-slate-100">
            模型加载中...
          </div>
        </div>
      </div>
    ),
  },
)

export default function HomePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { mounted, theme } = useTheme()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showCourseDesignDialog, setShowCourseDesignDialog] = useState(false)
  const [showMobileNavigation, setShowMobileNavigation] = useState(false)
  const [homeDynamicModelEnabled, setHomeDynamicModelEnabled] = useState(false)
  const [connectionHint, setConnectionHint] = useState<ConnectionHint | undefined>(undefined)
  const totalSlides = shipScenarios.length

  const routeByRole = (role?: UserRole | string | null) => {
    router.push(getPlatformCockpitHref(role))
  }

  const handleEnterCockpit = () => {
    if (!session) {
      setShowLoginModal(true)
      return
    }
    routeByRole(session.user?.role as UserRole | undefined)
  }

  const handleLoginSuccess = (role: UserRole) => {
    setShowLoginModal(false)
    routeByRole(role)
  }

  useEffect(() => {
    let active = true
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/platform/settings', { cache: 'no-store' })
        if (!response.ok) {
          return
        }
        const payload = await response.json() as { homeDynamicModelEnabled?: boolean }
        if (active) {
          setHomeDynamicModelEnabled(payload.homeDynamicModelEnabled === true)
        }
      } catch {
        if (active) {
          setHomeDynamicModelEnabled(false)
        }
      }
    }

    loadSettings()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }
    const maybeNavigator = navigator as Navigator & { connection?: ConnectionHint }
    setConnectionHint(maybeNavigator.connection)
  }, [])

  const homeModelRenderMode = resolveHomeModelRenderMode({
    adminEnabled: homeDynamicModelEnabled,
    connection: connectionHint,
  })
  const shouldUseDynamicHomeModel = homeModelRenderMode === 'dynamic'

  useEffect(() => {
    if (isDragging) {
      return
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 6000)
    return () => clearInterval(timer)
  }, [isDragging, totalSlides])

  useEffect(() => {
    if (!shouldUseDynamicHomeModel) {
      return
    }
    const current = shipScenarios[currentSlide]

    if (current?.modelPath) {
      void import('@/resources/simulations/ship-model-preview')
        .then(({ preloadShipModel }) => preloadShipModel(current.modelPath, 'high'))
        .catch(() => undefined)
    }
  }, [currentSlide, shouldUseDynamicHomeModel])

  const nextSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
  }

  const prevSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }

  const currentScenario = shipScenarios[currentSlide]
  const scenarioBackgroundClass = getHomepageScenarioBackgroundClass({
    mounted,
    theme,
    scenarioGradient: currentScenario.bgGradient,
  })

  return (
    <div
      className="surface-page"
      style={{ fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}
    >
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 transition-all duration-1000 ${scenarioBackgroundClass}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_55%)]" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-400/10" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/10" />

        <nav className="surface-topbar relative z-10">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Ship className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-wide text-foreground">AI-OBE船舶智控平台</div>
                <div className="text-xs text-subtle">Mission Control for Maritime Education</div>
              </div>
            </div>
            <div className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
              {homepageStudentEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  prefetch={entry.href.startsWith('/simulations') ? false : undefined}
                  className="transition hover:text-primary"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={showMobileNavigation ? '关闭平台入口菜单' : '打开平台入口菜单'}
                aria-expanded={showMobileNavigation}
                onClick={() => setShowMobileNavigation((value) => !value)}
                className="btn-ghost-themed inline-flex h-10 w-10 items-center justify-center rounded-lg border md:hidden"
              >
                {showMobileNavigation ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {session ? (
                <Button
                  onClick={handleEnterCockpit}
                  className="cta-primary"
                >
                  进入驾驶舱
                </Button>
              ) : (
                <Button
                  onClick={() => setShowLoginModal(true)}
                  className="cta-primary"
                >
                  进入驾驶舱
                </Button>
              )}
            </div>
          </div>
          {showMobileNavigation ? (
            <nav
              aria-label="移动平台入口菜单"
              className="mx-auto grid max-w-[1600px] gap-2 border-t border-border/60 px-6 py-3 md:hidden"
            >
              {homepageStudentEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  prefetch={entry.href.startsWith('/simulations') ? false : undefined}
                  onClick={() => setShowMobileNavigation(false)}
                  className="surface-card-soft flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <span>{entry.label}</span>
                  <ArrowUpRight className="h-4 w-4 text-subtle" />
                </Link>
              ))}
            </nav>
          ) : null}
        </nav>

        <section className="relative z-10">
          <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/65 bg-card/70 px-3 py-1 text-xs text-subtle">
                <Sparkles className="h-4 w-4 text-primary" />
                {currentScenario.tag} · {currentScenario.difficulty} · {currentScenario.participants}人参与
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                {currentScenario.title}
              </h1>
              <p className="text-lg text-subtle">{currentScenario.description}</p>
              <div className="flex flex-wrap gap-3">
                {currentScenario.ctaHref ? (
                  <Button asChild className="cta-primary">
                    <Link href={currentScenario.ctaHref} prefetch={false}>
                      <Play className="mr-2 h-4 w-4" />
                      {currentScenario.ctaLabel ?? '开启任务链'}
                    </Link>
                  </Button>
                ) : (
                  <Button className="cta-primary">
                    <Play className="mr-2 h-4 w-4" />
                    {currentScenario.ctaLabel ?? '开启任务链'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="btn-ghost-themed border"
                  onClick={() => setShowCourseDesignDialog(true)}
                >
                  了解课程设计
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: '任务链覆盖', value: '18类海事任务' },
                  { label: '仿真模型库', value: '7种主力船型' },
                  { label: 'AI分析维度', value: '24项指标' },
                ].map((item) => (
                  <div key={item.label} className="surface-card-soft p-4">
                    <div className="text-xs text-subtle">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-subtle">
                <span>{shouldUseDynamicHomeModel ? '可拖拽旋转模型' : '静态模型预览'}</span>
                <span>{shouldUseDynamicHomeModel ? '虚拟视角：战术俯视' : '当前策略：静态模式'}</span>
              </div>
              {shouldUseDynamicHomeModel ? (
                <ShipModelPreview
                  modelPath={currentScenario.modelPath}
                  onInteractionStart={() => setIsDragging(true)}
                  onInteractionEnd={() => setIsDragging(false)}
                />
              ) : (
                <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Image
                    src={getShipModelPosterPath(currentScenario.modelPath)}
                    alt={`${currentScenario.title}静态预览`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                </div>
              )}
              <div className="surface-card-soft flex items-center justify-between px-4 py-3 text-xs text-subtle">
                <span>当前任务：{currentScenario.tag}</span>
                <span>{shouldUseDynamicHomeModel ? '响应窗口：6秒轮播' : '响应窗口：静态图直出'}</span>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1600px] px-6 pb-12">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">任务序列</div>
                  <div className="text-xs text-subtle">{currentSlide + 1}/{totalSlides}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {shipScenarios.map((scenario, index) => (
                    <button
                      key={scenario.id}
                      onClick={() => setCurrentSlide(index)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        currentSlide === index
                          ? 'bg-primary/15 text-primary'
                          : 'text-subtle hover:bg-accent/55 hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{scenario.title}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">平台入口矩阵</div>
                  <div className="text-xs text-subtle">商业入口 · 学习意图</div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {homepageEntryIntentGroups.map((intentGroup) => {
                    const entry = homepageStudentEntries.find((candidate) => intentGroup.entryIds.includes(candidate.id))
                    const ModuleIcon = entry ? homepageIconMap[entry.iconKey as PlatformNavigationIconKey] ?? Layers : Layers
                    const entryHref = entry?.href ?? resolveCommercialEntryHref(intentGroup.intent, Boolean(session))
                    return (
                      <Link
                        key={intentGroup.intent}
                        href={entryHref}
                        prefetch={entry?.href.startsWith('/simulations') ? false : undefined}
                        className="surface-card-soft group p-4 transition hover:-translate-y-1 hover:border-primary/45"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <ModuleIcon className="h-5 w-5" />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-subtle group-hover:text-primary" />
                        </div>
                        <div className="mt-4 text-xs font-medium text-primary">{intentGroup.label}</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{entry?.label ?? intentGroup.label}</div>
                        <div className="mt-2 text-xs text-subtle">{intentGroup.summary}</div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 pb-12">
            <div className="flex items-center gap-3 text-xs text-subtle">
              <GraduationCap className="h-4 w-4 text-primary" />
              今日推荐任务：半潜平台动力定位挑战 · 预计时长 90 分钟
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="btn-ghost-themed rounded-full border p-2 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextSlide}
                className="btn-ghost-themed rounded-full border p-2 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={showCourseDesignDialog} onOpenChange={setShowCourseDesignDialog}>
        <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">虚拟仿真要求和背景知识</DialogTitle>
            <DialogDescription className="text-subtle">
              当前任务：{currentScenario.title}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 text-sm leading-6 text-subtle md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/45 p-4">
              <div className="mb-3 text-sm font-semibold text-foreground">虚拟仿真要求</div>
              <ul className="space-y-2">
                <li>识别控制对象、任务目标、主要扰动与执行器约束，再进入仿真操作。</li>
                <li>围绕稳定性、超调量、响应时间、稳态误差和控制能耗观察响应变化。</li>
                <li>每次调整参数后记录现象、判断原因，并说明方案是否满足任务指标。</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-background/45 p-4">
              <div className="mb-3 text-sm font-semibold text-foreground">背景知识</div>
              <ul className="space-y-2">
                <li>船舶与海工平台会同时受到风、浪、流、负载变化和测量噪声影响。</li>
                <li>不同任务分别对应定位控制、时滞控制、变质量控制、频域舒适度和快速机动等问题。</li>
                <li>仿真重点不是完成点击流程，而是把响应曲线与控制原理中的指标建立对应关系。</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}
