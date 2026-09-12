"""Original electronic score and Foley, synthesized for the 54-second picture edit.

No downloaded music, samples, voices or external service. Reproducible stereo stems.
Requires numpy and scipy. The final master is loudness-normalized by finish.mjs.
"""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

SR = 48000
DURATION = 54
N = SR * DURATION
rng = np.random.default_rng(90210)
music = np.zeros((N, 2), np.float64)
sfx = np.zeros((N, 2), np.float64)
out = Path(__file__).resolve().parents[1] / 'artifacts/cinematic-demo'
out.mkdir(parents=True, exist_ok=True)

def clock(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def filt(x, cutoff, kind='lowpass'):
    return sosfilt(butter(2, cutoff, kind, fs=SR, output='sos'), x)

def add(bus, signal, at, gain=1, pan=0):
    signal = np.asarray(signal)
    offset = int(at * SR)
    if offset < 0:
        signal, offset = signal[-offset:], 0
    length = min(len(signal), N - offset)
    if length <= 0: return
    if signal.ndim == 1:
        signal = np.column_stack((signal * np.sqrt((1-pan)/2), signal * np.sqrt((1+pan)/2)))
    bus[offset:offset+length] += signal[:length] * gain

def envelope(t, attack=.05, release=.5):
    return np.minimum(1, t / attack) * np.minimum(1, (t[-1] - t) / release)

def pad(notes, duration, at, gain=.07):
    t = clock(duration); channels=[]
    for channel in range(2):
        x = np.zeros(len(t))
        for i, note in enumerate(notes):
            f=hz(note) * (1 + (channel*2-1)*.0015)
            for harmonic in range(1, 6):
                x += np.sin(2*np.pi*f*harmonic*t+i*.7+channel*.4) / harmonic**1.7
        x *= envelope(t, 1.2, 1.7) * (.87+.13*np.sin(t*.7+channel))
        channels.append(x)
    add(music, np.column_stack(channels), at, gain)

def pluck(note, duration=.85):
    t=clock(duration);f=hz(note)
    return (np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2*t)+.09*np.sin(2*np.pi*f*3*t))*np.exp(-t*6)*np.minimum(t/.008,1)

def kick(at, gain=.25):
    t=clock(.7); f=43+92*np.exp(-t*31)
    x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)
    x+=filt(rng.normal(size=len(t)),1800)*np.exp(-t*90)*.2
    add(music,x,at,gain)

def snare(at,gain=.14):
    t=clock(.5);n=filt(rng.normal(size=len(t)),[1200,7000],'bandpass')
    x=(n*np.exp(-t*15)+.28*np.sin(2*np.pi*184*t)*np.exp(-t*23))*np.minimum(1,t/.002)
    add(music,x,at,gain,.13)

def hat(at,gain=.025,pan=-.3):
    t=clock(.15);add(music,filt(rng.normal(size=len(t)),7500,'highpass')*np.exp(-t*45),at,gain,pan)

def boom(at,power=1,pan=0):
    t=clock(3.7)
    noise=filt(rng.normal(size=len(t)),[35,1800],'bandpass')
    sub=np.sin(2*np.pi*(38*t+1.5*(1-np.exp(-t*12))))*np.exp(-t*1.9)
    crack=filt(rng.normal(size=len(t)),[900,8500],'bandpass')*np.exp(-t*28)
    x=(noise*.75*np.exp(-t*2.8)+sub*.6+crack*.65)*np.minimum(1,t/.003)
    add(sfx,x,at,.44*power,pan)
    add(sfx,x,at+.135,.08*power,-pan)

def whoosh(at,duration=1.2,gain=.15,pan=0):
    t=clock(duration);n=filt(rng.normal(size=len(t)),[180,4600],'bandpass')
    env=np.sin(np.pi*t/duration)**2
    x=n*env + .13*np.sin(2*np.pi*(90*t+240*t*t/duration))*env
    # Counter-delayed stereo creates motion without large level differences.
    stereo=np.column_stack((x,np.roll(x,int(.013*SR))))
    add(sfx,stereo,at,gain)

def metal(at,gain=.12):
    t=clock(1.7);x=sum(np.sin(2*np.pi*f*t)*np.exp(-t*(3+i*.8)) for i,f in enumerate([117,283,471,733,1103]))
    add(sfx,x,at,gain)

def glass(at,gain=.075,pan=0):
    for i in range(17):
        t=clock(.12+rng.random()*.3);f=rng.uniform(1500,6700)
        x=(np.sin(2*np.pi*f*t)+.25*rng.normal(size=len(t)))*np.exp(-t*24)
        add(sfx,x,at+rng.random()*.55,gain*rng.uniform(.3,1),np.clip(pan+rng.uniform(-.5,.5),-1,1))

