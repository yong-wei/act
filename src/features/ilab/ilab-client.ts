import { createHash } from 'node:crypto';

import type { IlabUploadBody } from './payload';

export interface IlabUserProfileClaims {
  username: string;
  displayName: string;
  studentNumber?: string;
  email?: string;
  phone?: string;
  school?: string;
  department?: string;
  major?: string;
  className?: string;
  year?: number;
  gender?: string;
  rawAttributes: Record<string, string | number | boolean>;
}

export interface IlabTokenResult {
  accessToken: string;
  username: string;
  displayName: string;
  expiresAtMs: number | null;
  bypass: boolean;
  profileClaims?: IlabUserProfileClaims;
}

export interface IlabRemoteResult {
  code: number;
  message: string;
  body: unknown;
}

export function decodeIlabTicket(ticket: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(ticket)) return ticket;
  try {
    return decodeURIComponent(ticket);
  } catch {
    return ticket;
  }
}

export function ilabSignature(ticket: string, appId: string, secret: string): string {
  const text = `${decodeIlabTicket(ticket)}${appId}${secret}`;
  return createHash('md5').update(text, 'utf8').digest('hex').toUpperCase();
}

export function ilabTokenUrl(baseUrl: string, ticket: string, appId: string, secret: string): string {
  const signature = ilabSignature(ticket, appId, secret);
  const encodedTicket = encodeURIComponent(decodeIlabTicket(ticket));
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/open/api/v2/token?ticket=${encodedTicket}&appid=${encodeURIComponent(appId)}&signature=${signature}`;
}

export function ilabRefreshSignature(accessToken: string, appId: string, secret: string): string {
  const text = `${decodeIlabTicket(accessToken)}${appId}${secret}`;
  return createHash('md5').update(text, 'utf8').digest('hex').toUpperCase();
}

export function ilabRefreshUrl(baseUrl: string, accessToken: string, appId: string, secret: string): string {
  const rawAccessToken = decodeIlabTicket(accessToken);
  const signature = ilabRefreshSignature(rawAccessToken, appId, secret);
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/open/api/v2/token/refresh?access_token=${encodeURIComponent(rawAccessToken)}&appid=${encodeURIComponent(appId)}&signature=${signature}`;
}

const SECRET_FIELD_KEYS = new Set([
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'secret',
  'appSecret',
  'signature',
]);

const ENVELOPE_STATUS_KEYS = new Set([
  'code',
  'msg',
  'message',
  'status',
]);

function readScalarRecord(source: unknown): Record<string, string | number | boolean> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (SECRET_FIELD_KEYS.has(key) || ENVELOPE_STATUS_KEYS.has(key)) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed.length <= 512) result[key] = trimmed;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

function decodeJwtPayloadObject(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const jsonText = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonText) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function pickFirstString(records: Array<Record<string, string | number | boolean>>, keys: string[]): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return undefined;
}

function parseYearCandidate(records: Array<Record<string, string | number | boolean>>): number | undefined {
  for (const record of records) {
    for (const key of ['year', 'grade', 'nj', 'enrollYear', 'enrollmentYear']) {
      const value = record[key];
      const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
      if (Number.isInteger(numeric) && numeric >= 2000 && numeric <= 2100) {
        return numeric;
      }
    }
  }
  return undefined;
}

