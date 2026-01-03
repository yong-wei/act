'use client';

/**
 * AIDynamicReport - AI动态报告
 *
 * AI生成课堂总结报告，展示班级数据。
 * 支持可编辑的报告模板、数据可视化类型和语音播报脚本。
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Award,
  AlertTriangle,
  Clock,
  Target,
  Mic,
  MicOff,
  Play,
  Pause,
  Edit3,
  Save,
  X,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AIDynamicReportConfig, BaseClassroomComponentProps } from './types';

export interface ClassData {
  totalStudents: number;
  completedStudents: number;
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  topPerformers: { name: string; score: number }[];
  commonMistakes: { description: string; count: number }[];
  averageTime: number;
  violationRate: number;
}

export interface AIDynamicReportProps extends BaseClassroomComponentProps<AIDynamicReportConfig> {
  /** 班级数据 */
  classData?: ClassData;
  /** 是否正在生成 */
  isGenerating?: boolean;
  /** 生成完成回调 */
  onGenerated?: () => void;
}

// 模拟班级数据
const MOCK_CLASS_DATA: ClassData = {
  totalStudents: 32,
  completedStudents: 28,
  averageScore: 78.5,
  scoreDistribution: [
    { range: '90-100', count: 6 },
    { range: '80-89', count: 10 },
    { range: '70-79', count: 7 },
    { range: '60-69', count: 4 },
    { range: '<60', count: 1 },
  ],
  topPerformers: [
    { name: '张三', score: 98 },
    { name: '李四', score: 95 },
    { name: '王五', score: 93 },
  ],
  commonMistakes: [
    { description: '比例系数Kp设置过大，导致超调量过高', count: 12 },
    { description: '忽略微分系数Kd的减振作用', count: 8 },
    { description: '积分系数Ki设置不当，导致稳态误差', count: 5 },
  ],
  averageTime: 85.3,
  violationRate: 15.6,
};

