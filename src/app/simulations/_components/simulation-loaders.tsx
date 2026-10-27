'use client';

import dynamic from 'next/dynamic';

export const ContainerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/container-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-muted-foreground">
        正在加载 MSC 集装箱船航速与准点...
      </div>
    ),
  },
);

export const CruiseSimulation = dynamic(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-muted-foreground">
        正在加载爱达·魔都号邮轮横摇控制...
      </div>
    ),
  },
);

export const DestroyerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/destroyer-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-muted-foreground">
        正在加载 055 型驱逐舰航向控制...
      </div>
    ),
  },
);

export const DrillingSimulation = dynamic(
  () => import('@/resources/simulations/simulations/drilling-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-muted-foreground">
        正在加载海洋石油981动力定位...
      </div>
    ),
  },
);

export const LNGSimulation = dynamic(
  () => import('@/resources/simulations/simulations/lng-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-muted-foreground">
        正在加载长恒号 LNG 大惯性操纵...
      </div>
    ),
  },
);

export const DredgerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/dredger-simulation').then((module) => module.DredgerSimulation),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-muted-foreground">正在加载天鲸号挖泥船动力定位...</p>
          <p className="mt-2 text-sm text-muted-foreground/80">MMG 3-DOF 高保真模型初始化中</p>
        </div>
      </div>
    ),
  },
);

export const IcebreakerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/icebreaker-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-muted-foreground">正在加载雪龙号吊舱与冰区控制...</p>
          <p className="mt-2 text-sm text-muted-foreground/80">Azipod 3-DOF 模型 + 冰阻力模型初始化中</p>
        </div>
      </div>
    ),
  },
);