export function extractIlabUserProfileClaims(
  body: Record<string, unknown>,
  accessToken?: string,
  ticket?: string,
): IlabUserProfileClaims {
  const topScalars = readScalarRecord(body);
  const nestedUser = readScalarRecord(body.user);
  const nestedData = readScalarRecord(body.data);
  const jwtScalars = accessToken ? readScalarRecord(decodeJwtPayloadObject(accessToken)) : {};
  const ticketScalars = ticket ? readScalarRecord(decodeJwtPayloadObject(decodeIlabTicket(ticket))) : {};
  const ordered = [topScalars, nestedUser, nestedData, jwtScalars, ticketScalars];

  const username = pickFirstString(ordered, ['un', 'username', 'userName', 'user_name', 'sub', 'uid', 'userId']) ?? '';
  const displayName = pickFirstString(ordered, ['dis', 'displayName', 'display_name', 'realName', 'real_name', 'name', 'nickname']) ?? username;
  const studentNumber = pickFirstString(ordered, ['studentNumber', 'student_no', 'studentNo', 'studentId', 'student_id', 'sno', 'xh', 'userCode', 'user_code']);
  const rawEmail = pickFirstString(ordered, ['email', 'mail', 'e_mail']);
  const email = rawEmail ? rawEmail.toLowerCase() : undefined;
  const phone = pickFirstString(ordered, ['phone', 'mobile', 'tel', 'telephone']);
  const school = pickFirstString(ordered, ['school', 'schoolName', 'school_name', 'unit', 'unitName', 'org', 'orgName', 'university']);
  const department = pickFirstString(ordered, ['department', 'deptName', 'dept_name', 'college', 'collegeName', 'academy', 'faculty']);
  const major = pickFirstString(ordered, ['major', 'majorName', 'major_name', 'specialty', 'profession']);
  const className = pickFirstString(ordered, ['className', 'class_name', 'bj', 'clazz', 'class']);
  const gender = pickFirstString(ordered, ['gender', 'sex']);
  const year = parseYearCandidate(ordered);

  const rawAttributes: Record<string, string | number | boolean> = {
    ...ticketScalars,
    ...jwtScalars,
    ...nestedData,
    ...nestedUser,
    ...topScalars,
  };

  return {
    username,
    displayName,
    ...(studentNumber ? { studentNumber } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(school ? { school } : {}),
    ...(department ? { department } : {}),
    ...(major ? { major } : {}),
    ...(className ? { className } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(gender ? { gender } : {}),
    rawAttributes,
  };
}

function hasExtraClaims(claims: IlabUserProfileClaims): boolean {
  const standardKeys = new Set(['code', 'msg', 'un', 'dis', 'create_time', 'create_time_display', 'expires_time', 'expires_time_display']);
  return Boolean(
    claims.studentNumber
    || claims.email
    || claims.phone
    || claims.school
    || claims.department
    || claims.major
    || claims.className
    || claims.year !== undefined
    || claims.gender
    || Object.keys(claims.rawAttributes).some((key) => !standardKeys.has(key)),
  );
}

export async function refreshIlabAccessToken(input: {
  accessToken: string;
  appId: string;
  secret: string;
  baseUrl: string;
  devBypass: boolean;
  fetcher?: typeof fetch;
}): Promise<IlabTokenResult> {
  if (input.devBypass && input.accessToken === 'dev-bypass-token') {
    return {
      accessToken: 'dev-bypass-token',
      username: 'dev_student',
      displayName: '本地演示',
      expiresAtMs: null,
      bypass: true,
    };
  }
  if (!input.accessToken.trim()) {
    throw new Error('缺少实验空间访问令牌，无法刷新。');
  }
  if (!input.appId || !input.secret || !input.baseUrl) {
    throw new Error('实验空间 APPID、密钥或地址未配置。');
  }
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(ilabRefreshUrl(input.baseUrl, input.accessToken, input.appId, input.secret), {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json() as Record<string, unknown> & { code?: number; msg?: string; access_token?: string; un?: string; dis?: string; expires_time?: number };
  if (body.code !== 0 || !body.access_token) {
    throw new Error(body.msg ? `${body.msg}（code ${body.code ?? response.status}）` : `实验空间令牌刷新失败（code ${body.code ?? response.status}）。`);
  }
  const claims = extractIlabUserProfileClaims(body, body.access_token);
  return {
    accessToken: body.access_token,
    username: body.un || claims.username || '',
    displayName: body.dis || body.un || claims.displayName || '',
    expiresAtMs: typeof body.expires_time === 'number' ? body.expires_time : null,
    bypass: false,
    ...(hasExtraClaims(claims) ? { profileClaims: claims } : {}),
  };
}

export async function exchangeIlabTicket(input: {
  ticket: string;
  appId: string;
  secret: string;
  baseUrl: string;
  devBypass: boolean;
  fetcher?: typeof fetch;
}): Promise<IlabTokenResult> {
  if (input.devBypass && input.ticket === 'dev-bypass') {
    return {
      accessToken: 'dev-bypass-token',
      username: 'dev_student',
      displayName: '本地演示',
      expiresAtMs: null,
      bypass: true,
      profileClaims: {
        username: 'dev_student',
        displayName: '本地演示',
        className: '实验空间演示班',
        rawAttributes: { un: 'dev_student', dis: '本地演示', bypass: true },
      },
    };
  }
  if (!input.appId || !input.secret || !input.baseUrl) {
    throw new Error('实验空间 APPID、密钥或地址未配置。');
  }
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(ilabTokenUrl(input.baseUrl, input.ticket, input.appId, input.secret), {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json() as Record<string, unknown> & { code?: number; msg?: string; access_token?: string; un?: string; dis?: string; expires_time?: number };
  if (body.code !== 0 || !body.access_token || !body.un) {
    throw new Error(body.msg || `实验空间票据校验失败（code ${body.code ?? response.status}）。`);
  }
  const profileClaims = extractIlabUserProfileClaims(body, body.access_token, input.ticket);
  return {
    accessToken: body.access_token,
    username: body.un,
    displayName: body.dis || profileClaims.displayName || body.un,
    expiresAtMs: typeof body.expires_time === 'number' ? body.expires_time : null,
    bypass: false,
    profileClaims,
  };
}

async function readRemote(response: Response): Promise<IlabRemoteResult> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { code?: number; msg?: string };
    return { code: typeof body.code === 'number' ? body.code : -1, message: body.msg || '', body };
  } catch {
    return { code: -1, message: text.slice(0, 200) || `HTTP ${response.status}`, body: text.slice(0, 200) };
  }
}

export async function uploadIlabScore(input: {
  baseUrl: string;
  accessToken: string;
  payload: IlabUploadBody;
  fetcher?: typeof fetch;
}): Promise<IlabRemoteResult> {
  const fetcher = input.fetcher ?? fetch;
  const root = input.baseUrl.replace(/\/+$/, '');
  const response = await fetcher(`${root}/open/api/v2/data_upload?access_token=${encodeURIComponent(input.accessToken)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input.payload),
    signal: AbortSignal.timeout(20000),
  });
  return readRemote(response);
}

export async function uploadIlabReport(input: {
  baseUrl: string;
  accessToken: string;
  appId: string;
  originId: string;
  filename: string;
  title: string;
  html: string;
  fetcher?: typeof fetch;
}): Promise<IlabRemoteResult> {
  if (!input.html.trim()) throw new Error('实验报告为空。');
  if (Buffer.byteLength(input.html, 'utf8') > 5 * 1024 * 1024) throw new Error('实验报告超过 5MB。');
  const fetcher = input.fetcher ?? fetch;
  const root = input.baseUrl.replace(/\/+$/, '');
  const query = new URLSearchParams({
    access_token: input.accessToken,
    appid: input.appId,
    originId: input.originId,
    filename: input.filename,
    title: input.title,
  });
  const response = await fetcher(`${root}/open/api/v2/attachment_upload?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: input.html,
    signal: AbortSignal.timeout(20000),
  });
  return readRemote(response);
}
