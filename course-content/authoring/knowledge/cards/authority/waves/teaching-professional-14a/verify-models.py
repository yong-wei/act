"""Source-specific inverse, impedance, sector shift and anti-windup examples."""
from pathlib import Path
import json,math,hashlib
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
def close(x,y):assert np.allclose(x,y,atol=2e-8), (x,y)
# Standalone l=2 integration inverse: z are inverse-block states, x are plant states.
def inverse_rhs(t,state):
    x1,x2,z1,z2=state;phi=2.;u=phi+z1+z2**3
    return [x2,-x1-x2**3+u,z2,phi]
sol=solve_ivp(inverse_rhs,[0,1],np.zeros(4),rtol=1e-11,atol=1e-13,dense_output=True)
for t in np.linspace(0,1,21):
    close(sol.sol(t),[t*t,2*t,t*t,2*t]);u=2+t*t+8*t**3
    close(-t*t-(2*t)**3+u,2.)
# Strict impedance uses Franklin's uniform positive real-part lower bound.
for omega in [0.,0.1,1.,10.,1000000.]:
    Z=1+1/(1+1j*omega);close(Z.real,1+1/(1+omega*omega));assert Z.real>0.5
for omega in [0.,1.,10.]:
    close((2-1/(1j*omega-1)).real,2+1/(1+omega*omega))
for x,i in [(0.,1.),(2.,-1.),(-0.5,3.)]:
    v=x+i;Vdot=x*(-x+i);close(i*v-Vdot,x*x+i*i)
# Sector and exact feedback loop shift, not nonlinear cancellation.
for y in np.linspace(-5,5,101):
    phi=2*y+math.tanh(y);shifted=phi-2*y
    close(shifted,math.tanh(y));assert 2*y*y-1e-12<=y*phi<=3*y*y+1e-12
    assert -1e-12<=y*shifted<=y*y+1e-12
    for r in [-1.,0.,2.]:close(-y+r-phi,-3*y+r-math.tanh(y))
    assert y*(-3*y-math.tanh(y))<=-3*y*y+1e-12
for w in [0.,1.,10.]:
    G=1/(1+1j*w);close(G/(1+2*G),1/(3+1j*w))
# Actual saturated plant and PI with/without local back-calculation.
def rhs(antiwindup):
    def f(t,state):
        y,z=state;e=2-y;v=2*e+z;u=np.clip(v,-1,1)
        return [-y+u,e+(2*(u-v) if antiwindup else 0)]
    return f
without=solve_ivp(rhs(False),[0,5],[0.,0.],rtol=1e-11,atol=1e-13,dense_output=True)
with_aw=solve_ivp(rhs(True),[0,5],[0.,0.],rtol=1e-11,atol=1e-13,dense_output=True)
for t in np.linspace(0,5,51):
    q=math.exp(-t);y=1-q;z_no=t+1-q;z_aw=-0.5-3*q+3.5*q*q
    close(without.sol(t),[y,z_no]);close(with_aw.sol(t),[y,z_aw])
    v_aw=2*(2-y)+z_aw;close(v_aw,1.5-q+3.5*q*q);assert v_aw>1
close(1.5-1/7+3.5/49,10/7)
state_no=without.sol(5);state_aw=with_aw.sol(5)
v_no=-2*state_no[0]+state_no[1];v_aw=-2*state_aw[0]+state_aw[1]
assert v_no>1 and v_aw<-1
ref=json.loads((BATCH/'supporting-source-inventory.json').read_text())
for row in ref['sources']+ref['localEvidence']:
    assert hashlib.sha256((ROOT/row['localPath']).read_bytes()).hexdigest()==row['sha256']
assert hashlib.sha256((ROOT/ref['sourceResolutionPath']).read_bytes()).hexdigest()==ref['sourceResolutionSha256']
models={'integral_inverse':{'order':2,'phi':2,'initialPlantAndInverseStates':[0,0],'output':'t^2','outputDerivative':'2*t','input':'2+t^2+8*t^3','checkedInterval':[0,1]},'strict_impedance':{'Z':'1+1/(s+1)','uniformDelta':0.5,'realPart':'1+1/(1+omega^2)','storage':'x^2/2','powerMinusStorageDerivative':'x^2+i^2','contrast':'1/(s+1) has real part tending to zero despite being SPR'},'sector_shift':{'originalSector':[2,3],'residualSector':[0,1],'phi':'2*y+tanh(y)','residual':'tanh(y)','originalG':'1/(s+1)','shiftedH':'1/(s+3)','equivalentDynamics':'ydot=r-3*y-tanh(y)'},'anti_windup':{'plant':'ydot=-y+u','saturation':[-1,1],'Kp':2,'Ki':1,'backCalculationGain':2,'referenceBeforeSwitch':2,'switchTime':5,'newReference':0,'withoutStateAtSwitch':state_no.tolist(),'withStateAtSwitch':state_aw.tolist(),'withoutRequestedControlAfterSwitch':float(v_no),'withRequestedControlAfterSwitch':float(v_aw),'withoutAppliedControlAfterSwitch':1,'withAppliedControlAfterSwitch':-1,'saturatedBranchMinimumVWithAW':'10/7','scope':'actual closed-loop pre-switch trajectory and instantaneous switch response; no universal stability/overshoot claim'}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'proofLimits':ref['limits']},ensure_ascii=False,indent=2)+'\n')
print('Passed four source-defined models and original-text evidence hashes')
