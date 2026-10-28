'use client';

import dynamic from 'next/dynamic';

function SimulationBootScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      className="sim-boot-screen relative flex h-[560px] w-full items-center justify-center overflow-hidden rounded-lg lg:h-[calc(100vh-10rem)]"
      role="status"
      aria-live="polite"
      data-simulation-boot-screen
    >
      <div className="sim-boot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative h-36 w-36" aria-hidden="true">
          <span className="sim-boot-ring absolute inset-0 rounded-full" />
          <span className="sim-boot-ring absolute inset-0 rounded-full [animation-delay:0.9s]" />
          <span className="sim-boot-ring absolute inset-0 rounded-full [animation-delay:1.8s]" />
          <span className="absolute inset-[38%] rounded-full bg-platform-action-primary shadow-[0_0_40px_hsl(var(--platform-action-primary))]" />
        </div>
        <p className="mt-6 text-[11px] font-semibold tracking-[0.4em] text-platform-action-primary">虚拟仿真实验</p>
        <h2 className="mt-2 text-2xl font-bold tracking-wide">正在加载{title}...</h2>
        <p className="mt-2 text-sm opacity-70">{detail}</p>
        <div className="mt-6 h-px w-64 overflow-hidden bg-platform-action-primary/20">
          <div className="sim-boot-bar h-full w-full" />
        </div>
      </div>
    </div>
  );
}

export const ContainerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/container-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title=" MSC 集装箱船航速与准点" detail="正在准备航线、海况与推进系统" />,
  },
);

export const CruiseSimulation = dynamic(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title="爱达·魔都号邮轮横摇控制" detail="正在准备波浪谱与减摇鳍" />,
  },
);

export const DestroyerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/destroyer-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title=" 055 型驱逐舰航向控制" detail="正在准备舰体模型与航向控制器" />,
  },
);

export const DrillingSimulation = dynamic(
  () => import('@/resources/simulations/simulations/drilling-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title="海洋石油981动力定位" detail="正在准备推进器布置与环境载荷" />,
  },
);

export const LNGSimulation = dynamic(
  () => import('@/resources/simulations/simulations/lng-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title="长恒号 LNG 大惯性操纵" detail="正在准备大惯性船体与液货舱" />,
  },
);

export const DredgerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/dredger-simulation').then((module) => module.DredgerSimulation),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title="天鲸号挖泥船动力定位" detail="MMG 三自由度模型初始化中" />,
  },
);

export const IcebreakerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/icebreaker-simulation'),
  {
    ssr: false,
    loading: () => <SimulationBootScreen title="雪龙号吊舱与冰区控制" detail="吊舱推进与冰阻力模型初始化中" />,
  },
);
