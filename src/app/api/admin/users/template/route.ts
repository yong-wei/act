import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAdminSession } from '@/lib/admin';

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
    ['20240001', '张三', '学生', 'zhangsan@example.com', '自动化2401', '自动化', '2024', ''],
    ['T2024001', '李老师', '教师', 'li@example.com', '', '', '', ''],
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, '导入模板');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="users-template.xlsx"',
    },
  });
}
