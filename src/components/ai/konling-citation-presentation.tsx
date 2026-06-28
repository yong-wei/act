'use client';

import React from 'react';

type CitationConfidence = 'none' | 'low' | 'medium' | 'high';

type CitationChipLike = {
  limitationState?: string | null;
  privacyVisibility?: string | null;
};

type CitationLike = {
  sourceType?: string | null;
  displayTitle?: string | null;
  href?: string | null;
  confidence?: CitationConfidence | string | null;
  evidenceBasis?: string | null;
  citationChip?: CitationChipLike | null;
  limitationState?: string | null;
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
  id: string;
  sourceType: string;
  displayTitle: string;
  href: string | null;
  confidence: CitationConfidence;
  evidenceBasis: string;
  limitationState: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function confidenceValue(value: unknown): CitationConfidence {
  return value === 'high' || value === 'medium' || value === 'low' || value === 'none' ? value : 'none';
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

export function normalizeKonlingCitationPresentation(metadata: unknown): {
  status: 'verified' | 'low-confidence' | 'missing';
  citations: PresentationCitation[];
  diagnostics: string[];
  missingReasons: string[];
} {
  const guard = isRecord(metadata) && isRecord(metadata.konlingCitationGuard)
    ? metadata.konlingCitationGuard as KonlingCitationGuardLike
    : null;
  if (!guard) return { status: 'missing', citations: [], diagnostics: [], missingReasons: [] };

  const rawCitations = Array.isArray(guard.citations) && guard.citations.length > 0
    ? guard.citations
    : Array.isArray(guard.retrievalSources)
      ? guard.retrievalSources
      : [];
  const status = guard.status === 'verified' ? 'verified' : 'low-confidence';
  const guardLimitation = status === 'verified' ? null : 'guard-low-confidence';
  const citations = rawCitations.map((citation, index): PresentationCitation => {
    const confidence = confidenceValue(citation.confidence);
    const chipLimitation = citation.citationChip?.limitationState ?? citation.limitationState ?? null;
    return {
      id: `${stringValue(citation.sourceType, 'source')}:${index + 1}`,
      sourceType: stringValue(citation.sourceType, 'source'),
      displayTitle: stringValue(citation.displayTitle, `引用 ${index + 1}`),
      href: safeCitationHref(citation.href),
      confidence,
      evidenceBasis: stringValue(citation.evidenceBasis, 'server-owned metadata'),
      limitationState: chipLimitation || guardLimitation || (confidence === 'none' || confidence === 'low' ? 'low-confidence-source' : null),
    };
  });
  const missingReasons = [
    ...(Array.isArray(guard.missingCitationClasses) ? guard.missingCitationClasses : []),
    ...(Array.isArray(guard.lowConfidenceReasons) ? guard.lowConfidenceReasons : []),
    ...(Array.isArray(guard.missingContext) ? guard.missingContext.map((item) => `missing-context:${item}`) : []),
  ];
  return {
    status: citations.length > 0 ? status : 'missing',
    citations,
    diagnostics: Array.isArray(guard.diagnosticReasons) ? guard.diagnosticReasons : [],
    missingReasons,
  };
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case 'content':
      return '课程内容';
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
    default:
      return sourceType;
  }
}

function limitationLabel(value: string | null) {
  if (!value) return '';
  if (value === 'low-confidence-source') return '可信度有限';
  if (value === 'guard-low-confidence') return '整体核验有限';
  if (value === 'insufficient-authority') return '权限受限';
  if (value === 'stale-source') return '来源已过期';
  if (value === 'unavailable-address') return '暂不可跳转';
  return value.replace(/-/g, ' ');
}

export function KonlingCitationPanel({ metadata }: { metadata: unknown }) {
  const presentation = normalizeKonlingCitationPresentation(metadata);
  if (presentation.status === 'missing' && presentation.missingReasons.length === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-700/70 pt-2" data-konling-citation-panel>
      <div className="mb-1 text-[11px] font-medium text-slate-400">已验证引用</div>
      {presentation.citations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presentation.citations.map((citation, index) => {
            const label = `${index + 1}. ${citation.displayTitle}`;
            const body = (
              <>
                <span className="font-medium">{label}</span>
                <span className="text-slate-400"> · {sourceTypeLabel(citation.sourceType)}</span>
                <span className="text-slate-500"> · {citation.confidence}</span>
                {citation.limitationState ? (
                  <span className="text-amber-300"> · {limitationLabel(citation.limitationState)}</span>
                ) : null}
              </>
            );
            if (citation.href && !citation.limitationState) {
              return (
                <a
                  key={citation.id}
                  href={citation.href}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100 hover:border-emerald-400"
                  data-konling-citation-chip
                  data-citation-target={citation.href}
                >
                  {body}
                </a>
              );
            }
            return (
              <span
                key={citation.id}
                className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300"
                aria-disabled="true"
                data-konling-citation-chip
                data-citation-limited={citation.limitationState || 'unavailable'}
              >
                {body}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-amber-200" data-konling-citation-missing>
          未找到可验证引用
          {presentation.missingReasons.length > 0 ? `：${presentation.missingReasons.slice(0, 3).join('；')}` : ''}
        </div>
      )}
      {process.env.NODE_ENV !== 'production' && presentation.diagnostics.length > 0 ? (
        <div className="mt-1 text-[10px] text-slate-500" data-konling-citation-diagnostics>
          诊断：{presentation.diagnostics.slice(0, 2).join('；')}
        </div>
      ) : null}
    </div>
  );
}
