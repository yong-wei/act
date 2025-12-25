'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShipModelPreview } from '@/components/ship-model-preview'
import { 
  Ship, 
  Compass, 
  Gauge, 
  Bot, 
  ChevronLeft, 
  ChevronRight,
  Play,
  BarChart3,
  Brain,
  Globe
} from 'lucide-react'

const shipScenarios = [
  {
    id: 1,
    title: "海上半潜平台动力定位",
    description: "模拟半潜式钻井平台在复杂海况下的动力定位，学习多推进器协同与定点保持策略。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/drilling-rig.glb",
    difficulty: "高级",
    participants: "2,847",
    bgGradient: "from-blue-900 to-blue-700"
  },
  {
    id: 2,
    title: "雪龙号破冰船航行控制",
    description: "在极地环境中学习破冰船的特殊操控技术，掌握冰区航行的PID控制参数调优。",
    image: "/api/placeholder/600/400", 
    modelPath: "/assets/icebreaker.glb",
    difficulty: "专家",
    participants: "1,234",
    bgGradient: "from-cyan-900 to-blue-800"
  },
  {
    id: 3,
    title: "挖泥船精确定位作业",
    description: "学习挖泥船在施工中的精确定位技术，掌握多点锚泊系统的协调控制。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/dredger.glb",
    difficulty: "中级", 
    participants: "3,456",
    bgGradient: "from-emerald-900 to-teal-700"
  },
  {
    id: 4,
    title: "LNG船舶低温货物控制",
    description: "体验液化天然气船舶的货物控制系统，学习低温环境下的精密控制技术。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/Lng-carrier.glb",
    difficulty: "高级",
    participants: "1,876",
    bgGradient: "from-purple-900 to-indigo-700"
  },
  {
    id: 5,
    title: "集装箱船智能装卸",
    description: "掌握现代集装箱船的智能装卸系统，学习港口作业中的自动化控制。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/container.glb",
    difficulty: "中级",
    participants: "4,123", 
    bgGradient: "from-orange-900 to-red-700"
  },
  {
    id: 6,
    title: "豪华游轮平稳行驶控制",
    description: "体验豪华游轮在客运航线中的平稳航行控制，学习舒适性与能耗优化的操纵策略。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/luxury-liner.glb",
    difficulty: "专家",
    participants: "987",
    bgGradient: "from-teal-900 to-cyan-700"
  },
  {
    id: 7,
    title: "军用驱逐舰战术机动",
    description: "体验军用舰艇的高机动性控制，学习战术环境下的快速响应控制策略。",
    image: "/api/placeholder/600/400",
    modelPath: "/assets/destroyer.glb",
    difficulty: "专家",
    participants: "654",
    bgGradient: "from-gray-900 to-slate-700",
    ctaHref: "/simulations/destroyer",
    ctaLabel: "开启任务链"
  }
]

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const totalSlides = shipScenarios.length

  useEffect(() => {
    if (isDragging) {
      return
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 5000)
    return () => clearInterval(timer)
  }, [isDragging, totalSlides])

  const nextSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev + 1) % shipScenarios.length)
  }

  const prevSlide = () => {
    setIsDragging(false)
    setCurrentSlide((prev) => (prev - 1 + shipScenarios.length) % shipScenarios.length)
  }

  const currentScenario = shipScenarios[currentSlide]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-dark-blue text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Ship className="h-8 w-8 text-amber-alert" />
            <span className="text-xl font-bold">AI-OBE船舶控制平台</span>
          </div>
          <div className="flex space-x-6">
            <Link href="/ai" className="hover:text-amber-alert transition-colors">AI助教工坊</Link>
            <Link href="/ethics" className="hover:text-amber-alert transition-colors">伦理决策沙盒</Link>
            <Link href="/knowledge" className="hover:text-amber-alert transition-colors">知识图谱</Link>
          </div>
        </div>
      </nav>

      {/* Hero Carousel Section */}
      <section className="relative h-[70vh] overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${currentScenario.bgGradient} transition-all duration-1000`}>
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
        
        <div className="relative z-10 h-full flex items-center">
          <div className="container mx-auto grid grid-cols-2 gap-8 items-center">
            <div className="text-white space-y-6">
              <div className="inline-block bg-amber-alert text-dark-blue px-3 py-1 rounded-full text-sm font-semibold">
                {currentScenario.difficulty} · {currentScenario.participants}人参与
              </div>
              <h1 className="text-5xl font-bold leading-tight">
                {currentScenario.title}
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                {currentScenario.description}
              </p>
              <div className="flex space-x-4">
                {currentScenario.ctaHref ? (
                  <Button
                    size="lg"
                    asChild
                    className="bg-amber-alert text-dark-blue hover:bg-yellow-500"
                  >
                    <Link href={currentScenario.ctaHref}>
                      <Play className="mr-2 h-5 w-5" />
                      {currentScenario.ctaLabel ?? "开启任务链"}
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" className="bg-amber-alert text-dark-blue hover:bg-yellow-500">
                    <Play className="mr-2 h-5 w-5" />
                    {currentScenario.ctaLabel ?? "开启任务链"}
                  </Button>
                )}
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-dark-blue">
                  了解更多
                </Button>
              </div>
            </div>
            
            <div className="relative">
              {currentScenario.modelPath ? (
                <ShipModelPreview
                  modelPath={currentScenario.modelPath}
                  onInteractionStart={() => setIsDragging(true)}
                  onInteractionEnd={() => setIsDragging(false)}
                />
              ) : (
                <div className="w-full h-80 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Ship className="h-32 w-32 text-white/70" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carousel Controls */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-all"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-all"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>

        {/* Carousel Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
          {shipScenarios.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? 'bg-amber-alert' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            智能海事教育核心功能
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-primary-blue">
                  <Gauge className="mr-3 h-6 w-6" />
                  学习驾驶舱
                </CardTitle>
                <CardDescription>个性化学习路径与能力评估</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-16 w-16 text-primary-blue" />
                  </div>
                  <p className="text-sm text-gray-600">
                    基于AI的个性化学习建议，实时跟踪学习进度和技能掌握情况
                  </p>
                  <Button className="w-full">进入驾驶舱</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-success-green">
                  <Compass className="mr-3 h-6 w-6" />
                  今日推荐工卡
                </CardTitle>
                <CardDescription>智能推荐的学习任务</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="p-3 bg-green-50 rounded-lg border-l-4 border-success-green">
                      <div className="font-medium">PID参数调优实验</div>
                      <div className="text-sm text-gray-600">难度: 中级 | 预计30分钟</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-primary-blue">
                      <div className="font-medium">船舶避碰决策分析</div>
                      <div className="text-sm text-gray-600">难度: 高级 | 预计45分钟</div>
                    </div>
                  </div>
                  <Button className="w-full" variant="outline">查看全部任务</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-amber-alert">
                  <Bot className="mr-3 h-6 w-6" />
                  AI助教即时问答
                </CardTitle>
                <CardDescription>24/7智能问答支持</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-32 bg-gradient-to-br from-amber-50 to-orange-100 rounded-lg p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded-lg text-sm">
                        💬 如何优化动力定位系统的PID参数？
                      </div>
                      <div className="bg-primary-blue text-white p-2 rounded-lg text-sm">
                        🤖 建议从Kp=0.8开始调试...
                      </div>
                    </div>
                  </div>
                  <Link href="/ai">
                    <Button className="w-full bg-amber-alert text-dark-blue hover:bg-yellow-500">
                      <Brain className="mr-2 h-4 w-4" />
                      开启AI对话
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="py-12 bg-dark-blue text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">快速访问专业工具</h2>
          <div className="flex justify-center space-x-6">
            <Link href="/ethics">
              <Button variant="outline" className="border-amber-alert text-amber-alert hover:bg-amber-alert hover:text-dark-blue">
                伦理决策沙盒
              </Button>
            </Link>
            <Link href="/knowledge">
              <Button variant="outline" className="border-amber-alert text-amber-alert hover:bg-amber-alert hover:text-dark-blue">
                <Globe className="mr-2 h-4 w-4" />
                知识图谱导航
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto text-center">
          <p>&copy; 2024 AI-OBE船舶控制平台. 智能海事教育创新实验室</p>
        </div>
      </footer>
    </div>
  )
}
