import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { teacherCourseBasisCitationTargetId } from '@/lib/source-pack/teacher-course-basis';

const FIXTURE_TOKEN = 'smart-lesson-real-browser-v1';
const SOURCE_BINDINGS_MARKER = 'source-bindings-v1:';

type E2ESourceBindingMetadata = {
  sourceVersionId: string;
  bindings: Array<{ stableAnchor: string; contentHash: string }>;
};

export function encodeKonlingE2ESourceBindingsMetadata(metadata: E2ESourceBindingMetadata) {
  return `[${SOURCE_BINDINGS_MARKER}${Buffer.from(JSON.stringify(metadata)).toString('base64url')}]`;
}

export function parseKonlingE2ESourceBindingsMetadata(query: string): E2ESourceBindingMetadata | null {
  const encoded = query.match(/\[source-bindings-v1:([A-Za-z0-9_-]+)\]/)?.[1];
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as E2ESourceBindingMetadata;
    if (typeof parsed.sourceVersionId !== 'string' || !Array.isArray(parsed.bindings) || parsed.bindings.length < 3) return null;
    if (parsed.bindings.some((binding) => typeof binding.stableAnchor !== 'string'
      || typeof binding.contentHash !== 'string' || binding.contentHash.length < 16)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveKonlingE2EChatModel(environment?: Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'SMART_LESSON_E2E_FIXTURE_TOKEN'>>): LanguageModelV3 | null {
  const nodeEnv = environment ? environment.NODE_ENV : process.env.NODE_ENV;
  const token = environment ? environment.SMART_LESSON_E2E_FIXTURE_TOKEN : process.env.SMART_LESSON_E2E_FIXTURE_TOKEN;
  if (nodeEnv === 'production' || token !== FIXTURE_TOKEN) return null;
  return createKonlingE2EChatModel();
}

function createKonlingE2EChatModel(): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'konling-e2e-fixture',
    modelId: 'root-locus-prep-coauthor-v1',
    supportedUrls: {},
    async doGenerate(options) {
      const content = fixtureContent(options);
      return { content, finishReason: finishReason(content), usage: usage(), warnings: [] };
    },
    async doStream(options) {
      const content = fixtureContent(options);
      const parts: LanguageModelV3StreamPart[] = [{ type: 'stream-start', warnings: [] }];
      for (const item of content) {
        if (item.type === 'tool-call') parts.push(item);
        if (item.type === 'text') {
          parts.push({ type: 'text-start', id: 'fixture-text' });
          parts.push({ type: 'text-delta', id: 'fixture-text', delta: item.text });
          parts.push({ type: 'text-end', id: 'fixture-text' });
        }
      }
      parts.push({ type: 'finish', finishReason: finishReason(content), usage: usage() });
      return { stream: new ReadableStream({ start(controller) { parts.forEach((part) => controller.enqueue(part)); controller.close(); } }) };
    },
  };
}

function fixtureContent(options: LanguageModelV3CallOptions): LanguageModelV3Content[] {
  const proposalResultSeen = options.prompt.some((message) => message.role === 'tool'
    && message.content.some((part) => part.type === 'tool-result' && part.toolName === 'propose_smart_lesson_task_change'));
  if (proposalResultSeen) {
    return [{ type: 'text', text: '建议已保存，等待教师确认。' }];
  }
  const query = [...options.prompt].reverse().find((message) => message.role === 'user')?.content
    .filter((part) => part.type === 'text').map((part) => part.text).join('\n') ?? '';
  const ids = Object.fromEntries([...query.matchAll(/\b(courseBasisId|sourceVersionId|taskId)=([^\s;，。]+)/g)].map((match) => [match[1], match[2]]));
  const sourceMetadata = parseKonlingE2ESourceBindingsMetadata(query);
  let input: Record<string, unknown>;
  if (query.includes('修订约束')) {
    input = {
      operation: 'revise', taskId: ids.taskId, expectedRevision: 1,
      goalPatches: [{
        operation: 'update', id: currentGoalId(options),
        changes: { content: participatoryGoalContent() },
      }],
    };
  } else if (query.includes('选择幅值与相角条件')) {
    input = { operation: 'bootstrap', proposedTask: taskInput(ids.courseBasisId!, ids.sourceVersionId!, sourceMetadata) };
  } else {
    input = {
      operation: 'bootstrap',
      clarification: { question: '根轨迹课程应聚焦哪些判据？', alternatives: ['幅值与相角条件', '仅绘图规则'] },
    };
  }
  return [{
    type: 'tool-call', toolCallId: `root-locus-${query.includes('修订约束') ? 'revision' : query.includes('选择幅值') ? 'confirm' : 'clarification'}`,
    toolName: 'propose_smart_lesson_task_change', input: JSON.stringify(input),
  }];
}

