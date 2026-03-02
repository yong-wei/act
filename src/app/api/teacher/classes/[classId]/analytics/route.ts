import { NextResponse } from 'next/server'
import { getServerAuthSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClassExtracurricularAnalytics } from '@/lib/extracurricular-analytics'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { classId } = await params

    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    })

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && classInfo.teacherId !== session.user.id) {
      return NextResponse.json({ error: '仅可查看本人班级分析' }, { status: 403 })
    }

    const payload = await getClassExtracurricularAnalytics(classId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('获取班级展示分析失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
