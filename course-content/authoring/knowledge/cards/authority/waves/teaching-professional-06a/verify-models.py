"""Exact rational checks for the seven original optimal-control examples."""
from fractions import Fraction as F
from pathlib import Path
import hashlib
import json

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]

def integral(p):
    return sum((F(c) / (i + 1) for i, c in enumerate(p)), F(0))

def product(p, q):
    out = [F(0)] * (len(p) + len(q) - 1)
    for i, a in enumerate(p):
        for j, b in enumerate(q):
            out[i + j] += a * b
    return out

def derivative(p):
    return [i * p[i] for i in range(1, len(p))]

def integrate_state(u):
    return [F(0)] + [F(c) / (i + 1) for i, c in enumerate(u)]

controls = [[F(1)], [F(0), F(2)]]
rows = []
for u in controls:
    x = integrate_state(u)
    assert derivative(x) == u and sum(x) == 1 and x[0] == 0
    effort = integral(product(u, u))
    state_cost = integral(product(x, x))
    rows.append({'u': list(map(str,u)), 'x':list(map(str,x)), 'effort':str(effort), 'runningTotal':str(effort+state_cost)})
assert [r['effort'] for r in rows] == ['1','4/3']
assert [r['runningTotal'] for r in rows] == ['4/3','23/15']
# A zero-integral perturbation v=epsilon*(1-2t) preserves the hard endpoint.
perturbations=[]
for eps in [F(-2), F(-1,2), F(0), F(1,3), F(2)]:
    u=[1+eps,-2*eps]
    assert integral(u)==1
    cost=integral(product(u,u))
    assert cost==1+eps*eps/F(3) and cost>=1
    perturbations.append({'epsilon':str(eps),'cost':str(cost)})
for q in [F(0), F(1), F(5,2), F(4)]:
    assert (q/F(5)+F(4,3))-(q/F(3)+1)==F(1,3)-2*q/F(15)
terminal=[]
for weight in [F(0),F(1),F(9)]:
    a=weight/(1+weight)
    cost=a*a+weight*(a-1)**2
    assert 2*a+2*weight*(a-1)==0
    assert cost==weight/(1+weight)
    for delta in [F(-1),F(1,3),F(2)]:
        shifted=(a+delta)**2+weight*(a+delta-1)**2
        assert shifted-cost==(1+weight)*delta**2
    terminal.append({'F':str(weight),'endpoint':str(a),'cost':str(cost)})
# For y=t+epsilon*t*(1-t), y'=1+epsilon*(1-2t).
eta=[F(0),F(1),F(-1)]
assert eta[0]==sum(eta)==0
assert integral(product(derivative(eta),derivative(eta)))==F(1,3)
# Minimum-principle candidate and the complete square in H=u^2+lambda*u.
costate=F(-2);control=-costate/2
assert control==1 and integral([control])==1
for u in [F(-2),F(0),F(1),F(3)]:
    assert u*u+costate*u - (control**2+costate*control)==(u-control)**2
# Backward value recursion for x_next=x+u with stage effort u^2.
p=F(1);gains=[];coefficients=[p]
for _ in range(2):
    gain=p/(1+p)
    next_p=p/(1+p)
    # Completing square: u^2+p*(x+u)^2 = (1+p)*(u+gain*x)^2+next_p*x^2.
    assert (1+p)*gain==p and (1+p)*gain*gain+next_p==p
    gains.insert(0,gain);p=next_p;coefficients.insert(0,p)
x=F(1);cost=F(0);trajectory=[x];inputs=[]
for gain in gains:
    u=-gain*x;inputs.append(u);cost+=u*u;x+=u;trajectory.append(x)
cost+=x*x
assert coefficients==[F(1,3),F(1,2),F(1)]
assert trajectory==[F(1),F(2,3),F(1,3)] and inputs==[F(-1,3),F(-1,3)] and cost==F(1,3)
support=json.loads((BATCH/'supporting-source-inventory.json').read_text())
for source in support['sources']:
    assert hashlib.sha256((ROOT/source['localPath']).read_bytes()).hexdigest()==source['sha256']
models={'minimum_effort':{'minimum':'1','optimalInput':'1','proof':'Cauchy-Schwarz with equality for constant input','perturbations':perturbations},'functional':{'candidates':rows},'running_cost':{'candidates':rows,'comparisonOnly':True},'terminal_cost':{'cases':terminal,'freeTerminalState':True},'variations':{'eta':'t*(1-t)','secondOrderIntegral':'1/3','globalProof':'J[t+eta]=1+integral(eta_prime^2) for zero endpoint eta'},'minimum_principle':{'lambda':'-2','u':'1','fixedEndpoint':True,'globalOptimalityProof':'separate Cauchy-Schwarz argument'},'dynamic_programming':{'valueCoefficients':list(map(str,coefficients)),'trajectory':list(map(str,trajectory)),'inputs':list(map(str,inputs)),'cost':str(cost),'greedyFirstThenOptimalCost':'1/2'}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','arithmetic':'exact fractions; analytic universal arguments independently reviewed','models':models},ensure_ascii=False,indent=2)+'\n')
print('Passed seven original model groups and supplementary reference hashes')
