'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Ship, Anchor, Compass, Snowflake, Fuel, Container, Waves, Play, BookOpen, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

// ============ 仿真数据定义 ============

interface SimulationInfo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  icon: LucideIcon;
  previewImage: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  controlFocus: string[];
  courseDesign: {
    overview: string;
    objectives: string[];
    keyPoints: string[];
  };
}

const simulations: SimulationInfo[] = [
  {
    id: 'destroyer',
    title: '052D驱逐舰',
    subtitle: 'Nomoto 船舶运动模型',
    description: '经典航向控制仿真，学习PID参数整定与船舶操纵性能分析。',
    href: '/simulations/destroyer',
    icon: Ship,
    previewImage: '/assets/destroyer.png',
    difficulty: 'beginner',
    tags: ['Nomoto模型', 'PID控制', '航向保持'],
    controlFocus: ['航向控制', '舵角响应', '转向特性'],
    courseDesign: {
      overview: '通过052D驱逐舰仿真，掌握船舶运动的基本数学模型和PID控制器设计方法。',
      objectives: [
        '理解Nomoto一阶船舶运动模型的物理意义',
        '掌握PID参数（Kp, Ki, Kd）对控制性能的影响',
        '分析船舶的K值（舵效）和T值（响应时间常数）',
        '完成航向保持和航迹跟踪任务',
      ],
      keyPoints: [
        '时间常数T表征船舶响应速度',
        '增益K表征舵效，即舵角对航向变化率的影响',
        '积分项消除稳态误差，但可能导致超调',
      ],
    },
  },
  {
    id: 'lng',
    title: 'LNG运输船',
    subtitle: '大型船舶操纵仿真',
    description: '模拟大型LNG运输船的操纵特性，体验惯性大、响应慢的控制挑战。',
    href: '/simulations/lng',
    icon: Fuel,
    previewImage: '/assets/Lng-carrier.png',
    difficulty: 'intermediate',
    tags: ['大惯性系统', '能源运输', '港口靠泊'],
    controlFocus: ['减速控制', '靠泊操作', '安全距离'],
    courseDesign: {
      overview: 'LNG运输船具有大吨位、低速、高惯性特点，是学习大惯性系统控制的典型案例。',
      objectives: [
        '理解大惯性系统的控制难点',
        '学习预测控制和提前量的概念',
        '掌握安全靠泊的速度控制策略',
        '分析风浪对大型船舶的影响',
      ],
      keyPoints: [
        '大型船舶停车距离长，需要提前减速',
        '低速时舵效降低，需辅助推进器',
        'PID参数需根据船舶吨位调整',
      ],
    },
  },
  {
    id: 'container',
    title: '集装箱货轮',
    subtitle: '高速航线运输仿真',
    description: '高速集装箱船的航线规划与经济航速控制，平衡效率与安全。',
    href: '/simulations/container',
    icon: Container,
    previewImage: '/assets/container.png',
    difficulty: 'intermediate',
    tags: ['航线规划', '经济航速', '定时到达'],
    controlFocus: ['速度控制', '航线跟踪', '油耗优化'],
    courseDesign: {
      overview: '集装箱船追求准时性和经济性，需要在速度、油耗和安全间寻找平衡。',
      objectives: [
        '学习航线规划的基本方法',
        '理解经济航速的概念和计算',
        '掌握定时到达控制策略',
        '分析风浪对航行时间的影响',
      ],
      keyPoints: [
        '航速与油耗呈非线性关系（约为速度的三次方）',
        '天气绕航可能更经济',
        '准时性与经济性需要权衡',
      ],
    },
  },
  {
    id: 'cruise',
    title: '邮轮',
    subtitle: '舒适性导向控制',
    description: '邮轮仿真着重乘客舒适度，学习减摇控制和平稳操纵策略。',
    href: '/simulations/cruise',
    icon: Anchor,
    previewImage: '/assets/luxury-liner.png',
    difficulty: 'intermediate',
    tags: ['舒适性控制', '减摇稳定', '平稳操纵'],
    controlFocus: ['横摇控制', '平稳转向', '加速度限制'],
    courseDesign: {
      overview: '邮轮以乘客体验为核心，控制系统需要在快速响应和舒适性间取得平衡。',
      objectives: [
        '理解舒适性与控制响应速度的矛盾',
        '学习加速度限制和jerk控制',
        '掌握减摇鳍/减摇水舱的工作原理',
        '设计平稳的转向和加减速曲线',
      ],
      keyPoints: [
        '人体对加速度变化率（jerk）敏感',
        'S形加减速曲线比线性更舒适',
        '横摇角速度比横摇角更影响舒适度',
      ],
    },
  },
  {
    id: 'drilling',
    title: '海洋石油981钻井平台',
    subtitle: '动力定位 DP 系统',
    description: '深水钻井平台DP系统仿真，学习8推进器解耦控制和位置保持。',
    href: '/simulations/drilling',
    icon: Compass,
    previewImage: '/assets/drilling-rig.png',
    difficulty: 'advanced',
    tags: ['动力定位', '解耦控制', '多推进器'],
    controlFocus: ['位置保持', '推力分配', '冗余设计'],
    courseDesign: {
      overview: '钻井平台需要在深海精确保持位置，是多自由度解耦控制的经典应用。',
      objectives: [
        '理解动力定位系统的3DOF耦合模型',
        '掌握推力分配算法（Thrust Allocation）',
        '学习解耦控制与标准PID的区别',
        '分析冗余推进器配置的意义',
      ],
      keyPoints: [
        'X-Y-Heading三自由度相互耦合',
        '8台推进器需要优化分配，避免相互抵消',
        '解耦控制将MIMO系统转化为多个SISO系统',
      ],
    },
  },
  {
    id: 'icebreaker',
    title: '雪龙2号极地科考破冰船',
    subtitle: 'Azipod 推进与冰阻力',
    description: '极地破冰船仿真，体验Azipod吊舱推进和冰区Stick-Slip阻力。',
    href: '/simulations/icebreaker',
    icon: Snowflake,
    previewImage: '/assets/icebreaker.png',
    difficulty: 'advanced',
    tags: ['Azipod推进', '冰阻力', '参数摄动'],
    controlFocus: ['推进角度', '破冰策略', '鲁棒控制'],
    courseDesign: {
      overview: '雪龙2号采用先进的Azipod推进系统，在冰区航行时船舶参数会显著变化。',
      objectives: [
        '理解Azipod吊舱推进器的工作原理',
        '学习冰阻力的Stick-Slip模型',
        '掌握参数摄动对控制系统的影响',
        '设计具有鲁棒性的控制器',
      ],
      keyPoints: [
        'Azipod可360度旋转，提供任意方向推力',
        '冰阻力具有非线性、时变特性',
        '破冰时K和T参数会显著变化，需要自适应控制',
      ],
    },
  },
  {
    id: 'dredger',
    title: '天鲸号自航绞吸挖泥船',
    subtitle: '多工况自适应控制',
    description: '挖泥船在疏浚、航行、定位等多工况间切换，学习模式切换控制。',
    href: '/simulations/dredger',
    icon: Waves,
    previewImage: '/assets/dredger.png',
    difficulty: 'advanced',
    tags: ['多工况', '模式切换', '自适应控制'],
    controlFocus: ['工况识别', '参数切换', '平滑过渡'],
    courseDesign: {
      overview: '挖泥船需要在多种工况间灵活切换，是自适应控制和模式切换控制的典型应用。',
      objectives: [
        '理解多工况系统的特点',
        '学习模式识别和切换策略',
        '掌握增益调度（Gain Scheduling）方法',
        '设计工况切换时的平滑过渡',
      ],
      keyPoints: [
        '不同工况下船舶动力学参数差异大',
        '工况切换需要避免控制器震荡',
        '增益调度是实现多工况控制的经典方法',
      ],
    },
  },
];

