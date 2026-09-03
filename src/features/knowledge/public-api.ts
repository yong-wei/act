/**
 * Knowledge 域公共边界：跨域调用方（如 AI runtime）只经此文件消费
 * candidate graph 的合同与访问策略；域内文件互访不受此约束。
 */

export {
  CANDIDATE_GRAPH_SUPPORT,
  CANDIDATE_RELEASE_SELECTOR,
} from './candidate-graph-contracts';
export {
  isCandidateGraphPubliclyActivated,
  resolveCandidateGraphAccess,
} from './candidate-graph-policy';
