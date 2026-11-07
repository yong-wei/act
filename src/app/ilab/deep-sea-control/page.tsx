import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * 旧 24 步综合课程退役入口（#2155）。
 *
 * 原实验已由七个独立实验取代；本页面不创建会话、不交换 ticket、
 * 不初始化任何仿真运行。
 */
export default function DeepSeaControlRetiredPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">旧综合实验已退役</h1>
      <p className="text-muted-foreground leading-relaxed">
        原「深海载体运动控制」24 步综合实验已于 2026 年 11 月退役，
        由七个独立船舶实验取代。请从仿真实验目录选择对应实验开始；
        历史成绩与报告仍由系统保留。
      </p>
      <Link
        href="/simulations"
        className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        前往七个独立实验
      </Link>
    </main>
  );
}
