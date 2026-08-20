import { TextbookReaderRoute } from '@/features/textbook-reader/textbook-reader-route';

export const dynamic = 'force-dynamic';

export default function TextbookModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string; edition: string; unitPath: string[] }>;
  searchParams: Promise<{ vbh?: string | string[] }>;
}) {
  return <TextbookReaderRoute params={params} searchParams={searchParams} presentation="modal" />;
}
