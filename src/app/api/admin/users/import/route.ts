import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { UserRole, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { initializeUserProgress } from '@/lib/user-sync';
import { loadFirstWorksheetRows } from '@/lib/server-spreadsheet';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  buildFailedImportArtifact,
  minimizeFailedImportRows,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';

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

type PublicImportError = {
  row: number;
  accountFingerprint: string | null;
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

function sha256Hex(buffer: ArrayBuffer) {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
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
  const mode = formData.get('mode') === 'preview' ? 'preview' : 'commit';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
  }

  let rows: unknown[][] | null;
  let sourceFileHash: string;
  try {
    const fileBuffer = await file.arrayBuffer();
    sourceFileHash = sha256Hex(fileBuffer);
    rows = await loadFirstWorksheetRows(fileBuffer);
  } catch {
    return NextResponse.json(
      { error: '无法解析 Excel 文件，请使用官方模板重新填写' },
      { status: 400 }
    );
  }

  if (!rows) {
    return NextResponse.json({ error: '未找到工作表' }, { status: 400 });
  }

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
  const batchId = `admin-user-import-${Date.now().toString(36)}`;
  const seenAccounts = new Map<string, number>();

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

    const accountKey = importRow.account.trim().toLowerCase();
    const firstSeenRow = seenAccounts.get(accountKey);
    if (firstSeenRow) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: `同批次重复账号，已在第 ${firstSeenRow} 行出现`,
      });
      continue;
    }
    seenAccounts.set(accountKey, rowNumber);

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
        if (mode === 'commit') {
          await createUserFromImport(importRow, role);
        }
        created += 1;
        continue;
      }

      if (mode === 'commit') {
        await updateUserByAccount(
          existing.id,
          Boolean(existing.profile),
          importRow,
          role
        );
      }
      updated += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: error instanceof Error ? error.message : '导入失败',
      });
    }
  }

  const completedAt = new Date().toISOString();
  const failedRows = minimizeFailedImportRows(errors);
  const publicErrors = failedRows.map((row): PublicImportError => ({
    row: row.row,
    accountFingerprint: row.accountFingerprint,
    reason: row.reason,
  }));
  const failedRowArtifact = buildFailedImportArtifact({
    batchId,
    failedRows,
    generatedAt: completedAt,
  });
  const failedRowArtifactWithDownload = failedRowArtifact
    ? {
        ...failedRowArtifact,
        downloadUrl: `/api/admin/operations/artifacts/${encodeURIComponent(failedRowArtifact.id)}`,
      }
    : null;
  const artifactRefs = failedRowArtifactWithDownload ? [failedRowArtifactWithDownload] : [];
  const outcome = errors.length > 0 ? 'completed-with-errors' : 'completed';
  const idempotencyKey = buildAdminOperationIdempotencyKey([
    'admin-user-import',
    mode,
    sourceFileHash,
    session.user.id,
  ]);
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-user-import',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: `admin-users-import:${mode}`,
    startedAt: completedAt,
    completedAt,
    outcome,
    idempotencyKey,
    sourceFileHash,
    artifactRefs,
    retentionPolicy: {
      policy: 'admin-import-failed-row-artifacts-7d',
      expiresAt: failedRowArtifactWithDownload?.expiresAt,
      revocable: true,
    },
    rollback: {
      available: false,
      rationale: mode === 'preview'
        ? '预览不会写入账号，无需回滚。'
        : '批量账号导入会合并新建、更新与初始化进度；当前阶段保留审计与失败行证据，不启用自动回滚。',
    },
    auditSummary: `${mode === 'preview' ? '预览' : '提交'}完成：新增 ${created}，更新 ${updated}，失败 ${errors.length}，空行 ${skippedEmpty}。`,
    recoveryState: errors.length > 0
      ? {
          status: 'download-artifact',
          action: '下载 PII 最小化失败行后修正源文件',
        }
      : {
          status: mode === 'preview' ? 'available' : 'not-available',
          action: mode === 'preview' ? '确认导入或更换文件重新预览' : '通过批次审计记录复核导入结果',
        },
  });
  await persistAdminOperationLedger(
    operationLedger,
    failedRowArtifactWithDownload
      ? [{
          ref: failedRowArtifactWithDownload,
          operationId: operationLedger.operationId,
          payload: { failedRows },
        }]
      : [],
  );

  return NextResponse.json({
    batchId,
    mode,
    preview: mode === 'preview',
    created,
    updated,
    failed: errors.length,
    skippedEmpty,
    totalRows: Math.max(rows.length - 1, 0),
    errors: publicErrors,
    failedRowArtifact: failedRowArtifactWithDownload,
    failedRows,
    operationLedger,
    auditRecord: {
      actorId: session.user.id,
      action: 'admin-users-import',
      batchId,
      mode,
      outcome,
      created,
      updated,
      failed: errors.length,
      rollbackAvailable: false,
      rollbackRationale: operationLedger.rollback.rationale,
      operationId: operationLedger.operationId,
      idempotencyKey,
      retentionPolicy: operationLedger.retentionPolicy.policy,
      recordedAt: completedAt,
    },
  });
}
