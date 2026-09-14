import { notFound, redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  buildPublishedResourceHref,
  parsePublishedResourceHref,
  publishedResourceIdentityFromId,
  PUBLISHED_RESOURCE_LABELS,
} from '@/lib/published-resource-reference';
import { resolvePublishedResourceFeature } from '@/lib/published-resource-index';
import {
  presentPublishedKnowledgeCard,
  resolveBindingViewerContentForType,
} from '@/lib/authority-domain-shards/binding-viewer-content';
import { launchRowsForResource } from '@/lib/resource-binding-release/query';
import { PublishedResourcePage, type PublishedResourcePageData } from '@/features/knowledge/published-resource-page';

export const dynamic = 'force-dynamic';

export default async function PublishedResourceRoute({ params, searchParams }: {
  params: Promise<{ resourceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect('/login');
  const [routeParams, query] = await Promise.all([params, searchParams]);
  let resourceId: string;
  try { resourceId = decodeURIComponent(routeParams.resourceId); }
  catch { notFound(); }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const part of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, part);
  }
  const ref = parsePublishedResourceHref('/learning-resources/' + encodeURIComponent(resourceId) + '?' + search.toString())
    ?? publishedResourceIdentityFromId(resourceId);
  if (!ref) notFound();
  let resolved;
  try { resolved = await resolvePublishedResourceFeature(ref); }
  catch (error) { rethrowIfNextDynamicError(error); }
  if (!resolved) {
    return <PublishedResourcePage key={`unavailable:${resourceId}`} resource={{ title: '资源暂不可用', kindLabel: '资源引用', summary: '',
      kind: 'reference-only', estimatedMinutes: null, knowledgeCount: 0,
      limitation: '该资源版本无法验证。请返回学习路径或知识图谱重新选择。' }} />;
  }
  const { resource, index, current } = resolved;
  const versionedIdentity = { ...resource.identity, resourceVersion: resource.version };
  const view: PublishedResourcePageData = {
    title: resource.title, summary: resource.summary, kindLabel: PUBLISHED_RESOURCE_LABELS[resource.type],
    estimatedMinutes: resource.executable ? resource.estimatedMinutes : null,
    knowledgeCount: resource.canonicalIds.length,
    limitation: current ? resource.limitation : '该引用来自已保留版本，当前内容已更新。请返回路径重新选择，避免读取不同版本。',
    kind: current ? resource.backend.kind : 'reference-only',
    referenceHref: current ? buildPublishedResourceHref(versionedIdentity) : undefined,
    appearance: resource.appearance ?? null,
    anchors: launchRowsForResource(
      resource.identity.resourceId,
      current && resource.backend.kind === 'route' ? resource.backend.href : null,
    ).flatMap((row) => row.anchorLabel ? [{
      label: row.anchorLabel,
      appearance: row.appearance,
      href: row.href,
    }] : []),
  };
  if (current && resource.backend.kind === 'card') {
    const card = resolveBindingViewerContentForType(resource.identity.resourceId, resource.type, resource.sourcePath);
    if (card?.summary && card.explanation) {
      const presented = presentPublishedKnowledgeCard({
        resourceId: resource.identity.resourceId,
        title: resource.title,
        canonicalIds: resource.canonicalIds,
        card: {
          summary: card.summary,
          insight: card.insight ?? null,
          explanation: card.explanation,
        },
      });
      view.title = presented.title;
      view.summary = presented.summary;
      view.card = { summary: presented.summary, insight: card.insight ?? null, explanation: presented.explanation };
    } else {
      view.kind = 'reference-only';
      view.limitation = '知识卡内容未通过当前版本校验。';
    }
  } else if (current && resource.backend.kind === 'infographic') {
    view.imageSrc = '/api/knowledge/published-infograph/' + encodeURIComponent(resource.backend.token)
      + '?resourceRef=' + encodeURIComponent(buildPublishedResourceHref(versionedIdentity));
  } else if (current && resource.backend.kind === 'media') {
    view.media = {
      mediaType: resource.backend.mediaType,
      assetPath: resource.backend.assetPath,
      src: resource.backend.href,
    };
  } else if (current && resource.backend.kind === 'route') {
    view.href = resource.backend.href;
  } else if (current && resource.backend.kind === 'container') {
    const ids = new Set(resource.backend.childResourceIds);
    view.children = index.resources.filter((entry) => ids.has(entry.identity.resourceId))
      .map((entry) => ({ title: entry.title, href: buildPublishedResourceHref({ ...entry.identity, resourceVersion: entry.version }) }));
  }
  return <PublishedResourcePage key={JSON.stringify([resourceId, resource.version, query.pathId, query.nodeId])} resource={view} />;
}
