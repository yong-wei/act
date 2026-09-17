"""Verify response metrics with analytic tails and original ODEs."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

BATCH=Path(__file__).resolve().parent
models={};wd=math.sqrt(3);tp=math.pi/wd
response=lambda t:1-np.exp(-np.asarray(t))*(np.cos(wd*np.asarray(t))+np.sin(wd*np.asarray(t))/wd)
t=np.linspace(0,12,2401)
trace=solve_ivp(lambda t,x:[x[1],4-2*x[1]-4*x[0]],[0,12],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.allclose(trace,response(t),atol=1e-8)
def settling(band):
    tail=math.log((2/math.sqrt(3))/band)
    knots=[0.]+[k*tp for k in range(1,int(tail/tp)+1)]+[tail]
    roots=[]
    # Response is monotone between these extrema; test both boundary levels.
    for a,b in zip(knots,knots[1:]):
        for level in [1-band,1+band]:
            f=lambda v:float(response(v))-level
            if f(a)*f(b)<0:roots.append(brentq(f,a,b,xtol=1e-13))
    roots.sort();assert roots and abs(float(response(roots[-1]))-1)<=band+1e-10
    assert np.max(abs(response(np.linspace(roots[-1]+1e-8,tail,1001))-1))<=band+1e-9
    return {'band':band,'crossingTimes':roots,'firstEntry':roots[0],'lastCrossingSettling':roots[-1],
            'guaranteedTailAfter':tail,'tailProof':'abs(y-1)<=2/sqrt(3)*exp(-t)'}
s2=settling(.02);s5=settling(.05)
assert float(response(tp))>1.02 and s2['firstEntry']<tp<s2['lastCrossingSettling']
models['settling_2percent']={'T':'4/(s^2+2s+4)',**s2,'commonApproximation':4,
    'boundary':'settling means entering and remaining; exact last crossing differs from first entry and from 4/(zeta wn)'}
coeff=np.polymul([1,3],[1,0,2]);assert np.allclose(coeff,[1,3,2,6])
assert np.all(np.real(np.roots([1,3,2,5]))<0)
assert np.any(np.real(np.roots([1,3,2,7]))>0)
yc=solve_ivp(lambda t,x:[x[1],x[2],6-3*x[2]-2*x[1]-6*x[0]],[0,12],[0.,0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
critical=1-2/11*np.exp(-3*t)-9/11*np.cos(math.sqrt(2)*t)-6/(11*math.sqrt(2))*np.sin(math.sqrt(2)*t)
assert np.allclose(yc,critical,atol=1e-8)
models['borderline_oscillation_frequency']={'loop':'K/[s(s+1)(s+2)]','negativeUnityFeedback':True,
    'characteristic':'s^3+3s^2+2s+K','criticalK':6,'factorizationAtCritical':'(s+3)(s^2+2)',
    'poles':[[-3,0],[0,math.sqrt(2)],[0,-math.sqrt(2)]],'angularFrequency':'sqrt(2)',
    'frequencyCyclesPerUnitTime':'sqrt(2)/(2pi)',
    'criticalUnitStep':'1-(2/11)exp(-3t)-(9/11)cos(sqrt(2)t)-6/(11sqrt(2))sin(sqrt(2)t)',
    'boundary':'this source refers to the borderline-gain oscillation, not a generic damped transient frequency; the critical step has persistent oscillation'}
ys=solve_ivp(lambda t,y:[-y[0]+2*math.sin(2*t)],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
steady=.4*np.sin(2*t)-.8*np.cos(2*t);transient=.8*np.exp(-t)
assert np.allclose(ys,steady+transient,atol=1e-9)
models['steady_state_response']={'G':'2/(s+1)','input':'sin(2t) for t>=0','zeroInitialState':True,
    'steadyPart':'0.4sin(2t)-0.8cos(2t)','amplitude':'2/sqrt(5)','phaseRadians':'-atan(2)',
    'decayingDifference':'0.8exp(-t)','boundary':'steady-state response may be periodic; y(t) need not have a constant limit'}
models['peak_time']={'T':'4/(s^2+2s+4)','zeroInitialUnitStep':True,'firstPeakTime':tp,
    'fractionalOvershoot':math.exp(-math.pi/math.sqrt(3)),
    'boundary':'time is measured from the specified input start; formula requires standard underdamped zero-free model'}
models['settling_band']={'twoPercent':s2,'fivePercent':s5,
    'boundary':'report tolerance and reference scale; finite sampled windows alone do not prove remaining inside forever'}
t10=brentq(lambda v:float(response(v))-.1,0,tp);t90=brentq(lambda v:float(response(v))-.9,0,tp)
t100=2*math.pi/(3*math.sqrt(3));assert abs(float(response(t100))-1)<1e-12
models['rise_time']={'sourceConvention':'first rise from zero to final value','zeroTo100':t100,
    't10':t10,'t90':t90,'tenTo90Interval':t90-t10,
    'boundary':'0-100 and 10-90 are different conventions; monotone asymptotic models may have no finite 0-100 time'}
models['peak_time_origin']={'sameBaseT':'4/(s^2+2s+4)','referenceDelay':.5,
    'input':'H(t-0.5)','relativePeakTime':tp,'absolutePeakTime':.5+tp,
    'output':'0 before 0.5; base step response evaluated at t-0.5 afterward',
    'boundary':'this shifts the reference start, not a new delay inserted inside the feedback loop'}
models['transient_response']={'sameModelAsSteadyState':True,'total':'0.4sin(2t)-0.8cos(2t)+0.8exp(-t)',
    'transient':'0.8exp(-t)','zeroInputFromZeroState':0,
    'boundary':'a transient may arise in a zero-state forced response; it is not necessarily initial-state response'}
critical_step=lambda v:1-(1+2*np.asarray(v))*np.exp(-2*np.asarray(v))
ct10=brentq(lambda v:float(critical_step(v))-.1,0,10);ct90=brentq(lambda v:float(critical_step(v))-.9,0,10)
models['critical_damping_response']={'T':'4/(s+2)^2','step':'1-(1+2t)exp(-2t)',
    'derivative':'4t exp(-2t)','t90':ct90,'tenTo90':ct90-ct10,
    'zeroTo100':'no finite first arrival','boundary':'standard zero-free, zero-initial step; finite 10-90 does not imply finite 0-100'}
ramp=solve_ivp(lambda t,y:[-y[0]+t],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.allclose(ramp,t-1+np.exp(-t),atol=1e-9)
models['steady_process']={'T':'1/(s+1)','input':'r=t for t>=0','output':'t-1+exp(-t)',
    'asymptoticPart':'t-1','trackingError':'1-exp(-t)','steadyError':1,
    'boundary':'stable system output can grow under an unbounded ramp; asymptotic behavior need not be a finite constant'}
ps=-4+2*math.sqrt(3);pf=-4-2*math.sqrt(3)
over=lambda v:1+(pf*np.exp(ps*np.asarray(v))-ps*np.exp(pf*np.asarray(v)))/(ps-pf)
yo=solve_ivp(lambda t,x:[x[1],4-8*x[1]-4*x[0]],[0,12],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.allclose(yo,over(t),atol=1e-8)
models['overdamped_response']={'T':'4/(s^2+8s+4)','slowPole':ps,'fastPole':pf,
    'step':'1+(pf exp(ps t)-ps exp(pf t))/(ps-pf)','initialValue':0,'initialSlope':0,'finalValue':1,
    't90':brentq(lambda v:float(over(v))-.9,0,20),
    'singleSlowPoleApproxInitialSlope':-ps,
    'boundary':'a single-pole approximation can lose the true initial slope; do not call it an exact equivalent'}
models['dynamic_process']={'T':'4/(s^2+2s+4)','input':'unit step','initialValue':0,'initialSlope':0,'initialAcceleration':4,
    'firstFinalValueCrossing':t100,'peakTime':tp,'twoPercentSettling':s2['lastCrossingSettling'],
    'boundary':'initial zero slope is not a pure delay; crossing the final value once is not the end of the transient'}
report={'status':'passed','stage':'models-before-authoring','timeConvention':'normalized time','models':models}
lines=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
with (BATCH/'model-verification.json').open('w') as f:
    for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
print(json.dumps({'status':'passed','settling2':s2,'settling5':s5,'rise':models['rise_time'],'critical':models['critical_damping_response']},indent=2))
