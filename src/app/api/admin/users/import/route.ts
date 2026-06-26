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

type ImportDb = Pick<
  typeof prisma,
  'user' | 'studentProfile' | 'mission' | 'userProgress' | 'adminOperationLedger' | 'adminOperationArtifact'
>;

type ImportUserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: {
      select: {
        id: true;
      };
    };
  };
}>;

type PlannedImportOperation =
  | {
      type: 'create';
      rowNumber: number;
      row: ImportRow;
      role: UserRole;
      passwordHash: string;
    }
  | {
      type: 'update';
      rowNumber: number;
      userId: string;
      hasProfile: boolean;
      row: ImportRow;
      role: UserRole;
      passwordHash: string | null;
    };

class ImportWriteError extends Error {
  constructor(
    readonly row: number,
    readonly account: string,
    readonly cause: unknown
  ) {
    super('导入写入失败，请检查该行账号、邮箱或学生档案是否与现有数据冲突');
  }
}

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

async function createUserFromImport(
  db: ImportDb,
  row: ImportRow,
  role: UserRole,
  passwordHash: string
) {
  const user = await db.user.create({
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
    await initializeUserProgress(user.id, db);
  }
}

async function updateUserByAccount(
  db: ImportDb,
  userId: string,
  hasProfile: boolean,
  row: ImportRow,
  role: UserRole,
  passwordHash: string | null
) {
  const userUpdateData: Prisma.UserUpdateInput = {
    name: row.name,
    role,
    employeeNumber: role === UserRole.STUDENT ? null : row.account,
  };

  if (row.email) {
    userUpdateData.email = row.email;
  }

  if (passwordHash) {
    userUpdateData.passwordHash = passwordHash;
  }

  await db.user.update({
    where: { id: userId },
    data: userUpdateData,
  });

  if (role !== UserRole.STUDENT) {
    return;
  }

  const profilePatch = pickNonEmptyProfileUpdate(row);

  if (hasProfile) {
    await db.studentProfile.update({
      where: { userId },
      data: {
        studentNumber: row.account,
        ...profilePatch,
      },
    });
  } else {
    await db.studentProfile.create({
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
    await initializeUserProgress(userId, db);
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
  const seenEmails = new Map<string, number>();
  const plannedOperations: PlannedImportOperation[] = [];

  const findExistingUsersByAccount = (account: string) =>
    prisma.user.findMany({
      where: {
        OR: [
          {
            employeeNumber: {
              equals: account,
              mode: 'insensitive',
            },
          },
          {
            profile: {
              is: {
                studentNumber: {
                  equals: account,
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
    }) as Promise<ImportUserWithProfile[]>;

  const emailBelongsToAnotherUser = async (email: string, existingUserId?: string) => {
    const usersWithEmail = await prisma.user.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    return usersWithEmail.some((user) => user.id !== existingUserId);
  };

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

    if (importRow.email) {
      const emailKey = importRow.email.trim().toLowerCase();
      const firstSeenEmailRow = seenEmails.get(emailKey);
      if (firstSeenEmailRow) {
        errors.push({
          row: rowNumber,
          account: importRow.account,
          reason: `同批次重复邮箱，已在第 ${firstSeenEmailRow} 行出现`,
        });
        continue;
      }
      seenEmails.set(emailKey, rowNumber);
    }

    const matchedUsers = await findExistingUsersByAccount(importRow.account);

    if (matchedUsers.length > 1) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: '同一账号匹配到多个用户，请先清理重复数据',
      });
      continue;
    }

    const existing = matchedUsers[0];
    if (
      importRow.email
      && await emailBelongsToAnotherUser(importRow.email, existing?.id)
    ) {
      errors.push({
        row: rowNumber,
        account: importRow.account,
        reason: '邮箱已被其他用户使用',
      });
      continue;
    }

    if (!existing) {
      if (mode === 'commit') {
        plannedOperations.push({
          type: 'create',
          rowNumber,
          row: importRow,
          role,
          passwordHash: await hash(importRow.password || '123456', 10),
        });
      }
      created += 1;
      continue;
    }

    if (mode === 'commit') {
      plannedOperations.push({
        type: 'update',
        rowNumber,
        userId: existing.id,
        hasProfile: Boolean(existing.profile),
        row: importRow,
        role,
        passwordHash: importRow.password ? await hash(importRow.password, 10) : null,
      });
    }
    updated += 1;
  }

  const persistImportLedger = async (db: ImportDb) => {
    const completedAt = new Date().toISOString();
    const failedRows = minimizeFailedImportRows(errors);
    const publicErrors = failedRows.map((row): PublicImportError => ({
      row: row.row,
      accountFingerprint: row.accountFingerprint,
      reason: row.reason,
    }));
    const failedRowArtifact = buildFailedImportArtifact({
      batchId,
      artifactSeed: sourceFileHash,
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
      db,
    );
    return {
      completedAt,
      failedRows,
      publicErrors,
      failedRowArtifactWithDownload,
      outcome,
      idempotencyKey,
      operationLedger,
    };
  };

  const applyPlannedOperations = async (db: ImportDb) => {
    for (const operation of plannedOperations) {
      try {
        if (operation.type === 'create') {
          await createUserFromImport(db, operation.row, operation.role, operation.passwordHash);
          continue;
        }

        await updateUserByAccount(
          db,
          operation.userId,
          operation.hasProfile,
          operation.row,
          operation.role,
          operation.passwordHash
        );
      } catch (error) {
        throw new ImportWriteError(operation.rowNumber, operation.row.account, error);
      }
    }
  };

  const {
    completedAt,
    failedRows,
    publicErrors,
    failedRowArtifactWithDownload,
    outcome,
    idempotencyKey,
    operationLedger,
  } = mode === 'commit'
    ? await prisma.$transaction(async (tx) => {
        const db = tx as ImportDb;
        await applyPlannedOperations(db);
        return persistImportLedger(db);
      }).catch(async (error) => {
        if (!(error instanceof ImportWriteError)) {
          throw error;
        }
        errors.push({
          row: error.row,
          account: error.account,
          reason: error.message,
        });
        created = 0;
        updated = 0;
        return persistImportLedger(prisma);
      })
    : await persistImportLedger(prisma);

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
