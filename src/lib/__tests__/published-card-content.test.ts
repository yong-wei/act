import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPublishedLearnerCardByToken } from '../authority-domain-shards/learning-content';

describe('published card content formats', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'act-card-format-'));
    mkdirSync(join(root, 'course-content/runtime/knowledge/cards/nodes'), { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });
  function write(body: string, status = '') {
    const source = '---\nnode_id: example\n' + status + '\n---\n\n## 首页\n\n**一句话定义**：比较 $T_i$ 与 $|s|$。\n\n## 详情\n\n' + body;
    writeFileSync(join(root, 'course-content/runtime/knowledge/cards/nodes/example.md'), source);
    return 'content:' + createHash('sha256').update(source).digest('hex');
  }
  it('reads legacy detail prose and preserves mathematical symbols and Markdown', () => {
    const hash = write('保持 $T_i$ 与 $|s|$。\n\n### 常见误区\n\n**重点**：不能混淆两者。');
    expect(readPublishedLearnerCardByToken('example', hash)).toMatchObject({
      summary: '比较 $T_i$ 与 $|s|$。',
      explanation: '保持 $T_i$ 与 $|s|$。\n\n常见误区\n\n**重点**：不能混淆两者。',
    });
  });
  it('retains the full-explanation format and excludes relation metadata', () => {
    const hash = write('### 完整解释\n\n正确解释。\n\n### 关联节点\nctkg:private-id');
    expect(readPublishedLearnerCardByToken('example', hash)?.explanation).toBe('正确解释。');
  });
  it('keeps blocked cards and source hash mismatches unavailable', () => {
    const hash = write('正文。', 'status: draft-blocked');
    expect(readPublishedLearnerCardByToken('example', hash)).toBeNull();
    write('正文。');
    expect(readPublishedLearnerCardByToken('example', 'content:' + '0'.repeat(64))).toBeNull();
  });
  it('reads the core-definition and detail-page variant', () => {
    writeFileSync(join(root, 'course-content/runtime/knowledge/cards/nodes/example.md'),
      '---\nnode_id: example\n---\n\n## 首页\n核心定义：基波近似。\n\n## 详情页\n\n描述函数使用 $N(A)$。');
    expect(readPublishedLearnerCardByToken('example')).toMatchObject({
      summary: '基波近似。', explanation: '描述函数使用 $N(A)$。',
    });
  });
  it('does not project internal identifiers from a detail body', () => {
    const hash = write('内部来源 ctkg:private-id。');
    expect(readPublishedLearnerCardByToken('example', hash)).toBeNull();
    expect(readPublishedLearnerCardByToken('../example')).toBeNull();
  });
});
