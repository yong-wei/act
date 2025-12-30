
import Link from 'next/link';
import { Plus, Play, Clock, User } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default async function PlaylistsPage() {
  // Server Component Fetching - Using LessonPlan (replaces CoursePlaylist)
  const playlists = await prisma.lessonPlan.findMany({
    where: { isPublic: true },
    include: {
      author: { select: { name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="container mx-auto py-8 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">课程播放列表</h1>
            <p className="text-slate-400">管理和播放您的互动课程流</p>
        </div>
        <Link href="/playlists/new">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors">
            <Plus className="h-4 w-4" />
            新建课程流
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((playlist) => (
          <Card key={playlist.id} className="bg-[#0F172A] border-slate-700 hover:border-blue-500 transition-all group">
            <CardHeader>
              <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                {playlist.title}
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {playlist.author.name || 'Unknown'}
                </div>
                <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(playlist.createdAt).toLocaleDateString()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 line-clamp-2 min-h-[40px]">
                {playlist.description || '暂无描述'}
              </p>
              <div className="mt-4 flex gap-2">
                <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                    {playlist._count.items} 个环节
                </span>
                <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs border border-green-800">
                    公开
                </span>
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-800 pt-4">
               <Link href={`/playlists/${playlist.id}/play`} className="w-full">
                 <button className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white py-2 rounded transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Play className="h-4 w-4" />
                    开始上课
                 </button>
               </Link>
            </CardFooter>
          </Card>
        ))}

        {playlists.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-900/50">
                暂无课程流，点击右上角创建第一个课程。
            </div>
        )}
      </div>
    </div>
  );
}
