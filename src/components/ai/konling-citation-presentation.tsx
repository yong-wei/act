'use client';

import React from 'react';

type CitationConfidence = 'none' | 'low' | 'medium' | 'high';
type PresentationConfidence = 'unknown' | 'low' | 'medium' | 'high';
type KonlingCitationPresentationStatus = 'verified' | 'limited' | 'missing' | 'unverified';

type CitationChipLike = {
  limitationState?: string | null;
  privacyVisibility?: string | null;
  freshnessBucket?: string | null;
  displayHref?: string | null;
  displayTitle?: string | null;
  confidence?: CitationConfidence | string | null;
  chunkId?: string | null;
};

type CitationLike = {
  id?: string | null;
  key?: string | null;
  sourceType?: string | null;
  displayTitle?: string | null;
  title?: string | null;
  href?: string | null;
  displayHref?: string | null;
  canonicalHref?: string | null;
  confidence?: CitationConfidence | string | null;
  evidenceBasis?: string | null;
  citationChip?: CitationChipLike | null;
  limitationState?: string | null;
  limitation?: string | null;
  citationTargetId?: string | null;
  retrievalChunkId?: string | null;
  resourceNodeId?: string | null;
  knowledgeNodeId?: string | null;
  textbookSectionId?: string | null;
  bookId?: string | null;
  sectionId?: string | null;
  anchor?: string | null;
  page?: string | number | null;
  figureRef?: string | null;
  equationRef?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
  executionId?: string | null;
  status?: string | null;
  evidenceTimestamp?: string | null;
  featureId?: string | null;
  evidenceRef?: string | null;
  sourceWindow?: string | null;
  privacyScope?: string | null;
};

type KonlingCitationGuardLike = {
  status?: 'verified' | 'low-confidence' | string;
  citations?: CitationLike[];
  retrievalSources?: CitationLike[];
  missingCitationClasses?: string[];
  lowConfidenceReasons?: string[];
  diagnosticReasons?: string[];
  missingContext?: string[];
};

export type KonlingCitationPresentationMetadata = {
  konlingCitationGuard?: KonlingCitationGuardLike | null;
};

type PresentationCitation = {
  key: string;
  displayIndex: number;
  sourceType: string;
  title: string;
  href: string | null;
  confidence: PresentationConfidence;
  evidenceBasis: string;
  limitation: string | null;
};

export type KonlingCitationPresentation = {
  summary: {
    status: KonlingCitationPresentationStatus;
    diagnostics: string[];
    missingReasons: string[];
  };
  items: PresentationCitation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function confidenceValue(value: unknown): PresentationConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'unknown';
}

export function isModelAuthoredFootnoteHref(href: string | null | undefined) {
  const normalized = String(href || '').trim().toLowerCase();
  return /^#user-content-fn(?:ref)?/.test(normalized)
    || /^\/knowledge#user-content-fn(?:ref)?/.test(normalized)
    || /^https?:\/\/[^/]+\/knowledge#user-content-fn(?:ref)?/.test(normalized);
}

function safeCitationHref(href: unknown) {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || isModelAuthoredFootnoteHref(trimmed)) return null;
  if (/^(javascript|data):/i.test(trimmed)) return null;
  return trimmed;
}

export function extractKonlingCitationMetadata(metadata: unknown): KonlingCitationPresentationMetadata | null {
  if (!isRecord(metadata) || !isRecord(metadata.konlingCitationGuard)) return null;
  return { konlingCitationGuard: metadata.konlingCitationGuard as KonlingCitationGuardLike };
}

export function normalizeKonlingCitationPresentation(metadata: unknown): KonlingCitationPresentation {
  const guard = isRecord(metadata) && isRecord(metadata.konlingCitationGuard)
    ? metadata.konlingCitationGuard as KonlingCitationGuardLike
    : null;
  if (!guard) return {
    summary: { status: 'missing', diagnostics: [], missingReasons: [] },
    items: [],
  };

  const rawCitations = Array.isArray(guard.citations) && guard.citations.length > 0
    ? guard.citations
    : Array.isArray(guard.retrievalSources)
      ? guard.retrievalSources
      : [];
  const diagnostics = Array.isArray(guard.diagnosticReasons) ? guard.diagnosticReasons : [];
  const citations = dedupePresentationCitations(rawCitations);
  const missingReasons = [
    ...(Array.isArray(guard.missingCitationClasses) ? guard.missingCitationClasses : []),
    ...(Array.isArray(guard.lowConfidenceReasons) ? guard.lowConfidenceReasons : []),
    ...(Array.isArray(guard.missingContext) ? guard.missingContext.map((item) => `missing-context:${item}`) : []),
  ];
  const status = citations.length === 0
    ? 'missing'
    : guard.status === 'verified'
      ? 'verified'
      : 'limited';
  return {
    summary: {
      status,
      diagnostics,
      missingReasons,
    },
    items: citations.map((citation, index) => ({ ...citation, displayIndex: index + 1 })),
  };
}

