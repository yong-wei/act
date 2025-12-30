
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Assuming authOptions is exported from here

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow public access for now for demonstration, or check session
    // In a real scenario, we might want to return public playlists + user's own playlists
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'my' or 'public'

    const where: any = {};
    
    if (mode === 'my' && session?.user?.email) {
       where.author = { email: session.user.email };
    } else {
       // Default: fetch public playlists
       where.isPublic = true;
    }

    const playlists = await prisma.lessonPlan.findMany({
      where,
      include: {
        author: {
          select: { name: true, image: true }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlists' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, isPublic, items } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Note: LessonPlan now uses LessonItem which requires resourceId and stage
    // This endpoint is kept for backward compatibility but items creation is simplified
    const playlist = await prisma.lessonPlan.create({
      data: {
        title,
        description,
        isPublic: isPublic || false,
        authorId: user.id,
        // Items are not created here as they require TeachingResource references
        // Use /api/lesson-plans for full BOPPPS-structured plans
      }
    });

    return NextResponse.json(playlist);

  } catch (error) {
    console.error('Error creating playlist:', error);
    return NextResponse.json(
      { error: 'Failed to create playlist' },
      { status: 500 }
    );
  }
}
