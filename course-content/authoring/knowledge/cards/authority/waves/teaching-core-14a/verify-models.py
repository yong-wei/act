"""Original-model checks for dominant poles, residues, and added zeros."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.signal import residue

BATCH=Path(__file__).resolve().parent
models={}
t=np.linspace(0,20,4001)
# Full cascade (s+1)(s+5): solve the second-order ODE.
y=solve_ivp(lambda t,x:[x[1],5-6*x[1]-5*x[0]],[0,20],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
exact=1-1.25*np.exp(-t)+.25*np.exp(-5*t)
approx=1-np.exp(-t)
assert np.max(abs(y-exact))<1e-8
peak_error_time=np.log(5)/4
peak_error=.25*(np.exp(-peak_error_time)-np.exp(-5*peak_error_time))
models['fast_pole']={'T':'5/((s+1)(s+5))','step':'1-1.25exp(-t)+0.25exp(-5t)',
 'unitGainReduced':'1/(s+1)','stepApproximation':'1-exp(-t)',
 'maximumAbsoluteStepError':float(peak_error),'atTime':float(peak_error_time),
 'boundary':'fivefold pole separation does not certify a small error tolerance'}
# Nearly cancelling slow pole: compute residues from original polynomials.
K=10/1.01
r,p,k=residue([K,K*1.01],np.polymul([1,0],np.polymul([1,1],[1,10])))
slow=float(r[np.argmin(abs(p+1))]);fast=float(r[np.argmin(abs(p+10))])
assert abs(slow+K*.01/9)<1e-10 and abs(slow+fast+1)<1e-10
models['near_zero']={'T':'(10/1.01)(s+1.01)/((s+1)(s+10))','slowResidue':slow,
 'fastResidue':fast,'boundary':'slow asymptotic rate alone does not quantify finite-time output importance'}
# Pair specified by captured node 08, plus a faster first-order factor.
den=np.polymul([1,5],[1,.8,.25]);assert np.allclose(den,[1,5.8,4.25,1.25])
full=solve_ivp(lambda t,x:[x[1],x[2],1.25-5.8*x[2]-4.25*x[1]-1.25*x[0]],
 [0,40],[0.,0.,0.],t_eval=np.linspace(0,40,4001),rtol=1e-11,atol=1e-13).y[0]
time=np.linspace(0,40,4001)
reduced=1-np.exp(-.4*time)*(np.cos(.3*time)+4/3*np.sin(.3*time))
rr,pp,_=residue([1.25],np.polymul([1,0],den))
from_residues=np.real(sum(a*np.exp(b*time) for a,b in zip(rr,pp)))
assert np.max(abs(full-from_residues))<1e-8
models['complex_pair']={'T':'1.25/((s+5)(s^2+0.8s+0.25))','poles':[[-5,0],[-.4,.3],[-.4,-.3]],
 'reduced':'0.25/(s^2+0.8s+0.25)','zeta':.8,'wn':.5,
 'gridInterval':[0,40],'gridSpacing':.01,'observedMaximumStepDifference':float(np.max(abs(full-reduced))),
 'boundary':'reported maximum is observed on the stated grid, not an all-time proof'}
# Proper systems with one added LHP/RHP zero: same denominator, different initial slope.
for tau in [.2,-.2]:
 ts=np.linspace(0,10,2001)
 trace=solve_ivp(lambda t,x:[x[1],16-4.8*x[1]-16*x[0]],[0,10],[0.,16*tau],t_eval=ts,rtol=1e-11,atol=1e-13).y[0]
 base=1-np.exp(-2.4*ts)*(np.cos(3.2*ts)+.75*np.sin(3.2*ts))
 derivative=5*np.exp(-2.4*ts)*np.sin(3.2*ts)
 assert np.max(abs(trace-(base+tau*derivative)))<1e-8
 models['zero_'+('left' if tau>0 else 'right')]={'T':f'16(1+({tau})s)/(s^2+4.8s+16)',
  'zero':-1/tau,'initialOutput':0,'initialSlope':16*tau,
  'boundary':'poles unchanged; response and inverse-motion possibility depend on the numerator'}
assert np.allclose(np.linalg.eigvals(np.diag([-1.,1.])),[-1,1])
models['hidden_mode']={'A':[[-1,0],[0,1]],'B':[1,0],'C':[1,0],'transfer':'1/(s+1)','unobservedState':'x2(0)*exp(t)','internallyAsymptoticallyStable':False}
models['modes']={'A':[[-1,0],[0,-5]],'initialState':[1,1],
 'state':['exp(-t)','exp(-5t)'],'outputC':[0,1],'output':'exp(-5t)',
 'boundary':'the slow state mode exists but is absent from this measured output'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
