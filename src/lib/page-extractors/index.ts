/**
 * 页面上下文提取器统一导出
 *
 * 所有页面类型特定的上下文提取器在此注册
 */

export {
  SimulationContextExtractor,
  simulationContextExtractor,
} from './simulation-extractor';

export {
  PracticeContextExtractor,
  practiceContextExtractor,
} from './practice-extractor';

// 导出类型
export type { SimulationRuntimeState } from './simulation-extractor';
export type { PracticeRuntimeState } from './practice-extractor';
