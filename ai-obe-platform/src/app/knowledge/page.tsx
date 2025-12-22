'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft,
  Search,
  Brain,
  BookOpen,
  Video,
  FileText,
  Globe,
  Network,
  Zap,
  Target,
  Eye,
  RotateCw,
  Play,
  Star,
  Download,
  Filter,
  X
} from 'lucide-react'

interface KnowledgeNode {
  id: number
  title: string
  type: string
  category: string
  connections: number[]
  difficulty: string
  resources: number
  position: { x: number; y: number }
}

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')

  const knowledgeNodes = [
    {
      id: 1,
      title: "PID控制器原理",
      type: "concept",
      category: "控制理论",
      connections: [2, 3, 4],
      difficulty: "中级",
      resources: 12,
      position: { x: 200, y: 150 }
    },
    {
      id: 2,
      title: "船舶动力学建模",
      type: "concept", 
      category: "海洋工程",
      connections: [1, 5, 6],
      difficulty: "高级",
      resources: 8,
      position: { x: 400, y: 100 }
    },
    {
      id: 3,
      title: "参数调优实验",
      type: "practice",
      category: "实验操作",
      connections: [1, 7],
      difficulty: "中级",
      resources: 15,
      position: { x: 150, y: 300 }
    },
    {
      id: 4,
      title: "稳定性分析",
      type: "theory",
      category: "控制理论",
      connections: [1, 2],
      difficulty: "高级", 
      resources: 6,
      position: { x: 350, y: 250 }
    },
    {
      id: 5,
      title: "海况建模",
      type: "concept",
      category: "海洋工程",
      connections: [2, 6],
      difficulty: "中级",
      resources: 10,
      position: { x: 500, y: 200 }
    },
    {
      id: 6,
      title: "动力定位系统",
      type: "application",
      category: "应用实例",
      connections: [2, 5],
      difficulty: "专家",
      resources: 20,
      position: { x: 450, y: 350 }
    },
    {
      id: 7,
      title: "避碰算法",
      type: "algorithm",
      category: "智能算法",
      connections: [3],
      difficulty: "高级",
      resources: 14,
      position: { x: 100, y: 400 }
    }
  ]

  const resources = [
    {
      id: 1,
      title: "PID控制器设计与调试指南",
      type: "document",
      category: "技术文档",
      author: "王教授",
      date: "2024-01-15",
      downloads: 1250,
      rating: 4.8
    },
    {
      id: 2,
      title: "船舶动力学仿真实验",
      type: "video",
      category: "实验视频",
      author: "李工程师",
      date: "2024-02-20",
      downloads: 890,
      rating: 4.6
    },
    {
      id: 3,
      title: "海洋环境建模案例",
      type: "case",
      category: "案例研究",
      author: "张博士",
      date: "2024-03-10",
      downloads: 670,
      rating: 4.9
    }
  ]

  const filteredNodes = knowledgeNodes.filter(node => {
    if (activeFilter === 'all') return true
    return node.type === activeFilter
  })

  const getNodeColor = (type: string) => {
    const colors = {
      concept: 'bg-blue-500',
      practice: 'bg-green-500',
      theory: 'bg-purple-500',
      application: 'bg-orange-500',
      algorithm: 'bg-red-500'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-500'
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      '初级': 'text-green-400',
      '中级': 'text-yellow-400',
      '高级': 'text-orange-400',
      '专家': 'text-red-400'
    }
    return colors[difficulty as keyof typeof colors] || 'text-gray-400'
  }

  return (
    <div className="min-h-screen bg-[#020721] text-[#e0e6ff]">
      <div className="flex h-screen">
        
        {/* Left Sidebar */}
        <div className="w-1/3 bg-[rgba(9,21,64,0.8)] border-r border-[rgba(79,134,198,0.3)] p-5 overflow-y-auto">
          <header className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-white hover:text-amber-alert">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-[#4f86c6] flex items-center">
                <Brain className="mr-2 h-6 w-6" />
                船舶知识图谱
              </h1>
            </div>
            
            <Tabs defaultValue="explore" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-[rgba(12,29,79,0.6)]">
                <TabsTrigger value="explore" className="text-[#8aa8d2] data-[state=active]:text-[#4f86c6]">
                  <Globe className="mr-2 h-4 w-4" />
                  探索
                </TabsTrigger>
                <TabsTrigger value="learn" className="text-[#8aa8d2] data-[state=active]:text-[#4f86c6]">
                  <BookOpen className="mr-2 h-4 w-4" />
                  学习
                </TabsTrigger>
                <TabsTrigger value="resources" className="text-[#8aa8d2] data-[state=active]:text-[#4f86c6]">
                  <FileText className="mr-2 h-4 w-4" />
                  资源
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="explore" className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-[#8aa8d2]" />
                  <Input
                    placeholder="搜索知识节点..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[rgba(12,29,79,0.6)] border-[rgba(79,134,198,0.3)] text-white"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {['all', 'concept', 'practice', 'theory', 'application', 'algorithm'].map(filter => (
                    <Button
                      key={filter}
                      size="sm"
                      variant={activeFilter === filter ? "default" : "outline"}
                      onClick={() => setActiveFilter(filter)}
                      className="text-xs"
                    >
                      {filter === 'all' ? '全部' : 
                       filter === 'concept' ? '概念' :
                       filter === 'practice' ? '实践' :
                       filter === 'theory' ? '理论' :
                       filter === 'application' ? '应用' : '算法'}
                    </Button>
                  ))}
                </div>
                
                <div className="space-y-2">
                  {filteredNodes.map(node => (
                    <Card 
                      key={node.id}
                      className="bg-[rgba(12,29,79,0.4)] border-[rgba(79,134,198,0.3)] cursor-pointer hover:bg-[rgba(79,134,198,0.1)] transition-colors"
                      onClick={() => setSelectedNode(node)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getNodeColor(node.type)}`}></div>
                          <div className="flex-1">
                            <div className="font-medium text-white text-sm">{node.title}</div>
                            <div className="text-xs text-[#8aa8d2]">{node.category}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-xs ${getDifficultyColor(node.difficulty)}`}>
                                {node.difficulty}
                              </span>
                              <span className="text-xs text-[#8aa8d2]">
                                {node.resources} 资源
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="learn" className="mt-4">
                <Card className="bg-[rgba(12,29,79,0.4)] border-[rgba(79,134,198,0.3)]">
                  <CardHeader>
                    <CardTitle className="text-[#4f86c6] text-lg">学习路径生成</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-[#8aa8d2]">
                      基于你的学习历史和目标，为你推荐最优学习路径
                    </div>
                    <Button className="w-full bg-[#4f86c6] hover:bg-[#3d6ba8]">
                      <Target className="mr-2 h-4 w-4" />
                      生成个人学习路径
                    </Button>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-[#4f86c6]">推荐路径：</div>
                      <div className="bg-[rgba(12,29,79,0.6)] p-3 rounded text-sm">
                        1. PID控制器原理 → 2. 参数调优实验 → 3. 稳定性分析
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="resources" className="mt-4 space-y-3">
                {resources.map(resource => (
                  <Card 
                    key={resource.id}
                    className="bg-[rgba(12,29,79,0.4)] border-[rgba(79,134,198,0.3)]"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-3">
                        <div className="text-xl">
                          {resource.type === 'document' ? '📄' :
                           resource.type === 'video' ? '🎥' : '📋'}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{resource.title}</div>
                          <div className="text-xs text-[#8aa8d2] mt-1">
                            {resource.author} • {resource.date}
                          </div>
                          <div className="flex items-center space-x-3 mt-2">
                            <div className="flex items-center space-x-1">
                              <Star className="h-3 w-3 text-yellow-400" />
                              <span className="text-xs text-[#8aa8d2]">{resource.rating}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Download className="h-3 w-3 text-[#8aa8d2]" />
                              <span className="text-xs text-[#8aa8d2]">{resource.downloads}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </header>
        </div>

        {/* Main Knowledge Graph Visualization */}
        <div className="flex-1 relative bg-gradient-to-br from-[#020721] to-[#0a1b3a]">
          
          {/* Graph Canvas */}
          <div className="absolute inset-0 overflow-hidden">
            <svg className="w-full h-full">
              {/* Connections */}
              {knowledgeNodes.map(node => (
                node.connections.map(connId => {
                  const connectedNode = knowledgeNodes.find(n => n.id === connId)
                  if (connectedNode) {
                    return (
                      <line
                        key={`${node.id}-${connId}`}
                        x1={node.position.x}
                        y1={node.position.y}
                        x2={connectedNode.position.x}
                        y2={connectedNode.position.y}
                        stroke="rgba(79,134,198,0.3)"
                        strokeWidth="1"
                        className="transition-all duration-300"
                      />
                    )
                  }
                  return null
                })
              ))}
              
              {/* Nodes */}
              {filteredNodes.map(node => (
                <g key={node.id}>
                  <circle
                    cx={node.position.x}
                    cy={node.position.y}
                    r={selectedNode?.id === node.id ? "25" : "20"}
                    className={`${getNodeColor(node.type)} cursor-pointer transition-all duration-300 hover:opacity-80`}
                    onClick={() => setSelectedNode(node)}
                  />
                  <text
                    x={node.position.x}
                    y={node.position.y + 35}
                    textAnchor="middle"
                    className="text-xs fill-white pointer-events-none"
                  >
                    {node.title}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80">
              <Card className="bg-[rgba(9,21,64,0.9)] border-[rgba(79,134,198,0.3)] backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-[#4f86c6] flex items-center justify-between">
                    {selectedNode.title}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedNode(null)}
                      className="text-white hover:text-amber-alert"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[#8aa8d2]">类型: </span>
                      <span className="text-white">{selectedNode.type}</span>
                    </div>
                    <div>
                      <span className="text-[#8aa8d2]">难度: </span>
                      <span className={getDifficultyColor(selectedNode.difficulty)}>
                        {selectedNode.difficulty}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8aa8d2]">分类: </span>
                      <span className="text-white">{selectedNode.category}</span>
                    </div>
                    <div>
                      <span className="text-[#8aa8d2]">资源: </span>
                      <span className="text-white">{selectedNode.resources}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-[#8aa8d2] mb-2">关联节点:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.connections.map(connId => {
                        const connectedNode = knowledgeNodes.find(n => n.id === connId)
                        return connectedNode ? (
                          <span 
                            key={connId}
                            className="px-2 py-1 bg-[rgba(79,134,198,0.2)] rounded text-xs text-white cursor-pointer hover:bg-[rgba(79,134,198,0.3)]"
                            onClick={() => setSelectedNode(connectedNode)}
                          >
                            {connectedNode.title}
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1 bg-[#4f86c6] hover:bg-[#3d6ba8]">
                      <Play className="mr-2 h-3 w-3" />
                      开始学习
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="mr-2 h-3 w-3" />
                      查看资源
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Control Panel */}
          <div className="absolute bottom-4 left-4 flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-[rgba(9,21,64,0.7)] border-[rgba(79,134,198,0.3)]"
            >
              <RotateCw className="mr-2 h-4 w-4" />
              重置视图
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-[rgba(9,21,64,0.7)] border-[rgba(79,134,198,0.3)]"
            >
              <Network className="mr-2 h-4 w-4" />
              3D视图
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}