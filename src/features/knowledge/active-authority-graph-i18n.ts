import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import {
  formatGraphInterfaceText,
  graphInterfaceText,
  type GraphInterfaceKey,
} from '@/lib/authority-locale-readiness/graph-interface-catalog';
import type { EngineeringRelationFamily } from '@/lib/authority-domain-shards/contracts';

export function graphCopy(locale: AdmittedLocale, key: GraphInterfaceKey): string {
  return graphInterfaceText(key, locale);
}

export function familyLabel(locale: AdmittedLocale, family: EngineeringRelationFamily): string {
  return graphInterfaceText(`filter.family.${family}`, locale);
}

export function shardUrl(path: string, locale: AdmittedLocale): string {
  if (locale === 'zh-CN') return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}locale=${encodeURIComponent(locale)}`;
}

export function visibleCoverageCopy(
  locale: AdmittedLocale,
  nodes: number,
  relations: number,
): string {
  return `${nodes} ${formatGraphInterfaceText('coverage.visible', locale, { relations })}`;
}

export function totalCoverageCopy(
  locale: AdmittedLocale,
  nodes: number,
  relations: number,
): string {
  return formatGraphInterfaceText('coverage.total', locale, { nodes, relations });
}

export function boundaryEnterCopy(
  locale: AdmittedLocale,
  domain: string,
  object: string,
  relation: string,
): string {
  return formatGraphInterfaceText('boundary.enter', locale, { domain, object, relation });
}

export function reviewedDomainHeaderCopy(locale: AdmittedLocale, domainCount: number): string {
  return formatGraphInterfaceText('header.domainCount', locale, { count: domainCount });
}

export function formatLoadMore(locale: AdmittedLocale, count: number): string {
  return formatGraphInterfaceText('search.loadMore', locale, { count });
}

export function formatLoadMoreAria(locale: AdmittedLocale, count: number): string {
  return formatGraphInterfaceText('search.loadMoreAria', locale, { count });
}

export function formatSearchShownCount(
  locale: AdmittedLocale,
  visible: number,
  total: number,
): string {
  return formatGraphInterfaceText('search.shownCount', locale, { visible, total });
}
