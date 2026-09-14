import { loadLiveTeachingPrerequisiteEdges } from './live-teaching-prerequisites';
import { loadPlanningKnowledgeLabels } from './planning-resource-titles';
import { loadCurrentResourceBindingRelease } from '@/lib/resource-binding-release/store';

/** 进程启动时把高频规划索引读进内存。失败不阻断启动。 */
export function warmupPlanningIndexes(repoRoot = process.cwd()): void {
  try {
    loadPlanningKnowledgeLabels(repoRoot);
    loadLiveTeachingPrerequisiteEdges(repoRoot);
    loadCurrentResourceBindingRelease(repoRoot);
  } catch {
    // 作者态包或绑定指针未就绪时由请求路径再失败关闭。
  }
}
