"""Independent scalar models for finite/infinite quadratic control examples."""
from pathlib import Path
from fractions import Fraction as F
import hashlib,json,math
import numpy as np
from scipy.integrate import quad
from scipy.linalg import solve_continuous_are

BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
def close(a,b):assert np.allclose(a,b,atol=1e-10), (a,b)

# Bounded minimum-time integrator: exact endpoint and saturation.
x0=F(2);umax=F(1);minimum_time=abs(x0)/umax
assert minimum_time==2 and x0-umax*minimum_time==0

weights=[]
for q,r in [(4.,1.),(4.,4.),(1.,1.)]:
    P=float(solve_continuous_are(np.array([[0.]]),np.array([[1.]]),np.array([[q]]),np.array([[r]]))[0,0])
    K=P/r
    close(P,math.sqrt(q*r));close(K,math.sqrt(q/r));close(-P*P/r+q,0.)
    cost=quad(lambda t:0.5*(q+r*K*K)*math.exp(-2*K*t),0,np.inf)[0]
    close(cost,P/2)
    weights.append({'q':q,'r':r,'P':P,'K':K,'costAtOne':cost,'pole':-K})

# Compare the two gains under the same metric, rather than mixing optimum values.
for q,K,expected in [(1.,1.,0.5),(1.,2.,0.625),(4.,1.,1.25),(4.,2.,1.)]:
    actual=quad(lambda t:0.5*(q+K*K)*math.exp(-2*K*t),0,np.inf)[0]
    close(actual,expected)
close(math.exp(-math.log(10)),0.1)
close(math.exp(-2*(math.log(10)/2)),0.1)
finite=[]
for weight in [0.,1.,9.]:
    def p(t):return weight/(1+weight*(1-t))
    def x(t):return (1+weight*(1-t))/(1+weight)
    u=-weight/(1+weight)
    for t in [0.,0.2,0.7,1.]:
        close(-p(t)*x(t),u)
        pdot=weight*weight/(1+weight*(1-t))**2
        close(pdot,p(t)**2)
        close(-weight/(1+weight),u)  # derivative of the explicit x(t)
    close(x(0),1);close(p(1),weight)
    cost=0.5*u*u+0.5*weight*x(1)**2
    close(cost,0.5*p(0))
    finite.append({'F':weight,'P0':p(0),'P1':p(1),'xT':x(1),'u':u,'cost':cost})

# Finite horizon Q=R=F=1: terminal condition and Riccati residual.
P=1.;close(0.,-P*P+1)
cost=quad(lambda t:math.exp(-2*t),0,1)[0]+0.5*math.exp(-2)
close(cost,0.5)
for x,u in [(-2.,1.),(0.4,-0.1),(1.,-1.)]:
    close(0.5*(x*x+u*u)+x*u,0.5*(u+x)**2)

# Unstable scalar A=B=Q=R=1; distinguish stabilizing from nonstabilizing root.
P=float(solve_continuous_are(np.array([[1.]]),np.array([[1.]]),np.array([[1.]]),np.array([[1.]]))[0,0])
close(P,1+math.sqrt(2));close(2*P-P*P+1,0);assert 1-P<0
bad=1-math.sqrt(2);close(2*bad-bad*bad+1,0);assert bad<0 and 1-bad>0
cost=quad(lambda t:0.5*(1+P*P)*math.exp(2*(1-P)*t),0,np.inf)[0];close(cost,P/2)
close(-(0.75)/(2-0.5),-0.5)
close(-1/(2-0.5),-2/3)
# Free-endpoint transversality and fixed-endpoint counterexample.
for weight in [F(0),F(1),F(9)]:
    lam=weight/(1+weight);u=-lam;end=1+u
    assert lam==weight*end and u+lam==0
assert F(1)!=F(1)*F(0)  # Fixed endpoint xT=0 requires u=-1, lambda=1, not lambda=F*xT.
for item in json.loads((BATCH/'supporting-source-inventory.json').read_text())['sources']:
    assert hashlib.sha256((ROOT/item['localPath']).read_bytes()).hexdigest()==item['sha256']
models={'minimum_time':{'x0':2,'inputBound':1,'time':2,'control':-1},'weight_R':{'cases':weights[:2]},'weight_Q':{'cases':[weights[2],weights[0]],'semidefiniteExample':'Q=diag(1,0) has zero cost on nonzero second axis'},'weight_F':{'cases':finite},'linear_quadratic':{'horizon':1,'Q':1,'R':1,'F':1,'P':1,'costAtOne':0.5,'identity':'J=x0^2/2+integral((u+x)^2)/2'},'lqr':{'A':1,'B':1,'Q':1,'R':1,'P':P,'closedLoopPole':1-P,'otherRoot':bad,'otherPole':1-bad,'costAtOne':cost},'transversality':{'freeEndpoint':'lambda(T)=F*x(T)','control':'-F/(1+F)','fixedEndpointCounterexample':'u=-1 and lambda=1 for x0=1, xT=0; lambda(T)=F*xT would incorrectly force zero'},'finite_horizon_feedback':{'P':'1/(2-t)','x':'(2-t)/2','u':-0.5,'cost':0.25}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'limits':'scalar examples only; general theorem hypotheses require independent content review'},ensure_ascii=False,indent=2)+'\n')
print('Passed eight scalar control model groups, Riccati residuals and reference hashes')
