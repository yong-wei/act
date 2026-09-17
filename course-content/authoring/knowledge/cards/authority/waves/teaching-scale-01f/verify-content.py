"""Authoring-only identity, model-based numerical and actual parser checks."""
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp, quad
from scipy.signal import residue

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
checks = []
def check(label, value):
    assert value, label
    checks.append(label)
def close(label, actual, expected, tolerance=1e-8):
    check(label, bool(np.allclose(actual, expected, rtol=tolerance, atol=tolerance)))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, data):
    lines = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with p.open('w') as f:
        for i in range(0, len(lines), 300): f.writelines(lines[i:i+300])

def model_checks():
    from scipy.optimize import brentq
    # Original state equations independently integrate perturbation examples.
    t=np.array([0.,1.,2.,3.])
    response=solve_ivp(lambda _,x:[-2*x[0]], [0,3],[.1],t_eval=t,rtol=1e-11,atol=1e-12)
    close('stable perturbation solution',response.y[0],.1*np.exp(-2*t))
    close('stable perturbation at one second',response.y[0,1],.0135335283)
    integrator=solve_ivp(lambda _,x:[1.], [0,3],[0.],t_eval=t,rtol=1e-11,atol=1e-12)
    close('bounded step drives unbounded-integrator trend',integrator.y[0],t)
    hidden=solve_ivp(lambda _,x:[-2*x[0],x[1]], [0,3],[0.,.01],t_eval=t,rtol=1e-11,atol=1e-12)
    close('hidden unstable state',hidden.y[1],.01*np.exp(t))
    close('hidden state not seen at output',hidden.y[0],np.zeros(4))
    # Root computations validate Routh sign counts from the original polynomial.
    for gain, unstable in [(0,0),(3,0),(6,0),(8,2)]:
        roots=np.roots([1,3,2,gain])
        check('Routh RHP root count '+str(gain),sum(p.real>1e-7 for p in roots)==unstable)
    roots=np.roots([1,3,2,6])
    close('Routh boundary imaginary pair frequencies',sorted(abs(p.imag) for p in roots if abs(p.real)<1e-7),[math.sqrt(2)]*2)
    check('zero-gain boundary has origin root',any(abs(p)<1e-9 for p in np.roots([1,3,2,0])))
    for coeff, expected in [([1,2,3,4],[2,2,8]),([1,1,1,2],[1,-1,-2])]:
        a0,a1,a2,a3=coeff
        h=np.array([[a1,a3,0],[a0,a2,0],[0,a1,a3]],dtype=float)
        minors=[np.linalg.det(h[:k,:k]) for k in [1,2,3]]
        close('Hurwitz minors '+str(coeff),minors,expected)
        check('Hurwitz criterion agrees with original roots '+str(coeff), all(v>0 for v in minors)==all(p.real<0 for p in np.roots(coeff)))
    # Solve crossover using direct complex evaluation, not an expanded denominator.
    loop=lambda omega,gain: gain/((1j*omega)*(1+1j*omega)*(2+1j*omega))
    pc=brentq(lambda omega: loop(omega,3).imag,.5,3)
    close('phase crossover',pc,math.sqrt(2))
    close('negative-real response at phase crossover',loop(pc,3),-.5)
    gm=1/abs(loop(pc,3))
    close('gain margin multiplier',gm,2)
    close('gain margin dB',20*math.log10(gm),6.0205999133)
    close('critical gain response',loop(pc,6),-1)
    for factor,unstable in [(1,0),(2,0),(2.5,2)]:
        roots=np.roots([1,3,2,3*factor])
        check('gain multiplier closed-loop roots '+str(factor),sum(p.real>1e-7 for p in roots)==unstable)
    for factor,expected_freq,expected_pm in [(1,1,45),(2,math.sqrt((math.sqrt(33)-1)/2),33)]:
        open_loop=lambda omega: factor*math.sqrt(2)/((1j*omega)*(1+1j*omega))
        wc=brentq(lambda omega:abs(open_loop(omega))-1,.01,10)
        pm=180+np.angle(open_loop(wc),deg=True)
        close('gain crossover factor '+str(factor),wc,expected_freq)
        close('phase margin factor '+str(factor),pm,expected_pm,tolerance=.002)
        check('quadratic closed-loop stable '+str(factor),all(p.real<0 for p in np.roots([1,1,factor*math.sqrt(2)])))
    close('gain crossover conversion Hz',1/(2*math.pi),.1591549431)
    plant=lambda omega:4/(1+1j*omega)
    closed=lambda omega:plant(omega)/(1+plant(omega))
    wc=brentq(lambda omega:abs(plant(omega))-1,0,10)
    bandwidth=brentq(lambda omega:abs(closed(omega))/abs(closed(0))-1/math.sqrt(2),0,10)
    close('cutoff uses open loop',wc,math.sqrt(15))
    close('bandwidth uses closed-loop relative DC',bandwidth,5)
    close('closed magnitude at cutoff',abs(closed(wc)),4/math.sqrt(40))
    close('bandwidth threshold',abs(closed(bandwidth)),.8/math.sqrt(2))
    check('cutoff differs from bandwidth',abs(wc-bandwidth)>1)
    close('cutoff Hz',wc/(2*math.pi),.6164044441)