function dedupePresentationCitations(citations: CitationLike[]): PresentationCitation[] {
  const seen = new Set<string>();
  const items: PresentationCitation[] = [];
  for (const citation of citations) {
    const item = normalizePresentationCitation(citation);
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    items.push(item);
  }
  return items;
}

function normalizePresentationCitation(citation: CitationLike): PresentationCitation {
  const sourceType = normalizeSourceType(citation.sourceType);
  const href = safeCitationHref(citation.displayHref ?? citation.citationChip?.displayHref ?? citation.href);
  const confidence = confidenceValue(citation.confidence ?? citation.citationChip?.confidence);
  return {
    key: buildCitationKey(sourceType, citation, href),
    displayIndex: 0,
    sourceType,
    title: stringValue(citation.displayTitle ?? citation.title ?? citation.citationChip?.displayTitle, '未命名引用'),
    href,
    confidence,
    evidenceBasis: stringValue(citation.evidenceBasis, 'server-owned metadata'),
    limitation: citationLimitation(citation, href, confidence),
  };
}

function normalizeSourceType(value: unknown) {
  const normalized = stringValue(value, 'other');
  if (normalized === 'source') return 'other';
  return normalized;
}

function buildCitationKey(sourceType: string, citation: CitationLike, href: string | null) {
  const identity = firstString([
    ...sourceTypeIdentities(sourceType, citation),
    citation.citationChip?.chunkId,
    citation.key,
    citation.id,
    href,
    `${citation.title ?? citation.displayTitle ?? 'untitled'}:${citation.evidenceBasis ?? 'unknown'}`,
  ]) ?? 'unknown';
  return `${sourceType}:${identity}`;
}

function sourceTypeIdentities(sourceType: string, citation: CitationLike) {
  switch (sourceType) {
    case 'knowledge-node':
      return [
        knowledgeIdentity(citation),
        contentIdentity(citation),
        textbookIdentity(citation),
        pathIdentity(citation),
        learnerStateIdentity(citation),
      ];
    case 'textbook':
      return [
        textbookIdentity(citation),
        contentIdentity(citation),
        knowledgeIdentity(citation),
        pathIdentity(citation),
        learnerStateIdentity(citation),
      ];
    case 'path-execution':
      return [
        pathIdentity(citation),
        contentIdentity(citation),
        knowledgeIdentity(citation),
        textbookIdentity(citation),
        learnerStateIdentity(citation),
      ];
    case 'learner-state':
      return [
        learnerStateIdentity(citation),
        contentIdentity(citation),
        knowledgeIdentity(citation),
        textbookIdentity(citation),
        pathIdentity(citation),
      ];
    case 'content':
    default:
      return [
        contentIdentity(citation),
        knowledgeIdentity(citation),
        textbookIdentity(citation),
        pathIdentity(citation),
        learnerStateIdentity(citation),
      ];
  }
}

function contentIdentity(citation: CitationLike) {
  return firstString([
    citation.citationTargetId,
    citation.retrievalChunkId,
    citation.resourceNodeId,
  ]);
}

function knowledgeIdentity(citation: CitationLike) {
  return firstString([
    citation.knowledgeNodeId,
    citation.resourceNodeId,
  ]);
}

function textbookIdentity(citation: CitationLike) {
  return firstString([
    citation.textbookSectionId,
    joinKey([citation.bookId, citation.sectionId, citation.anchor, citation.page, citation.figureRef, citation.equationRef]),
  ]);
}

function pathIdentity(citation: CitationLike) {
  return firstString([
    joinKey([citation.pathId, citation.nodeId, citation.executionId, citation.status, citation.evidenceTimestamp]),
  ]);
}

