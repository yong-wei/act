import { loadNodeDetailShard } from '@/lib/authority-domain-shards/loader';
import { AuthorityShardStoreError } from '@/lib/authority-domain-shards/store';

/**
 * 知识图谱当前选中项传给控灵的是权威分片 canonical id，不是 Prisma KnowledgeNode.id。
 * 名称只取服务端分片，不采用浏览器附带的标题。
 */
export interface AuthorityKnowledgeNodeView {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  tags: string[];
  knowledgeDim: string | null;
}

export function readAuthorityKnowledgeNode(nodeId: string): AuthorityKnowledgeNodeView | null {
  try {
    const shard = loadNodeDetailShard(nodeId);
    const name = shard.node.label?.replace(/\s+/g, ' ').trim() ?? '';
    const id = shard.node.id?.trim() ?? '';
    if (!id || !name) return null;
    const conceptKind = shard.node.teachingFields?.concept_kind;
    const aliases = Array.isArray(shard.node.aliases)
      ? shard.node.aliases.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const typeLabel = shard.node.typeLabel?.replace(/\s+/g, ' ').trim() ?? '';
    return {
      id,
      name,
      nodeType: typeLabel || shard.node.canonicalType,
      description: shard.node.description?.replace(/\s+/g, ' ').trim() ?? '',
      tags: aliases,
      knowledgeDim: typeof conceptKind === 'string' && conceptKind.trim() ? conceptKind.trim() : null,
    };
  } catch (error) {
    if (error instanceof AuthorityShardStoreError) return null;
    return null;
  }
}
