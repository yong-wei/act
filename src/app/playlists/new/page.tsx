
import { PlaylistBuilder } from '@/features/knowledge/playlist-builder';

interface NewPlaylistPageProps {
  searchParams?: Promise<{ nodeId?: string }>;
}

export default async function NewPlaylistPage({ searchParams }: NewPlaylistPageProps) {
  const params = await searchParams;
  const initialNodeId = typeof params?.nodeId === 'string' ? params.nodeId : null;

  return (
    <div className="container mx-auto py-6 h-screen flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-6">创建新课程流</h1>
      <div className="flex-1 min-h-0">
         <PlaylistBuilder initialNodeId={initialNodeId} />
      </div>
    </div>
  );
}
