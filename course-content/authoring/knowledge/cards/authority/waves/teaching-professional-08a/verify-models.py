"""Original sampled-data and discrete-action examples; no frontend simulator."""
import json,math
from pathlib import Path
from fractions import Fraction as F
import numpy as np
from scipy.linalg import expm
from scipy.integrate import quad
BATCH=Path(__file__).resolve().parent

def close(a,b):assert np.allclose(a,b,atol=1e-10), (a,b)

unit={str(p):[p**k for k in range(6)] for p in [0.8,1.,-1.,1.1]}
J=np.array([[1.,1.],[0.,1.]])
for k in range(6):close(np.linalg.matrix_power(J,k)@np.array([0.,1.]),[k,1.])
periods=[]
for T in [0.5,1.5]:
    a=float(expm(np.array([[-1.]])*T)[0,0]);b=quad(lambda s:math.exp(-s),0,T)[0]
    close(b,1-a);pole=a-2*b;close(pole,3*math.exp(-T)-2)
    periods.append({'T':T,'a':a,'b':b,'closedLoopPole':pole,'stable':bool(abs(pole)<1)})
assert periods[0]['stable'] and not periods[1]['stable'];close(3*math.exp(-math.log(3))-2,-1)

A=F(4,5);B=F(1,5);x=F(1);sequence=[x]
for k in range(1,6):
    x=A*x;assert x==A**k;sequence.append(x)

x=F(0)
for k in range(1,6):
    x=A*x+B;assert x==1-A**k

T=0.2;ad=float(expm(np.array([[-2.]])*T)[0,0]);bd=quad(lambda s:3*math.exp(-2*s),0,T)[0];close(bd,1.5*(1-ad));x=0.;sampled=[x]
for k in range(1,6):
    x=ad*x+bd;close(x,1.5*(1-ad**k));close(x,1.5*(1-math.exp(-2*k*T)));sampled.append(x)
for xk,uk in [(0.,1.),(0.6,-0.2),(1.,0.)]:
    tau=0.13;val=xk*math.exp(-2*tau)+1.5*uk*(1-math.exp(-2*tau))
    deriv=-2*xk*math.exp(-2*tau)+3*uk*math.exp(-2*tau);close(deriv,-2*val+3*uk)

proportional=[]
for K in [F(2),F(10)]:
    pole=A-B*K;steady=B*K/(1-pole)
    proportional.append({'K':str(K),'pole':str(pole),'formalEquilibrium':str(steady),'stable':abs(pole)<1})
assert proportional[0]['pole']=='2/5' and proportional[0]['formalEquilibrium']=='2/3'
assert proportional[1]['pole']=='-6/5' and not proportional[1]['stable']
assert A-B*F(9)==-1 and A-B*F(-1)==1

Ki=F(2);Ts=F(1,10);state=F(0);integral=[]
for _ in range(3):state+=Ki*Ts;integral.append(state)
assert integral==[F(1,5),F(2,5),F(3,5)]
assert A-B*F(4)==0
assert [min(value,F(3,10)) for value in integral]==[F(1,5),F(3,10),F(3,10)]
assert sum([Ki*Ts/F(2)]*6)==sum([Ki*Ts]*3)
Kd=F(1,2);T=F(1,10);Tf=F(1,5)
ramp=[F(k,5) for k in range(4)];derivatives=[Kd*(ramp[k]-ramp[k-1])/T for k in range(1,4)];assert derivatives==[F(1)]*3
noise=[F(-1,100),F(1,100),F(-1,100),F(1,100)];assert all(abs(Kd*(noise[k]-noise[k-1])/T)==F(1,10) for k in range(1,4))
alpha=Tf/(Tf+T);beta=Kd/(Tf+T);assert alpha==F(2,3) and beta==F(5,3)
previous=F(0);output=F(0);filtered=[]
for error in [F(1),F(1),F(1)]:
    output=alpha*output+beta*(error-previous);previous=error;filtered.append(output)
assert filtered[:2]==[F(5,3),F(10,9)]
models={'unit_circle':{'scalarSequences':unit,'jordanSequence':'[k,1] for x0=[0,1]'},'sampling_period':{'cases':periods,'stableInterval':'0<T<ln(3)'},'discrete_model':{'zeroInputSequence':list(map(str,sequence)),'transfer':'0.2/(z-0.8), zero initial state'},'exact_zoh':{'T':0.2,'Ad':ad,'Bd':bd,'stepSamples':sampled},'proportional':{'cases':proportional,'positiveGainStableInterval':'0<K<9'},'integral':{'initialState':'I[-1]=0','updateBeforeOutput':True,'outputs':list(map(str,integral))},'derivative':{'rampOutput':'1','alternatingNoiseAmplitude':'1/10','filterAlpha':str(alpha),'filterBeta':str(beta),'filteredStep':list(map(str,filtered))}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'scope':'original example equations; content and source support still require independent review'},ensure_ascii=False,indent=2)+'\n')
print('Passed seven discrete model groups from dynamics, exact matrices and recurrences')
