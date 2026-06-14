'use client';

/**
 * VideoComponent - 视频播放课堂组件
 *
 * 支持：
 * - 视频URL播放或占位符图片显示
 * - 分屏对比模式（水平/垂直）
 * - AI旁白文本显示
 * - 编辑模式下的配置表单
 */

import { useState, useRef, useEffect, useId } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  LayoutGrid,
  ImageIcon,
  MessageSquare,
  Settings,
} from 'lucide-react';
import type {
  VideoComponentConfig,
  BaseClassroomComponentProps,
  SplitMode,
} from './types';

type VideoComponentProps = BaseClassroomComponentProps<VideoComponentConfig>;

// Temporary accessibility exception: dynamic classroom media has no caption asset field yet.
// Owner: classroom runtime. Remove this placeholder when media metadata carries caption URLs.
const TEMPORARY_CAPTION_TRACK_SRC = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00:00.000%20--%3E%2000:00:05.000%0A%E6%9A%82%E6%97%A0%E5%8F%AF%E7%94%A8%E5%AD%97%E5%B9%95%EF%BC%9B%E8%AF%B7%E6%95%99%E5%B8%88%E4%B8%BA%E6%AD%A3%E5%BC%8F%E5%AA%92%E4%BD%93%E8%A1%A5%E5%85%85%E5%AD%97%E5%B9%95%E8%B5%84%E4%BA%A7%E3%80%82';

// ========== 编辑模式组件 ==========

