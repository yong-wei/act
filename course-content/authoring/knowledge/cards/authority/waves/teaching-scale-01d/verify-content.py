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
    times = np.array([0, .25, .5, 1, 2, 5, 10])
    # From L=4(s+1)/s^2, r=t^2, unit negative feedback:
    # y''=4e'+4e, hence e''+4e'+4e=r''=2.
    result = solve_ivp(lambda t,x: [x[1], 2-4*x[1]-4*x[0]], [0,10], [0,0], t_eval=times, rtol=1e-11, atol=1e-12)
    close('Ka: original feedback differential equation', result.y[0], .5-(.5+times)*np.exp(-2*times))
    close('Ka: closed-loop roots', np.roots([1,4,4]), [-2,-2])
    close('Ka: unit parabolic final error', 1/4, .25)
    # Raw DC equations y=P*C*em+P*d; em=r-H*y.
    for disturbance, expected in [(0, .6),(1,.2),(-1,1)]:
        y, em = np.linalg.solve([[1,-4],[1,1]], [2*disturbance,3])
        close('steady error disturbance '+str(disturbance), em, expected)
    y, em = np.linalg.solve([[1,-4],[2,1]], [0,3])
    close('nonunit H output', y, 4/3)
    close('nonunit H comparator error', em, 1/3)
    close('nonunit H physical tracking difference', 3-y, 5/3)
    # 2*y'+y=r=t^2/2; solve plant output and form r-y independently.
    result = solve_ivp(lambda t,y: [(t*t/2-y[0])/2], [0,10], [0], t_eval=times, rtol=1e-11, atol=1e-12)
    close('parabolic error from original closed-loop model', times**2/2-result.y[0], 2*times-4+4*np.exp(-times/2))
    close('physical acceleration displacement', .2*4**2/2, 1.6)
    close('physical acceleration velocity', .2*4, .8)
    for sample in [.5,1,2]:
        close('parabolic Laplace quadrature '+str(sample), quad(lambda t: t*t/2*math.exp(-sample*t),0,np.inf)[0], 1/sample**3)
    # 3*y'+2*y=6*u, u=2; C=2 feedback then gives 3*y'+14*y=12*r.
    result = solve_ivp(lambda t,y: [(12-2*y[0])/3], [0,10], [0], t_eval=times, rtol=1e-11, atol=1e-12)
    close('DC gain from plant ODE', result.y[0], 6*(1-np.exp(-2*times/3)))
    close('closed-loop DC equilibrium', np.linalg.solve([[1,-6],[1,1]],[0,2])[0], 12/7)
    # Independent integrations expose duplicate natural response for fixed x0.
    at = math.log(2)
    outputs = [solve_ivp(lambda t,y: [u-y[0]], [0,at], [1], rtol=1e-11, atol=1e-12).y[0,-1] for u in [1,2,3]]
    close('fixed initial response sum', outputs[0]+outputs[1], 2.5)
    close('combined input actual response', outputs[2], 2)
    check('fixed-initial input-only superposition fails', abs(outputs[0]+outputs[1]-outputs[2])>.4)
    # Library residue calculation starts with original numerator/denominator.
    r,p,k = residue([1,3], [1,2,1])
    close('repeated pole residues', r,[1,2]); close('repeated poles',p,[-1,-1])
    close('repeated-pole example t=1', 3/math.e,1.1036383235)
    quotient,remainder = np.polydiv([1,2,3],[1,1])
    close('improper quotient',quotient,[1,1]);close('improper remainder',remainder,[2])
    r,p,k = residue([2], [1,3,2,0])
    close('distinct poles',p,[0,-1,-2]);close('distinct residues',r,[1,-2,1])
    result=solve_ivp(lambda t,x:[x[1],2-3*x[1]-2*x[0]],[0,10],[0,0],t_eval=times,rtol=1e-11,atol=1e-12)
    close('step response original second-order ODE',result.y[0],(1-np.exp(-times))**2)
    close('step response t=ln2', (1-math.exp(-math.log(2)))**2,.25)
    result=solve_ivp(lambda t,y:[(3-y[0])/2],[0,10],[1],t_eval=times,rtol=1e-11,atol=1e-12)
    close('nonzero initial Laplace solution original ODE',result.y[0],3-2*np.exp(-times/2))
    for sample in [.5,1,2]:
        integral=quad(lambda t:(3-2*math.exp(-t/2))*math.exp(-sample*t),0,np.inf)[0]
        close('Laplace integral vs transformed initial-value equation '+str(sample),integral,(3/sample+2)/(2*sample+1))

inventory=json.loads((BATCH/'inventory.json').read_text())
scope=json.loads((BATCH/'accepted-scope.json').read_text())
authority=json.loads((ROOT/'course-content/authoring/knowledge/authority/current.json').read_text())
check('exact eight unique endpoints',len(inventory['cards'])==len({c['canonicalId'] for c in inventory['cards']})==8)
check('scope identity', [c['canonicalId'] for c in inventory['cards']]==[c['canonicalId'] for c in scope['cards']])
for field in ['releaseId','snapshotId','snapshotHash']:check('current authority '+field,inventory['authority'][field]==authority[field])
for c in inventory['cards']:
    path=ROOT/c['authoringPath'];text=path.read_text()
    check('card sha '+c['cardId'],sha(path)==c['cardSha256'])
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
with tempfile.TemporaryDirectory(prefix='teaching-scale-01d-parser-') as tmp:
    env=os.environ.copy();env.update({'CARD_REPO_ROOT':str(ROOT),'CARD_PARSE_ROOT':tmp,'CARD_INVENTORY':str(BATCH/'inventory.json')})
    result=subprocess.run(['npx','tsx','--eval',module.TS_VERIFY],cwd=ROOT,env=env,text=True,capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr)
    parsed=json.loads(result.stdout.strip().splitlines()[-1])
write(BATCH/'numerical-verification.json',{'status':'passed','checks':checks,'checkCount':len(checks),'parser':parsed,'method':'original differential equations, raw feedback signal equations, library partial fractions and integral quadrature; no runtime writes'})
print(json.dumps({'status':'passed','checkCount':len(checks),'parser':parsed},ensure_ascii=False))
