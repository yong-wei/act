"""Offline piecewise nonlinear examples; no platform simulation runtime."""
from pathlib import Path
import math,json
BATCH=Path(__file__).resolve().parent
models={}
sat=lambda u: max(-1.,min(1.,u))
dead=lambda u:2*max(0,u-.5) if u>=0 else -2*max(0,-u-.5)
assert sat(.75)+sat(.75)==1.5 and sat(1.5)==1
assert dead(.4)==0 and abs(dead(.6)-.2)<1e-12
models['saturation']={'law':'y=clip(u,-1,1)','samples':[[u,sat(u)] for u in [-2,-1,-.5,0,.5,1,2]],'nonadditivity':{'f075Plusf075':1.5,'f15':1},'boundary':'memoryless static model; input-output saturation alone is not hysteresis'}
models['dead_zone']={'law':'y=0 for abs(u)<=0.5; y=2(u-0.5sign(u)) otherwise','halfWidth':.5,'outsideSlope':2,'samples':[[u,dead(u)] for u in [-1,-.5,-.4,0,.4,.5,.6,1]],'boundary':'continuous offset outside dead zone; no state/history in this ideal law'}
inputs=[0,.6,0,-.6,0,.6];state=-2;outputs=[]
for u in inputs:
 if u>=.5:state=2
 elif u<=-.5:state=-2
 outputs.append(state)
assert outputs==[-2,2,2,-2,-2,2]
models['relay_hysteresis']={'thresholds':[-.5,.5],'levels':[-2,2],'initialState':-2,'inputs':inputs,'outputs':outputs,'sameInputZeroDifferentOutputs':True,'boundary':'explicit initial state and equality convention; not a single-valued memoryless curve'}
models['ideal_relay']={'law':'y=2sign(u) for u!=0; choose y(0)=0 for this example','inputs':[-.01,0,.01],'outputs':[-2,0,2],'boundary':'zero switching threshold and no hysteresis here; chattering possible with noisy crossings'}
inputs=[0,2,1,0,-2,0,2];y=0.;ys=[]
for u in inputs:
 y=max(u-1,min(y,u+1));ys.append(y);assert abs(u-y)<=1
assert ys==[0,1,1,1,-1,-1,1]
models['backlash_play']={'halfGap':1,'initialInput':0,'initialOutput':0,'inputs':inputs,'outputs':ys,'update':'y=clip(previousY,u-1,u+1), each input segment monotone','boundary':'ideal quasi-static play; output sticks inside gap, depends on history; not impact/compliance dynamics'}
m=2.;fc=3.;v0=2.;ts=m*v0/fc;distance=m*v0*v0/(2*fc)
assert abs(ts-4/3)<1e-12 and abs(distance-4/3)<1e-12
models['coulomb_slide']={'mass':m,'Fc':fc,'initialVelocity':v0,'velocityBeforeStop':'2-1.5t','stopTime':ts,'stoppingDistance':distance,'afterStop':'v=0 when external force zero; do not extend formula to reverse motion','force':'-Fc sign(v) for v!=0','boundary':'value at v=0 requires sticking/contact rule; setting sign(0)=0 alone cannot model static friction'}
fs=4.;force=2.;assert abs(force)<=fs
models['stiction']={'mass':2,'staticLimit':fs,'kineticLevel':fc,'appliedAtRest':force,'staticFriction':-force,'acceleration':0,'aboveLimitForce':5,'initialPositiveSlipAcceleration':(5-fc)/2,'boundary':'sticking possible within static force interval, kinetic law after breakaway; onset exactly at limit needs declared convention'}
bv=1.;tsv=m/bv*math.log(1+bv*v0/fc);dist=(v0+fc/bv)*m/bv*(1-math.exp(-bv*tsv/m))-fc/bv*tsv
assert abs((v0+fc/bv)*math.exp(-bv*tsv/m)-fc/bv)<1e-12
for v in [-2,-.1,.1,2]:
 f=-math.copysign(fc,v)-bv*v;assert f*v<0
models['coulomb_viscous']={'mass':m,'Fc':fc,'b':bv,'v0':v0,'positiveVelocity':'5exp(-t/2)-3 until stopping','stopTime':tsv,'stoppingDistance':dist,'forceAtVelocity2':-5,'forceAtVelocityMinus2':5,'powerAtVelocity2':-10,'boundary':'velocity law ends at first zero; hold at rest with consistent static law'}
models['integrator_saturation']={'assumedError':1,'integralGain':1,'initialIntegralState':0,'time':3,'integralState':3,'actuatorClippedOutput':1,'boundary':'prescribed persistent error thought experiment, not a solved closed loop; windup depends on controller state, not memory inside static saturator'}
# Dynamic nonadditivity and static inverse examples used in authored cards.
for t in [0,.1,1,3]:
 e=math.exp(-t);x=.75*(1-e);xdot=.75*e
 assert abs(xdot+x-sat(.75))<1e-12
 big=1-e;assert abs(e+big-sat(1.5))<1e-12
 if t>0:assert abs(2*x-big)>0
assert abs(dead(.6)-.2)<1e-12 and sat(dead(2))==1
models['dynamic_nonadditivity']={'ode':'x_dot=-x+sat(u); x(0)=0','u075Response':'0.75(1-exp(-t))','u15Response':'1-exp(-t)','boundary':'two separate responses do not sum to response to combined input'}
models['dead_zone_inverse']={'halfWidth':.5,'slope':2,'targetOutput':.2,'requiredPositiveInput':.6,'zeroOutputInverseInterval':[-.5,.5],'combinedSaturationAtInput2':1}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
