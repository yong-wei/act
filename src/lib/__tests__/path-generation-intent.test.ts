import { expect, it } from 'vitest';
import { requestsLearningPathGeneration } from '../ai/path-generation-intent';

it.each([
  '请根据我的学习记录，直接生成根轨迹分析基础的学习路径。我有180分钟。',
  '帮我创建学习路径',
  'Please generate a learning path for frequency response.',
])('routes explicit creation: %s', (message) => expect(requestsLearningPathGeneration(message)).toBe(true));

it.each([
  '不要生成路径，先解释根轨迹。',
  '为什么生成路径失败了？',
  '如何生成学习路径？',
  '比较之前的学习路径',
  '请解释生成学习路径的原理',
  '我不想生成新的路径',
  '我昨天生成路径失败了',
  'Do not generate a learning path.',
])('does not create for discussion or negation: %s', (message) => expect(requestsLearningPathGeneration(message)).toBe(false));
