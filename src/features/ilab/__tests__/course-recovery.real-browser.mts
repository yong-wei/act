import {config} from 'dotenv';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {chromium,expect,type BrowserContext,type Page,type Request as PlaywrightRequest} from '@playwright/test';
import {prisma} from '@/lib/prisma';
import {readSimulationTraceChunk} from '@/lib/data-governance/simulation-trace-cas';
import {vesselRunStorageSummary} from '@/features/ilab/course-evidence-service';

config({path:'.env.local',quiet:true});
config({quiet:true});
const origin=process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3002';
const courseKey=process.env.VESSEL_RECOVERY_COURSE ?? 'cruise';
assert(['cruise','container','drilling','destroyer','lng'].includes(courseKey));
const experimentKey={cruise:'cruise-comfort',container:'container-voyage',drilling:'drilling-dp',destroyer:'destroyer',lng:'lng-berthing'}[courseKey]!;
const predictionLabel=courseKey==='destroyer' ? '运行前预测与理由'
  : courseKey==='lng' ? '运行或分析前的预测' : '运行前预测与方案依据';
const storageKey=courseKey==='destroyer' ? 'act-destroyer-origin' : `act-vessel-origin:${experimentKey}`;
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
assert(['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
const password=randomBytes(24).toString('base64url');
const user=await prisma.user.create({data:{name:'原页面跨设备恢复验收夹具',role:'STUDENT',
  employeeNumber:`QA-RECOVERY-${randomUUID()}`,passwordHash:await bcrypt.hash(password,10)}});
const browser=await chromium.launch({channel:'chrome',headless:true});
let first:BrowserContext | undefined;
let second:BrowserContext | undefined;
let third:BrowserContext | undefined;
let debugPage:Page | undefined;

async function enter(context:BrowserContext) {
  const page=await context.newPage();
  debugPage=page;
  page.setDefaultTimeout(30000);
  await page.goto(`${origin}/login?callbackUrl=${encodeURIComponent(`/simulations/${courseKey}?graphics=webgl`)}`,{waitUntil:'networkidle'});
  await page.getByPlaceholder('学号/工号').fill(user.employeeNumber!);
  await page.getByPlaceholder('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  try { await page.waitForURL((url)=>url.pathname===`/simulations/${courseKey}`,{waitUntil:'domcontentloaded'}); }
  catch {
    const message=(await page.locator('body').innerText()).replaceAll(password,'[omitted]').replaceAll(user.employeeNumber!,'[fixture]');
    console.log(JSON.stringify({phase:'normal-login',pathname:new URL(page.url()).pathname,message:message.slice(-1600)}));
    throw new Error('Normal credentials login did not finish');
  }
  await page.locator('[data-marine-status="runnable"]').waitFor();
  await page.getByLabel(predictionLabel,{exact:true}).waitFor();
  await page.getByRole('button',{name:'开始',exact:true}).waitFor({state:'visible'});
  await expect(page.getByRole('button',{name:'开始',exact:true})).toBeEnabled({timeout:60000});
  return page;
}

async function waitCloud(runId:string,timeS:number) {
  const deadline=Date.now()+30000;
  while(Date.now()<deadline) {
    const saved=await prisma.simulationRun.findFirst({where:{ownerUserId:user.id,sourceRefId:runId}});
    if(saved && Math.abs(vesselRunStorageSummary(saved).lastTimeS-timeS)<1e-7) return saved;
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  throw new Error('Automatic cloud checkpoint did not reach the local watermark');
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
  await page.getByLabel(predictionLabel,{exact:true}).fill(prediction);
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForFunction(()=>{
    const match=/仿真时间\s*([\d.]+)\s*s/.exec(document.body.innerText);
    return match && Number(match[1])>=6;
  });
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.waitForTimeout(800);
  const local=await activeLocalRun(page);
  assert(local.lastTimeS>=6 && local.lastTimeS<60);
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
  if (courseKey!=='destroyer') {
    const auditOrigin=await page.evaluate((key)=>sessionStorage.getItem(key),storageKey);
    assert(auditOrigin);
    const response=await page.request.get(`${origin}/api/ilab/vessel/session/${encodeURIComponent(auditOrigin)}`);
    assert.equal(response.status(),200);
    const audit=await response.json();
    assert.equal(audit.auditTelemetry.controlSampleCadenceS,.05);
    assert.equal(audit.auditTelemetry.totalSamplePoints,summary.controlCount);
    assert.equal(audit.auditTelemetry.persistedChunkCount,summary.chunkCount);
    if (['cruise','container','drilling'].includes(courseKey)) {
      const tourWrites:string[]=[];
      const capture=(request:PlaywrightRequest)=>{
        if (['POST','PATCH','PUT','DELETE'].includes(request.method()) && new URL(request.url()).pathname.startsWith('/api/ilab/')) {
          tourWrites.push(new URL(request.url()).pathname);
        }
      };
      await page.locator('[data-highlight-tour-toggle]').click();
      await page.locator('[data-highlight-tour-banner]').waitFor();
      const expectedNode={cruise:'node-mismatch',container:'node-container',drilling:'node-drilling'}[courseKey]!;
      await expect(page.locator(`button[data-tour-node-pill="${expectedNode}"]`)).toBeVisible();
      page.on('request',capture);
      await page.getByLabel(predictionLabel,{exact:true}).fill('只读导览临时输入，不应进入本人实验。');
      await expect(page.getByRole('button',{name:'导览只读锁定',exact:true})).toBeDisabled();
      await page.waitForTimeout(1600);
      page.off('request',capture);
      assert.deepEqual(tourWrites,[],'Read-only tour must not write formal experiment state');
      await page.locator('[data-highlight-tour-exit]').click();
      await page.locator('[data-highlight-tour-banner]').waitFor({state:'hidden'});
      await expect(page.getByLabel(predictionLabel,{exact:true})).toHaveValue(prediction);
      const returnedFromTour=await activeLocalRun(page);
      assert.equal(returnedFromTour.id,local.id);
      assert.equal(returnedFromTour.checkpoint,local.checkpoint);
      assert.equal(await page.evaluate((key)=>sessionStorage.getItem(key),storageKey),auditOrigin);
    }
  }
  console.log(JSON.stringify({courseKey,phase:'first-browser-saved',timeS:local.lastTimeS}));

  second=await browser.newContext({viewport:{width:1801,height:867}});
  const recoveredPage=await enter(second);
  await expect(recoveredPage.getByLabel(predictionLabel,{exact:true})).toHaveValue(prediction);
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
  await recoveredPage.waitForTimeout(800);
  const continued=await activeLocalRun(recoveredPage);
  assert.equal(continued.id,local.id);
  assert(continued.lastTimeS>local.lastTimeS);
  await waitCloud(continued.id,continued.lastTimeS);
  console.log(JSON.stringify({courseKey,phase:'second-browser-advanced',timeS:continued.lastTimeS}));
  debugPage=page;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByLabel(predictionLabel,{exact:true}).waitFor();
  await expect(page.getByRole('button',{name:'开始',exact:true})).toBeEnabled({timeout:60000});
  const returned=await activeLocalRun(page);
  assert.equal(returned.id,continued.id);
  assert.equal(returned.lastTimeS,continued.lastTimeS);
  assert.equal(returned.checkpoint,continued.checkpoint,'The first browser must reconcile its existing, older cache');
  debugPage=recoveredPage;
  const oldOrigin=await recoveredPage.evaluate((key)=>sessionStorage.getItem(key),storageKey);
  await recoveredPage.getByRole('tab',{name:'评估',exact:true}).click();
  await recoveredPage.getByRole('button',{name:'开启新一轮实验',exact:true}).click();
  await recoveredPage.getByRole('tab',{name:'控制',exact:true}).click();
  await recoveredPage.waitForFunction(({previous,key,label})=>{
    const current=sessionStorage.getItem(key);
    const answer=document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
    return current && current!==previous && answer?.value==='';
  },{previous:oldOrigin,key:storageKey,label:predictionLabel});
  const newOrigin=await recoveredPage.evaluate((key)=>sessionStorage.getItem(key),storageKey);
  assert(newOrigin && newOrigin!==oldOrigin);
  await recoveredPage.getByLabel(predictionLabel,{exact:true}).fill('New round B prediction');
  await recoveredPage.waitForTimeout(900);
  const before=await prisma.ilabExperimentRun.findUniqueOrThrow({where:{originId:newOrigin}});
  await recoveredPage.getByRole('tab',{name:'评估',exact:true}).click();
  if(courseKey==='destroyer') {
    await recoveredPage.getByRole('button',{name:/继续此轮实验/}).first().click();
  } else {
    const selector=recoveredPage.getByLabel('本机实验轮次',{exact:true});
    const oldScope=await selector.locator('option').evaluateAll((options)=>options.map((option)=>(option as HTMLOptionElement).value).find((value)=>!value.includes(':round:')));
    assert(oldScope); await selector.selectOption(oldScope);
  }
  await recoveredPage.getByRole('tab',{name:'控制',exact:true}).click();
  await expect(recoveredPage.getByLabel(predictionLabel,{exact:true})).not.toHaveValue('New round B prediction');
  await recoveredPage.getByLabel(courseKey==='destroyer' ? '证据解释与适用边界' : predictionLabel,{exact:true}).fill('Historical round A edited');
  await recoveredPage.waitForTimeout(1500);
  const after=await prisma.ilabExperimentRun.findUniqueOrThrow({where:{originId:newOrigin}});
  assert.deepEqual(after.stepDrafts,before.stepDrafts,'Historical A must never overwrite the new origin B');
  const historical=await prisma.ilabExperimentRun.findUniqueOrThrow({where:{originId:oldOrigin!}});
  const historicalAnswers=(historical.stepDrafts as {bySeq:Record<string,Record<string,string>>}).bySeq['1'];
  assert.equal(historicalAnswers[courseKey==='destroyer' ? 'interpretation' : 'prediction'],'Historical round A edited');
  third=await browser.newContext({viewport:{width:1801,height:867}});
  const emptyRoundPage=await enter(third);
  await expect(emptyRoundPage.getByLabel(predictionLabel,{exact:true})).toBeEnabled();
  assert.equal(await emptyRoundPage.getByLabel(predictionLabel,{exact:true}).inputValue(),'New round B prediction');
  assert.equal(await emptyRoundPage.evaluate((key)=>sessionStorage.getItem(key),storageKey),newOrigin);
  assert(!(await activeLocalRun(emptyRoundPage)),'An empty new round must not hydrate the earlier physical run');
  if (courseKey!=='destroyer') {
    const response=await emptyRoundPage.request.get(`${origin}/api/ilab/vessel/session/${encodeURIComponent(newOrigin)}`);
    assert.equal(response.status(),200);
    const body=await response.json();
    assert.equal(body.auditTelemetry.totalSamplePoints,0,'New-round audit must exclude historical records');
  }
  if(courseKey==='cruise') {
    await recoveredPage.close();
    const branchPage=await second.newPage();debugPage=branchPage;
    await branchPage.goto(`${origin}/simulations`,{waitUntil:'domcontentloaded'});
    await branchPage.evaluate(async (runId)=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('act-vessel-experiment-v2');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      await new Promise<void>((resolve,reject)=>{const tx=db.transaction('runs','readwrite');const store=tx.objectStore('runs');
        const request=store.get(runId);request.onsuccess=()=>store.put({...request.result,checkpoint:'conflicting-local-checkpoint'});
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    },continued.id);
    await branchPage.goto(`${origin}/simulations/cruise?graphics=webgl`,{waitUntil:'domcontentloaded'});
    await branchPage.getByText('这次运行在不同设备上产生了不同的记录。本机记录已保留，请选择原实验轮次或新建一轮实验。',{exact:true}).waitFor();
    await branchPage.getByRole('tab',{name:'评估',exact:true}).click();
    await expect(branchPage.getByRole('button',{name:'开启新一轮实验',exact:true})).toBeEnabled();
    await branchPage.getByRole('button',{name:'开启新一轮实验',exact:true}).click();
    await branchPage.getByRole('tab',{name:'控制',exact:true}).click();
    await expect(branchPage.getByRole('button',{name:'开始',exact:true})).toBeEnabled({timeout:60000});
  }
  console.log(JSON.stringify({status:'passed',entry:`normal-login-original-${courseKey}-page`,
    inProgressTimeS:local.lastTimeS,controlSamples:local.traceLength,checkpointExact:true,
    separateBrowserContext:true,sameRunContinued:true,continuedTimeS:continued.lastTimeS,
    returnedBrowserCacheReconciled:true,forceNewOrigin:true,historicalRoundOriginIsolated:true,emptyRoundCrossDeviceIsolation:true,
    ...(courseKey==='cruise' ? {branchConflictKeepsNewRoundAction:true} : {})}));
} catch (error) {
  if (debugPage && !debugPage.isClosed()) {
    const message=(await debugPage.locator('body').innerText()).replaceAll(password,'[omitted]').replaceAll(user.employeeNumber!,'[fixture]');
    console.log(JSON.stringify({phase:'course-recovery',pathname:new URL(debugPage.url()).pathname,message:message.slice(-3500)}));
    console.log(JSON.stringify(await debugPage.evaluate(()=>({buttons:Array.from(document.querySelectorAll('button'))
      .filter((button)=>button.textContent?.trim()==='开始').map((button)=>({disabled:button.disabled,text:button.textContent})),
      prediction:document.querySelector<HTMLTextAreaElement>('[aria-label^="运行前预测与"]')?.value}))));
  }
  throw error;
} finally {
  await first?.close();await second?.close();await third?.close();await browser.close();
  await prisma.simulationRun.deleteMany({where:{ownerUserId:user.id}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.$disconnect();
}
