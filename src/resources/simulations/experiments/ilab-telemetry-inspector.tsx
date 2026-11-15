'use client';

import { ShieldCheck, Activity, Database, RefreshCw } from 'lucide-react';
import { ILAB_AI_DATA_KEYS } from '@/features/ilab/ai-data';
import { maskOriginId, type VesselAuditTelemetry } from '@/features/ilab/telemetry-redaction';
import { STEP_SCORE_DISTRIBUTION } from '../contracts/experiment-step';
import type { FrozenVesselStudentModel } from './student-analysis';
import type { VesselSample } from '../simulations/vessel-experiment';

const UPLOAD_MODE_LABELS: Record<VesselAuditTelemetry['uploadMode'], string> = {
  'local-only': '本机离线草稿',
  'dev-bypass': '开发验证通道',
  'ilab-remote': '实验空间远端回传',
};

const UPLOAD_STATUS_LABELS: Record<string, string> = {
  pending: '待回传',
  uploaded: '已同步回传',
  'score-uploaded': '成绩已传（待补证据）',
  failed: '回传待重试',
  skipped: '本机跳过远端回传',
};

export function IlabTelemetryToggleButton({
  open,
  onToggle,
  aiCallCount,
  chunkCount,
}: {
  open: boolean;
  onToggle: () => void;
  aiCallCount: number;
  chunkCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-ilab-telemetry-toggle
      className="inline-flex items-center gap-1.5 rounded-full border border-platform-border-subtle bg-platform-surface/80 px-2.5 py-1 text-[11px] font-medium text-platform-fg-primary transition hover:border-platform-accent/60"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
      <span>审计透视镜</span>
      <span className="font-mono text-[10px] text-platform-fg-secondary">
        AI:{aiCallCount} · {chunkCount}块
      </span>
    </button>
  );
}

/**
 * Read-only, redacted telemetry drawer pinned beside SimulationMissionTracker.
 */