function learnerStateIdentity(citation: CitationLike) {
  return firstString([
    citation.featureId,
    citation.evidenceRef,
    joinKey([citation.sourceWindow, citation.privacyScope]),
  ]);
}

function firstString(values: readonly unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function joinKey(values: readonly unknown[]) {
  const parts = values
    .map((value) => (typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(':') : null;
}

function citationLimitation(
  citation: CitationLike,
  href: string | null,
  confidence: PresentationConfidence,
) {
  const explicitLimitation = citation.citationChip?.limitationState ?? citation.limitationState ?? citation.limitation ?? null;
  if (explicitLimitation) return explicitLimitation;
  if (citation.citationChip?.privacyVisibility === 'restricted') return 'insufficient-authority';
  if (citation.citationChip?.freshnessBucket === 'stale') return 'stale-source';
  if (!href) return 'unavailable-address';
  if (confidence === 'low') return 'low-confidence-source';
  if (confidence === 'unknown') return 'unknown-confidence-source';
  return null;
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case 'content':
      return '课程内容';
    case 'knowledge-node':
      return '知识节点';
    case 'textbook':
      return '教材片段';
    case 'learner-state':
      return '学习证据';
    case 'path-execution':
      return '学习路径';
    case 'simulation':
      return '仿真记录';
    case 'arena':
      return 'Arena';
    case 'intervention':
      return '干预记录';
    case 'memory':
      return '记忆摘要';
    case 'other':
      return '其他来源';
    default:
      return sourceType;
  }
}

function limitationLabel(value: string | null) {
  if (!value) return '';
  if (value === 'low-confidence-source') return '可信度有限';
  if (value === 'unknown-confidence-source') return '可信度未知';
  if (value === 'insufficient-authority') return '权限受限';
  if (value === 'stale-source') return '来源已过期';
  if (value === 'unavailable-address') return '暂不可跳转';
  return value.replace(/-/g, ' ');
}

function citationPanelTitle(status: KonlingCitationPresentationStatus) {
  if (status === 'verified') return '已验证引用';
  if (status === 'limited') return '引用核验有限';
  if (status === 'unverified') return '引用待核验';
  return '未找到可验证引用';
}

export function KonlingCitationPanel({ metadata }: { metadata: unknown }) {
  const presentation = normalizeKonlingCitationPresentation(metadata);
  if (presentation.summary.status === 'missing' && presentation.summary.missingReasons.length === 0) return null;

  return (
    <div
      className="mt-3 border-t border-slate-700/70 pt-2"
      data-konling-citation-panel
      data-konling-citation-status={presentation.summary.status}
    >
      <div className="mb-1 text-[11px] font-medium text-slate-400">{citationPanelTitle(presentation.summary.status)}</div>
      {presentation.items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presentation.items.map((citation) => {
            const label = `${citation.displayIndex}. ${citation.title}`;
            const body = (
              <>
                <span className="font-medium">{label}</span>
                <span className="text-slate-400"> · {sourceTypeLabel(citation.sourceType)}</span>
                <span className="text-slate-500"> · {citation.confidence}</span>
                {citation.limitation ? (
                  <span className="text-amber-300"> · {limitationLabel(citation.limitation)}</span>
                ) : null}
              </>
            );
            if (citation.href && !citation.limitation) {
              return (
                <a
                  key={citation.key}
                  href={citation.href}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100 hover:border-emerald-400"
                  data-konling-citation-chip
                  data-citation-key={citation.key}
                  data-citation-target={citation.href}
                >
                  {body}
                </a>
              );
            }
            return (
              <span
                key={citation.key}
                className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300"
                aria-disabled="true"
                data-konling-citation-chip
                data-citation-key={citation.key}
                data-citation-limited={citation.limitation || 'unavailable'}
              >
                {body}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-amber-200" data-konling-citation-missing>
          未找到可验证引用
          {presentation.summary.missingReasons.length > 0 ? `：${presentation.summary.missingReasons.slice(0, 3).join('；')}` : ''}
        </div>
      )}
      {process.env.NODE_ENV !== 'production' && presentation.summary.diagnostics.length > 0 ? (
        <div className="mt-1 text-[10px] text-slate-500" data-konling-citation-diagnostics>
          开发模式诊断：{presentation.summary.diagnostics.slice(0, 2).join('；')}
        </div>
      ) : null}
    </div>
  );
}
