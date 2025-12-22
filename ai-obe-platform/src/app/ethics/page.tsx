'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft,
  Shield,
  AlertTriangle,
  Users,
  Globe,
  DollarSign,
  Clock,
  RefreshCw,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'

export default function EthicsPage() {
  const [economicValue, setEconomicValue] = useState(70)
  const [environmentValue, setEnvironmentValue] = useState(60)
  const [safetyValue, setSafetyValue] = useState(85)
  const [socialValue, setSocialValue] = useState(55)
  const [timeValue, setTimeValue] = useState(40)
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [currentScenario, setCurrentScenario] = useState(0)

  const scenarios = [
    {
      title: "海洋污染事故应急决策",
      description: "某货轮在航行中发生燃油泄漏，需要在经济成本、环境保护和航行安全之间做出平衡决策。",
      pressure: 85,
      consequences: [
        "立即停船清理：环境影响最小，但经济损失巨大",
        "继续航行至港口：降低经济损失，但可能扩大污染范围",
        "就近港口处理：平衡方案，但时间压力大"
      ]
    },
    {
      title: "极地航行路径选择",
      description: "破冰船在北极航行，遇到海冰密集区域，需要在生态保护、航行效率和船员安全之间权衡。",
      pressure: 75,
      consequences: [
        "绕行避开生态敏感区：保护环境，但增加航行时间和成本",
        "直接穿越：时间最短，但对生态系统造成影响",
        "部分绕行：折中方案，需要精确计算风险"
      ]
    }
  ]

  const scholars = [
    { name: "王海洋", title: "海事法专家", specialty: "国际海事法规", avatar: "👨‍⚖️" },
    { name: "李环境", title: "海洋生态学家", specialty: "海洋环境保护", avatar: "👩‍🔬" },
    { name: "张安全", title: "船舶安全专家", specialty: "航行安全评估", avatar: "👨‍✈️" },
    { name: "陈经济", title: "海事经济学家", specialty: "成本效益分析", avatar: "👩‍💼" }
  ]

  const toggleSimulation = () => {
    setIsSimulating(!isSimulating)
  }

  const resetValues = () => {
    setEconomicValue(50)
    setEnvironmentValue(50)
    setSafetyValue(50)
    setSocialValue(50)
    setTimeValue(50)
  }

  const calculateEthicsScore = () => {
    const weights = {
      safety: 0.3,
      environment: 0.25,
      economic: 0.2,
      social: 0.15,
      time: 0.1
    }
    
    return Math.round(
      safetyValue * weights.safety +
      environmentValue * weights.environment +
      economicValue * weights.economic +
      socialValue * weights.social +
      timeValue * weights.time
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-dark-blue border-b border-amber-alert p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:text-amber-alert">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold flex items-center">
              <Shield className="mr-3 h-8 w-8 text-amber-alert" />
              伦理决策沙盒 - 海事道德两难困境模拟器
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm bg-amber-alert text-dark-blue px-3 py-1 rounded-full">
              压力值: {scenarios[currentScenario].pressure}%
            </span>
            <Button 
              onClick={toggleSimulation}
              className={`${isSimulating ? 'bg-danger-red' : 'bg-success-green'} text-white`}
            >
              {isSimulating ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isSimulating ? '暂停模拟' : '开始模拟'}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          
          {/* Left Panel - Value Sliders */}
          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-amber-alert flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5" />
                  价值观权重调节器
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-red-400">
                      <Shield className="mr-2 h-4 w-4" />
                      安全保障
                    </span>
                    <span className="text-amber-alert font-bold">{safetyValue}%</span>
                  </div>
                  <Slider 
                    value={[safetyValue]} 
                    onValueChange={(value) => setSafetyValue(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-green-400">
                      <Globe className="mr-2 h-4 w-4" />
                      环境保护
                    </span>
                    <span className="text-amber-alert font-bold">{environmentValue}%</span>
                  </div>
                  <Slider 
                    value={[environmentValue]} 
                    onValueChange={(value) => setEnvironmentValue(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-blue-400">
                      <DollarSign className="mr-2 h-4 w-4" />
                      经济效益
                    </span>
                    <span className="text-amber-alert font-bold">{economicValue}%</span>
                  </div>
                  <Slider 
                    value={[economicValue]} 
                    onValueChange={(value) => setEconomicValue(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-purple-400">
                      <Users className="mr-2 h-4 w-4" />
                      社会责任
                    </span>
                    <span className="text-amber-alert font-bold">{socialValue}%</span>
                  </div>
                  <Slider 
                    value={[socialValue]} 
                    onValueChange={(value) => setSocialValue(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-yellow-400">
                      <Clock className="mr-2 h-4 w-4" />
                      时间效率
                    </span>
                    <span className="text-amber-alert font-bold">{timeValue}%</span>
                  </div>
                  <Slider 
                    value={[timeValue]} 
                    onValueChange={(value) => setTimeValue(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="pt-4 border-t border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-semibold">伦理评分</span>
                    <span className="text-2xl font-bold text-amber-alert">{calculateEthicsScore()}/100</span>
                  </div>
                  <Button onClick={resetValues} variant="outline" className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    重置参数
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Scenario Display */}
          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-amber-alert flex items-center justify-between">
                  <span className="flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    决策场景
                  </span>
                  <span className="text-sm bg-danger-red px-3 py-1 rounded-full">
                    场景 {currentScenario + 1}/{scenarios.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">
                    {scenarios[currentScenario].title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {scenarios[currentScenario].description}
                  </p>
                  
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 text-amber-alert">可能的决策选项：</h4>
                    <div className="space-y-2">
                      {scenarios[currentScenario].consequences.map((consequence, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="text-amber-alert font-bold">{index + 1}.</span>
                          <span className="text-gray-300">{consequence}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => setCurrentScenario((prev) => (prev - 1 + scenarios.length) % scenarios.length)}
                      variant="outline" 
                      className="flex-1"
                    >
                      上一个场景
                    </Button>
                    <Button 
                      onClick={() => setCurrentScenario((prev) => (prev + 1) % scenarios.length)}
                      variant="outline" 
                      className="flex-1"
                    >
                      下一个场景
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real-time Analysis */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-success-green">实时分析结果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>决策倾向</span>
                    <span className="text-amber-alert font-bold">
                      {safetyValue > 70 ? '安全优先' : 
                       environmentValue > 70 ? '环保优先' : 
                       economicValue > 70 ? '经济优先' : '平衡考量'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>风险评级</span>
                    <span className={`font-bold ${calculateEthicsScore() > 70 ? 'text-success-green' : 
                                                  calculateEthicsScore() > 50 ? 'text-amber-alert' : 'text-danger-red'}`}>
                      {calculateEthicsScore() > 70 ? '低风险' : 
                       calculateEthicsScore() > 50 ? '中风险' : '高风险'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>模拟状态</span>
                    <span className={`font-bold ${isSimulating ? 'text-success-green' : 'text-gray-400'}`}>
                      {isSimulating ? '运行中' : '已停止'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Scholar Advisory */}
          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-amber-alert flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  学者顾问团
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scholars.map((scholar, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded-lg">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">{scholar.avatar}</span>
                        <div>
                          <div className="font-semibold text-white">{scholar.name}</div>
                          <div className="text-sm text-gray-400">{scholar.title}</div>
                        </div>
                      </div>
                      <div className="text-xs text-amber-alert bg-gray-600 px-2 py-1 rounded">
                        {scholar.specialty}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-amber-alert">专家建议</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="bg-blue-900/30 p-3 rounded border-l-4 border-blue-400">
                    <div className="font-semibold text-blue-400">王海洋 - 法律观点</div>
                    <div className="text-gray-300 mt-1">
                      根据国际海事组织规定，环境保护应优先考虑，建议提高环境权重至80%以上。
                    </div>
                  </div>
                  
                  <div className="bg-green-900/30 p-3 rounded border-l-4 border-green-400">
                    <div className="font-semibold text-green-400">李环境 - 生态观点</div>
                    <div className="text-gray-300 mt-1">
                      当前环境参数设置过低，海洋生态系统一旦破坏难以恢复，建议重新评估。
                    </div>
                  </div>
                  
                  <div className="bg-red-900/30 p-3 rounded border-l-4 border-red-400">
                    <div className="font-semibold text-red-400">张安全 - 安全观点</div>
                    <div className="text-gray-300 mt-1">
                      安全系数达标，但在极端天气下仍需提高安全权重至90%以上。
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-dark-blue border-t border-gray-600 p-4">
        <div className="container mx-auto text-center text-gray-400">
          <p>伦理决策沙盒 - 培养负责任的海事决策能力</p>
        </div>
      </footer>
    </div>
  )
}