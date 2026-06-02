import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';
import { buildWorkbookBuffer } from '@/lib/server-spreadsheet';

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const buffer = await buildWorkbookBuffer('导入模板', [
    ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
    ['20240001', '张三', '学生', 'zhangsan@example.com', '自动化2401', '自动化', '2024', ''],
    ['T2024001', '李老师', '教师', 'li@example.com', '', '', '', ''],
  ]);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="users-template.xlsx"',
    },
  });
}
