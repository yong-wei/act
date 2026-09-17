"""Original digital-compensator models derived from transfer and update equations."""
from pathlib import Path
from fractions import Fraction as F
import json,cmath,math
import numpy as np
from scipy.signal import lfilter
BATCH=Path(__file__).resolve().parent

def close(a,b):assert np.allclose(a,b,atol=1e-10), (a,b)

compensators=[]
for kind,a,b,K in [('lag',0.2,0.7,3/8),('lead',0.7,0.2,8/3)]:
    def response(w):return K*(1-a*np.exp(-1j*w))/(1-b*np.exp(-1j*w))
    close(response(0),1.)
    close(response(math.pi),9/34 if kind=='lag' else 34/9)
    for w in np.linspace(0.001,math.pi-0.001,100):
        c=response(w)
        close(c.imag,K*(a-b)*math.sin(w)/abs(1-b*np.exp(-1j*w))**2)
        assert c.imag<0 if kind=='lag' else c.imag>0
    samples=lfilter([K,-K*a],[1,-b],np.ones(6))
    compensators.append({'kind':kind,'zero':a,'pole':b,'gain':K,'dc':float(response(0).real),'nyquist':float(response(math.pi).real),'phaseAtPiOver3Degrees':float(np.angle(response(math.pi/3),deg=True)),'unitStepSamples':samples.tolist(),'phaseSignProof':'Im(C)=K*(a-b)*sin(Omega)/abs(1-b*exp(-j*Omega))^2'})
for w in [0.,0.3,1.2,math.pi]:
    lag=(3/8)*(1-0.2*np.exp(-1j*w))/(1-0.7*np.exp(-1j*w))
    lead=(8/3)*(1-0.7*np.exp(-1j*w))/(1-0.2*np.exp(-1j*w))
    close(lag*lead,1.)

A=F(4,5);B=F(1,5);target=F(3,10);K=(A-target)/B
assert K==F(5,2);pole=A-B*K;dc=B*K/(1-pole);prefilter=1/dc
assert pole==target and dc==F(5,7) and prefilter==F(7,5)
assert B*K*prefilter/(1-pole)==1

root_cases=[]
for gain in [0.,0.4,1.,8.,8.8,9.]:
    coefficients=[1.,-0.8,0.12+0.1*gain]
    roots=np.roots(coefficients)
    predicted=np.array([0.4+cmath.sqrt(0.04-0.1*gain),0.4-cmath.sqrt(0.04-0.1*gain)])
    assert np.allclose(np.sort_complex(roots),np.sort_complex(predicted),atol=1e-7)
    assert max(abs(np.polyval(coefficients,r)) for r in roots)<1e-10
    root_cases.append({'K':gain,'roots':[[float(r.real),float(r.imag)] for r in roots],'maxModulus':float(max(abs(roots)))})
close(root_cases[-2]['maxModulus'],1.)
assert root_cases[-1]['maxModulus']>1 and root_cases[-3]['maxModulus']<1

T=math.log(5/4);a=math.exp(-T);b=1-a;rho=math.exp(-4*T);gain=(a-rho)/b
close(a,0.8);close(b,0.2);close(rho,0.4096);close(gain,1.952)
close(a-3*b,0.2);close(a-b*gain,rho)

Kp=F(3,2);Ki=F(2);Kd=F(1,20);Ts=F(1,10);Tf=F(1,5)
alpha=Tf/(Tf+Ts);beta=Kd/(Tf+Ts);assert alpha==F(2,3) and beta==F(1,6)
I=F(0);D=F(0);previous=F(0);outputs=[];details=[]
for e in [F(1),F(1,2),F(0)]:
    I+=Ki*Ts*e;D=alpha*D+beta*(e-previous);previous=e
    value=Kp*e+I+D;outputs.append(value);details.append({'e':str(e),'P':str(Kp*e),'I':str(I),'D':str(D),'u':str(value)})
assert outputs==[F(28,15),F(97,90),F(127,540)]
models={'digital_lag':compensators[0],'direct_z_design':{'plantA':'4/5','plantB':'1/5','K':str(K),'pole':str(pole),'dc':str(dc),'referencePrefilter':str(prefilter)},'z_root_locus':{'cases':root_cases,'analyticRoots':'0.4 +/- sqrt(0.04-0.1*K)','stableInterval':'0<=K<8.8'},'direct_digital_design':{'T':T,'a':a,'b':b,'targetPole':rho,'K':gain,'heldContinuousGain3Pole':a-3*b},'digital_lead':compensators[1],'digital_pid':{'alpha':str(alpha),'beta':str(beta),'steps':details,'closedLoopTest':False}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'scope':'original transfer functions, pole equations, phase identity and exact controller recurrence'},ensure_ascii=False,indent=2)+'\n')
print('Passed six original compensator, locus, direct-design and PID model groups')
