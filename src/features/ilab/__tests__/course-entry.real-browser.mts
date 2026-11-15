import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { chromium } from '@playwright/test';
import { prisma } from '@/lib/prisma';

config({path:'.env.local',quiet:true});
config({quiet:true});
assert(['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
const origin=process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3001';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const password = randomBytes(24).toString('base64url');
const user = await prisma.user.create({data:{name:'本地055正常入口验收夹具',role:'STUDENT',
  employeeNumber:`ACT-VESSEL-${randomUUID()}`,passwordHash:await bcrypt.hash(password,10)}});
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1801,height:867}});
  let rawOpeningRequests = 0;
  page.on('request',(request)=> {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ilab/experiment-runs') rawOpeningRequests++;
  });
  page.setDefaultTimeout(30000);
  await page.goto(`${origin}/login?callbackUrl=%2Fsimulations%2Fdestroyer%3Fgraphics%3Dwebgl`,{waitUntil:'networkidle'});
  await page.getByPlaceholder('学号/工号').fill(user.employeeNumber!);
  await page.getByPlaceholder('密码',{exact:true}).fill(password).catch(()=>{throw new Error('本地测试登录字段不可用');});
  await page.getByRole('button',{name:'登录',exact:true}).click();
  try {await page.waitForURL((url)=>url.pathname === '/simulations/destroyer',{waitUntil:'domcontentloaded'});}
  catch {
    const text = (await page.locator('body').innerText()).replaceAll(password,'[omitted]').replaceAll(user.employeeNumber!,'[test-account]');
    console.log(JSON.stringify({phase:'login',pathname:new URL(page.url()).pathname,message:text.slice(0,1500)}));
    throw new Error('正常登录回调尚未完成');
  }
  await page.getByLabel('运行前预测与理由',{exact:true}).fill('正常账户入口验收夹具，保持直航并观察仪器量测。');
  const start = page.getByRole('button',{name:'开始',exact:true});
  await start.waitFor({state:'visible'});
  await page.waitForFunction(()=>![...document.querySelectorAll('button')].find((button)=>button.innerText.trim()==='开始')?.disabled);
  await start.click();
  await page.getByRole('button',{name:'暂停',exact:true}).waitFor();
  const deadline = Date.now()+90000;
  let saved;
  while(Date.now()<deadline) {
    saved = await prisma.simulationRun.findFirst({where:{ownerUserId:user.id,sourceDomain:'ilab-course'},include:{traces:true}});
    if(saved?.status === 'completed' && saved.traces.length) break;
    await page.waitForTimeout(300);
  }
  if(saved?.status !== 'completed' || !saved.traces.length) {
    const status = await page.locator('[role="status"]').allTextContents();
    throw new Error(`原页面运行未获得分块回执 ${status.join(' | ')}`);
  }
  const summary = saved.summary as {controlCount:number;nativeCount:number;fineCount?:number;lastTimeS:number};
  assert(summary.controlCount>0 && summary.nativeCount>0);
  const openingCount = rawOpeningRequests;
  await page.getByRole('button',{name:'同步本轮实验记录',exact:true}).click();
  await page.getByText('本轮原始运行、模型、对照与提交尝试已同步。',{exact:true}).waitFor();
  assert.equal(rawOpeningRequests,openingCount,'Completed raw runs should reuse durable local receipts');
  const emptyRound = `account:${user.id}:destroyer:seven-vessel-2026.11.14:round:${randomUUID()}`;
  await page.evaluate((scope)=>localStorage.setItem(scope.slice(0,scope.indexOf(':round:'))+':active-round',scope),emptyRound);
  await page.reload({waitUntil:'domcontentloaded'});
  const prediction = page.getByLabel('运行前预测与理由',{exact:true});
  await prediction.waitFor();
  await page.waitForFunction(()=>{
    const input=document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与理由"]');
    return input && !input.matches(':disabled');
  });
  assert.equal(await prediction.inputValue(),'','A missing round draft must start with empty answers');
  await page.getByRole('tab',{name:'评估',exact:true}).click();
  assert.equal(await page.getByLabel('分析运行记录',{exact:true}).locator('option').count(),1);
  assert.equal(await page.getByLabel('冻结的学生模型',{exact:true}).locator('option').count(),1);
  assert.equal(rawOpeningRequests,openingCount,'Changing rounds must not upload prior round evidence');
  await page.getByRole('button',{name:/继续此轮实验/}).click();
  await page.getByRole('tab',{name:'控制',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与理由"]')?.value
    === '正常账户入口验收夹具，保持直航并观察仪器量测。');
  console.log(JSON.stringify({status:'passed',entry:'normal-login-and-original-page',
    serverStatus:saved.status,controlSamples:summary.controlCount,nativeSamples:summary.nativeCount,
    fineWindowSamples:summary.fineCount ?? 0,timeS:summary.lastTimeS,chunks:saved.traces.length,
    repeatedRawOpenings:rawOpeningRequests-openingCount,emptyRoundIsolation:true,previousRoundRecovered:true}));
} finally {
  await browser?.close();
  await prisma.simulationRun.deleteMany({where:{ownerUserId:user.id}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.$disconnect();
}
