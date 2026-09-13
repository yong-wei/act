/** Only explicit creation requests should force a mutating path tool. */
export function requestsLearningPathGeneration(message: string): boolean {
  if (/(?:不要|别|不必|无需|暂不|先不|不用|不想|不需要).{0,16}(?:生成|创建|规划)|(?:如何|怎么|为什么|是否|能否|解释|介绍|讨论|说明).{0,20}(?:生成|创建|规划)|(?:don't|do not|how to|why|whether)\b/iu.test(message)) return false;
  return /(?:^|[，。！？;\n])\s*(?:(?:请|帮我|为我|给我|直接|重新|我想|我希望|我要).{0,35})?(?:生成|创建|规划).{0,30}(?:学习)?路径/u.test(message)
    || /(?:^|[.!?\n])\s*(?:please\s+)?(?:generate|create|build)\b.{0,30}\blearning path\b/iu.test(message);
}
