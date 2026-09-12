"""Original electronic score and Foley, synthesized for the 38.5-second action edit.

No downloaded music, samples, voices or external service. Reproducible stereo stems.
Requires numpy and scipy. The final master is loudness-normalized by finish.mjs.
"""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

SR = 48000
DURATION = 38.5
N = int(SR * DURATION)
rng = np.random.default_rng(90210)
music = np.zeros((N, 2), np.float64)
sfx = np.zeros((N, 2), np.float64)
out = Path(__file__).resolve().parents[1] / 'artifacts/cinematic-demo/action'
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

# 160 BPM. Percussion and a repeating bass hook begin with the first attack.
beat=.375
roots=[38,34,41,36]
for j,at in enumerate(np.arange(0,34.5,3)):
    root=roots[j%4];pad([root,root+12,root+19,root+24],3.7,float(at),.026)
for j,at in enumerate(np.arange(0,35,beat)):
    if j%4 in [0,2,3]:kick(float(at),.24)
    if j%2==1:snare(float(at),.2)
    for k in range(4):hat(float(at+k*beat/4),.02 if k%2==0 else .012,(-.4 if k%2 else .4))
for j,at in enumerate(np.arange(0,34.9,beat/2)):
    root=roots[int(at//3)%4];note=root+[0,0,7,0,3,0,10,7][j%8]
    tt=clock(.23);f=hz(note-12)
    x=np.tanh((np.sin(2*np.pi*f*tt)+.3*np.sin(2*np.pi*f*2*tt)+.14*np.sin(2*np.pi*f*3*tt))*1.8)
    add(music,x*np.minimum(tt/.008,1)*np.exp(-tt*11),float(at),.11)
    if j%2==0:
        x=pluck(note+24,.5);add(music,x,float(at),.045,(-.38 if j%4 else .38))
        add(music,x,float(at+beat*.75),.012,(.5 if j%4 else -.5))
for at in np.arange(31,33.35,.125):snare(float(at),.025+(at-31)*.012)

# Synchronized fight Foley: distinctly dry punches, clanging guards and turbines.
def punch_hit(at,gain=1):
    tt=clock(.8);low=np.sin(2*np.pi*(57*tt+2*(1-np.exp(-tt*22))))*np.exp(-tt*7)
    crack=filt(rng.normal(size=len(tt)),[230,9000],'bandpass')*np.exp(-tt*34)
    add(sfx,(low*.7+crack)*np.minimum(tt/.0015,1),at,.5*gain)
    metal(at+.025,.1*gain)

boom(.15,.45)
for at in [2.05,3.4,8.1,14.1,16.15,28.15]:metal(at,.07);whoosh(at-.22,.4,.11)
for at in [3.1,4.35,5.5,7.25,9.75,11.5,13,15.45,17,18.35,21.35,25.3,29.6,31.85,37.5]:whoosh(at,.5,.13)
for at in [6.32,6.85,7.2]:boom(at,.42);glass(at,.035)
punch_hit(10,1.2);boom(12.5,.35)
punch_hit(29.85,1.1)

for start,end in [(0,2.9),(7.6,9.6),(13,14.9),(16.1,16.9),(27.5,28.9)]:
    for j,at in enumerate(np.arange(start,end,.12)):
        tt=clock(.1);x=np.sin(2*np.pi*(1000*tt-3300*tt*tt))*np.exp(-tt*42)
        add(sfx,x,float(at),.065,(-.5 if j%2 else .5))

for i in range(8):
    at=17.12+i*.11
    whoosh(at,.65,.11)
    tt=clock(.13);add(sfx,filt(rng.normal(size=len(tt)),2400)*np.exp(-tt*20),at,.12,(i%3-1)*.5)

# Eight separate Doppler passes, matching the authored catch-up clocks.
near=[2.15,2.65,3.15,3.6,4.15,4.65,5.15,5.6]
tt=clock(7);wind=filt(rng.normal(size=len(tt)),[120,4600],'bandpass')*.055
wind+=np.sin(2*np.pi*(100*tt+4*np.sin(tt*2)))*.018
add(sfx,wind*envelope(tt,.15,.35),18.5)
for i,n in enumerate(near):
    at=18.5+n;tt=clock(.55)
    f=430-310*tt/.55;doppler=np.sin(2*np.pi*np.cumsum(f)/SR)*.16+filt(rng.normal(size=len(tt)),[550,6800],'bandpass')*.8
    add(sfx,doppler*np.sin(np.pi*tt/.55)**2,at-.18,.2,(-.65 if i%2 else .65))
    boom(at+.85,.34,(i%3-1)*.5);glass(at+.88,.032,(i%3-1)*.4)
boom(25.83,.75);metal(25.85,.11)
for at in [26.4,26.8,27.15]:boom(at,.3);glass(at,.03)
whoosh(31.05,.95,.11)
boom(32.4,.8);punch_hit(32.4,.65)
bursts=[0,.24,.49,.73,.98,1.2,1.42,1.6,1.76,2.02,2.3,2.65,3.05,3.5,4.1]
for i,b in enumerate(bursts):
    at=33.5+b if b<1.5 else 35+(b-1.5)/1.3
    boom(at,1.05 if i==7 else .23,(i%3-1)*.35)
    if i>7:metal(at,.032)
whoosh(37.52,.6,.22)

# Pull the music away for both fist contacts, then let the beat immediately return.
time=np.arange(N)/SR;duck=np.ones(N)
for at in [10,29.85,32.4,35.077]:
    duck-=.67*np.exp(-np.maximum(0,time-at)*7)*(time>=at)
    duck*=np.where((time>at-.075)&(time<at),.22,1)
music*=np.clip(duck,.2,1)[:,None]
music*=np.where(time>35.08,np.exp(-(time-35.08)*2),1)[:,None]
fade=np.minimum(1,time/.08)*np.clip((DURATION-time)/.4,0,1)
music*=fade[:,None];sfx*=fade[:,None]
mix=np.tanh((music+sfx)*.95)
for name,data in [('music',music),('sound-design',sfx),('soundtrack',mix)]:
    write(out/f'{name}.wav',SR,np.int16(np.clip(data,-.99,.99)*32767))
print(f'Action score: {DURATION}s, 160 BPM, eight timed missile passes, two fist impacts.')