export function AIDynamicReport({
  config,
  mode = 'play',
  onConfigChange,
  classData = MOCK_CLASS_DATA,
  isGenerating = false,
  onGenerated,
}: AIDynamicReportProps) {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [editConfig, setEditConfig] = useState(config);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // 生成报告文本
  const generateReport = useCallback(() => {
    const { totalStudents, completedStudents, averageScore, violationRate } = classData;
    const completionRate = ((completedStudents / totalStudents) * 100).toFixed(1);

    // 基于模板生成报告
    let report = config.reportTemplate
      .replace('{totalStudents}', String(totalStudents))
      .replace('{completedStudents}', String(completedStudents))
      .replace('{completionRate}', completionRate)
      .replace('{averageScore}', averageScore.toFixed(1))
      .replace('{violationRate}', violationRate.toFixed(1));

    // 添加洞察
    if (averageScore >= 80) {
      report += '\n\n本节课整体表现优秀，同学们对舒适度控制的概念理解较为透彻。';
    } else if (averageScore >= 60) {
      report += '\n\n本节课基本达到教学目标，但部分同学仍需加强对阻尼调节原理的理解。';
    } else {
      report += '\n\n本节课需要重点关注，建议复习二阶系统响应特性相关内容。';
    }

    return report;
  }, [config.reportTemplate, classData]);

  // 模拟报告生成过程
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setReportText(generateReport());
            onGenerated?.();
            return 100;
          }
          return prev + 10;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isGenerating, generateReport, onGenerated]);

  // 初始加载报告
  useEffect(() => {
    if (!isGenerating && !reportText) {
      setReportText(generateReport());
    }
  }, [isGenerating, reportText, generateReport]);

  // 播放语音
  const handleTogglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
    // TODO: 集成TTS语音合成
  }, [isPlaying]);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    onConfigChange?.(editConfig);
    setIsEditing(false);
  }, [editConfig, onConfigChange]);

  // 成绩分布图表
  const ScoreDistributionChart = useMemo(() => {
    const maxCount = Math.max(...classData.scoreDistribution.map((d) => d.count));
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500'];

    return (
      <div className="space-y-2">
        {classData.scoreDistribution.map((item, index) => (
          <div key={item.range} className="flex items-center gap-3">
            <div className="w-16 text-xs text-slate-600 text-right">{item.range}</div>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[index]} transition-all duration-500`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
            <div className="w-8 text-xs font-medium text-slate-700">{item.count}</div>
          </div>
        ))}
      </div>
    );
  }, [classData.scoreDistribution]);

  if (isEditing) {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-blue-500" />
            编辑报告配置
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
            >
              <X className="h-4 w-4" />
              取消
            </button>
          </div>
        </div>

        {/* 编辑表单 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
            <input
              type="text"
              value={editConfig.title}
              onChange={(e) =>
                setEditConfig((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              报告模板
              <span className="text-xs text-slate-400 ml-2">
                可用变量: {'{totalStudents}'}, {'{completedStudents}'}, {'{completionRate}'}, {'{averageScore}'},{' '}
                {'{violationRate}'}
              </span>
            </label>
            <textarea
              value={editConfig.reportTemplate}
              onChange={(e) =>
                setEditConfig((prev) => ({ ...prev, reportTemplate: e.target.value }))
              }
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">可视化类型</label>
            <div className="flex gap-2">
              {['bar', 'pie', 'line'].map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setEditConfig((prev) => ({
                      ...prev,
                      visualizations: prev.visualizations.includes(type as never)
                        ? prev.visualizations.filter((v) => v !== type)
                        : [...prev.visualizations, type as never],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    editConfig.visualizations.includes(type as never)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {type === 'bar' && <BarChart3 className="h-4 w-4 inline mr-1" />}
                  {type === 'pie' && <PieChart className="h-4 w-4 inline mr-1" />}
                  {type === 'line' && <TrendingUp className="h-4 w-4 inline mr-1" />}
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableVoice"
              checked={editConfig.enableVoice}
              onChange={(e) =>
                setEditConfig((prev) => ({ ...prev, enableVoice: e.target.checked }))
              }
              className="rounded border-slate-300"
            />
            <label htmlFor="enableVoice" className="text-sm text-slate-700">
              启用语音播报
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* 标题 */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-violet-500" />
          <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
        </div>
        <p className="text-slate-600 text-sm">AI智能分析课堂学习数据</p>
      </div>

      {/* 生成进度 */}
      {isGenerating && generationProgress < 100 && (
        <div className="mb-6 p-4 bg-violet-50 rounded-xl border border-violet-200">
          <div className="flex items-center gap-3 mb-2">
            <RefreshCw className="h-5 w-5 text-violet-600 animate-spin" />
            <span className="text-violet-800 font-medium">正在生成课堂报告...</span>
          </div>
          <div className="h-2 bg-violet-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 核心指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <div className="text-2xl font-bold text-slate-900">
            {classData.completedStudents}/{classData.totalStudents}
          </div>
          <div className="text-xs text-slate-500">完成人数</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Award className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
          <div className="text-2xl font-bold text-slate-900">
            {classData.averageScore.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">平均分数</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Clock className="h-6 w-6 mx-auto mb-2 text-amber-500" />
          <div className="text-2xl font-bold text-slate-900">
            {classData.averageTime.toFixed(0)}s
          </div>
          <div className="text-xs text-slate-500">平均用时</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-500" />
          <div className="text-2xl font-bold text-slate-900">
            {classData.violationRate.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500">违规率</div>
        </div>
      </div>

      {/* AI 报告内容 */}
      <div className="mb-6 p-5 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-200">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-violet-500 rounded-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-violet-900 mb-2">AI 课堂分析</h3>
            <p className="text-slate-700 whitespace-pre-line">{reportText}</p>
          </div>
        </div>

        {/* 语音控制 */}
        {config.enableVoice && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-violet-200">
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isPlaying
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-violet-700 border border-violet-300'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  暂停播报
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  语音播报
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 成绩分布 */}
      {config.visualizations.includes('bar') && (
        <div className="mb-6 p-5 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900">成绩分布</h3>
          </div>
          {ScoreDistributionChart}
        </div>
      )}

      {/* 详细信息折叠 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        {showDetails ? (
          <>
            <ChevronUp className="h-4 w-4" />
            收起详情
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            查看详情
          </>
        )}
      </button>

      {/* 详细信息 */}
      {showDetails && (
        <div className="space-y-4 mt-4">
          {/* 优秀学员 */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-emerald-500" />
              <h4 className="font-medium text-slate-900">优秀学员</h4>
            </div>
            <div className="space-y-2">
              {classData.topPerformers.map((performer, index) => (
                <div
                  key={performer.name}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-amber-400 text-amber-900'
                          : index === 1
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-amber-700 text-amber-100'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-700">{performer.name}</span>
                  </div>
                  <span className="font-mono text-sm font-medium text-emerald-600">
                    {performer.score}分
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 常见错误 */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h4 className="font-medium text-slate-900">常见问题</h4>
            </div>
            <div className="space-y-2">
              {classData.commonMistakes.map((mistake) => (
                <div
                  key={mistake.description}
                  className="flex items-center justify-between p-2 bg-amber-50 rounded-lg"
                >
                  <span className="text-sm text-amber-800">{mistake.description}</span>
                  <span className="text-xs text-amber-600 font-medium">
                    {mistake.count}人
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 编辑按钮 */}
      {mode === 'edit' && !isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <Edit3 className="h-4 w-4" />
          编辑配置
        </button>
      )}
    </div>
  );
}

/**
 * 创建默认报告配置
 */
export function createDefaultReportConfig(id: string = 'report-default'): AIDynamicReportConfig {
  return {
    id,
    type: 'ai-report',
    title: '课堂学习报告',
    reportTemplate: `本节课共有 {totalStudents} 名同学参与学习，{completedStudents} 人完成全部任务，完成率 {completionRate}%。

班级平均分为 {averageScore} 分，伦理违规率 {violationRate}%。`,
    visualizations: ['bar', 'pie'],
    enableVoice: true,
    voiceScript: '',
  };
}

export default AIDynamicReport;
