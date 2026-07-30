 /**
 * 公式推导 API
 *
 * 调用 SymPy 子进程执行拉普拉斯变换、逆变换和符号化简的逐步推导。
 * 用于学生在互动课中查看公式推导过程。
 */

 import { NextRequest, NextResponse } from 'next/server';
 import { execFile } from 'node:child_process';
 import { promisify } from 'node:util';
 import { z } from 'zod';
 import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
 import { getServerAuthSession } from '@/lib/auth';

 const execFileAsync = promisify(execFile);

 export const dynamic = 'force-dynamic';

 // ── 请求校验 ────────────────────────────────────────────────────────────

 const DeriveType = z.enum(['laplace', 'simplify', 'inverse_laplace']);

 const DeriveRequestSchema = z.object({
   type: DeriveType,
   expression: z.string().min(1).max(500),
   variable: z.string().max(10).default('t'),
   params: z.record(z.unknown()).optional(),
 });

 // ── 响应类型 ────────────────────────────────────────────────────────────

 interface DerivationStep {
   step: number;
   description: string;
   operation: string;
   input: string;
   output: string;
 }

 interface DeriveSuccessResponse {
   status: 'ok';
   steps: DerivationStep[];
   result: string;
 }

 interface DeriveErrorResponse {
   status: 'error';
   steps: DerivationStep[];
   result: string;
   error: string;
 }

 type DeriveResponse = DeriveSuccessResponse | DeriveErrorResponse;

 // ── 路由处理 ────────────────────────────────────────────────────────────

 export async function POST(request: NextRequest) {
   try {
     const session = await getServerAuthSession();
     rethrowIfNextDynamicError(session);

     // 解析和校验请求体
     const body: unknown = await request.json();
     const parsed = DeriveRequestSchema.safeParse(body);

     if (!parsed.success) {
       return NextResponse.json(
         { error: 'Invalid request', details: parsed.error.flatten() },
         { status: 400 }
       );
     }

     const { type, expression, variable, params } = parsed.data;

     // 构造 Python 脚本输入
     const inputPayload = JSON.stringify({
       type,
       expression,
       variable,
       params: params ?? {},
     });

     // 调用 SymPy 脚本（超时 15 秒）
     const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
     const scriptPath = 'scripts/math/formula-derivation.py';

     const { stdout, stderr } = await execFileAsync(pythonCmd, [scriptPath], {
       input: inputPayload,
       timeout: 15_000,
       maxBuffer: 1024 * 1024,
       cwd: process.cwd(),
     });

     if (stderr) {
       console.warn('[formula-derivation] stderr:', stderr);
     }

     // 解析 Python 脚本输出
     const result: DeriveResponse = JSON.parse(stdout);

     if (result.status === 'error') {
       return NextResponse.json(result, { status: 422 });
     }

     return NextResponse.json(result);

   } catch (err) {
     // 超时或子进程崩溃
     if (err instanceof Error && 'code' in err) {
       const execErr = err as NodeJS.ErrnoException;
       if (execErr.code === 'ETIMEDOUT') {
         return NextResponse.json(
           { status: 'error', steps: [], result: '', error: 'Derivation timed out' },
           { status: 504 }
         );
       }
       if (execErr.code === 'ENOENT') {
         return NextResponse.json(
           { status: 'error', steps: [], result: '', error: 'Python not found' },
           { status: 503 }
         );
       }
     }

     console.error('[formula-derivation] Unexpected error:', err);
     return NextResponse.json(
       { status: 'error', steps: [], result: '', error: 'Internal server error' },
       { status: 500 }
     );
   }
 }
