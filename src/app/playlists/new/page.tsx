
import { PlaylistBuilder } from '@/features/knowledge/playlist-builder';

export default function NewPlaylistPage() {
  return (
    <div className="container mx-auto py-6 h-screen flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-6">创建新课程流</h1>
      <div className="flex-1 min-h-0">
         <PlaylistBuilder />
      </div>
    </div>
  );
}
