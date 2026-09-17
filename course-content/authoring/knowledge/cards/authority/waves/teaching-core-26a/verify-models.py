"""Original margin, Nyquist, phase and reduction examples."""
from pathlib import Path
import cmath,json,math
BATCH=Path(__file__).resolve().parent
models={}
G=lambda s:1/((1+s)*(1+.1*s));R=lambda s:1/(1+1.1*s)
points=[]
for w in [.1,1,10]:
 a=G(1j*w);r=R(1j*w);points.append({'omega':w,'originalMagnitude':abs(a),'reducedMagnitude':abs(r),'relativeComplexError':abs(r-a)/abs(a)})
assert G(0)==R(0)==1
models['frequency_matching']={'original':'1/[(s+1)(0.1s+1)]','reduced':'1/(1.1s+1)','method':'match DC value and first derivative at s=0; compare exact complex frequency samples','samples':points,'boundary':'same DC only ensures same constant-input final gain for stable models, not same response at every frequency'}
K=10.;L=lambda w:K/((1+1j*w)*(2+1j*w)*(3+1j*w));wp=math.sqrt(11);gm=60/K
assert abs(L(wp).imag)<1e-12 and abs(L(wp).real+K/60)<1e-12
lo,hi=0.,10.
for _ in range(100):
 mid=(lo+hi)/2
 if abs(L(mid))>1:lo=mid
 else:hi=mid
wc=(lo+hi)/2;phase=-sum(math.degrees(math.atan(wc/p)) for p in [1,2,3]);pm=180+phase
assert abs(abs(L(wc))-1)<1e-12
models['margins']={'loop':'10/[(s+1)(s+2)(s+3)]','phaseCrossover':wp,'gainMarginFactor':gm,'gainMarginDb':20*math.log10(gm),'gainCrossover':wc,'phaseMarginDegrees':pm,'closedCharacteristic':'s^3+6s^2+11s+6+K','stablePositiveKRange':[0,60],'boundaryK60':'(s+6)(s^2+11); imaginary pair, not asymptotically stable'}
# RHP contour: up imaginary axis then clockwise right semicircle.
rad=100.;count=12000
contour=[complex(0,-rad+2*rad*i/count) for i in range(count+1)]
contour += [rad*cmath.exp(1j*(math.pi/2-math.pi*i/count)) for i in range(1,count+1)]
ny=[]
for k in [.5,2.]:
 vals=[1+k/(s-1) for s in contour]
 winding=sum(cmath.phase(vals[(i+1)%len(vals)]/vals[i]) for i in range(len(vals)))/(2*math.pi)
 z=1 if 1-k>0 else 0
 assert abs(winding-(1-z))<1e-8
 ny.append({'K':k,'openRhpPoles':1,'closedPole':1-k,'closedRhpPoles':z,'ccwWindingOfLAboutMinus1':round(winding)})
models['nyquist']={'loop':'K/(s-1)','contour':'clockwise boundary of RHP; imaginary axis -jR to +jR, right semicircle back','convention':'R counts counterclockwise image windings about -1; R=P-Z','samples':ny,'boundary':'K=1 passes through -1 at omega0; closed pole0; imaginary-axis poles need indented contour; no hidden unstable cancellation'}
Gp=lambda s:(1+.5*s)/((1+s)*(1+.2*s));Gn=lambda s:(1-.5*s)/((1+s)*(1+.2*s))
for w in [0,.1,1,2,10]:assert abs(abs(Gp(1j*w))-abs(Gn(1j*w)))<1e-12
for t in [0,.1,1,3]:
 yp=1-.625*math.exp(-t)-.375*math.exp(-5*t)
 yn=1-1.875*math.exp(-t)+.875*math.exp(-5*t)
 if t==0:assert abs(yp)<1e-12 and abs(yn)<1e-12
 if t==.1:assert yn<0<yp
models['minimum_phase_pair']={'minimum':'(1+0.5s)/[(s+1)(0.2s+1)]','nonminimum':'(1-0.5s)/[(s+1)(0.2s+1)]','poles':[-1,-5],'zeros':[-2,2],'sameMagnitude':True,'extraPhaseDegreesAtOmega2':-90,'minimumStep':'1-0.625exp(-t)-0.375exp(-5t)','nonminimumStep':'1-1.875exp(-t)+0.875exp(-5t)','initialSlopes':[2.5,-2.5],'boundary':'stable nonminimum phase possible; improper inverse due relative degree is distinct from unstable inverse due RHP zero'}
models['convention_boundaries']={'negativeGain':'-1 has no finite zeros/poles but extra 180deg relative to +1; source typical-element convention treats it separately','originElements':'textbook frequency-element convention includes 1/s and s; they are not examples with all roots strictly LHP and stable proper inverse','delay':'exp(-tau*s) has unit magnitude and phase -omega*tau; inverse time advance is noncausal','unstablePole':'1/(s-1) is unstable regardless of lack of finite zeros; stable-minimum-phase usage excludes it'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
