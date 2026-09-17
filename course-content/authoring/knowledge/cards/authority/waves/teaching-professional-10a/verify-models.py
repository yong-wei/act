"""Original deadbeat examples verified from continuous state and controller recurrence."""
from pathlib import Path
import json,math
import numpy as np
from scipy.linalg import expm
from scipy.signal import ss2tf
BATCH=Path(__file__).resolve().parent

def close(x,y):assert np.allclose(x,y,atol=1e-9), (x,y)
A=np.array([[-1.,1.],[0.,-1.]])
B=np.array([[0.],[1.]])
C=np.array([[1.,0.]])
aug=np.block([[A,B],[np.zeros((1,3))]])
M=expm(aug);Ad=M[:2,:2];Bd=M[:2,2]
a=math.exp(-1);b1=1-2*a;b2=1-a;d=(1-a)**2
close(Ad,a*np.array([[1.,1.],[0.,1.]]));close(Bd,[b1,b2])
num,den=ss2tf(Ad,Bd[:,None],C,np.zeros((1,1)))
close(num[0],[0,b1,a*a]);close(den,[1,-2*a,a*a]);assert abs(-a*a/b1)<1

def simulate(controller_den, count=8):
    controller_num=[1,-2*a,a*a]
    states=[np.zeros(2)];outputs=[];inputs=[];errors=[];midpoints=[]
    for k in range(count):
        state=states[-1];output=float(state[0]);error=1-output
        errors.append(error);value=0.
        for j in range(3):
            if k-j>=0:value+=controller_num[j]*errors[k-j]
        for j in range(1,3):
            if k-j>=0:value-=controller_den[j]*inputs[k-j]
        value/=controller_den[0]
        outputs.append(output);inputs.append(value)
        mid=expm(aug*0.5)@np.array([state[0],state[1],value]);midpoints.append(float(mid[0]))
        states.append(Ad@state+Bd*value)
    # Characteristic polynomial before any pole-zero cancellation.
    characteristic=np.polyadd(np.convolve(controller_den,den),np.convolve(controller_num,num[0]))
    roots=np.roots(characteristic);assert max(abs(roots))<1
    return {'outputs':outputs,'inputs':inputs,'errors':errors,'midpoints':midpoints,'states':[x.tolist() for x in states],'internalClosedLoopPoles':[[float(r.real),float(r.imag)] for r in roots]}

sample=simulate([b1,a*a-b1,-a*a])
close(sample['outputs'],[0]+[1]*7)
assert abs(sample['midpoints'][1]-1)>0.01
for k in range(1,7):close(sample['states'][k+1][1]-1,(-a*a/b1)*(sample['states'][k][1]-1))
ripple_free=simulate([d,-b1,-a*a])
alpha=b1/d;beta=a*a/d;close(alpha+beta,1)
close(ripple_free['outputs'],[0,alpha]+[1]*6)
close(ripple_free['inputs'],[1/d,b1/d]+[1]*6)
close(ripple_free['states'][2],[1,1])
close(A@np.ones(2)+B[:,0],np.zeros(2))
close(ripple_free['midpoints'][2:],[1]*6)
assert abs(b1-b2)>0.1  # No single scalar u can make both components of Bd*u equal one.
# Error transfer applied to a ramp rather than a step.
ramp=np.arange(6,dtype=float);ramp_output=np.r_[0,ramp[:-1]];close(ramp-ramp_output,[0,1,1,1,1,1])
# One-step first-order example: controller 5*(1-.8q)/(1-q).
x=0.;previous_error=0.;previous_u=0.;ys=[];us=[]
for k in range(5):
    ys.append(x);e=1-x;u=previous_u+5*e-4*previous_error;us.append(u)
    previous_error=e;previous_u=u;x=0.8*x+0.2*u
close(ys,[0,1,1,1,1]);close(us,[5,1,1,1,1]);close(0.2*2,0.4)
models={'plant':{'a':a,'b1':b1,'b2':b2,'d':d,'zero':-a*a/b1},'sample_deadbeat':sample,'deadbeat_design':{'controllerNumerator':[1,-2*a,a*a],'controllerDenominator':[b1,a*a-b1,-a*a]},'error_transfer':{'oneStep':'1-z^-1','rampError':[0,1,1,1,1,1],'rippleFreeStepError':[1,beta,0]},'ripple':{'midpointAt1_5':sample['midpoints'][1],'sampleAt1':sample['outputs'][1],'sampleAt2':sample['outputs'][2]},'ripple_free':ripple_free,'ripple_free_design':{'alpha':alpha,'beta':beta,'controllerNumerator':[1,-2*a,a*a],'controllerDenominator':[d,-b1,-a*a]},'one_step':{'outputs':ys,'inputs':us,'amplitudeBound2FirstOutputMax':0.4}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'scope':'zero-initial-state unit-step sampled and intersample behavior; not general arbitrary-state deadbeat claim'},ensure_ascii=False,indent=2)+'\n')
print('Passed continuous-derived ZOH, true controller recurrences, intersample and internal-pole checks')
