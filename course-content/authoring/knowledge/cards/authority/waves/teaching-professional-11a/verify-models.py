"""Original robust-control examples; sampled checks complement analytic bounds."""
from pathlib import Path
from fractions import Fraction as F
import json,hashlib,math
import numpy as np
BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
def close(x,y):assert np.allclose(x,y,atol=1e-10), (x,y)
K=F(2);corners=[]
for k in [F(1,2),F(3,2)]:
    for a in [F(4,5),F(6,5)]:
        rate=a+K*k;dc=K*k/rate;error=1-dc
        pole=np.roots([1,float(a+K*k)])[0];close(pole,-float(rate))
        corners.append({'a':str(a),'k':str(k),'rate':str(rate),'pole':float(pole),'dc':str(dc),'steadyError':str(error)})
rates=[F(r['rate']) for r in corners];dc=[F(r['dc']) for r in corners];errors=[F(r['steadyError']) for r in corners]
assert min(rates)==F(9,5) and max(rates)==F(21,5)
assert min(dc)==F(5,11) and max(dc)==F(15,19)
assert max(errors)==F(6,11) and max(errors)<F(55,100) and max(errors)>F(1,10)
# Analytic monotonicity: d(2k/(a+2k))/dk=2a/(a+2k)^2>0; da derivative=-2k/(a+2k)^2<0.
for a in [F(4,5),F(1),F(6,5)]:
    for k in [F(1,2),F(1),F(3,2)]:
        assert K*a/(a+K*k)**2>0 and -K*k/(a+K*k)**2<0
correlated=[]
for rho in [F(-1,5),F(0),F(1,5)]:
    a=1+rho;k=1-rho;rate=a+2*k;assert rate==3-rho
    correlated.append({'rho':str(rho),'a':str(a),'k':str(k),'rate':str(rate)})
assert min(F(r['rate']) for r in correlated)==F(14,5)
assert max(F(r['rate']) for r in correlated)==F(16,5)
rectangle=[a+2*k for a in [F(4,5),F(6,5)] for k in [F(4,5),F(6,5)]]
assert min(rectangle)==F(12,5) and max(rectangle)==F(18,5)
for theta,coefficient in [(F(-1),F(-3,4)),(F(0),F(1,4)),(F(1),F(-3,4))]:
    assert F(1,4)-theta*theta==coefficient
# Omitted stable lag with identical DC gain.
tau=0.2;actual_den=np.polyadd(np.polymul([1,1],[tau,1]),[2]);close(actual_den,[0.2,1.2,3])
roots=np.roots(actual_den);close(np.sort_complex(roots),np.sort_complex([-3+math.sqrt(6)*1j,-3-math.sqrt(6)*1j]))
relative=[]
for w in [0.,0.1,1.,10.,100.]:
    z=1j*w;nominal=1/(z+1);actual=1/((z+1)*(1+tau*z));delta=actual/nominal-1
    close(delta,-tau*z/(1+tau*z));close(abs(delta),tau*w/math.sqrt(1+(tau*w)**2))
    relative.append({'omega':w,'relativeMagnitude':abs(delta)})
# Weighted return channels derived from actual nominal feedback expressions.
additive=[]
for epsilon in [0.4,0.5,1.49,1.5,1.6]:
    norm=2*epsilon/3
    for w in [0.,0.01,0.3,1.,10.,100.]:
        z=1j*w;g0=1/(z+1);S=1/(1+2*g0);Wa=epsilon/(z+1)
        close(Wa*2*S,2*epsilon/(z+3))
        close(abs(Wa*2*S),2*epsilon/math.sqrt(9+w*w));assert abs(Wa*2*S)<=norm+1e-12
    witness_pole=-(1+2*(1-epsilon))
    additive.append({'epsilon':epsilon,'returnNorm':norm,'deltaMinusOnePole':witness_pole})
close(additive[-2]['deltaMinusOnePole'],0);assert additive[-1]['deltaMinusOnePole']>0
mult=0.5
for w in [0.,0.2,1.,10.]:
    z=1j*w;g0=1/(z+1);T0=2*g0/(1+2*g0)
    close(mult*T0,2*mult/(z+3))
close(2*mult/3,1/3)
for source in json.loads((BATCH/'supporting-source-inventory.json').read_text())['sources']:
    assert hashlib.sha256((ROOT/source['localPath']).read_bytes()).hexdigest()==source['sha256']
models={'robustness':{'corners':corners,'exactPoleInterval':['-21/5','-9/5'],'exactDCInterval':['5/11','15/19'],'analyticBound':'rate affine; DC strictly increasing in k and decreasing in a'},'robust_system':{'minimumRate':'9/5','maximumSteadyError':'6/11','rateRequirement':'3/2','errorRequirement':'11/20','tighterErrorRequirementFails':'1/10'},'model_inaccuracy':{'nominal':{'a':1,'k':1,'pole':-3,'dc':'2/3'},'family':corners,'parametersFixed':True},'unmodeled_dynamics':{'tau':tau,'actualClosedLoopDenominator':actual_den.tolist(),'actualPoles':[[float(r.real),float(r.imag)] for r in roots],'relativeErrorSamples':relative,'relativeErrorNorm':1},'parameter_bounds':{'correlated':correlated,'correlatedRateRange':['14/5','16/5'],'independentOuterBoxRateRange':['12/5','18/5']},'additive':{'nominal':'1/(s+1)','controller':2,'weight':'epsilon/(s+1)','returnChannel':'2*epsilon/(s+3)','cases':additive},'multiplicative':{'weight':0.5,'returnChannel':'1/(s+3)','returnNorm':'1/3'},'robust_stability':{'parameterFamilyProof':'analytic pole range','dynamicUncertaintyProof':'nominal internal stability, stable proper uncertainty with norm <=1, strict weighted small-gain bound','gridIsProof':False}}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models,'limits':'No arbitrary time-varying-parameter or nonlinear robustness claim; numerical samples support explicit analytic reasoning.'},ensure_ascii=False,indent=2)+'\n')
print('Passed eight robust-model groups and frozen primary-reference hash')
