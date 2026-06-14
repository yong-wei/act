'use client';

/**
 * 知识卡片组件
 * Knowledge Card Component for Lesson Phases
 * 用于在课程阶段中展示知识点
 */

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react';
import type { LessonKnowledgeCard } from './knowledge-cards-data';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { getBloomLabel, getKnowledgeDimLabel } from '@/lib/knowledge-labels';

/** 知识卡片颜色配置 */
const cardColors = {
  default: {
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

interface KnowledgeCardProps {
  /** 知识节点数据 */
  node: LessonKnowledgeCard;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否可关闭 */
  dismissible?: boolean;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** 自定义样式类 */
  className?: string;
  /** 变体：inline (内嵌) | sidebar (侧边栏) | floating (浮动) */
  variant?: 'inline' | 'sidebar' | 'floating';
}

/**
 * 将 LaTeX 公式转换为可读显示格式
 */
function formatLatex(latex: string): string {
  return latex
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\ddot\{([^}]+)\}/g, '$1̈')
    .replace(/\\dot\{([^}]+)\}/g, '$1̇')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\int/g, '∫')
    .replace(/\\sin/g, 'sin')
    .replace(/\\approx/g, '≈')
    .replace(/\\ll/g, '≪')
    .replace(/\\quad/g, '  ')
    .replace(/\\,/g, ' ')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
}

export function KnowledgeCard({
  node,
  defaultExpanded = false,
  dismissible = false,
  onDismiss,
  className = '',
  variant = 'inline',
}: KnowledgeCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colorConfig = cardColors.default;
  const bloomLabel = getBloomLabel(node.bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(node.knowledgeDim);
  const mdxPaths = Array.isArray(node.resources)
    ? node.resources
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const candidate = (item as { path?: string; url?: string }).path
              || (item as { path?: string; url?: string }).url;
            return typeof candidate === 'string' ? candidate : null;
          }
          return null;
        })
        .filter((path): path is string => !!path && path.endsWith('.mdx'))
    : [];

  // 根据变体确定基础样式
  const variantStyles = {
    inline: 'rounded-xl border',
    sidebar: 'rounded-xl border shadow-lg',
    floating: 'rounded-xl border shadow-2xl backdrop-blur',
  };

  return (
    <div
      className={`
        ${variantStyles[variant]}
        bg-slate-900/95
        transition-all duration-300
        ${className}
      `}
      style={{
        borderColor: `${colorConfig.color}40`,
      }}
    >
      {/* 卡片头部 */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div
          tabIndex={0}
          role="button"
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setIsExpanded((current) => !current);
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${colorConfig.color}20` }}
            >
              <BookOpen className="h-4 w-4" style={{ color: colorConfig.color }} />
            </div>
            <div className="min-w-0 space-y-1">
              <h4
                className="text-sm font-semibold"
                style={{ color: colorConfig.color }}
              >
                {node.name}
              </h4>
              <p className="text-xs text-slate-500">{node.lessonId}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {(bloomLabel || knowledgeLabel) && (
              <div className="flex flex-wrap justify-end gap-2">
                {bloomLabel && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                    认知：{bloomLabel}
                  </span>
                )}
                {knowledgeLabel && (
                  <span className="rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-200">
                    知识：{knowledgeLabel}
                  </span>
                )}
              </div>
            )}
            <div className="text-slate-500">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>

        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            aria-label="关闭知识卡片"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 定义（始终显示） */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-slate-300">{node.description}</p>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 pt-3">
          {/* 详细解释 */}
          <div className="mb-4">
            <p className="text-sm leading-relaxed text-slate-400">
              {node.explanation}
            </p>
          </div>

          {/* 公式（如果有） */}
          {node.formulaContinuous && (
            <div className="mb-4 rounded-lg bg-slate-800/50 p-3">
              <div className="mb-1 text-xs text-slate-500">核心公式</div>
              <code className="font-mono text-sm text-emerald-400">
                {formatLatex(node.formulaContinuous)}
              </code>
            </div>
          )}

          {/* 应用领域 */}
          {node.applications && node.applications.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-slate-500">应用领域</div>
              <div className="flex flex-wrap gap-2">
                {node.applications.map((app, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400"
                  >
                    {app}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mdxPaths.length > 0 && (
            <div className="pt-4">
              <div className="mb-2 text-xs text-slate-500">扩展内容</div>
              <div className="space-y-4">
                {mdxPaths.map((path) => (
                  <MdxSlide key={path} path={path} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 知识卡片侧边栏
 * 用于在课程阶段中作为侧边栏展示
 */
interface KnowledgeSidebarProps {
  /** 知识节点 */
  node: LessonKnowledgeCard;
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 位置 */
  position?: 'left' | 'right';
}

export function KnowledgeSidebar({
  node,
  isOpen,
  onClose,
  position = 'right',
}: KnowledgeSidebarProps) {
  if (!isOpen) return null;

  const positionClass = position === 'left' ? 'left-4' : 'right-4';

  return (
    <div
      className={`
        absolute top-4 ${positionClass} z-20 w-80
        animate-in slide-in-from-right-4
      `}
    >
      <KnowledgeCard
        node={node}
        defaultExpanded={true}
        dismissible={true}
        onDismiss={onClose}
        variant="floating"
      />
    </div>
  );
}

/**
 * 知识卡片触发按钮
 * 用于触发显示知识卡片
 */
interface KnowledgeCardTriggerProps {
  /** 按钮文字 */
  label?: string;
  /** 点击回调 */
  onClick: () => void;
  /** 颜色 */
  color?: string;
}

export function KnowledgeCardTrigger({
  label = '知识卡片',
  onClick,
  color = '#ef4444',
}: KnowledgeCardTriggerProps) {
  return (
    <button type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-700"
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      <BookOpen className="h-4 w-4" />
      {label}
    </button>
  );
}