# D minor / Bb / F / C. Suspended high notes keep the opening unresolved.
pad([38,50,57,62,64],8,0,.057)
pad([34,46,53,58,62],8,6,.06)
pad([41,53,60,65],6,12,.052)
chords=[[38,50,57,62],[34,46,53,58],[41,53,60,65],[36,48,55,60]]
for i,at in enumerate(np.arange(16,40,4)):
    pad(chords[i%4],5.4,float(at),.05)
pad([38,50,57,65],6,40,.064)
pad([38,50,57,62,69],8,46,.057)

# Measured half-time heartbeat, then an accelerating ostinato.
for at in np.arange(6,16,1): kick(float(at),.19)
pattern=[0,7,12,7,3,7,14,12]
for j,at in enumerate(np.arange(12,40,.25)):
    root=[50,46,53,48][int((at-16)//4)%4] if at>=16 else 50
    gain=.038 if at<16 else (.046 if at<22 else .026 if at<28 else .062)
    x=pluck(root+pattern[j%8]);add(music,x,float(at),gain,(-.45 if j%2 else .45))
    add(music,x,float(at+.375),gain*.23,(-.5 if j%2==0 else .5))
for at in np.arange(16,40,.5):
    if 22<=at<28: continue
    kick(float(at),.23 if at<32 else .27)
    if int(at*2)%2: snare(float(at),.14)
    hat(float(at),.02)
    hat(float(at+.25),.012,.35)
for at in np.arange(37,39.75,.125): snare(float(at),.018+(at-37)*.014)

# Low city air and distant machinery underpin the first reveal.
t=clock(12);air=filt(rng.normal(size=len(t)),[70,1100],'bandpass')*.034
add(sfx,air*envelope(t,2,1),0)
for at in [6,6.65,9.8]: boom(at,.45);metal(at+.02,.045)
whoosh(11.45,.75,.10)
whoosh(13.55,1.1,.2);boom(13.7,.33)
whoosh(15.65,.8,.18)
t=clock(6);turbine=filt(rng.normal(size=len(t)),[160,4200],'bandpass')*.09
turbine+=(np.sin(2*np.pi*(95*t+15*np.sin(t)))+np.sin(2*np.pi*192*t))*.017
add(sfx,turbine*envelope(t,.3,.4),16)
for at in [17.8,19.7,21.3]:whoosh(at,.7,.08)
# The slow-motion breach: bass pressure, crackle, then falling fragments.
whoosh(21.75,.5,.10)
for at,p in [(22.8,.6),(23.7,.46),(24.3,.6),(25.2,.46)]:
    boom(at,p);glass(at+.08,.056);metal(at+.08,.045)
for at in [28.3,28.8,29.3]:whoosh(at,.7,.19)
for at in [29.8,30.3,30.8]:boom(at,.55)
boom(32.64,.85);metal(32.64,.13)
for at in [33.7,34.5,35.2,36.1]:boom(at,.42);glass(at,.04)
for j,at in enumerate(np.arange(37,39.8,.125)):
    tt=clock(.12);x=np.sin(2*np.pi*(880*tt-2400*tt*tt))*np.exp(-tt*34)
    add(sfx,x,float(at),.055,(-.45 if j%2 else .45))
boom(39.2,.65)
# Native reactor's fifteen staggered blasts, at the exact playback speed.
bursts=[0,.24,.49,.73,.98,1.2,1.42,1.6,1.76,2.02,2.3,2.65,3.05,3.5,4.1]
for i,b in enumerate(bursts):
    at=40+b/.78;boom(at,1.25 if i==7 else .3+(.1 if i%3==0 else 0),(i%3-1)*.25)
    if i>7:metal(at,.035)
whoosh(46.1,.85,.12)
boom(47,.95);metal(47,.07)
for at,note in [(47,62),(47.25,69),(47.5,74)]:add(music,pluck(note,2),at,.085)

# Short room reflections on the score. All sound tails remain inside the finish.
dry=music.copy()
for delay,gain in [(.083,.12),(.179,.09),(.317,.06),(.571,.035)]:
    d=int(delay*SR);music[d:,0]+=dry[:-d,1]*gain;music[d:,1]+=dry[:-d,0]*gain
timeline=np.arange(N)/SR
duck=np.ones(N)
for at in [6,13.7,22.8,28.3,32.64,39.2,40,42.05,47]:
    duck-=.24*np.exp(-np.maximum(0,timeline-at)*4)*(timeline>=at)
music*=np.clip(duck,.4,1)[:,None]
fade=np.minimum(1,timeline/1.1)*np.clip((54-timeline)/1.35,0,1)
music*=fade[:,None];sfx*=fade[:,None]
mix=music+sfx
# Soft-limit isolated transients before transparent master normalization.
mix=np.tanh(mix*.9)
for name,data in [('music',music),('sound-design',sfx),('soundtrack',mix)]:
    data=np.clip(data,-.99,.99)
    write(out/f'{name}.wav',SR,np.int16(data*32767))
print(f'Original score + synchronized sound design: {DURATION}s / {SR}Hz stereo')
print(f'Raw mix peak: {np.max(np.abs(mix)):.3f}')
