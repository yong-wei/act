import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { UserRole, type Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { initializeUserProgress } from '@/lib/user-sync';

type ImportRow = {
  account: string;
  name: string;
  roleRaw: string;
  email: string;
  className: string;
  major: string;
  year: string;
  password: string;
};

type ImportError = {
  row: number;
  account: string;
  reason: string;
};

const HEADER_ALIASES = {
  account: [
    '账号',
    'account',
    'username',
    'login',
    'studentnumber',
    'student number',
    'student_id',
    'employeenumber',
    'employee number',
    'employee_id',
    '学号',
    '工号',
    '学生编号',
  ],
  name: ['姓名', 'name', 'studentname', '学生姓名'],
  role: ['角色', 'role', 'userrole', '用户角色'],
  email: ['邮箱', 'email', 'mail'],
  className: ['班级', 'classname', 'class', 'class_name'],
  major: ['专业', 'major'],
  year: ['年级', 'year'],
  password: ['初始密码', '密码', 'password', 'defaultpassword', 'initialpassword'],
} as const;

const REQUIRED_HEADERS: Array<keyof Pick<ImportRow, 'account' | 'name' | 'roleRaw'>> = [
  'account',
  'name',
  'roleRaw',
];

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const normalizeValue = (value: unknown) => String(value ?? '').trim();

function parseRole(roleRaw: string): UserRole | null {
  const normalized = roleRaw.trim().toLowerCase();
  if (!normalized) return null;

  if (['student', '学生', 'stu'].includes(normalized)) {
    return UserRole.STUDENT;
  }
  if (['teacher', '教师', 'tea'].includes(normalized)) {
    return UserRole.TEACHER;
  }
  if (['admin', '管理员'].includes(normalized)) {
    return UserRole.ADMIN;
  }
  return null;
}

function buildHeaderIndexes(headerRow: unknown[]) {
  const findIndexByAliases = (aliases: readonly string[]) =>
    headerRow.findIndex((cell) => aliases.includes(normalizeHeader(cell)));

  return {
    account: findIndexByAliases(HEADER_ALIASES.account),
    name: findIndexByAliases(HEADER_ALIASES.name),
    roleRaw: findIndexByAliases(HEADER_ALIASES.role),
    email: findIndexByAliases(HEADER_ALIASES.email),
    className: findIndexByAliases(HEADER_ALIASES.className),
    major: findIndexByAliases(HEADER_ALIASES.major),
    year: findIndexByAliases(HEADER_ALIASES.year),
    password: findIndexByAliases(HEADER_ALIASES.password),
  } satisfies Record<keyof ImportRow, number>;
}

function getCellValue(row: unknown[], index: number) {
  if (index < 0) return '';
  return normalizeValue(row[index]);
}

function pickNonEmptyProfileUpdate(row: ImportRow): Prisma.StudentProfileUpdateInput {
  const data: Prisma.StudentProfileUpdateInput = {};

  if (row.className) {
    data.className = row.className;
  }
  if (row.major) {
    data.major = row.major;
  }
  if (row.year) {
    data.year = row.year;
  }

  return data;
}

async function createUserFromImport(row: ImportRow, role: UserRole) {
  const passwordHash = await hash(row.password || '123456', 10);

  const user = await prisma.user.create({
    data: {
      name: row.name,
      email: row.email || null,
      passwordHash,
      role,
      employeeNumber: role === UserRole.STUDENT ? null : row.account,
      profile:
        role === UserRole.STUDENT
          ? {
              create: {
                studentNumber: row.account,
                className: row.className || null,
                major: row.major || null,
                year: row.year || null,
                techScore: 0,
                ethicsScore: 100,
              },
            }
          : undefined,
    },
    include: {
      profile: {
        select: {
          id: true,
        },
      },
    },
  });

  if (role === UserRole.STUDENT) {
    await initializeUserProgress(user.id);
  }
}

async function updateUserByAccount(
  userId: string,
  hasProfile: boolean,
  row: ImportRow,
  role: UserRole
) {
  const userUpdateData: Prisma.UserUpdateInput = {
    name: row.name,
    role,
    employeeNumber: role === UserRole.STUDENT ? null : row.account,
  };

  if (row.email) {
    userUpdateData.email = row.email;
  }

  if (row.password) {
    userUpdateData.passwordHash = await hash(row.password, 10);
  }

  await prisma.user.update({
    where: { id: userId },
    data: userUpdateData,
  });

  if (role !== UserRole.STUDENT) {
    return;
  }

  const profilePatch = pickNonEmptyProfileUpdate(row);

  if (hasProfile) {
    await prisma.studentProfile.update({
      where: { userId },
      data: {
        studentNumber: row.account,
        ...profilePatch,
      },
    });
  } else {
    await prisma.studentProfile.create({
      data: {
        userId,
        studentNumber: row.account,
        className: row.className || null,
        major: row.major || null,
        year: row.year || null,
        techScore: 0,
        ethicsScore: 100,
      },
    });
    await initializeUserProgress(userId);
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    return NextResponse.json({ error: '未找到工作表' }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  }) as Array<Array<unknown>>;

  if (rows.length < 2) {
    return NextResponse.json({ error: '模板内容为空' }, { status: 400 });
  }

  const headerRow = rows[0] ?? [];
  const headerIndexes = buildHeaderIndexes(headerRow);

  const missingRequiredHeaders = REQUIRED_HEADERS.filter(
    (field) => headerIndexes[field] === -1
  );
  if (missingRequiredHeaders.length > 0) {
    return NextResponse.json(
      {
        error: '模板列名不匹配，请使用官方模板',
        missing: missingRequiredHeaders,
      },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  let skippedEmpty = 0;
  const errors: ImportError[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const importRow: ImportRow = {
      account: getCellValue(row, headerIndexes.account),
      name: getCellValue(row, headerIndexes.name),
      roleRaw: getCellValue(row, headerIndexes.roleRaw),
      email: getCellValue(row, headerIndexes.email),
      className: getCellValue(row, headerIndexes.className),
      major: getCellValue(row, headerIndexes.major),
      year: getCellValue(row, headerIndexes.year),
      password: getCellValue(row, headerIndexes.password),
    };

    const rowNumber = i + 1;
    const rowIsEmpty = Object.values(importRow).every((value) => value === '');
    if (rowIsEmpty) {
      skippedEmpty += 1;
      continue;
    }

    if (!importRow.account || !importRow.name || !importRow.roleRaw) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: '账号、姓名、角色为必填列',
      });
      continue;
    }

    const role = parseRole(importRow.roleRaw);
    if (!role) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: `角色无效：${importRow.roleRaw}`,
      });
      continue;
    }

    try {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            {
              employeeNumber: {
                equals: importRow.account,
                mode: 'insensitive',
              },
            },
            {
              profile: {
                is: {
                  studentNumber: {
                    equals: importRow.account,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        },
        include: {
          profile: {
            select: {
              id: true,
            },
          },
        },
      });

      if (matchedUsers.length > 1) {
        errors.push({
          row: rowNumber,
          account: importRow.account,
          reason: '同一账号匹配到多个用户，请先清理重复数据',
        });
        continue;
      }

      const existing = matchedUsers[0];
      if (!existing) {
        await createUserFromImport(importRow, role);
        created += 1;
        continue;
      }

      await updateUserByAccount(
        existing.id,
        Boolean(existing.profile),
        importRow,
        role
      );
      updated += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: error instanceof Error ? error.message : '导入失败',
      });
    }
  }

  return NextResponse.json({
    created,
    updated,
    failed: errors.length,
    skippedEmpty,
    totalRows: Math.max(rows.length - 1, 0),
    errors,
  });
}
