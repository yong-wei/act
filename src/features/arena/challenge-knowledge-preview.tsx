'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Image as ImageIcon, Loader2 } from 'lucide-react';

import type { RelatedKnowledgeRef } from './types';
import {
  KnowledgeCardDialog,
  extractInfographResource,
  resolveKnowledgeInfographSrc,
  type KnowledgeCardSource,
} from '@/features/knowledge/knowledge-card';

interface ArenaKnowledgeNode extends KnowledgeCardSource {
  id: string;
  chapter?: string | null;
  chapterName?: string | null;
  tags?: string[] | null;
  relatedNodes?: Array<{
    id: string;
    name: string;
    relation?: string;
    category?: string;
  }>;
}

function ChallengeKnowledgePreviewDetail({ selected }: { selected: RelatedKnowledgeRef }) {
  const [nodeState, setNodeState] = useState<{
    nodeId: string;
    node: ArenaKnowledgeNode | null;
    loading: boolean;
  }>(() => ({ nodeId: selected.nodeId, node: null, loading: true }));
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/knowledge/nodes/${encodeURIComponent(selected.nodeId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setNodeState({ nodeId: selected.nodeId, node: data, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNodeState({ nodeId: selected.nodeId, node: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected.nodeId]);

  const node = nodeState.nodeId === selected.nodeId ? nodeState.node : null;
  const loading = nodeState.nodeId === selected.nodeId ? nodeState.loading : true;
  const infographSrc = useMemo(
    () => resolveKnowledgeInfographSrc(extractInfographResource(node?.resources)),
    [node?.resources],
  );
  const tags = node?.tags ?? [];
  const relations = node?.relatedNodes ?? [];

  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-subtle">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载知识预览
        </div>
      ) : node ? (
        <div className="grid gap-4">
          <div>
            <div className="text-xs font-medium text-primary">知识预览</div>
            <h3 className="mt-1 text-base font-semibold text-foreground">{node.name}</h3>
            <p className="mt-2 text-sm leading-6 text-subtle">{node.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-subtle">
              {node.chapterName || node.chapter ? <span>章节：{node.chapterName ?? node.chapter}</span> : null}
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/70 bg-background/70 px-2 py-1">{tag}</span>
              ))}
            </div>
          </div>

          {relations.length > 0 ? (
            <div className="grid gap-2 text-xs text-subtle">
              <div className="font-medium text-foreground">关联关系</div>
              <div className="flex flex-wrap gap-2">
                {relations.slice(0, 6).map((relation) => (
                  <span key={relation.id} className="rounded-full border border-border/70 bg-background/70 px-2 py-1">
                    {relation.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {infographSrc ? (
            <figure className="overflow-hidden rounded-lg border border-border/70 bg-background/70">
              <Image
                src={infographSrc}
                alt={`${node.name}信息图`}
                width={800}
                height={320}
                className="max-h-52 w-full object-contain p-2"
                unoptimized
              />
            </figure>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCardOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <BookOpen className="h-4 w-4" />
              打开知识卡片
            </button>
            {infographSrc ? (
              <a
                href={infographSrc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
              >
                <ImageIcon className="h-4 w-4" />
                查看信息图
              </a>
            ) : null}
          </div>
          <KnowledgeCardDialog open={cardOpen} onOpenChange={setCardOpen} node={node} />
        </div>
      ) : (
        <div className="text-sm text-subtle">{selected.label}</div>
      )}
    </div>
  );
}

export function ChallengeKnowledgePreview({ items }: { items: RelatedKnowledgeRef[] }) {
  const [selected, setSelected] = useState<RelatedKnowledgeRef | null>(items[0] ?? null);

  if (items.length === 0) {
    return <p className="text-sm text-subtle">暂无关联知识点。</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.nodeId}
            type="button"
            onClick={() => setSelected(item)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              selected?.nodeId === item.nodeId
                ? 'border-primary/55 bg-primary/12 text-primary shadow-sm'
                : 'border-border/70 bg-background/70 text-subtle hover:border-primary/40 hover:text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {selected ? <ChallengeKnowledgePreviewDetail key={selected.nodeId} selected={selected} /> : null}
    </div>
  );
}
