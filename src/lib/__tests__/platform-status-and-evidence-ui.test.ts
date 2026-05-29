import { describe, expect, it } from 'vitest';

import {
  PLATFORM_STATUS_INTEGRATION_CONTRACTS,
  PLATFORM_STATUS_RENDERING_CONTRACTS,
  PLATFORM_STATUS_TOKEN_MAP,
  buildPlatformStatusViewModel,
  filterPlatformStatusDetailsForRole,
  type PlatformStatusPayload,
} from '@/components/platform/platform-ui-contracts';
import {
  PlatformStatusChip,
  PlatformStatusDetailPanel,
  PlatformStatusEmptyState,
  PlatformStatusErrorState,
  PlatformStatusInlineExplanation,
} from '@/components/platform/status-and-evidence';

interface ReactElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function asElement(value: unknown): ReactElementLike {
  return value as ReactElementLike;
}

function childElements(children: unknown): ReactElementLike[] {
  const values = Array.isArray(children) ? children : [children];
  return values.filter((child): child is ReactElementLike => Boolean(child) && typeof child === 'object');
}

function textFrom(element: unknown): string {
  if (element === null || element === undefined || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(textFrom).join('');
  if (typeof element === 'object') {
    return textFrom((element as ReactElementLike).props?.children);
  }
  return '';
}

describe('platform status and evidence UI contracts', () => {
  const payload: PlatformStatusPayload = {
    id: 'arena-preview',
    label: 'Arena 预览评分',
    categories: {
      confidence: 'low',
      sourceCoverage: 'partial',
      privacy: 'restricted',
      replay: 'stale',
      protocol: 'preview',
      evaluation: 'preview',
      readiness: 'degraded',
      fallback: 'fallback-active',
    },
    summary: '预览评分使用部分证据，不能替代正式评价。',
    source: { domain: 'arena', capability: 'official-submit-feedback' },
    details: [
      { label: '学生可见摘要', value: '可展示为预览评分', roleScope: 'student-visible' },
      { label: '教师判读', value: '证据覆盖不完整', roleScope: 'teacher-scoped' },
      { label: '原始答案', value: 'answer=hidden', roleScope: 'system-internal', restricted: true },
    ],
    fallbackReason: '证据覆盖不足，已降级为预览口径。',
  };

  it('maps status categories to shared labels, tones, and platform tokens', () => {
    const viewModel = buildPlatformStatusViewModel(payload, { role: 'teacher' });

    expect(viewModel.summaryLabel).toBe('低置信 · 部分覆盖 · 受限 · 回放过期 · 预览协议 · 预览评价 · 降级可用 · 已使用回退');
    expect(viewModel.tone).toBe('warning');
    expect(viewModel.tokenNames).toEqual(
      expect.arrayContaining([
        'platform-evidence-context',
        'platform-privacy-restricted',
        'platform-replay-partial',
        'platform-evaluation-preview',
        'platform-action-subtle',
      ]),
    );
    expect(PLATFORM_STATUS_TOKEN_MAP.confidence.low).toBe('platform-evidence-context');
    expect(PLATFORM_STATUS_TOKEN_MAP.fallback['fallback-active']).toBe('platform-action-subtle');
  });

  it('filters details by role scope and masks restricted payloads', () => {
    expect(filterPlatformStatusDetailsForRole(payload.details, 'student')).toEqual([
      { label: '学生可见摘要', value: '可展示为预览评分', roleScope: 'student-visible' },
    ]);

    expect(filterPlatformStatusDetailsForRole(payload.details, 'teacher')).toEqual([
      { label: '学生可见摘要', value: '可展示为预览评分', roleScope: 'student-visible' },
      { label: '教师判读', value: '证据覆盖不完整', roleScope: 'teacher-scoped' },
    ]);

    expect(filterPlatformStatusDetailsForRole(payload.details, 'admin')).toContainEqual({
      label: '原始答案',
      value: '受限内容不可在当前界面展示',
      roleScope: 'system-internal',
      restricted: true,
    });
  });

  it('keeps audit-only details out of ordinary admin product views', () => {
    const details = [
      { label: '学生摘要', value: '可见', roleScope: 'student-visible' },
      { label: '教师摘要', value: '教师可见', roleScope: 'teacher-scoped' },
      { label: '管理摘要', value: '管理可见', roleScope: 'admin-scoped' },
      { label: '审计轨迹', value: 'audit-trail-id', roleScope: 'audit-only' },
    ] as const;

    expect(filterPlatformStatusDetailsForRole(details, 'admin').map((detail) => detail.label)).toEqual([
      '学生摘要',
      '教师摘要',
      '管理摘要',
    ]);
    expect(filterPlatformStatusDetailsForRole(details, 'audit').map((detail) => detail.label)).toEqual([
      '学生摘要',
      '教师摘要',
      '管理摘要',
      '审计轨迹',
    ]);
  });

  it('fails closed for system-internal details even when restricted is omitted', () => {
    const details = filterPlatformStatusDetailsForRole(
      [
        { label: '内部评分链', value: 'raw-answer=42', roleScope: 'system-internal' },
      ],
      'admin',
    );

    expect(details).toEqual([
      {
        label: '内部评分链',
        value: '受限内容不可在当前界面展示',
        roleScope: 'system-internal',
        restricted: true,
      },
    ]);
  });

  it('does not render success tone when replay or protocol context is missing', () => {
    const viewModel = buildPlatformStatusViewModel(
      {
        id: 'official-with-missing-context',
        label: '正式评价状态',
        categories: {
          confidence: 'high',
          sourceCoverage: 'complete',
          privacy: 'public',
          replay: 'missing',
          protocol: 'missing',
          evaluation: 'official',
          readiness: 'ready',
          fallback: 'none',
        },
        source: { domain: 'arena', capability: 'official-submit-feedback' },
      },
      { role: 'teacher' },
    );

    expect(viewModel.summaryLabel).toContain('缺少回放');
    expect(viewModel.summaryLabel).toContain('缺少协议');
    expect(viewModel.tone).toBe('danger');
  });

  it('does not render success tone when source coverage is unsupported', () => {
    const viewModel = buildPlatformStatusViewModel(
      {
        id: 'official-with-unsupported-source',
        label: '正式评价状态',
        categories: {
          confidence: 'high',
          sourceCoverage: 'unsupported',
          privacy: 'public',
          replay: 'ready',
          protocol: 'current',
          evaluation: 'official',
          readiness: 'ready',
          fallback: 'none',
        },
        source: { domain: 'simulation', capability: 'legacy-source' },
      },
      { role: 'teacher' },
    );

    expect(viewModel.summaryLabel).toContain('来源不支持');
    expect(viewModel.tone).toBe('danger');
  });

  it('renders compact, inline, detail, empty, and error primitives from governed payloads', () => {
    const chip = asElement(PlatformStatusChip({ payload, role: 'teacher' }));
    expect(textFrom(chip)).toContain('低置信');
    expect(chip.props?.className).toContain('border-platform-evidence-context');

    const inline = asElement(PlatformStatusInlineExplanation({ payload, role: 'teacher' }));
    expect(textFrom(inline)).toContain('预览评分使用部分证据');
    expect(textFrom(inline)).toContain('证据覆盖不足');

    const detail = asElement(PlatformStatusDetailPanel({ payload, role: 'teacher' }));
    expect(textFrom(detail)).toContain('教师判读');
    expect(textFrom(detail)).not.toContain('answer=hidden');

    const empty = asElement(PlatformStatusEmptyState({ title: '暂无证据', description: '等待学生提交后生成状态。' }));
    expect(textFrom(empty)).toContain('暂无证据');

    const error = asElement(PlatformStatusErrorState({ title: '状态不可用', description: '协议版本无法读取。' }));
    expect(textFrom(error)).toContain('状态不可用');
  });

  it('declares integration and rendering contracts without deriving domain truth', () => {
    expect(PLATFORM_STATUS_RENDERING_CONTRACTS.map((contract) => contract.variant)).toEqual([
      'compact-chip',
      'inline-explanation',
      'detail-panel',
      'audit-row',
      'empty-state',
      'error-state',
    ]);

    expect(PLATFORM_STATUS_INTEGRATION_CONTRACTS.map((contract) => contract.domain)).toEqual(
      expect.arrayContaining([
        'simulation',
        'arena',
        'learner-state',
        'path',
        'konling',
        'resource-node',
        'experiment',
      ]),
    );

    for (const contract of PLATFORM_STATUS_INTEGRATION_CONTRACTS) {
      expect(contract.sharedPrimitiveRule).toContain('display-only');
      expect(contract.domainOwnership).toContain('computes');
    }
  });
});