const difficultyColors = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const difficultyLabels = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '挑战',
};

// ============ 页面组件 ============

export default function SimulationsPage() {
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationInfo | null>(null);

  return (
    <div className="surface-page" data-commercial-workspace="simulations">
      <FeaturePageNav
        title="虚拟仿真实验室"
        backHref="/"
        backLabel="返回首页"
        rightSlot={(
          <Badge variant="outline" className="border-primary/50 text-primary">
            7 个仿真场景
          </Badge>
        )}
      />

      {/* 简介 */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="surface-card p-6">
          <h2 className="mb-2 text-lg font-medium text-foreground">船舶控制理论实践平台</h2>
          <p className="text-sm leading-relaxed text-subtle">
            通过7种典型船舶的3D仿真，深入理解自动控制原理在海洋工程中的应用。
            从经典PID到多自由度解耦控制，从单一工况到自适应控制，循序渐进掌握控制系统设计方法。
          </p>
        </div>
      </div>

      {/* 仿真卡片网格 */}
      <div className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {simulations.map((sim) => (
            <SimulationCard
              key={sim.id}
              simulation={sim}
              onLearnMore={() => setSelectedSimulation(sim)}
            />
          ))}
        </div>
      </div>

      {/* 课程设计模态框 */}
      <Dialog open={!!selectedSimulation} onOpenChange={() => setSelectedSimulation(null)}>
        <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
          {selectedSimulation && (() => {
            const SelectedIcon = selectedSimulation.icon;
            return (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <SelectedIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl text-foreground">{selectedSimulation.title}</DialogTitle>
                    <DialogDescription className="text-subtle">{selectedSimulation.subtitle}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* 概述 */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground/90">课程概述</h4>
                  <p className="text-sm leading-relaxed text-subtle">
                    {selectedSimulation.courseDesign.overview}
                  </p>
                </div>

                {/* 学习目标 */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground/90">学习目标</h4>
                  <ul className="space-y-2">
                    {selectedSimulation.courseDesign.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-subtle">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 要点提示 */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground/90">要点提示</h4>
                  <div className="space-y-2 rounded-lg bg-accent/45 p-4">
                    {selectedSimulation.courseDesign.keyPoints.map((point, i) => (
                      <p key={i} className="text-sm text-subtle">
                        <span className="mr-2 text-primary">#{i + 1}</span>
                        {point}
                      </p>
                    ))}
                  </div>
                </div>

                {/* 控制重点 */}
                <div className="flex flex-wrap gap-2">
                  {selectedSimulation.controlFocus.map((focus) => (
                    <Badge key={focus} variant="outline" className="border-border text-subtle">
                      {focus}
                    </Badge>
                  ))}
                </div>

                {/* 开始按钮 */}
                <div className="border-t border-border pt-4">
                  <Link href={selectedSimulation.href} prefetch={false}>
                    <Button className="cta-primary w-full">
                      <Play className="mr-2 h-4 w-4" />
                      开始仿真实验
                    </Button>
                  </Link>
                </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ 仿真卡片组件 ============

function SimulationCard({
  simulation,
  onLearnMore,
}: {
  simulation: SimulationInfo;
  onLearnMore: () => void;
}) {
  const Icon = simulation.icon;

  return (
    <Card className="surface-card group transition-all hover:border-primary/45 hover:bg-card/90">
      {/* 预览图区域 */}
      <div className="relative h-40 overflow-hidden bg-secondary/35">
        <Image
          src={simulation.previewImage}
          alt={`${simulation.title} 3D模型预览`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          priority={simulation.id === 'destroyer'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="absolute top-3 right-3">
          <Badge className={`${difficultyColors[simulation.difficulty]} border`}>
            {difficultyLabels[simulation.difficulty]}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3 rounded-md border border-border/50 bg-background/80 px-2 py-1 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/90">
            <Icon className="h-3 w-3 text-primary" />
            <span>3D 模型静态预览</span>
          </div>
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg text-foreground">{simulation.title}</CardTitle>
            <CardDescription className="text-subtle">{simulation.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="line-clamp-2 text-sm text-subtle">{simulation.description}</p>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5">
          {simulation.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="bg-accent text-subtle text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Link href={simulation.href} prefetch={false} className="flex-1">
            <Button className="cta-primary w-full" size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              开启任务链
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="btn-ghost-themed border"
            onClick={onLearnMore}
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            课程设计
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
