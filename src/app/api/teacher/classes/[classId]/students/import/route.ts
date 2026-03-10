import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * Excel 导入学生 API
 *
 * POST /api/teacher/classes/[classId]/students/import
 *
 * 上传Excel文件，按学号导入学生到班级
 * Excel文件格式：第一列为学号（studentNumber）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;

    // 验证班级属于当前教师
    const classInfo = await prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: session.user.id,
      },
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在或无权限' }, { status: 404 });
    }

    // 解析上传的文件
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '请上传Excel文件' }, { status: 400 });
    }

    // 验证文件类型
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: '请上传Excel文件（.xlsx或.xls格式）' }, { status: 400 });
    }

    // 读取Excel文件
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 转换为JSON数组 (header: 1 返回数组而非对象)
    const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

    if (data.length < 2) {
      return NextResponse.json({ error: 'Excel文件为空或格式不正确' }, { status: 400 });
    }

    // 解析学号列表（跳过标题行）
    const studentNumbers: string[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[0]) {
        const studentNumber = String(row[0]).trim();
        if (studentNumber) {
          studentNumbers.push(studentNumber);
        }
      }
    }

    if (studentNumbers.length === 0) {
      return NextResponse.json({ error: '未找到有效的学号数据' }, { status: 400 });
    }

    // 处理导入结果
    const results = {
      success: [] as string[],
      failed: [] as { studentNumber: string; reason: string }[],
    };

    // 逐个处理学号
    for (const studentNumber of studentNumbers) {
      // 查找学生档案
      const studentProfile = await prisma.studentProfile.findFirst({
        where: { studentNumber },
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      if (!studentProfile) {
        results.failed.push({
          studentNumber,
          reason: '学号不存在',
        });
        continue;
      }

      if (studentProfile.user.role !== 'STUDENT') {
        results.failed.push({
          studentNumber,
          reason: '该账号不是学生',
        });
        continue;
      }

      if (studentProfile.classId === classId) {
        results.failed.push({
          studentNumber,
          reason: '已在本班级中',
        });
        continue;
      }

      // 添加到班级
      try {
        await prisma.studentProfile.update({
          where: { id: studentProfile.id },
          data: {
            classId,
            className: classInfo.name,
          },
        });
        results.success.push(studentNumber);
      } catch {
        results.failed.push({
          studentNumber,
          reason: '添加失败',
        });
      }
    }

    return NextResponse.json({
      success: results.success,
      failed: results.failed,
      summary: {
        total: studentNumbers.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
      },
    });
  } catch (error) {
    console.error('Error importing students:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
