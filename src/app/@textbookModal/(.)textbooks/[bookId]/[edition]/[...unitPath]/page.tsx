import { TextbookReaderRoute } from '@/features/textbook-reader/textbook-reader-route';

export const dynamic = 'force-dynamic';

export default function TextbookModalPage({
  params,
}: {
  params: Promise<{ bookId: string; edition: string; unitPath: string[] }>;
}) {
  return <TextbookReaderRoute params={params} presentation="modal" />;
}
