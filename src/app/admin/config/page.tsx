'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Server,
  Bell,
  Shield,
  Save,
  RefreshCcw,
} from 'lucide-react';

interface SystemConfig {
  siteName: string;
  maintenanceMode: boolean;
  maxStudentsPerClass: number;
  defaultPassword: string;
  aiModelEndpoint: string;
  aiModelName: string;
  enableNotifications: boolean;
  ethicsAlertThreshold: number;
  homeDynamicModelEnabled: boolean;
}

export default function SystemConfigPage() {
  const [config, setConfig] = useState<SystemConfig>({
    siteName: 'AI-OBE 船舶智控平台',
    maintenanceMode: false,
    maxStudentsPerClass: 100,
    defaultPassword: '123456',
    aiModelEndpoint: '',
    aiModelName: '',
    enableNotifications: true,
    ethicsAlertThreshold: 3,
    homeDynamicModelEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/admin/platform-settings', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('加载配置失败');
        }
        const payload = await response.json() as { homeDynamicModelEnabled?: boolean };
        setConfig((prev) => ({
          ...prev,
          homeDynamicModelEnabled: payload.homeDynamicModelEnabled === true,
        }));
      } catch {
        setNotice({ type: 'error', message: '读取平台配置失败，已使用默认值' });
        setTimeout(() => setNotice(null), 3000);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeDynamicModelEnabled: config.homeDynamicModelEnabled,
        }),
      });
      if (!response.ok) {
        throw new Error('保存失败');
      }
      showNotice('success', '配置已保存');
    } catch {
      showNotice('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      siteName: 'AI-OBE 船舶智控平台',
      maintenanceMode: false,
      maxStudentsPerClass: 100,
      defaultPassword: '123456',
      aiModelEndpoint: '',
      aiModelName: '',
      enableNotifications: true,
      ethicsAlertThreshold: 3,
      homeDynamicModelEnabled: false,
    });
    showNotice('success', '已重置为默认配置');
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-800" />
          <div className="h-64 rounded-xl bg-slate-800" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* 头部 */}
      <header className="border-b border-cyan-500/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回管理后台
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">系统配置</h1>
              <p className="text-sm text-slate-400">管理平台全局参数和设置</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {notice && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            }`}
          >
            {notice.message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 基础设置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Server className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">基础设置</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  平台名称
                </label>
                <input
                  type="text"
                  value={config.siteName}
                  onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  默认密码
                </label>
                <input
                  type="text"
                  value={config.defaultPassword}
                  onChange={(e) => setConfig({ ...config, defaultPassword: e.target.value })}
                  placeholder="新账号默认密码"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">批量创建账号时使用的默认密码</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  每班最大学生数
                </label>
                <input
                  type="number"
                  value={config.maxStudentsPerClass}
                  onChange={(e) => setConfig({ ...config, maxStudentsPerClass: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={500}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">维护模式</p>
                  <p className="text-xs text-slate-500">开启后仅管理员可访问</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.maintenanceMode ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.maintenanceMode ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">首页动态模型渲染</p>
                  <p className="text-xs text-slate-500">关闭后首页仅显示静态图片，仿真页保持不变</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, homeDynamicModelEnabled: !config.homeDynamicModelEnabled })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.homeDynamicModelEnabled ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.homeDynamicModelEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* AI 模型配置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Server className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">AI 模型配置</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  API 端点
                </label>
                <input
                  type="text"
                  value={config.aiModelEndpoint}
                  onChange={(e) => setConfig({ ...config, aiModelEndpoint: e.target.value })}
                  placeholder="https://api.siliconflow.cn/v1"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  模型名称
                </label>
                <input
                  type="text"
                  value={config.aiModelName}
                  onChange={(e) => setConfig({ ...config, aiModelName: e.target.value })}
                  placeholder="deepseek-ai/DeepSeek-V4-Flash"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                AI 模型用于智能教学助手和答疑功能。如需更改，请同步更新环境变量。
              </p>
            </div>
          </div>

          {/* 通知设置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">通知设置</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">启用通知</p>
                  <p className="text-xs text-slate-500">系统消息和预警通知</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, enableNotifications: !config.enableNotifications })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.enableNotifications ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.enableNotifications ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 伦理监测 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">伦理监测</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  预警阈值
                </label>
                <input
                  type="number"
                  value={config.ethicsAlertThreshold}
                  onChange={(e) => setConfig({ ...config, ethicsAlertThreshold: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  当学生违规次数达到此值时触发预警
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            重置为默认
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </main>
  );
}