function currentGoalId(options: LanguageModelV3CallOptions): string {
  const promptText = options.prompt.flatMap((message) => {
    if (typeof message.content === 'string') return [message.content];
    return message.content.flatMap((part) => part.type === 'text' ? [part.text] : []);
  }).join('\n');
  const encoded = promptText.match(/可用现有条目定位清单：(\{[^\n]+\})/)?.[1];
  if (!encoded) throw new Error('konling-e2e-fixture-current-task-collections-required');
  try {
    const collections = JSON.parse(encoded) as { goals?: Array<{ id?: unknown }> };
    const goalId = collections.goals?.[0]?.id;
    if (typeof goalId !== 'string' || !goalId) throw new Error('missing-goal-id');
    return goalId;
  } catch {
    throw new Error('konling-e2e-fixture-current-goal-id-required');
  }
}

function participatoryGoalContent() {
  return '根轨迹上的点满足开环相角为奇数倍180度；学生在至少20分钟参与式学习中运用此条件完成可执行判断活动。';
}

function taskInput(
  courseBasisId: string,
  sourceVersionId: string,
  metadata: E2ESourceBindingMetadata | null,
) {
  const bindings = metadata?.sourceVersionId === sourceVersionId
    ? metadata.bindings.slice(0, 3).map((binding) => ({
      citationId: teacherCourseBasisCitationTargetId({ courseBasisId, versionId: sourceVersionId, stableAnchor: binding.stableAnchor }),
      sourceVersionId,
      anchor: binding.stableAnchor,
      contentHash: binding.contentHash,
    }))
    : [];
  return {
    courseBasisId,
    topic: '根轨迹幅值条件、相角条件与基本绘图规则',
    audience: '自动化专业本科生', prerequisites: '传递函数', durationMinutes: 45,
    outlineConfirmationRequired: true, sourceVersionIds: [sourceVersionId],
    knowledgePoints: [
      { title: '根轨迹上的点满足开环相角为奇数倍180度。', content: '相角条件', sourceState: 'ai_generated_source_pending', sourceBindings: bindings.slice(0, 1), origin: 'SUGGESTED' },
      { title: '由幅值条件计算指定根轨迹点对应的增益。', content: '幅值条件', sourceState: 'ai_generated_source_pending', sourceBindings: bindings.slice(1, 2), origin: 'SUGGESTED' },
      { title: '分支起于开环极点并终止于开环零点或无穷远。', content: '基本绘图规则', sourceState: 'ai_generated_source_pending', sourceBindings: bindings.slice(2, 3), origin: 'SUGGESTED' },
    ],
    goals: [{
      content: '根轨迹上的点满足开环相角为奇数倍180度；学生运用此条件判断候选点。',
      sourceState: 'ai_generated_source_pending', sourceBindings: bindings.slice(0, 1), standardsMappings: [],
    }],
    confirmScope: true, confirmGoals: true,
  };
}

function finishReason(content: LanguageModelV3Content[]) {
  return { unified: content.some((item) => item.type === 'tool-call') ? 'tool-calls' as const : 'stop' as const, raw: undefined };
}

function usage(): LanguageModelV3Usage {
  return {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  };
}
