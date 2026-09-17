"""Original polynomial checks for root-locus geometry and parameter families."""
import json,math
from pathlib import Path
import numpy as np
BATCH=Path(__file__).resolve().parent
models={}
# Departure tangent from a simple complex pole under increasing positive gain.
p=-1+1j;D=np.poly1d(np.polymul([1,2],[1,2,2]));slope=-1/np.polyder(D)(p)
assert abs(np.angle(slope,deg=True)-45)<1e-10
small=np.roots(D.c+np.array([0,0,0,1e-5]));near=small[np.argmin(abs(small-p))]
assert abs(np.angle(near-p,deg=True)-45)<.01
models['departure']={'L0':'1/((s+2)(s^2+2s+2))','pole':[-1,1],
 'dsdK':[float(slope.real),float(slope.imag)],'departureDegrees':45}
# Near a finite zero, distinguish radial angle from direction of travel.
N=np.poly1d([1,2,2]);D=np.poly1d(np.polymul([1,3],np.polymul([1,4],[1,5])));z=-1+1j
radial=-D(z)/np.polyder(N)(z);angle=float(np.angle(radial,deg=True))
K=1e6;rr=np.roots(np.polyadd(D.c,K*N.c));near=rr[np.argmin(abs(rr-z))]
assert abs(np.angle(near-z,deg=True)-angle)<.01
travel=-N(near)/(np.polyder(D)(near)+K*np.polyder(N)(near))
assert abs((np.angle(travel,deg=True)%360)-((angle+180)%360))<.01
models['arrival']={'L0':'(s^2+2s+2)/((s+3)(s+4)(s+5))','zero':[-1,1],
 'largeKOffsetCoefficient':[float(radial.real),float(radial.imag)],'rayFromZeroDegrees':angle,
 'travelTowardZeroDegrees':(angle+180)%360,
 'boundary':'state whether angle describes ray from the zero or motion toward it'}
kb=2/(3*math.sqrt(3));sb=-1+1/math.sqrt(3)
assert abs(sb**3+3*sb**2+2*sb+kb)<1e-12
models['breakaway']={'L0':'1/[s(s+1)(s+2)]','point':sb,'gain':kb,'rejectedPoint':-1-1/math.sqrt(3),'rejectedGain':-kb}
assert np.allclose(np.poly([-3,1j*math.sqrt(2),-1j*math.sqrt(2)]),[1,3,2,6])
assert abs((0-1-(-3))/(2-1)-2)<1e-12
assert 6+5*1>0
models['finite_zero_centroid']={'L0':'(s+3)/(s(s+1))','centroid':2,'angleDegrees':180,'characteristicAtS2':'6+5K','positiveKStable':True}
models['asymptotes']={'sameCubic':True,'n':3,'m':0,'centroid':-1,'anglesDegrees':[60,180,300],
 'boundary':'large-gain limits, not exact finite-gain curves; n=m has no such infinite branches'}
family=[]
for a in [1.,2.,3.]:
 for K in [1.,4.,9.]:
  roots=np.roots([1,a,K]);assert np.max(roots.real)<0
  family.append({'a':a,'K':K,'roots':[[float(v.real),float(v.imag)] for v in roots]})
for a in [2.,2.8,4.,5.]:
 roots=np.roots([1,a,4]);assert np.max(roots.real)<0
assert np.allclose(np.sort(np.roots([1,5,4])),[-4,-1])
models['parameter_family']={'characteristic':'s^2+a*s+K','grid':family,'stableConditions':'a>0 and K>0',
 'fixedK4Auxiliary':'1+a*s/(s^2+4)=0','twoStepChoice':{'initialA':2,'chooseK':4,'thenA':2.8,'wn':2,'zeta':.7},
 'boundary':'a sweep holds K fixed; K sweep holds a fixed; a two-step choice is not a global optimum proof'}
models['open_loop_poles']={'L0':'1/[s(s+1)(s+2)]','openPoles':[0,-1,-2],
 'closedAtK6':[[-3,0],[0,math.sqrt(2)],[0,-math.sqrt(2)]],
 'boundary':'open-loop poles are zero-gain start points; actual closed roots depend on gain'}
T=.5;wb=1/T;G=1/(1+1j*wb*T)
assert abs(20*math.log10(abs(G))+3.01029995664)<1e-9
assert abs(abs(G)-1/math.sqrt(2))<1e-12 and abs(np.angle(G,deg=True)+45)<1e-12
wn=3.;zeta=.2;G2=wn**2/((1j*wn)**2+2*zeta*wn*1j*wn+wn**2)
assert abs(abs(G2)-1/(2*zeta))<1e-12
models['bode_breakpoint']={'firstOrderT':T,'firstOrderBreakRadPerSecond':wb,'firstOrderMagnitudeAtBreak':abs(G),
 'secondOrderWn':wn,'secondOrderZeta':zeta,'secondOrderMagnitudeAtBreak':abs(G2),
 'secondOrderResonantFrequency':wn*math.sqrt(1-2*zeta*zeta),
 'boundary':'frequency-domain asymptote breakpoint, not a root-locus breakaway; not always a -3dB or resonance point'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
