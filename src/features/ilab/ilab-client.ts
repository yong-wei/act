import { createHash } from 'node:crypto';

import type { IlabUploadBody } from './payload';

export interface IlabTokenResult {
  accessToken: string;
  username: string;
  displayName: string;
  expiresAtMs: number | null;
  bypass: boolean;
}

export interface IlabRemoteResult {
  code: number;
  message: string;
  body: unknown;
}

export function decodeIlabTicket(ticket: string): string {
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
  const body = await response.json() as { code?: number; msg?: string; access_token?: string; un?: string; dis?: string; expires_time?: number };
  if (body.code !== 0 || !body.access_token || !body.un) {
    throw new Error(body.msg || `实验空间票据校验失败（code ${body.code ?? response.status}）。`);
  }
  return {
    accessToken: body.access_token,
    username: body.un,
    displayName: body.dis || body.un,
    expiresAtMs: typeof body.expires_time === 'number' ? body.expires_time : null,
    bypass: false,
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