inventory=json.loads((BATCH/'inventory.json').read_text())
scope=json.loads((BATCH/'accepted-scope.json').read_text())
authority=json.loads((ROOT/'course-content/authoring/knowledge/authority/current.json').read_text())
check('exact seven unique endpoints',len(inventory['cards'])==len({c['canonicalId'] for c in inventory['cards']})==7)
check('scope identity', [c['canonicalId'] for c in inventory['cards']]==[c['canonicalId'] for c in scope['cards']])
for field in ['releaseId','snapshotId','snapshotHash']:check('current authority '+field,inventory['authority'][field]==authority[field])
for c in inventory['cards']:
    path=ROOT/c['authoringPath'];text=path.read_text()
    check('card sha '+c['cardId'],sha(path)==c['cardSha256'])
    import re
    declared=re.findall(r'^  - "([^"\n]+)"$', text.split('source_docs:\n',1)[1].split('asset_refs:',1)[0],re.M)
    check('declared source paths '+c['cardId'],declared==[r['path'] for r in c['sources']])
    for source in c['sources']:
        check('source sha '+source['path'],sha(ROOT/source['path'])==source['sha256'])
        if source.get('revision'):
            data=subprocess.check_output(['git','show',source['revision']+':'+source['path']],cwd=ROOT)
            check('source revision '+source['path'],hashlib.sha256(data).hexdigest()==source['sha256'])
    check('backup sha '+c['cardId'],sha(ROOT/c['sourceBackupPath'])==c['sourceBackupSha256'])
    neighborhood=json.loads((ROOT/c['sources'][1]['path']).read_text())
    check('exact source node '+c['cardId'],neighborhood['nodeId']==c['canonicalId'])
    for marker in ['## 首页','## 详情','### 完整解释','### 教学计算/推理例','### 自检','核对要点','### 常见误区与边界','### 关联节点']:
        check(marker+' '+c['cardId'],marker in text)
model_checks()
# Reuse the unchanged parser/KaTeX harness only, not another batch's numerical answers.
spec=importlib.util.spec_from_file_location('previous_parser',BATCH.parent/'teaching-scale-01b/verify-content.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='teaching-scale-01f-parser-') as tmp:
    env=os.environ.copy();env.update({'CARD_REPO_ROOT':str(ROOT),'CARD_PARSE_ROOT':tmp,'CARD_INVENTORY':str(BATCH/'inventory.json')})
    result=subprocess.run(['npx','tsx','--eval',module.TS_VERIFY],cwd=ROOT,env=env,text=True,capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr)
    parsed=json.loads(result.stdout.strip().splitlines()[-1])
write(BATCH/'numerical-verification.json',{'status':'passed','checks':checks,'checkCount':len(checks),'parser':parsed,'method':'original state equations, polynomial roots, Hurwitz determinants and numerical complex crossover roots; no runtime writes'})
print(json.dumps({'status':'passed','checkCount':len(checks),'parser':parsed},ensure_ascii=False))
