import type { ControlTheoryNode, ViewState } from './types';

type FilterState = Pick<
  ViewState,
  'showTimeDomain' | 'showFreqDomain' | 'showContinuous' | 'showDiscrete' | 'searchQuery'
>;

export type ControlMapFilterKey = 'showTimeDomain' | 'showFreqDomain' | 'showContinuous' | 'showDiscrete';

export const CONTROL_MAP_FILTER_GROUPS: readonly (readonly ControlMapFilterKey[])[] = [
  ['showTimeDomain', 'showFreqDomain'],
  ['showContinuous', 'showDiscrete'],
];

export function matchesControlMapSearch(node: ControlTheoryNode, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return node.nameCn.includes(trimmed) || node.name.toLowerCase().includes(lower) || node.definition.includes(trimmed);
}

export function isControlNodeVisible(node: ControlTheoryNode, state: FilterState) {
  const matchesDomain =
    (state.showTimeDomain && (node.domain === 'time' || node.domain === 'both')) ||
    (state.showFreqDomain && (node.domain === 'frequency' || node.domain === 'both'));
  const matchesTime =
    (state.showContinuous && (node.timeType === 'continuous' || node.timeType === 'both')) ||
    (state.showDiscrete && (node.timeType === 'discrete' || node.timeType === 'both'));
  return matchesDomain && matchesTime && matchesControlMapSearch(node, state.searchQuery);
}

/** 当前有搜索词时，返回同时满足筛选与搜索的节点，按数据顺序排列。 */
export function findControlMapSearchMatches(nodes: readonly ControlTheoryNode[], state: FilterState) {
  if (!state.searchQuery.trim()) return [];
  return nodes.filter((node) => isControlNodeVisible(node, state));
}

/** 每个筛选组至少保留一项：关闭组内最后一项的请求被忽略。 */
export function toggleControlMapFilter(state: FilterState, key: ControlMapFilterKey): Partial<ViewState> {
  const group = CONTROL_MAP_FILTER_GROUPS.find((keys) => keys.includes(key)) ?? [key];
  const activeCount = group.filter((groupKey) => state[groupKey]).length;
  if (state[key] && activeCount <= 1) return {};
  return { [key]: !state[key] };
}

export function isLastActiveControlMapFilter(state: FilterState, key: ControlMapFilterKey) {
  const group = CONTROL_MAP_FILTER_GROUPS.find((keys) => keys.includes(key)) ?? [key];
  return state[key] && group.filter((groupKey) => state[groupKey]).length <= 1;
}
