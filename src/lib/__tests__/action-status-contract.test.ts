import { describe, expect, it } from 'vitest';

import {
  createAuditedActionState,
  mapApiActionResult,
  mapHttpStatusToActionFailure,
  parseRouteActionQuery,
  type AuditedActionIdentity,
} from '../action-status-contract';

const identity: AuditedActionIdentity = {
  id: 'test-export',
  category: 'export',
  label: '导出报告',
  sourceRoute: '/teacher/reports',
  targetId: 'report-1',
};

describe('action status contract', () => {
  it('creates pending route action state from supported query action', () => {
    const state = parseRouteActionQuery({
      action: 'export',
      targetId: 'report-1',
      sourceRoute: '/teacher/reports',
    });

    expect(state).toMatchObject({
      status: 'pending',
      severity: 'info',
      identity: {
        category: 'export',
        label: '导出',
        targetId: 'report-1',
      },
    });
    expect(state?.announcement).toContain('导出处理中');
  });

  it('maps unsupported route action to recoverable unsupported state', () => {
    const state = parseRouteActionQuery({
      action: 'unknown-action',
      sourceRoute: '/admin/data-governance',
    });

    expect(state).toMatchObject({
      status: 'unsupported',
      severity: 'warning',
      identity: {
        category: 'unsupported-action',
        requestedAction: 'unknown-action',
      },
      recoveryAction: '返回页面默认状态',
    });
  });

  it('normalizes test route action to model-test category', () => {
    const state = parseRouteActionQuery({
      action: 'test',
      sourceRoute: '/admin/config',
    });

    expect(state).toMatchObject({
      status: 'pending',
      identity: {
        category: 'model-test',
        requestedAction: 'test',
        label: '模型测试',
      },
    });
  });

  it('maps successful API export to download state with filename', () => {
    const state = mapApiActionResult({
      identity,
      ok: true,
      status: 200,
      filename: 'report.csv',
    });

    expect(state).toMatchObject({
      status: 'succeeded',
      severity: 'success',
      downloadFilename: 'report.csv',
      nextAction: '查看下载文件',
    });
    expect(state.announcement).toContain('report.csv');
  });

  it('blocks successful download/export result without observable filename', () => {
    const state = mapApiActionResult({
      identity,
      ok: true,
      status: 200,
    });

    expect(state).toMatchObject({
      status: 'blocked',
      severity: 'warning',
      recoveryAction: '显示下载失败状态并重新生成文件',
    });
  });

  it('maps validation, permission, missing target, unsupported method, and server failures', () => {
    expect(mapHttpStatusToActionFailure(400, { error: '标题不能为空' })).toMatchObject({
      status: 'failed',
      message: '标题不能为空',
      recoveryAction: '检查输入后重试',
    });
    expect(mapHttpStatusToActionFailure(403)).toMatchObject({
      status: 'blocked',
      recoveryAction: '切换有权限的账号或返回工作台',
    });
    expect(mapHttpStatusToActionFailure(404)).toMatchObject({
      status: 'blocked',
      recoveryAction: '返回列表并刷新数据',
    });
    expect(mapHttpStatusToActionFailure(405)).toMatchObject({
      status: 'unsupported',
      recoveryAction: '返回页面提供的操作入口',
    });
    expect(mapHttpStatusToActionFailure(500)).toMatchObject({
      status: 'failed',
      recoveryAction: '稍后重试或联系管理员',
    });
  });

  it('keeps failed action context and accessible announcement', () => {
    const state = createAuditedActionState({
      identity,
      status: 'failed',
      message: '导出失败',
      recoveryAction: '稍后重试',
    });

    expect(state).toMatchObject({
      status: 'failed',
      severity: 'danger',
      recoveryAction: '稍后重试',
    });
    expect(state.announcement).toContain('导出报告失败');
  });
});
