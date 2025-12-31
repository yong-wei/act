import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const node = await prisma.knowledgeNode.findUnique({
      where: { id: params.id }
    });

    if (!node) {
      return NextResponse.json({ error: 'Knowledge node not found' }, { status: 404 });
    }

    return NextResponse.json(node);
  } catch (error) {
    console.error('Error fetching knowledge node:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
