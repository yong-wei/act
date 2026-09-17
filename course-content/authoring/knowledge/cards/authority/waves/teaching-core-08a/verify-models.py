"""Verify poles, zeros and transfer models from independent realizations."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.linalg import expm

BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,10,2001)
y=solve_ivp(lambda t,x:[-x[0]+2],[0,10],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,2*(1-np.exp(-t)),atol=1e-10)
models['strictly_proper']={'standardStateSpace':True,'A':[[-1]],'B':[[1]],'C':[[2]],'D':0,
    'G':'2/(s+1)','unitStep':'2(1-exp(-t))','highFrequencyLimit':0,
    'properComparison':{'D':1,'G':'1+2/(s+1)','unitStep':'3-2exp(-t)','initialJump':1},
    'boundary':'finite-dimensional standard causal LTI realization; D is direct feedthrough, not a statement that output is identically zero'}
A=np.array([[0.,1.],[-3.,-4.]]);B=np.array([0.,1.]);C=np.array([2.,1.]);C0=np.array([2.,0.])
x=solve_ivp(lambda t,x:A@x+B,[0,10],[0.,0.],t_eval=t,rtol=1e-12,atol=1e-14).y
assert np.allclose(C@x,2/3-.5*np.exp(-t)-np.exp(-3*t)/6,atol=1e-10)
assert np.allclose(C0@x,2/3-np.exp(-t)+np.exp(-3*t)/3,atol=1e-10)
models['zero']={'G':'(s+2)/((s+1)(s+3))','finiteZero':-2,'poles':[-1,-3],
    'A':A.tolist(),'B':B.tolist(),'C':C.tolist(),'D':0,
    'step':'2/3-0.5exp(-t)-(1/6)exp(-3t)','initialStepSlope':1,
    'samePoleComparison':{'G':'2/((s+1)(s+3))','step':'2/3-exp(-t)+(1/3)exp(-3t)','initialStepSlope':0},
    'boundary':'reduced scalar rational transfer; zeros shape the response without being autonomous state modes'}
Ac=np.array([[0.,1.],[-2.,-2.]]);Bc=np.array([0.,1.]);Cc=np.array([2.,0.])
xc=solve_ivp(lambda t,x:Ac@x+Bc,[0,10],[0.,0.],t_eval=t,rtol=1e-12,atol=1e-14).y
assert np.allclose(Cc@xc,1-np.exp(-t)*(np.cos(t)+np.sin(t)),atol=1e-10)
for tau in [0,.5,1,2]:assert abs(Cc@expm(Ac*tau)@Bc-2*np.exp(-tau)*np.sin(tau))<1e-12
models['complex_frequency_poles']={'G':'2/(s^2+2s+2)','poles':[[-1,1],[-1,-1]],
    'impulse':'2exp(-t)sin(t)','step':'1-exp(-t)(cos(t)+sin(t))',
    'boundary':'minimal realization; negative real part sets decay, imaginary part sets modal oscillation rate'}
models['open_loop_zeros']={'L':'K(s+2)/(s(s+1))','KCondition':'K>0','openPoles':[0,-1], 'openZero':-2,
    'boundary':'fixed numerator zero of the specified loop model; K=0 is excluded, pole-zero cancellation must be checked'}
loop_cases=[]
for H in [1.,.5]:
    Al=np.array([[-2.,-2*H],[1.,-1.]]);Bl=np.array([2.,0.]);Cl=np.array([0.,1.])
    for s in [.3,1j,3.]:
        forward=2/((s+2)*(s+1));loop=H*forward
        assert abs(Cl@np.linalg.solve(s*np.eye(2)-Al,Bl)-forward/(1+loop))<1e-12
        assert abs(forward/(1+loop)-2/(s*s+3*s+2+2*H))<1e-12
    loop_cases.append({'H':H,'loopNumerator':2*H,'closedDenominator':[1,3,2+2*H]})
models['open_loop_transfer']={'controller':'2/(s+2)','plant':'1/(s+1)',
    'forwardTransfer':'2/((s+2)(s+1))','loopConvention':'L=controller*plant*H','cases':loop_cases,
    'boundary':'distinguish forward path from full loop when measurement feedback is not unity; closed reference transfer is forward/(1+L)'}
Ah=np.diag([1.,-1.]);Bh=np.array([0.,1.]);Ch=np.array([0.,1.])
for s in [.3,1j,3.]:
    assert abs(Ch@np.linalg.solve(s*np.eye(2)-Ah,Bh)-1/(s+1))<1e-12
assert np.allclose(expm(Ah)@np.array([1.,0.]),[np.e,0.])
models['poles_and_hidden_modes']={'A':Ah.tolist(),'B':Bh.tolist(),'C':Ch.tolist(),'D':0,
    'reducedTransfer':'1/(s+1)','unreducedExpression':'(s-1)/((s-1)(s+1))', 'transferPole':-1,
    'hiddenStateEigenvalue':1,'zeroInputFrom1_0':['exp(t)','0'],
    'boundary':'cancelled +1 is not a pole of the reduced transfer; stable input-output transfer does not guarantee all internal modes stable'}
closed_cases=[]
for K in [1.,3.]:
    coeff=[1,1+K,2*K];poles=np.roots(coeff)
    for s in [.3,1j,3.]:
        L=K*(s+2)/(s*(s+1));T=K*(s+2)/(s*s+(1+K)*s+2*K)
        assert abs(L/(1+L)-T)<1e-12
    assert np.polyval(coeff,-2)!=0
    closed_cases.append({'K':K,'denominator':coeff,'poles':[[float(p.real),float(p.imag)] for p in poles]})
models['closed_loop_poles']={'loop':'K(s+2)/(s(s+1))','feedback':'unit negative',
    'closedTransfer':'K(s+2)/(s^2+(1+K)s+2K)','cases':closed_cases,
    'boundary':'closed poles depend on K and feedback structure; not simply the original open-loop pole list'}
def Gm(s):return np.diag([(s+2)/(s+1),1/(s+3)])
assert np.linalg.matrix_rank(Gm(0))==2 and np.linalg.matrix_rank(Gm(-2))==1
Az=np.diag([-1.,-3.]);Bz=np.eye(2);Cz=np.eye(2);Dz=np.diag([1.,0.])
R=np.block([[-2*np.eye(2)-Az,-Bz],[Cz,Dz]])
assert np.linalg.matrix_rank(R)==3
counter=np.array([[1.,0.],[0.,1.]])
assert np.linalg.matrix_rank(counter)==2
models['transmission_zero']={'G':'diag((s+2)/(s+1),1/(s+3))','normalRank':2,'zero':-2,'rankAtZero':1,
    'A':Az.tolist(),'B':Bz.tolist(),'C':Cz.tolist(),'D':Dz.tolist(),'systemMatrixRankAtZero':3,
    'entryZeroCounterexample':'G2=[[1,s/(s+1)],[0,1]]: at s=0 one entry vanishes but matrix rank stays 2',
    'boundary':'rank drop of the transfer matrix at a finite non-pole point, not merely a zero in one scalar entry; example realization is minimal'}
for s in [.3,1j,3.]:
    T=(s+2)/(s*s+2*s+2);F=(s+3)/(s+5)
    assert abs(F*T-(s+3)*(s+2)/((s+5)*(s*s+2*s+2)))<1e-12
models['closed_loop_zeros']={'baselineT':'(s+2)/(s^2+2s+2)','baselineZero':-2,
    'prefilter':'(s+3)/(s+5)','filteredReferenceTransfer':'(s+3)(s+2)/((s+5)(s^2+2s+2))',
    'filteredZeros':[-3,-2],'addedReferenceChannelPole':-5,
    'boundary':'unity feedback without extra paths preserves this numerator zero; a reference prefilter can change reference-channel zeros while feedback-loop characteristic roots remain unchanged'}
report={'status':'passed','stage':'models-before-authoring','models':models}
lines=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
with (BATCH/'model-verification.json').open('w') as f:
    for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
print('PASS: nine transfer models, original ODE responses, hidden-mode and matrix-rank counterexamples')
