"""Original nonlinear examples and KYP certificate, checked from original equations."""
from pathlib import Path
import math,json,hashlib
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
def close(x,y):assert np.allclose(x,y,atol=1e-8), (x,y)
for x in [-3.,-1.,0.,0.5,2.]:
    for v in [-1.,0.,2.]:close(-x**3+(x**3+v),v)
sol=solve_ivp(lambda t,x:-x**3+(x**3-2*x),[0,3],[2.],rtol=1e-10,atol=1e-12,dense_output=True)
for t in np.linspace(0,3,11):close(sol.sol(t)[0],2*math.exp(-2*t))
ff=solve_ivp(lambda t,x:-x**3+math.cos(t)+math.sin(t)**3,[0,6],[0.],rtol=1e-10,atol=1e-12,dense_output=True)
for t in np.linspace(0,6,13):close(ff.sol(t)[0],math.sin(t))
for x in [-3.,-1.,0.,2.]:
    derivative=x*(-x**3-2*x);close(derivative,-x**4-2*x*x);assert derivative<=-2*x*x
close(3**3-2*3,21);close(-2*3,-6)
for x0 in [-3.,1.,2.]:
    damping=solve_ivp(lambda t,x:-x**3-2*x,[0,3],[x0],rtol=1e-10,atol=1e-12,dense_output=True)
    for t in np.linspace(0,3,11):
        actual=damping.sol(t)[0];exact=x0*math.exp(-2*t)/math.sqrt(1+(x0*x0/2)*(1-math.exp(-4*t)))
        close(actual,exact);assert abs(actual)<=abs(x0)*math.exp(-2*t)+1e-8
A=np.array([[-1.]]);B=C=P=L=np.array([[1.]]);D=W=np.array([[0.]]);epsilon=1.
close(P@A+A.T@P,-L.T@L-epsilon*P);close(P@B,C.T-L.T@W);close(W.T@W,D+D.T)
for x,u in [(1.,2.),(-2.,0.5),(0.,3.)]:close(u*x-x*(-x+u),x*x)
for omega in [0.,1.,10.,1000000.]:
    z=1j*omega;close((1/(z+1)).real,1/(1+omega*omega));assert (1/(z+0.5)).real>0

def tracking_rhs(t,x):
    yd=math.sin(t);dyd=math.cos(t);ddyd=-math.sin(t)
    v=ddyd-3*(x[1]-dyd)-2*(x[0]-yd);u=x[0]+x[1]**3+v
    return [x[1],-x[0]-x[1]**3+u]
two=solve_ivp(tracking_rhs,[0,5],[0.,0.],rtol=1e-10,atol=1e-12,dense_output=True)
for t in np.linspace(0,5,21):
    e=math.exp(-2*t)-math.exp(-t);ed=-2*math.exp(-2*t)+math.exp(-t);edd=4*math.exp(-2*t)-math.exp(-t)
    close(edd+3*ed+2*e,0);close(two.sol(t),[math.sin(t)+e,math.cos(t)+ed])
close(np.sort(np.roots([1,3,2])),[-2,-1])
single=solve_ivp(lambda t,x:-x**3+(x**3+math.cos(t)-2*(x-math.sin(t))),[0,5],[1.],rtol=1e-10,atol=1e-12,dense_output=True)
for t in np.linspace(0,5,21):close(single.sol(t)[0],math.sin(t)+math.exp(-2*t))
hidden=solve_ivp(lambda t,x:[-x[0]**3+(x[0]**3-2*x[0]),x[1]],[0,2],[0.,1.],rtol=1e-10,atol=1e-12)
close(hidden.y[:,-1],[0,math.exp(2)])
# Smooth bounded reference does not imply bounded derivative or internal velocity.
for n in [1,4,16]:
    t=math.sqrt(2*math.pi*n)
    close(math.sin(t*t),0);close(2*t*math.cos(t*t),2*t)
    assert 2*t>4*math.sqrt(n)
reference=json.loads((BATCH/'supporting-source-inventory.json').read_text())
for row in reference['sources']+reference.get('localEvidence',[]):
    assert hashlib.sha256((ROOT/row['localPath']).read_bytes()).hexdigest()==row['sha256']
models={'feedback_linearization':{'plant':'xdot=-x^3+u','feedback':'u=x^3-2*x','solutionAtX0Two':'2*exp(-2*t)'},'inverse_system':{'reference':'sin(t)','input':'cos(t)+sin(t)^3','matchingInitialState':0},'state_feedback':{'law':'-2*x','Vdot':'-2*x^2-x^4','stateBound':'abs(x0)*exp(-2*t)','dampingInputAtThree':-6,'cancellationInputAtThree':21},'kyp':{'A':-1,'B':1,'C':1,'D':0,'P':1,'L':1,'W':0,'epsilon':1,'storage':'x^2/2','supplyMinusDerivative':'x^2','shiftForSPR':0.5},'inverse_design':{'plant':['x2','-x1-x2^3+u'],'reference':'sin(t)','initialState':[0,0],'error':'exp(-2*t)-exp(-t)','errorPoles':[-1,-2]},'asymptotic_tracking':{'reference':'sin(t)','initialState':1,'error':'exp(-2*t)','hiddenStateCounterexampleAtTwo':[0,float(math.exp(2))]}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'scope':'original continuous equations, exact errors, KYP identities and frozen reference bytes'},ensure_ascii=False,indent=2)+'\n')
print('Passed six nonlinear/inversion/KYP groups and reference hashes')
