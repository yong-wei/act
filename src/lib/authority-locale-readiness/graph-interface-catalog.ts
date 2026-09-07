import {
  GRAPH_INTERFACE_CATALOG_CONTRACT,
  type AdmittedLocale,
} from './contracts';

function isSafeInterfaceValue(value: string): boolean {
  return value.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
}

export const GRAPH_INTERFACE_KEYS = [
  'language.group',
  'language.zh',
  'language.en',
  'language.englishUnavailable',
  'title.graph',
  'badge.engineering',
  'subtitle.graph',
  'header.reviewedDomains',
  'header.aggregateEntry',
  'header.domainCount',
  'root.chooseDomain',
  'search.label',
  'search.placeholder',
  'search.empty',
  'search.searching',
  'search.failed',
  'search.shownCount',
  'search.loadMore',
  'search.loadMoreAria',
  'search.locate',
  'filter.panel',
  'filter.nodeTypes',
  'filter.relationFamilies',
  'nodeType.DomainConcept',
  'nodeType.Formula',
  'nodeType.KnowledgeStatement',
  'nodeType.SystemModel',
  'nodeType.ModelRepresentation',
  'filter.family.structure',
  'filter.family.derivation-and-representation',
  'filter.family.application-and-analysis',
  'filter.family.association',
  'filter.family.loadFailed',
  'filter.family.retry',
  'filter.teachingOrder',
  'legend.teachingUnavailable',
  'legend.teachingPartial',
  'legend.teachingEmpty',
  'loading.graph',
  'loading.detail',
  'empty.domain',
  'empty.noLegacyFallback',
  'empty.noPublishedRelation',
  'error.login',
  'error.loginCta',
  'error.forbidden',
  'error.identityDrift',
  'error.generic',
  'error.domainShard',
  'error.familyShard',
  'error.neighborhoodShard',
  'error.responseIdentity',
  'error.noOtherGraph',
  'error.contentNotReady',
  'error.viewLegacy',
  'error.retryGraph',
  'error.retryNeighborhood',
  'error.detail',
  'controls.returnDomain',
  'controls.zoomIn',
  'controls.zoomOut',
  'controls.zoomReset',
  'controls.unpin',
  'controls.unpinAria',
  'controls.unpinAll',
  'controls.unpinAllAria',
  'coverage.visible',
  'coverage.total',
  'inspector.label',
  'inspector.subtitle',
  'inspector.close',
  'inspector.noDescription',
  'inspector.nameUnavailable',
  'inspector.aliases',
  'inspector.mathUnavailable',
  'inspector.card',
  'inspector.infograph',
  'inspector.resources',
  'inspector.relations',
  'inspector.outgoing',
  'inspector.incoming',
  'inspector.undirected',
  'inspector.noAuthorizedResources',
  'inspector.hiddenRelations',
  'inspector.sources',
  'inspector.governance',
  'inspector.review',
  'inspector.publication',
  'inspector.governance.approved',
  'inspector.governance.published',
  'inspector.governance.active',
  'inspector.governance.core',
  'inspector.governance.extension',
  'inspector.governance.unclassified',
  'inspector.governance.gold',
  'inspector.governance.silver',
  'inspector.governance.unknown',
  'inspector.governance.unavailable',
  'inspector.source.locateUnavailable',
  'inspector.source.none',
  'inspector.optionalUnavailable',
  'a11y.graph',
  'a11y.canvas',
  'a11y.hiddenUnsafe',
  'focus.search',
  'graphDomain.aggregate',
  'graphDomain.root-locus',
  'graphDomain.modeling',
  'graphDomain.time',
  'graphDomain.stability',
  'graphDomain.frequency',
  'graphDomain.design',
  'graphDomain.discrete',
  'graphDomain.state-space',
  'graphDomain.nonlinear-analysis',
  'graphDomain.lyapunov',
  'graphDomain.discrete-design',
  'graphDomain.robustness',
  'graphDomain.optimal',
  'graphDomain.robust-design',
  'graphDomain.nonlinear-design',
  'relationDirection.forward',
  'relationDirection.source_to_target',
  'relationDirection.unordered',
  'teachingRelation.PREREQUISITE',
] as const;

export type GraphInterfaceKey = (typeof GRAPH_INTERFACE_KEYS)[number];

type CatalogTable = Record<GraphInterfaceKey, { readonly 'zh-CN': string; readonly en: string }>;

const FORBIDDEN_AUTHORITY_OVERRIDE = /^(?:authority|domain|object|relation\.semantic|alias|source)\./u;

