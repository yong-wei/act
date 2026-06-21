import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  type RuntimeLessonResourceCatalogEntry,
} from '@/lib/course-runtime';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
  type TextbookRuntimeResourceCatalogEntry,
  type TextbookRuntimeSearchDocument,
} from '@/lib/textbook-runtime-resources';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import type { RegisteredResourceNodeInput, ResourceNodeRegistry } from '@/lib/resource-node-registry';
import { textbookSearchDocumentsToLearningEvidenceCorpus } from './graph-center-evidence';
import type { LearningEvidenceCorpusChunk } from './learning-evidence-rag-corpus';
import {
  teachingResourceWhereForGraphCenter,
  type GraphCenterViewerRole,
} from './graph-center-source-scope';

export interface GraphCenterCoverageSources {
  resourceRegistry: ResourceNodeRegistry;
  evidenceCorpus: LearningEvidenceCorpusChunk[];
}

interface TeachingResourceForGraphCenter {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  type: string;
  registryId: string | null;
  content: string | null;
  category: string | null;
  teacherOnly: boolean | null;
  config: unknown;
  knowledgeNodes: Array<{
    id: string;
    name: string;
    resources: unknown;
    tags: string[];
  }>;
}

export async function buildGraphCenterCoverageSources(input: {
  viewerRole: GraphCenterViewerRole;
  viewerUserId?: string | null;
}): Promise<GraphCenterCoverageSources> {
  const [teachingResources, runtimeLessons, runtimeTextbooks, textbookDocuments] = await Promise.all([
    loadTeachingResourcesForGraphCenter(input.viewerRole, input.viewerUserId),
    loadAllLessonRuntimeResourceCatalogEntries().catch((): RuntimeLessonResourceCatalogEntry[] => []),
    loadAllTextbookRuntimeResourceCatalogEntries().catch((): TextbookRuntimeResourceCatalogEntry[] => []),
    loadAllTextbookRuntimeSearchDocuments().catch((): TextbookRuntimeSearchDocument[] => []),
  ]);
  const registeredResources = getAllRegisteredResourceMetadata();

  return {
    resourceRegistry: buildResourceNodeRegistryFromTeachingResources(
      teachingResources,
      registeredResources as RegisteredResourceNodeInput[],
      runtimeLessons,
      runtimeTextbooks,
    ),
    evidenceCorpus: textbookSearchDocumentsToLearningEvidenceCorpus(textbookDocuments),
  };
}

async function loadTeachingResourcesForGraphCenter(
  viewerRole: GraphCenterViewerRole,
  viewerUserId?: string | null,
): Promise<TeachingResourceForGraphCenter[]> {
  const where = teachingResourceWhereForGraphCenter(viewerRole, viewerUserId);
  if (where === null) return [];
  return prisma.teachingResource.findMany({
    where,
    include: {
      knowledgeNodes: {
        select: {
          id: true,
          name: true,
          resources: true,
          tags: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
  }) as Promise<TeachingResourceForGraphCenter[]>;
}
