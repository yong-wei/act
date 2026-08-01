import { notFound, redirect } from 'next/navigation';

import 'katex/dist/katex.min.css';

import { getServerAuthSession } from '@/lib/auth';
import {
  loadTextbookReaderProjection,
  TextbookReaderError,
} from '@/lib/textbook-reader';

import { TextbookReader } from './textbook-reader';
import { TextbookReaderModal } from './textbook-reader-modal';

export async function TextbookReaderRoute({
  params,
  presentation,
}: {
  params: Promise<{ bookId: string; edition: string; unitPath: string[] }>;
  presentation: 'standalone' | 'modal';
}) {
  const encodedRoute = await params;
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

  try {
    const projection = await loadTextbookReaderProjection({
      userId: session.user.id,
      bookId: route.bookId,
      edition: route.edition,
      unitPath: route.unitPath ?? [],
    });
    const reader = <TextbookReader projection={projection} presentation={presentation} />;
    return presentation === 'modal'
      ? <TextbookReaderModal>{reader}</TextbookReaderModal>
      : reader;
  } catch (error) {
    if (error instanceof TextbookReaderError) notFound();
    throw error;
  }
}
