"""Fix the original models before writing the seven control-design cards."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

BATCH = Path(__file__).resolve().parent
results = {}
for gain in [1,4]:
    times=np.linspace(0,5,501)
    y=solve_ivp(lambda t,y:[gain*(1-y[0])-y[0]], [0,5],[0.],t_eval=times,rtol=1e-10,atol=1e-12).y[0]
    expected=gain/(1+gain)*(1-np.exp(-(1+gain)*times))
    assert np.allclose(y,expected,atol=1e-8)
    results['P_'+str(gain)]={'plant':'1/(s+1)','controllerGain':gain,'closedPole':-1-gain,'stepError':1/(1+gain),'timeConstant':1/(1+gain),'initialControl':gain}
for label,kp,ki in [('PI',2,1),('pure_I',0,1),('PI_stable_cancellation',1,1)]:
    t=np.linspace(0,40,8001)
    # z'=e, u=kp*e+ki*z, y'=-y+u; r=1 and both states initially zero.
    trace=solve_ivp(lambda t,x:[-x[0]+kp*(1-x[0])+ki*x[1],1-x[0]], [0,40],[0.,0.],t_eval=t,rtol=1e-10,atol=1e-12).y
    y,z=trace;u=kp*(1-y)+ki*z
    roots=np.roots([1,1+kp,ki]);assert all(p.real<0 for p in roots)
    assert abs(y[-1]-1)<1e-6
    if label=='pure_I':assert abs(max(y)-1-math.exp(-math.pi/math.sqrt(3)))<1e-6
    if label=='PI_stable_cancellation':assert np.allclose(y,1-np.exp(-t),atol=1e-8)
    results[label]={'plant':'1/(s+1)','kp':kp,'ki':ki,'zeroInitialState':True,'stepFinalOutput':float(y[-1]),'peakOutput':float(max(y)),'peakControl':float(max(u)),'poles':[[float(p.real),float(p.imag)] for p in roots]}
assert results['PI']['peakControl'] < 3
results['performance_choice']={'P_gain_for_10_percent_error':9,'P_initialControl':9,'actuatorLimit':3,'PI_initialControl':2,'PI_stepError':0,'limitation':'PI control bound verified only for this unit step and model'}
results['lead_compensator']={'plant':'1/(s+1)','compensator':'(s+1)/(0.1s+1)','closedTransfer':'1/(0.1s+2)','closedTimeConstant':.05,'baselineTimeConstant':.5,'stableCancelledPole':-1,'highFrequencyControllerGain':10}
results['series_vs_prefilter']={'plant':'1/(s+1)','feedback':'unit negative','seriesC4':'4/(s+5)','prefilterF4_with_C1':'4/(s+2)'}
for sample in [.5,1j,3]:
    p=1/(sample+1)
    c=(sample+1)/(.1*sample+1)
    assert abs(c*p/(1+c*p)-1/(.1*sample+2))<1e-12
    assert abs(4*p/(1+4*p)-4/(sample+5))<1e-12
    assert abs(4*p/(1+p)-4/(sample+2))<1e-12
assert 1/(1+9)==.1 and 9>3
# The authored card uses dynamic blocks; independently reviewed final examples.
for sample in [.5, 1j, 3]:
    p=1/(sample+1)
    c=4/(sample+5)
    f=4/(sample+2)
    assert abs(c*p/(1+c*p)-4/(sample+3)**2)<1e-12
    assert abs(f*p/(1+p)-4/(sample+2)**2)<1e-12
results['authored_series_vs_prefilter']={'plant':'1/(s+1)','feedback':'unit negative','seriesController':'4/(s+5)','seriesClosed':'4/(s+3)^2','prefilter':'4/(s+2)','prefilterClosedWithC1':'4/(s+2)^2'}
plant=lambda w:1/(1j*w*(1+1j*w))
comp=lambda w:(1+1j*w)/(1+.1j*w)*10*(1+10j*w)/(1+100j*w)
for label,loop in [('baseline',plant),('lead_lag',lambda w:comp(w)*plant(w))]:
    wc=brentq(lambda w:abs(loop(w))-1,.001,100)
    results[label]={'gainCrossover':wc,'phaseMarginDegrees':float(180+np.angle(loop(wc),deg=True))}
den=np.polymul([.1,1],[100,1]);num=np.polymul([1,1],[100,10]);closed=np.polyadd(np.polymul(den,[1,1,0]),num)
roots=np.roots(closed);assert all(r.real<0 for r in roots)
epsilon=1e-8
kv=np.polyval(num,epsilon)/np.polyval(den,epsilon)/(epsilon+1)
assert abs(1/kv-.1)<1e-6
assert num[0]/den[0]==10
results['lead_lag'].update({'controller':'(1+s)/(1+0.1s) * 10(1+10s)/(1+100s)','closedCharacteristic':closed.tolist(),'poles':[[float(p.real),float(p.imag)] for p in roots],'rampError':.1,'baselineRampError':1,'controllerHighFrequencyGain':10})
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','cardAuthoringStatus':'not-yet-written','models':results},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