export const GRAPH_INTERFACE_CATALOG: CatalogTable = {
  'language.group': { 'zh-CN': '显示语言', en: 'Display language' },
  'language.zh': { 'zh-CN': '中文', en: 'Chinese' },
  'language.en': { 'zh-CN': 'English', en: 'English' },
  'language.englishUnavailable': {
    'zh-CN': '当前发布尚未通过完整英文资格，暂不能切换到 English。',
    en: 'English is unavailable until this release qualifies as bilingual-ready.',
  },
  'title.graph': { 'zh-CN': '当前知识图谱', en: 'Current knowledge graph' },
  'badge.engineering': { 'zh-CN': '工程知识', en: 'Engineering knowledge' },
  'subtitle.graph': {
    'zh-CN': '先选择知识领域，再按需加载教学骨架与工程关系族。',
    en: 'Choose a knowledge domain, then load the teaching skeleton and engineering families as needed.',
  },
  'header.reviewedDomains': { 'zh-CN': '已审领域', en: 'Reviewed domains' },
  'header.aggregateEntry': { 'zh-CN': '综合入口', en: 'Summary entry' },
  'header.domainCount': {
    'zh-CN': '已审领域 {count} 个 · 综合入口 1 个',
    en: '{count} reviewed domains · 1 summary entry',
  },
  'root.chooseDomain': {
    'zh-CN': '选择一个已审知识领域进入默认教学骨架。完整图谱不会在此加载。',
    en: 'Choose a reviewed domain to enter the default teaching skeleton. The full graph is not loaded here.',
  },
  'search.label': { 'zh-CN': '搜索知识对象', en: 'Search knowledge objects' },
  'search.placeholder': { 'zh-CN': '搜索对象名称或类型', en: 'Search object names or types' },
  'search.empty': { 'zh-CN': '没有匹配的语义对象。', en: 'No matching semantic objects.' },
  'search.searching': { 'zh-CN': '正在检索当前领域…', en: 'Searching the current domain…' },
  'search.failed': { 'zh-CN': '检索暂时不可用，请调整关键词后重试。', en: 'Search is temporarily unavailable; adjust the query and retry.' },
  'search.shownCount': {
    'zh-CN': '已显示 {visible} / {total} 个匹配对象',
    en: 'Showing {visible} / {total} matching objects',
  },
  'search.loadMore': { 'zh-CN': '加载更多搜索结果（还剩 {count} 项）', en: 'Load more search results ({count} remaining)' },
  'search.loadMoreAria': { 'zh-CN': '加载更多搜索结果，还剩{count}项', en: 'Load more search results, {count} remaining' },
  'search.locate': { 'zh-CN': '定位', en: 'Locate ' },
  'filter.panel': { 'zh-CN': '图谱筛选', en: 'Graph filters' },
  'filter.nodeTypes': { 'zh-CN': '对象类型', en: 'Object types' },
  'filter.relationFamilies': { 'zh-CN': '关系族', en: 'Relation families' },
  'nodeType.DomainConcept': { 'zh-CN': '领域概念', en: 'Domain concept' },
  'nodeType.Formula': { 'zh-CN': '公式', en: 'Formula' },
  'nodeType.KnowledgeStatement': { 'zh-CN': '知识陈述', en: 'Knowledge statement' },
  'nodeType.SystemModel': { 'zh-CN': '系统模型', en: 'System model' },
  'nodeType.ModelRepresentation': { 'zh-CN': '模型表示', en: 'Model representation' },
  'filter.family.structure': { 'zh-CN': '结构', en: 'Structure' },
  'filter.family.derivation-and-representation': { 'zh-CN': '推导与表示', en: 'Derivation and representation' },
  'filter.family.application-and-analysis': { 'zh-CN': '应用与分析', en: 'Application and analysis' },
  'filter.family.association': { 'zh-CN': '关联', en: 'Association' },
  'filter.family.loadFailed': { 'zh-CN': '关系加载失败，点击重试', en: 'Relation family failed to load, retry' },
  'filter.family.retry': { 'zh-CN': '重试', en: 'Retry' },
  'filter.teachingOrder': { 'zh-CN': '教学顺序（默认）', en: 'Teaching order (default)' },
  'legend.teachingUnavailable': { 'zh-CN': '教学关系暂不可用', en: 'Teaching relations are not available yet' },
  'legend.teachingPartial': { 'zh-CN': '该领域仅有部分教学关系已发布', en: 'Only part of the teaching relations are published' },
  'legend.teachingEmpty': { 'zh-CN': '该领域尚无已发布的教学关系', en: 'No teaching relations are published in this domain yet' },
  'loading.graph': { 'zh-CN': '正在加载知识图谱…', en: 'Loading the knowledge graph…' },
  'loading.detail': { 'zh-CN': '正在加载节点详情…', en: 'Loading node details…' },
  'empty.domain': { 'zh-CN': '当前领域暂无可显示对象。', en: 'This domain has no displayable objects.' },
  'empty.noLegacyFallback': { 'zh-CN': '未请求完整图谱或 Legacy API。', en: 'The full graph and Legacy API were not requested.' },
  'empty.noPublishedRelation': { 'zh-CN': '该对象暂无已发布关系', en: 'This object has no published relations yet' },
  'error.login': { 'zh-CN': '请先登录后查看知识图谱。', en: 'Sign in to view the knowledge graph.' },
  'error.loginCta': { 'zh-CN': '前往登录', en: 'Go to sign in' },
  'error.forbidden': { 'zh-CN': '当前身份无权查看知识图谱。', en: 'The current identity cannot view the knowledge graph.' },
  'error.identityDrift': { 'zh-CN': '当前知识图谱身份发生漂移，已停止显示。', en: 'The knowledge graph identity drifted and display stopped.' },
  'error.generic': { 'zh-CN': '当前知识图谱暂时无法加载。', en: 'The knowledge graph is temporarily unavailable.' },
  'error.domainShard': { 'zh-CN': '当前领域分片暂时无法加载。', en: 'The current domain shard is temporarily unavailable.' },
  'error.familyShard': { 'zh-CN': '关系族分片暂时无法加载，请重试。', en: 'The relation family shard is temporarily unavailable. Retry.' },
  'error.neighborhoodShard': { 'zh-CN': '邻域分片暂时无法加载，请重试。', en: 'The neighborhood shard is temporarily unavailable. Retry.' },
  'error.responseIdentity': { 'zh-CN': '当前知识图谱响应身份校验失败，已停止显示。', en: 'The knowledge graph response failed identity checks and display stopped.' },
  'error.noOtherGraph': { 'zh-CN': '当前知识图谱不可用；未请求另一套图谱数据，也未自动补齐。', en: 'This knowledge graph is unavailable; another graph was not requested or filled in.' },
  'error.contentNotReady': {
    'zh-CN': '知识数据尚未发布完成，请等待发布或联系教师。',
    en: 'Knowledge data has not finished publishing; wait for the release or contact your teacher.',
  },
  'error.viewLegacy': { 'zh-CN': '查看旧版图谱', en: 'Open the legacy graph' },
  'error.retryGraph': { 'zh-CN': '重试当前图谱', en: 'Retry this graph' },
  'error.retryNeighborhood': { 'zh-CN': '重试邻域', en: 'Retry neighborhood' },
  'error.detail': { 'zh-CN': '节点详情暂时无法加载。', en: 'Node details are temporarily unavailable.' },
  'controls.returnDomain': { 'zh-CN': '返回领域', en: 'Back to domains' },
  'controls.zoomIn': { 'zh-CN': '放大图谱', en: 'Zoom in' },
  'controls.zoomOut': { 'zh-CN': '缩小图谱', en: 'Zoom out' },
  'controls.zoomReset': { 'zh-CN': '重置图谱视图', en: 'Reset graph view' },
  'controls.unpin': { 'zh-CN': '解除固定', en: 'Unpin' },
  'controls.unpinAria': { 'zh-CN': '解除固定，交还力学布局', en: 'Unpin and return to force layout' },
  'controls.unpinAll': { 'zh-CN': '解除全部固定', en: 'Unpin all' },
  'controls.unpinAllAria': { 'zh-CN': '解除全部固定（{count} 个节点）', en: 'Unpin all ({count} nodes)' },
  'coverage.visible': { 'zh-CN': '个对象 · {relations} 条关系 · 可见范围', en: 'objects · {relations} relations · visible range' },
  'coverage.total': { 'zh-CN': '总覆盖 {nodes} 个对象 · {relations} 条关系', en: 'Total coverage {nodes} objects · {relations} relations' },
  'inspector.label': { 'zh-CN': '节点详情', en: 'Node details' },
  'inspector.subtitle': { 'zh-CN': '语义对象信息', en: 'Semantic object information' },
  'inspector.close': { 'zh-CN': '关闭节点详情', en: 'Close node details' },
  'inspector.noDescription': { 'zh-CN': '该对象暂无公开说明。', en: 'This object has no public explanation.' },
  'inspector.nameUnavailable': { 'zh-CN': '名称暂不可用', en: 'Name is not available yet' },
  'inspector.aliases': { 'zh-CN': '别名：', en: 'Aliases: ' },
  'inspector.mathUnavailable': { 'zh-CN': '该公式暂不可渲染。', en: 'This formula cannot be rendered yet.' },
  'inspector.card': { 'zh-CN': '知识卡', en: 'Knowledge card' },
  'inspector.infograph': { 'zh-CN': '信息图', en: 'Infograph' },
  'inspector.resources': { 'zh-CN': '系统资源', en: 'System resources' },
  'inspector.relations': { 'zh-CN': '一跳关系', en: 'One-hop relations' },
  'inspector.outgoing': { 'zh-CN': '出向', en: 'Outgoing' },
  'inspector.incoming': { 'zh-CN': '入向', en: 'Incoming' },
  'inspector.undirected': { 'zh-CN': '关联关系', en: 'Undirected relation' },
  'inspector.noAuthorizedResources': {
    'zh-CN': '暂无已授权系统资源。',
    en: 'No authorized system resources yet.',
  },
  'inspector.hiddenRelations': { 'zh-CN': '部分关系暂不可解释，已隐藏。', en: 'Some relations cannot be explained yet and are hidden.' },
  'inspector.sources': { 'zh-CN': '参考来源', en: 'Sources' },
  'inspector.governance': { 'zh-CN': '内容状态', en: 'Content status' },
  'inspector.review': { 'zh-CN': '审核', en: 'Review' },
  'inspector.publication': { 'zh-CN': '发布', en: 'Publication' },
  'inspector.governance.approved': { 'zh-CN': '已审核', en: 'Reviewed' },
  'inspector.governance.published': { 'zh-CN': '已发布', en: 'Published' },
  'inspector.governance.active': { 'zh-CN': '当前有效', en: 'Currently active' },
  'inspector.governance.core': { 'zh-CN': '核心内容', en: 'Core content' },
  'inspector.governance.extension': { 'zh-CN': '扩展内容', en: 'Extension content' },
  'inspector.governance.unclassified': { 'zh-CN': '未分类内容', en: 'Unclassified content' },
  'inspector.governance.gold': { 'zh-CN': '高置信内容', en: 'High-confidence content' },
  'inspector.governance.silver': { 'zh-CN': '一般置信内容', en: 'Standard-confidence content' },
  'inspector.governance.unknown': { 'zh-CN': '状态暂不可解释', en: 'Status cannot be interpreted yet' },
  'inspector.governance.unavailable': { 'zh-CN': '状态暂不可用', en: 'Status is not available yet' },
  'inspector.source.locateUnavailable': { 'zh-CN': '来源定位暂不可用', en: 'Source location is not available yet' },
  'inspector.source.none': { 'zh-CN': '暂无公开来源', en: 'No public sources yet' },
  'inspector.optionalUnavailable': {
    'zh-CN': '所选语言下该可选内容不可用。',
    en: 'This optional content is unavailable in the selected language.',
  },
  'a11y.graph': { 'zh-CN': '知识图谱', en: 'Knowledge graph' },
  'a11y.canvas': { 'zh-CN': '新版语义关系画布', en: 'Semantic relation canvas' },
  'a11y.hiddenUnsafe': {
    'zh-CN': '部分内容暂不可解释，已隐藏以保持语义安全。',
    en: 'Some content cannot be explained yet and are hidden to keep the semantics safe.',
  },
  'focus.search': { 'zh-CN': '搜索知识对象', en: 'Search knowledge objects' },
  // ACT 呈现层词汇（#1741）：导航域名、方向枚举与教学谓词是 ACT 编排层
  // 词汇而非上游 Authority release 内容，其双语值在此维护并随 interface
  // catalog digest 一起封印；release 内容（对象名/说明/类型/工程谓词）仍
  // 只经 locale manifest 投影。
  'graphDomain.aggregate': { 'zh-CN': '控制理论综合', en: 'Control theory integration' },
  'graphDomain.root-locus': { 'zh-CN': '根轨迹', en: 'Root locus' },
  'graphDomain.modeling': { 'zh-CN': '系统建模', en: 'System modeling' },
  'graphDomain.time': { 'zh-CN': '时域分析', en: 'Time-domain analysis' },
  'graphDomain.stability': { 'zh-CN': '稳定性分析', en: 'Stability analysis' },
  'graphDomain.frequency': { 'zh-CN': '频域分析', en: 'Frequency-domain analysis' },
  'graphDomain.design': { 'zh-CN': '经典控制设计', en: 'Classical control design' },
  'graphDomain.discrete': { 'zh-CN': '离散时间控制分析', en: 'Discrete-time control analysis' },
  'graphDomain.state-space': { 'zh-CN': '状态空间控制分析与设计', en: 'State-space control analysis and design' },
  'graphDomain.nonlinear-analysis': { 'zh-CN': '非线性系统分析', en: 'Nonlinear system analysis' },
  'graphDomain.lyapunov': { 'zh-CN': '李雅普诺夫稳定性', en: 'Lyapunov stability' },
  'graphDomain.discrete-design': { 'zh-CN': '离散时间控制设计', en: 'Discrete-time control design' },
  'graphDomain.robustness': { 'zh-CN': '鲁棒性与灵敏度分析', en: 'Robustness and sensitivity analysis' },
  'graphDomain.optimal': { 'zh-CN': '最优控制与线性二次型设计', en: 'Optimal control and LQ design' },
  'graphDomain.robust-design': { 'zh-CN': '鲁棒控制分析与设计', en: 'Robust control analysis and design' },
  'graphDomain.nonlinear-design': { 'zh-CN': '非线性控制设计', en: 'Nonlinear control design' },
  'relationDirection.forward': { 'zh-CN': '由前者指向后者', en: 'From the former to the latter' },
  'relationDirection.source_to_target': { 'zh-CN': '由前者指向后者', en: 'From the former to the latter' },
  'relationDirection.unordered': { 'zh-CN': '关联关系', en: 'Undirected relation' },
  'teachingRelation.PREREQUISITE': { 'zh-CN': '先修关系', en: 'Prerequisite' },
};