function VideoEditor({
  config,
  onConfigChange,
}: {
  config: VideoComponentConfig;
  onConfigChange?: (config: VideoComponentConfig) => void;
}) {
  const idPrefix = useId();
  const titleId = `${idPrefix}-video-title`;
  const sourceTypeId = `${idPrefix}-video-source-type`;
  const primarySourceId = `${idPrefix}-video-primary-source`;
  const splitModeId = `${idPrefix}-video-split-mode`;
  const secondarySourceId = `${idPrefix}-video-secondary-source`;
  const descriptionId = `${idPrefix}-video-description`;
  const narrationId = `${idPrefix}-video-narration`;

  const updateConfig = (updates: Partial<VideoComponentConfig>) => {
    onConfigChange?.({ ...config, ...updates });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 text-blue-400 mb-4">
        <Settings className="h-4 w-4" />
        <span className="font-medium">视频组件配置</span>
      </div>

      {/* 标题 */}
      <div>
        <label htmlFor={titleId} className="block text-sm text-slate-400 mb-1">视频标题</label>
        <input id={titleId}
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
          placeholder="输入视频标题"
        />
      </div>

      {/* 来源类型 */}
      <div>
        <label htmlFor={sourceTypeId} className="block text-sm text-slate-400 mb-1">来源类型</label>
        <select id={sourceTypeId}
          value={config.sourceType}
          onChange={(e) =>
            updateConfig({ sourceType: e.target.value as 'url' | 'placeholder' })
          }
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="placeholder">占位符（图片+描述）</option>
          <option value="url">视频URL</option>
        </select>
      </div>

      {/* 主视频/占位符 */}
      <div>
        <label htmlFor={primarySourceId} className="block text-sm text-slate-400 mb-1">
          {config.sourceType === 'url' ? '主视频URL' : '占位符图片URL'}
        </label>
        <input id={primarySourceId}
          type="text"
          value={config.primarySource}
          onChange={(e) => updateConfig({ primarySource: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
          placeholder={config.sourceType === 'url' ? 'https://...' : '/images/placeholder.jpg'}
        />
      </div>

      {/* 分屏模式 */}
      <div>
        <label htmlFor={splitModeId} className="block text-sm text-slate-400 mb-1">分屏模式</label>
        <select id={splitModeId}
          value={config.splitMode}
          onChange={(e) => updateConfig({ splitMode: e.target.value as SplitMode })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="none">单屏</option>
          <option value="horizontal">水平分屏（左右）</option>
          <option value="vertical">垂直分屏（上下）</option>
        </select>
      </div>

      {/* 副视频（分屏模式） */}
      {config.splitMode !== 'none' && (
        <div>
          <label htmlFor={secondarySourceId} className="block text-sm text-slate-400 mb-1">
            {config.sourceType === 'url' ? '副视频URL' : '副占位符图片URL'}
          </label>
          <input id={secondarySourceId}
            type="text"
            value={config.secondarySource || ''}
            onChange={(e) => updateConfig({ secondarySource: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
            placeholder={config.sourceType === 'url' ? 'https://...' : '/images/placeholder2.jpg'}
          />
        </div>
      )}

      {/* 描述（占位符模式） */}
      {config.sourceType === 'placeholder' && (
        <div>
          <label htmlFor={descriptionId} className="block text-sm text-slate-400 mb-1">视频描述</label>
          <textarea id={descriptionId}
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
            rows={3}
            placeholder="描述视频内容..."
          />
        </div>
      )}

      {/* AI旁白 */}
      <div>
        <label htmlFor={narrationId} className="block text-sm text-slate-400 mb-1">AI旁白文本</label>
        <textarea id={narrationId}
          value={config.narration || ''}
          onChange={(e) => updateConfig({ narration: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
          rows={2}
          placeholder="AI将朗读的旁白文本..."
        />
      </div>

      {/* 选项 */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.autoPlay || false}
            onChange={(e) => updateConfig({ autoPlay: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-blue-500"
          />
          自动播放
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={config.autoAdvance || false}
            onChange={(e) => updateConfig({ autoAdvance: e.target.checked })}
            className="rounded border-slate-600 bg-slate-900 text-blue-500"
          />
          播放完成后继续
        </label>
      </div>
    </div>
  );
}

// ========== 视频面板组件 ==========

function VideoPanel({
  source,
  sourceType,
  description,
  label,
}: {
  source: string;
  sourceType: 'url' | 'placeholder';
  description?: string;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [imageError, setImageError] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (sourceType === 'placeholder') {
    return (
      <div className="relative h-full bg-slate-900 rounded-lg overflow-hidden">
        {/* 占位符背景 */}
        {source && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt="Video placeholder"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        )}

        {/* 标签 */}
        {label && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 rounded text-xs text-slate-300">
            {label}
          </div>
        )}

        {/* 占位符图标和描述 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <ImageIcon className="h-12 w-12 text-slate-500 mb-4" />
          <p className="text-slate-400 text-sm max-w-md">
            {description || '视频内容占位符 - 后续将替换为真实视频'}
          </p>
        </div>

        {/* 播放按钮（装饰性） */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-8 w-8 text-white/70" />
          </div>
        </div>
      </div>
    );
  }

  // 视频URL模式
  return (
    <div className="relative h-full bg-black rounded-lg overflow-hidden group">
      {label && (
        <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-black/50 rounded text-xs text-slate-300">
          {label}
        </div>
      )}

      <video
        aria-label={label || '课堂视频'}
        ref={videoRef}
        src={source}
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
      >
        <track kind="captions" srcLang="zh-CN" label="中文说明" src={TEMPORARY_CAPTION_TRACK_SRC} />
      </video>

      {/* 控制栏 */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={togglePlay}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-white" />
            ) : (
              <Play className="h-4 w-4 text-white" />
            )}
          </button>
          <button type="button"
            onClick={toggleMute}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-white" />
            ) : (
              <Volume2 className="h-4 w-4 text-white" />
            )}
          </button>
          <div className="flex-1" />
          <button type="button" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <Maximize className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 播放模式组件 ==========

function VideoPlayer({ config }: { config: VideoComponentConfig }) {
  const [showNarration, setShowNarration] = useState(true);

  const renderVideoContent = () => {
    if (config.splitMode === 'none') {
      return (
        <VideoPanel
          source={config.primarySource}
          sourceType={config.sourceType}
          description={config.description}
        />
      );
    }

    const isHorizontal = config.splitMode === 'horizontal';

    return (
      <div
        className={`grid gap-2 h-full ${
          isHorizontal ? 'grid-cols-2' : 'grid-rows-2'
        }`}
      >
        <VideoPanel
          source={config.primarySource}
          sourceType={config.sourceType}
          description={config.description}
          label="对比A"
        />
        <VideoPanel
          source={config.secondarySource || ''}
          sourceType={config.sourceType}
          description={config.description}
          label="对比B"
        />
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {config.splitMode !== 'none' && (
            <LayoutGrid className="h-4 w-4 text-blue-400" />
          )}
          <h3 className="font-medium text-white">{config.title}</h3>
        </div>
        {config.narration && (
          <button type="button"
            onClick={() => setShowNarration(!showNarration)}
            className={`p-1.5 rounded-md transition-colors ${
              showNarration
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-700 text-slate-400'
            }`}
            title="显示/隐藏旁白"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 视频区域 */}
      <div className="flex-1 p-4">{renderVideoContent()}</div>

      {/* AI旁白 */}
      {config.narration && showNarration && (
        <div className="px-4 py-3 bg-blue-500/10 border-t border-blue-500/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-blue-400 mb-1">AI 旁白</div>
              <p className="text-sm text-slate-300 leading-relaxed">
                &ldquo;{config.narration}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 主组件 ==========

export function VideoComponent({
  mode,
  config,
  onConfigChange,
}: VideoComponentProps) {
  const effectiveMode = mode ?? 'play';
  const effectiveConfig = config
    ? { ...createDefaultVideoConfig(config.id), ...config }
    : createDefaultVideoConfig('video-default');

  if (effectiveMode === 'edit') {
    return <VideoEditor config={effectiveConfig} onConfigChange={onConfigChange} />;
  }

  return <VideoPlayer config={effectiveConfig} />;
}

// ========== 默认配置 ==========

export function createDefaultVideoConfig(id: string): VideoComponentConfig {
  return {
    id,
    type: 'video',
    title: '教学视频',
    sourceType: 'placeholder',
    primarySource: '',
    splitMode: 'none',
    narration: '',
    description: '',
    autoPlay: false,
    autoAdvance: false,
  };
}
