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
    // 分片缺文件（shard-absent）是正常的未命中；其余存储/身份错误若静默吞掉，
    // 生产上会表现为"节点未解析"且日志无迹可循。
    if (error instanceof AuthorityShardStoreError && error.code !== 'shard-absent') {
      console.warn(`[konling-knowledge-authority-node] node ${nodeId} resolution failed: ${error.code}`);
    } else if (!(error instanceof AuthorityShardStoreError)) {
      console.warn(`[konling-knowledge-authority-node] node ${nodeId} resolution threw:`, error);
    }
    return null;
  }
}