export class GraphInterfaceCatalogError extends Error {
  readonly code: 'unknown-key' | 'incomplete' | 'authority-override' | 'unsafe';
  constructor(code: GraphInterfaceCatalogError['code'], message: string) {
    super(message);
    this.name = 'GraphInterfaceCatalogError';
    this.code = code;
  }
}

export function graphInterfaceCatalogReady(): boolean {
  try {
    validateGraphInterfaceCatalog(GRAPH_INTERFACE_CATALOG);
    return true;
  } catch {
    return false;
  }
}

export function validateGraphInterfaceCatalog(table: CatalogTable): void {
  for (const key of GRAPH_INTERFACE_KEYS) {
    if (FORBIDDEN_AUTHORITY_OVERRIDE.test(key)) {
      throw new GraphInterfaceCatalogError('authority-override', `catalog key ${key} overrides Authority semantics`);
    }
    const row = table[key];
    if (!row?.['zh-CN'] || !row.en) {
      throw new GraphInterfaceCatalogError('incomplete', `catalog key ${key} lacks a reviewed bilingual value`);
    }
    if (!isSafeInterfaceValue(row['zh-CN']) || !isSafeInterfaceValue(row.en)) {
      throw new GraphInterfaceCatalogError('unsafe', `catalog key ${key} is not a safe interface value`);
    }
  }
  for (const key of Object.keys(table)) {
    if (!(GRAPH_INTERFACE_KEYS as readonly string[]).includes(key)) {
      throw new GraphInterfaceCatalogError('unknown-key', `unknown catalog key ${key}`);
    }
    if (FORBIDDEN_AUTHORITY_OVERRIDE.test(key)) {
      throw new GraphInterfaceCatalogError('authority-override', `catalog key ${key} overrides Authority semantics`);
    }
  }
}

export function graphInterfaceText(key: GraphInterfaceKey, locale: AdmittedLocale): string {
  validateGraphInterfaceCatalog(GRAPH_INTERFACE_CATALOG);
  const value = GRAPH_INTERFACE_CATALOG[key][locale];
  if (!value) {
    throw new GraphInterfaceCatalogError('unknown-key', `catalog key ${key} has no ${locale} value`);
  }
  return value;
}

export function formatGraphInterfaceText(
  key: GraphInterfaceKey,
  locale: AdmittedLocale,
  tokens: Record<string, string | number>,
): string {
  return graphInterfaceText(key, locale).replace(/\{([a-z]+)\}/gu, (_match, name: string) => String(tokens[name] ?? ''));
}

export const GRAPH_INTERFACE_CATALOG_VERSION = GRAPH_INTERFACE_CATALOG_CONTRACT;
