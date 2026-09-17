"""Original robust-design examples: constraints, frequency sets and true closed-loop costs."""
from pathlib import Path
from fractions import Fraction as F
import math,json,hashlib
import numpy as np
from scipy.integrate import quad,solve_ivp
BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
def close(x,y):assert np.allclose(x,y,atol=1e-9), (x,y)

templates=[]
for a in [1.,2.]:
    for k in [1.,2.]:
        g=k/(a+1j);sens=1/(1+2*g)
        close(abs(sens),math.sqrt((a*a+1)/((a+2*k)**2+1)))
        templates.append({'a':a,'k':k,'magnitude':abs(g),'magnitudeDB':20*math.log10(abs(g)),'phaseDegrees':float(np.angle(g,deg=True)),'sensitivityAtOne':abs(sens)})
close(max(t['sensitivityAtOne'] for t in templates),math.sqrt(5/17));assert math.sqrt(5/17)<0.6
# Positive-a and negative-k derivatives justify the full rectangular-set bound at omega=1.
for a in [1.,1.5,2.]:
    for k in [1.,1.5,2.]:
        assert a*(a+2*k)-1>0
amin=F(4,5);amax=F(6,5);kmin=F(1,2);kmax=F(3,2)
required_gain=3*amax/kmin;assert required_gain==F(36,5)
gain=F(15,2);worst_error=amax/(amax+gain*kmin);assert worst_error==F(8,33) and worst_error<F(1,4)
assert required_gain>6 and gain<=8
for a in [amin,amax]:
    for k in [kmin,kmax]:
        rate=a+gain*k;steady=gain*k/rate
        for t in [0.,0.1,1.,10.]:
            x=float(steady)*(1-math.exp(-float(rate)*t));u=float(gain)*(1-x)
            assert 0<u<=float(gain)+1e-12
            close(float(steady)*float(rate)*math.exp(-float(rate)*t),-float(a)*x+float(k)*u)

K=F(9,2);eps=F(6,5);norm=eps*K/(1+K);assert norm==F(54,55)<1 and 1/(1+K)==F(2,11)<F(1,5)
assert (eps-1)*6-1==F(1,5)
for w in [0.,1.,10.]:
    z=1j*w;g0=1/(z+1);S=1/(1+float(K)*g0)
    close((float(eps)/(z+1))*float(K)*S,float(eps*K)/(z+1+float(K)))

itae=[]
for p in [0.5,1.,2.]:
    full=quad(lambda t:t*math.exp(-p*t),0,np.inf)[0];close(full,1/(p*p))
    finite=[]
    for horizon in [1.,5.]:
        value=quad(lambda t:t*math.exp(-p*t),0,horizon)[0]
        exact=(1-(1+p*horizon)*math.exp(-p*horizon))/(p*p);close(value,exact)
        finite.append({'H':horizon,'value':value})
    itae.append({'p':p,'infiniteITAE':full,'finiteWindows':finite})
assert F(1,4)-F(1,2)**2==0
responses=[]
for theta in [-1.,0.,1.]:
    coeff=0.25-theta*theta
    sol=solve_ivp(lambda t,x:coeff*x,[0,4],[1.],rtol=1e-10,atol=1e-12)
    value=float(sol.y[0,-1]);close(value,math.exp(4*coeff));responses.append({'theta':theta,'pole':coeff,'xAt4':value})
assert responses[1]['pole']>0 and responses[0]['pole']<0 and responses[2]['pole']<0
worst=F(1)/(F(4,5)*F(2))**2;assert worst==F(25,64)
for k in [0.8,1.,1.2]:
    for p in [0.5,1.,2.]:
        val=quad(lambda t:t*math.exp(-k*p*t),0,np.inf)[0];close(val,1/(k*p)**2)
        for t in [0.,0.2,2.]:
            e=math.exp(-k*p*t);x=1-e;u=p*e;close(k*p*e,k*u);assert abs(u)<=2

pi=[]
for a in [0.8,1.2]:
    for k in [0.5,1.5]:
        matrix=np.array([[-a-2*k,k],[-1.,0.]])
        close(np.poly(matrix),[1,a+2*k,k]);assert max(np.linalg.eigvals(matrix).real)<0
        for dist in [-0.2,0.,0.2]:
            steady=np.linalg.solve(-matrix,np.array([2*k+k*dist,1.]))
            close(steady[0],1);close(steady[1],a/k-dist)
        pi.append({'a':a,'k':k,'poles':[[float(r.real),float(r.imag)] for r in np.linalg.eigvals(matrix)],'zeroDisturbanceSteadyInput':a/k})
for row in json.loads((BATCH/'supporting-source-inventory.json').read_text())['sources']:
    assert hashlib.sha256((ROOT/row['localPath']).read_bytes()).hexdigest()==row['sha256']
models={'qft':{'frequency':1,'templates':templates,'worstSensitivity':math.sqrt(5/17),'requirement':0.6,'fullQFTDesignClaim':False},'robust_design':{'requiredGain':'36/5','amplitudeLimit6Feasible':False,'gainAtLimit8':'15/2','worstSteadyError':'8/33'},'uncertainty_design':{'epsilon':'6/5','gain':'9/2','nominalError':'2/11','weightedNorm':'54/55','gain6AllowedWitnessPole':'1/5'},'time_weighted_error':{'trueClosedLoop':'xdot=u, u=p*(1-x), x0=0','cases':itae},'robust_simulation':{'family':'xdot=(1/4-theta^2)*x, theta fixed in [-1,1]','cases':responses},'itae_method':{'plant':'xdot=k*u','kRange':[0.8,1.2],'pRange':[0.5,2],'amplitudeLimit':2,'optimalGainWithinDeclaredFamily':2,'worstITAE':'25/64'},'robust_zero_offset':{'controller':'2+1/s','characteristic':'s^2+(a+2k)*s+k','cases':pi,'stepReferenceSteadyError':0,'constantPlantInputDisturbanceOutputFinalValue':0,'noSaturation':True}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'scope':'analytic bounds, independent integration and original state-space equilibrium checks'},ensure_ascii=False,indent=2)+'\n')
print('Passed seven robust-design groups and frozen reference hashes')
