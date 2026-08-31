import { featureName } from './classify';
import type { ResolvedImport } from './imports';

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly context: 'production' | 'test';
  readonly crossDomain: boolean;
  readonly deepImport: boolean;
  readonly featureToApp: boolean;
}

export interface SccRecord {
  readonly id: string;
  readonly members: readonly string[];
  readonly edgeIds: readonly string[];
}

function isInternalFeaturePath(path: string): boolean {
  const feature = featureName(path);
  if (!feature) return false;
  return !/\/index\.(?:ts|tsx|js)$/u.test(path);
}

export function buildDeclaredEdges(
  imports: readonly ResolvedImport[],
  contextFor: (path: string) => 'production' | 'test',
): GraphEdge[] {
  const unique = new Map<string, GraphEdge>();
  for (const item of imports) {
    if (!item.to) continue;
    const fromFeature = featureName(item.from);
    const toFeature = featureName(item.to);
    const crossDomain = Boolean(fromFeature && toFeature && fromFeature !== toFeature);
    const deepImport = crossDomain && isInternalFeaturePath(item.to);
    const featureToApp = item.from.startsWith('src/features/') && item.to.startsWith('src/app/');
    const id = `${item.from}->${item.to}`;
    const existing = unique.get(id);
    unique.set(id, {
      id,
      from: item.from,
      to: item.to,
      context: contextFor(item.from),
      crossDomain: Boolean(existing?.crossDomain || crossDomain),
      deepImport: Boolean(existing?.deepImport || deepImport),
      featureToApp: Boolean(existing?.featureToApp || featureToApp),
    });
  }
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function reverseEdges(edges: readonly GraphEdge[]): GraphEdge[] {
  return edges
    .map((edge) => ({
      ...edge,
      id: `${edge.to}<-${edge.from}`,
      from: edge.to,
      to: edge.from,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function stronglyConnectedComponents(edges: readonly GraphEdge[]): SccRecord[] {
  const nodes = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].sort();
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node, []);
  for (const edge of edges) adj.get(edge.from)?.push(edge.to);
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let next = 0;

  function visit(node: string): void {
    index.set(node, next);
    low.set(node, next);
    next += 1;
    stack.push(node);
    onStack.add(node);
    for (const nextNode of adj.get(node) ?? []) {
      if (!index.has(nextNode)) {
        visit(nextNode);
        low.set(node, Math.min(low.get(node)!, low.get(nextNode)!));
      } else if (onStack.has(nextNode)) {
        low.set(node, Math.min(low.get(node)!, index.get(nextNode)!));
      }
    }
    if (low.get(node) === index.get(node)) {
      const members: string[] = [];
      while (stack.length > 0) {
        const item = stack.pop()!;
        onStack.delete(item);
        members.push(item);
        if (item === node) break;
      }
      if (members.length > 1) components.push(members.sort());
    }
  }

  for (const node of nodes) {
    if (!index.has(node)) visit(node);
  }

  return components
    .sort((left, right) => left.join(',').localeCompare(right.join(',')))
    .map((members) => {
      const memberSet = new Set(members);
      const edgeIds = edges
        .filter((edge) => memberSet.has(edge.from) && memberSet.has(edge.to))
        .map((edge) => edge.id)
        .sort();
      return {
        id: `scc:${members.join('|')}`,
        members,
        edgeIds,
      };
    });
}
