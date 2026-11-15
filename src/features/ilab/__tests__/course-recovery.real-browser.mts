import {config} from 'dotenv';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {chromium,type BrowserContext,type Page} from '@playwright/test';
import {prisma} from '@/lib/prisma';
import {readSimulationTraceChunk} from '@/lib/data-governance/simulation-trace-cas';
import {vesselRunStorageSummary} from '@/features/ilab/course-evidence-service';

config({path:'.env.local',quiet:true});
config({quiet:true});
const origin=process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3002';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
assert(['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
const password=randomBytes(24).toString('base64url');
const user=await prisma.user.create({data:{name:'原页面跨设备恢复验收夹具',role:'STUDENT',
  employeeNumber:`QA-RECOVERY-${randomUUID()}`,passwordHash:await bcrypt.hash(password,10)}});
const browser=await chromium.launch({channel:'chrome',headless:true});
let first:BrowserContext | undefined;
let second:BrowserContext | undefined;
let debugPage:Page | undefined;

async function enter(context:BrowserContext) {
  const page=await context.newPage();
  debugPage=page;
  page.setDefaultTimeout(30000);
  await page.goto(`${origin}/login?callbackUrl=%2Fsimulations%2Fcruise%3Fgraphics%3Dwebgl`,{waitUntil:'networkidle'});
  await page.getByPlaceholder('学号/工号').fill(user.employeeNumber!);
  await page.getByPlaceholder('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  try { await page.waitForURL((url)=>url.pathname==='/simulations/cruise',{waitUntil:'domcontentloaded'}); }
  catch {
    const message=(await page.locator('body').innerText()).replaceAll(password,'[omitted]').replaceAll(user.employeeNumber!,'[fixture]');
    console.log(JSON.stringify({phase:'normal-login',pathname:new URL(page.url()).pathname,message:message.slice(-1600)}));
    throw new Error('Normal credentials login did not finish');
  }
  await page.locator('[data-marine-status="runnable"]').waitFor();
  await page.getByLabel('运行前预测与方案依据',{exact:true}).waitFor();
  return page;
}

async function activeLocalRun(page:Page) {
  return page.evaluate(async () => {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('act-vessel-experiment-v2');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const rows=await new Promise<Array<{id:string;checkpoint:string;lastTimeS:number;traceLength:number}>>((resolve,reject)=>{
      const request=db.transaction('runs').objectStore('runs').getAll();
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    db.close();
    return rows.sort((a,b)=>b.lastTimeS-a.lastTimeS)[0];
  });
}

try {
  first=await browser.newContext({viewport:{width:1801,height:867}});
  const page=await enter(first);
  const prediction='跨设备恢复夹具，观察本人仪器读数与持续保存的完整恢复点。';
  await page.getByLabel('运行前预测与方案依据',{exact:true}).fill(prediction);
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForFunction(()=>{
    const match=/仿真时间\s*([\d.]+)\s*s/.exec(document.body.innerText);
    return match && Number(match[1])>=12;
  });
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.waitForTimeout(800);
  const local=await activeLocalRun(page);
  assert(local.lastTimeS>=12 && local.lastTimeS<60);
  let saved;
  const deadline=Date.now()+30000;
  while(Date.now()<deadline) {
    saved=await prisma.simulationRun.findFirst({where:{ownerUserId:user.id,sourceRefId:local.id}});
    if(saved && Math.abs(vesselRunStorageSummary(saved).lastTimeS-local.lastTimeS)<1e-7) break;
    await page.waitForTimeout(250);
  }
  assert(saved,'Automatic cloud save did not create the run');
  const summary=vesselRunStorageSummary(saved);
  assert.equal(summary.lastTimeS,local.lastTimeS);
  assert.equal(saved.status,'running');
  assert.equal(saved.completedAt,null);
  const remote=await readSimulationTraceChunk<{checkpoint:string}>(summary.lastCheckpointReference);
  assert.equal(remote.checkpoint,local.checkpoint);
  await first.close();first=undefined;

  second=await browser.newContext({viewport:{width:1801,height:867}});
  const recoveredPage=await enter(second);
  await recoveredPage.waitForFunction((expected)=>{
    const text=document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与方案依据"]')?.value;
    return text===expected;
  },prediction);
  const recovered=await activeLocalRun(recoveredPage);
  assert.equal(recovered.id,local.id);
  assert.equal(recovered.lastTimeS,local.lastTimeS);
  assert.equal(recovered.traceLength,local.traceLength);
  assert.equal(recovered.checkpoint,local.checkpoint);
  await recoveredPage.getByRole('button',{name:'开始',exact:true}).click();
  await recoveredPage.waitForFunction((time)=>{
    const match=/仿真时间\s*([\d.]+)\s*s/.exec(document.body.innerText);
    return match && Number(match[1])>time+2;
  },local.lastTimeS);
  await recoveredPage.getByRole('button',{name:'暂停',exact:true}).click();
  const continued=await activeLocalRun(recoveredPage);
  assert.equal(continued.id,local.id);
  assert(continued.lastTimeS>local.lastTimeS);
  const oldOrigin=await recoveredPage.evaluate(()=>sessionStorage.getItem('act-vessel-origin:cruise-comfort'));
  await recoveredPage.getByRole('tab',{name:'评估',exact:true}).click();
  await recoveredPage.getByRole('button',{name:'开启新一轮实验',exact:true}).click();
  await recoveredPage.getByRole('tab',{name:'控制',exact:true}).click();
  await recoveredPage.waitForFunction((previous)=>{
    const current=sessionStorage.getItem('act-vessel-origin:cruise-comfort');
    const answer=document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与方案依据"]');
    return current && current!==previous && answer?.value==='';
  },oldOrigin);
  await recoveredPage.waitForTimeout(900);
  await second.close();second=undefined;
  first=await browser.newContext({viewport:{width:1801,height:867}});
  const emptyRoundPage=await enter(first);
  await emptyRoundPage.waitForFunction(()=>{
    const answer=document.querySelector<HTMLTextAreaElement>('[aria-label="运行前预测与方案依据"]');
    return answer && !answer.matches(':disabled');
  });
  assert.equal(await emptyRoundPage.getByLabel('运行前预测与方案依据',{exact:true}).inputValue(),'');
  assert(!(await activeLocalRun(emptyRoundPage)),'An empty new round must not hydrate the earlier physical run');
  console.log(JSON.stringify({status:'passed',entry:'normal-login-original-cruise-page',
    inProgressTimeS:local.lastTimeS,controlSamples:local.traceLength,checkpointExact:true,
    separateBrowserContext:true,sameRunContinued:true,continuedTimeS:continued.lastTimeS,
    forceNewOrigin:true,emptyRoundCrossDeviceIsolation:true}));
} catch (error) {
  if (debugPage && !debugPage.isClosed()) {
    const message=(await debugPage.locator('body').innerText()).replaceAll(password,'[omitted]').replaceAll(user.employeeNumber!,'[fixture]');
    console.log(JSON.stringify({phase:'course-recovery',pathname:new URL(debugPage.url()).pathname,message:message.slice(-3500)}));
  }
  throw error;
} finally {
  await first?.close();await second?.close();await browser.close();
  await prisma.simulationRun.deleteMany({where:{ownerUserId:user.id}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.$disconnect();
}