export function IlabTelemetryDrawer({
  auditTelemetry,
  originId,
  doneSeqs,
  samples,
  models,
  controlSampleCount,
  tourActive = false,
  onRefresh,
}: {
  auditTelemetry?: VesselAuditTelemetry | null;
  originId?: string;
  doneSeqs: Set<number>;
  samples: VesselSample[];
  models: FrozenVesselStudentModel[];
  controlSampleCount?: number;
  tourActive?: boolean;
  onRefresh?: () => void;
}) {
  const maskedOrigin = auditTelemetry?.maskedOriginId ?? maskOriginId(originId ?? 'local');
  const aiData = auditTelemetry?.aiData ?? {
    ai_call_count: 0,
    ai_models_used: [],
    ai_usage_scenarios: [],
    ai_input_token_count: 0,
    ai_output_token_count: 0,
    ai_remark: '当前会话尚未产生可审计的服务端调用记录。',
  };
  const chunkCount = auditTelemetry?.persistedChunkCount;
  const weightSum = STEP_SCORE_DISTRIBUTION.reduce(
    (sum, weight, idx) => (doneSeqs.has(idx + 1) ? sum + weight : sum),
    0,
  );

  return (
    <div
      className="sim-hud-tile space-y-2.5 p-3 text-xs"
      data-ilab-telemetry-drawer
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-platform-border-subtle pb-2">
        <div className="inline-flex items-center gap-1.5 font-semibold text-platform-fg-primary">
          <Database className="h-3.5 w-3.5 text-sky-500" />
          <span>实验追溯与审计实时透视镜（只读脱敏）</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onRefresh && !tourActive ? (
            <button
              type="button"
              onClick={onRefresh}
              data-ilab-telemetry-refresh
              className="inline-flex items-center gap-1 rounded border border-platform-border-subtle bg-platform-canvas/60 px-1.5 py-0.5 text-[10px] font-medium text-platform-fg-secondary transition hover:border-platform-accent/60 hover:text-platform-fg-primary"
            >
              <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
              <span>刷新</span>
            </button>
          ) : null}
          <span className="rounded bg-slate-500/15 px-2 py-0.5 font-mono text-[10px] text-platform-fg-secondary">
            {tourActive
              ? '只读导览模式（禁止回传）'
              : UPLOAD_MODE_LABELS[auditTelemetry?.uploadMode ?? 'local-only']}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-platform-border-subtle/80 bg-platform-canvas/45 p-2">
          <div className="text-[10px] text-platform-fg-secondary">脱敏实验标识</div>
          <div className="mt-0.5 truncate font-mono font-semibold text-platform-fg-primary" data-audit-origin-id>
            {maskedOrigin}
          </div>
        </div>
        <div className="rounded border border-platform-border-subtle/80 bg-platform-canvas/45 p-2">
          <div className="text-[10px] text-platform-fg-secondary">{controlSampleCount !== undefined ? '本轮20Hz采样进度' : '曲线摘要采样'}</div>
          <div className="mt-0.5 font-mono font-semibold text-platform-fg-primary">
            {controlSampleCount ?? samples.length} 点 · 已存 {auditTelemetry?.totalSamplePoints ?? 0} 点
            {chunkCount !== undefined ? ` · ${chunkCount} 块` : ''}
          </div>
        </div>
        <div className="rounded border border-platform-border-subtle/80 bg-platform-canvas/45 p-2">
          <div className="text-[10px] text-platform-fg-secondary">20 步分值权重完成</div>
          <div className="mt-0.5 font-mono font-semibold text-platform-fg-primary">
            {doneSeqs.size}/20 步 · {weightSum}/100 分
          </div>
        </div>
        <div className="rounded border border-platform-border-subtle/80 bg-platform-canvas/45 p-2">
          <div className="text-[10px] text-platform-fg-secondary">同步回传状态</div>
          <div className="mt-0.5 font-medium text-platform-fg-primary">
            {UPLOAD_STATUS_LABELS[auditTelemetry?.uploadStatus ?? 'pending'] ?? auditTelemetry?.uploadStatus ?? '待同步'}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-medium text-platform-fg-secondary">
          20 步权重分布（共 100 分，高亮为已完成步骤）
        </div>
        <div className="grid grid-cols-10 gap-1">
          {STEP_SCORE_DISTRIBUTION.map((weight, index) => {
            const seq = index + 1;
            const done = doneSeqs.has(seq);
            return (
              <div
                key={seq}
                className={`rounded border px-1 py-0.5 text-center font-mono text-[10px] ${
                  done
                    ? 'border-emerald-500/50 bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-200'
                    : 'border-platform-border-subtle/70 text-platform-fg-secondary'
                }`}
              >
                {seq}:{weight}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-1 text-[11px] font-medium text-platform-fg-secondary">
          <Activity className="h-3 w-3" />
          <span>本人冻结模型摘要校验（{models.length} 份）</span>
        </div>
        {models.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {models.map((model) => (
              <span
                key={model.id}
                className="rounded border border-platform-border-subtle bg-platform-canvas/55 px-2 py-0.5 font-mono text-[10px] text-platform-fg-primary"
              >
                {model.label} · 摘要 {(model.contentHash ?? '待生成').slice(0, 10)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-platform-fg-secondary">尚未冻结本人辨识模型，完成前序辨识后自动记录摘要指纹。</p>
        )}
      </div>

      <div className="space-y-1 border-t border-platform-border-subtle pt-2" data-ilab-ai-data-grid>
        <div className="text-[11px] font-semibold text-platform-fg-primary">
          AI 使用合规账本（六项审计字段）
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[0]}</span>
            <div className="font-mono font-semibold text-platform-fg-primary">{aiData.ai_call_count} 次</div>
          </div>
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[3]}</span>
            <div className="font-mono font-semibold text-platform-fg-primary">{aiData.ai_input_token_count}</div>
          </div>
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[4]}</span>
            <div className="font-mono font-semibold text-platform-fg-primary">{aiData.ai_output_token_count}</div>
          </div>
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[1]}</span>
            <div className="truncate font-medium text-platform-fg-primary">
              {aiData.ai_models_used.length > 0
                ? aiData.ai_models_used.map((m) => `${m.model}(${m.deployment})`).join(' / ')
                : '尚未调用'}
            </div>
          </div>
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[2]}</span>
            <div className="truncate font-medium text-platform-fg-primary">
              {aiData.ai_usage_scenarios.length > 0 ? aiData.ai_usage_scenarios.join('、') : '—'}
            </div>
          </div>
          <div className="rounded border border-platform-border-subtle/70 px-2 py-1">
            <span className="font-mono text-[10px] text-platform-fg-secondary">{ILAB_AI_DATA_KEYS[5]}</span>
            <div className="truncate text-platform-fg-secondary" title={aiData.ai_remark}>
              {aiData.ai_remark}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-platform-fg-secondary">
          安全声明：仅展示脱敏运行标识与已记账用量，绝不呈现访问令牌、会话凭据或评分答案。
        </p>
      </div>
    </div>
  );
}
