'use client';

/**
 * ExperimentArchive - 实验档案（右侧面板）
 */

import { Archive, Beaker, Scale, AlertTriangle, Star, Trophy, Activity, Wrench, Compass, Link2, Link2Off } from 'lucide-react';
import Link from 'next/link';
import type { AiCollectionEnvelope, AiExperimentItem } from '../ai-workshop-collections';

interface ExperimentArchiveProps {
  collection: AiCollectionEnvelope<AiExperimentItem>;
}

const typeConfig = {
  PID_TUNING: { icon: Beaker, label: 'PID 调参', color: 'text-foreground', bg: 'bg-muted' },
  ETHICS_SANDBOX: { icon: Scale, label: '伦理沙盘', color: 'text-foreground', bg: 'bg-muted' },
  ANOMALY_EVENT: { icon: AlertTriangle, label: '异常事件', color: 'text-foreground', bg: 'bg-muted' },
  ARENA_SUBMISSION: { icon: Trophy, label: 'Arena 提交', color: 'text-foreground', bg: 'bg-muted' },
  SCENE_SIMULATION: { icon: Activity, label: '场景仿真', color: 'text-foreground', bg: 'bg-muted' },
  CONTROL_WORKBENCH: { icon: Wrench, label: '控制工作台', color: 'text-foreground', bg: 'bg-muted' },
  ODYSSEY_RUN: { icon: Compass, label: '控制奥德赛', color: 'text-foreground', bg: 'bg-muted' },
};

export function ExperimentArchive({ collection }: ExperimentArchiveProps) {
  const experiments = collection.items;
  const scored = experiments.filter((experiment) => typeof experiment.score === 'number');

  return (
    <aside
      className="w-full max-w-none shrink-0 overflow-y-visible border-t border-border bg-card p-5 md:w-[20%] md:min-w-[240px] md:max-w-[300px] md:overflow-y-auto md:border-l md:border-t-0"
      data-ai-workshop-collection="experiments"
      data-ai-workshop-collection-state={collection.state}
    >
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Archive className="h-5 w-5" />
          实验档案
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">近期实验记录</p>
      </div>

      {/* 统计概览 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded border border-border bg-background p-3 text-center">
          <div className="text-2xl font-bold text-foreground" data-ai-workshop-metric="experiment-count">
            {collection.state === 'available'
              // 未知总数（截断）显示 N+，不得把窗口数伪装成精确总数（Codex R3 review）。
              ? collection.total ?? `${experiments.length}+`
              : collection.state === 'unavailable'
                ? '不可用'
                : '暂无'}
          </div>
          <div className="text-xs text-muted-foreground">实验总数</div>
        </div>
        <div className="rounded border border-border bg-background p-3 text-center">
          <div className="text-2xl font-bold text-foreground">
            {scored.length > 0
              ? Math.round(scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0) / scored.length)
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">平均分</div>
        </div>
      </div>

      {/* 实验记录列表 */}
      <div className="space-y-3">
        {collection.state === 'available' ? experiments.map((experiment) => {
          const config = typeConfig[experiment.type];
          const Icon = config.icon;
          const body = (
            <>
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-1.5 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-foreground" />
                  <span className="font-medium text-foreground">
                    {experiment.score ?? '—'}
                  </span>
                  {experiment.resultAuthority === 'preview' ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">非正式</span>
                  ) : null}
                </div>
              </div>

              <div className="font-medium text-foreground">{experiment.title}</div>

              <div className="mt-2 text-xs text-muted-foreground">
                {new Date(experiment.createdAt).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}来源：{experiment.sourceLabel}
              </div>

              {/* PID 参数预览 */}
              {experiment.type === 'PID_TUNING' && experiment.parameters ? (
                <div className="mt-2 flex gap-2 text-xs">
                  {Object.entries(experiment.parameters).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* 导航状态：已验证目标可进入；不可验证时受限展示，不生成死链（Issue #1912）。
                  卡片本身不是链接——主导航与被归并来源链接分别渲染，避免嵌套 <a>
                  破坏解析与 hydration（Codex R3 review）。 */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {experiment.navigation ? (
                  <Link
                    href={experiment.navigation.href}
                    aria-label={`${experiment.title}，${experiment.navigation.label}`}
                    className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-ai-workshop-experiment-navigation={experiment.navigation.href}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {experiment.navigation.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1" data-ai-workshop-experiment-navigation="restricted">
                    <Link2Off className="h-3.5 w-3.5" />
                    入口不可用
                  </span>
                )}
                {/* 被归并来源的已验证链路（Codex R2 review）：不因合并丢失 */}
                {(experiment.bridgedSources ?? []).map((bridged, index) => (
                  bridged.navigation ? (
                    <Link
                      key={`${bridged.sourceLabel}-${index}`}
                      href={bridged.navigation.href}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground underline-offset-2 hover:underline"
                      data-ai-workshop-experiment-bridged-source={bridged.sourceLabel}
                    >
                      {bridged.sourceLabel}
                    </Link>
                  ) : (
                    <span
                      key={`${bridged.sourceLabel}-${index}`}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                      data-ai-workshop-experiment-bridged-source={bridged.sourceLabel}
                    >
                      {bridged.sourceLabel}
                    </span>
                  )
                ))}
              </div>
            </>
          );

          return (
            <div
              key={experiment.id}
              data-ai-workshop-experiment-item={experiment.id}
              className="rounded border border-border bg-background p-4"
            >
              {body}
            </div>
          );
        }) : (
          <div className="rounded border border-border bg-muted p-4 text-sm text-muted-foreground" data-ai-workshop-empty="experiments">
            {collection.state === 'unavailable'
              ? collection.limitation ?? '仿真记录暂时不可用。'
              : '暂无已验证的仿真训练记录。'}
            <Link className="mt-3 inline-flex font-medium text-foreground underline" href={collection.action.href} data-ai-workshop-action="experiments">
              {collection.action.label}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
