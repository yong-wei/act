import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';

import 'katex/dist/katex.min.css';

import { getServerAuthSession } from '@/lib/auth';
import {
  loadTextbookReaderProjection,
  TextbookReaderError,
} from '@/lib/textbook-reader';
import {
  loadTextbookCoachContext,
  verifyTextbookVersionBoundHandle,
} from '@/lib/textbook-resource-coach';

import { TextbookPathCompletionBar } from './textbook-path-completion-bar';
import { TextbookReader } from './textbook-reader';
import { TextbookReaderCoachingSurface } from './textbook-reader-coaching-surface';
import { TextbookReaderModal } from './textbook-reader-modal';

const CITATION_NOTICE: Record<string, string> = {
  unauthorized: '权限已变化，无法打开原引用。',
  'version-changed': '版本已变化，定位不可用。',
  'revision-unavailable': '版本已变化，定位不可用。',
  'hash-drift': '版本已变化，定位不可用。',
  'anchor-unavailable': '定位不可用。',
  'unverified-citation': '引用未能核验。',
  'identity-tampered': '引用未能核验。',
  'location-unavailable': '定位不可用。',
};

export async function TextbookReaderRoute({
  params,
  searchParams,
  presentation,
}: {
  params: Promise<{ bookId: string; edition: string; unitPath: string[] }>;
  searchParams?: Promise<{ vbh?: string | string[] }>;
  presentation: 'standalone' | 'modal';
}) {
  const encodedRoute = await params;
  const query = searchParams ? await searchParams : {};
  let route: { bookId: string; edition: string; unitPath: string[] };
  try {
    route = {
      bookId: decodeURIComponent(encodedRoute.bookId),
      edition: decodeURIComponent(encodedRoute.edition),
      unitPath: (encodedRoute.unitPath ?? []).map(decodeURIComponent),
    };
  } catch {
    notFound();
  }
  const callbackPath = `/textbooks/${[
    route.bookId,
    route.edition,
    ...(route.unitPath ?? []),
  ].map(encodeURIComponent).join('/')}`;
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const handleValue = Array.isArray(query.vbh) ? query.vbh[0] : query.vbh;
  let citationNotice: string | null = null;
  if (handleValue) {
    const identity = verifyTextbookVersionBoundHandle(handleValue);
    if (!identity) {
      citationNotice = CITATION_NOTICE['unverified-citation'];
    } else {
      const loaded = await loadTextbookCoachContext({
        actorUserId: session.user.id,
        pinned: identity,
      });
      if (loaded.status !== 'ready') {
        citationNotice = CITATION_NOTICE[loaded.reason] ?? CITATION_NOTICE['location-unavailable'];
      }
    }
  }

  try {
    const projection = await loadTextbookReaderProjection({
      userId: session.user.id,
      bookId: route.bookId,
      edition: route.edition,
      unitPath: route.unitPath ?? [],
    });
    if (handleValue && !citationNotice) {
      const identity = verifyTextbookVersionBoundHandle(handleValue);
      if (!identity
        || identity.unitId !== projection.unit.id
        || identity.sourceRevision !== projection.book.sourceRevision
        || identity.contentHash !== projection.unit.contentHash) {
        citationNotice = CITATION_NOTICE['version-changed'];
      }
    }
    const reader = (
      <TextbookReaderCoachingSurface projection={projection} citationNotice={citationNotice}>
        {presentation === 'standalone' ? (
          <Suspense fallback={null}>
            <TextbookPathCompletionBar />
          </Suspense>
        ) : null}
        <TextbookReader projection={projection} presentation={presentation} />
      </TextbookReaderCoachingSurface>
    );
    return presentation === 'modal'
      ? <TextbookReaderModal>{reader}</TextbookReaderModal>
      : reader;
  } catch (error) {
    if (error instanceof TextbookReaderError) notFound();
    throw error;
  }
}
