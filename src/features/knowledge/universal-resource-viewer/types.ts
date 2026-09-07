import type { KnowledgeCardSource } from '../knowledge-card';

export interface UniversalResourceViewerDescriptor {
  title: string;
  resourceKind: string;
  href: string | null;
  startSeconds?: number;
  stepId?: string;
  node?: KnowledgeCardSource;
  imageSrc?: string;
}
