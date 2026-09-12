"""Original, deterministic material textures. Optional photographic upgrades: npm run assets."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
out=Path(__file__).resolve().parents[1]/'public/assets';out.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(4219);size=1024
n=rng.normal(0,1,(size,size))
# Fine aggregate, broad mottling and hairline cracks. No third-party imagery.
base=np.clip(102+n*7,0,255)
asphalt=np.dstack([base*.73,base*.82,base*.86]).astype('uint8')
im=Image.fromarray(asphalt);d=ImageDraw.Draw(im)
for j in range(45):
 x,y=rng.integers(0,size,2);points=[(int(x),int(y))]
 for k in range(int(rng.integers(4,16))):x+=rng.integers(-10,16);y+=rng.integers(2,16);points.append((int(x),int(y)))
 d.line(points,fill=(50,64,69),width=1)
im.save(out/'asphalt.jpg',quality=90)
cloud=Image.fromarray(np.uint8(rng.random((64,64))*45+185)).resize((size,size),Image.Resampling.BICUBIC)
a=np.array(cloud).astype(float)+rng.normal(0,2.3,(size,size));con=np.stack([a*.91,a*.94,a*.96],2).clip(0,255).astype('uint8')
im=Image.fromarray(con);d=ImageDraw.Draw(im)
for x in [0,512,1023]:d.line([(x,0),(x,1024)],fill=(121,135,138),width=3)
for y in [0,512,1023]:d.line([(0,y),(1024,y)],fill=(127,139,141),width=3)
for x in [28,484,540,996]:
 for y in [28,484,540,996]:d.ellipse((x-3,y-3,x+3,y+3),fill=(121,132,135))
im.save(out/'concrete.jpg',quality=92)
# One physical storey with four inset glazed bays. Colour, normal, and emission are separate.
a=np.zeros((size,size,3),dtype=np.uint8);a[:]=[135,153,163];a=np.clip(a.astype(float)+rng.normal(0,2.1,(size,size,1)),0,255).astype('uint8')
fac=Image.fromarray(a);draw=ImageDraw.Draw(fac);height=Image.new('L',(size,size),180);hd=ImageDraw.Draw(height);emit=Image.new('RGB',(size,size),(0,0,0));ed=ImageDraw.Draw(emit)
for col in range(4):
 x0=col*256+22;x1=(col+1)*256-22;y0=90;y1=848
 draw.rectangle((x0-10,y0-9,x1+10,y1+15),fill=(38,56,67));hd.rectangle((x0-10,y0-9,x1+10,y1+15),fill=110)
 lit=col in [1,3]
 for y in range(y0,y1):
  t=(y-y0)/(y1-y0);c=(np.array([66,92,107])*(1-t)+np.array([26,48,67])*t) if not lit else (np.array([152,156,145])*(1-t)+np.array([70,102,112])*t)
  draw.line((x0,y,x1,y),fill=tuple(c.astype(int)))
 hd.rectangle((x0,y0,x1,y1),fill=75)
 for xx in range(x0+8,x1,26):
  horizon=int(520+80*np.sin(xx*.027)+rng.integers(-38,38));draw.rectangle((xx,horizon,xx+int(rng.integers(8,25)),y1),fill=(33,57,72))
 if lit:
  ed.rectangle((x0+8,y0+18,x1-8,y1-12),fill=(int(140-col*12),int(116-col*9),int(65-col*5)))
  for yy in range(y0+50,y1,46):ed.line((x0+8,yy,x1-8,yy),fill=(55,44,25),width=2)
 draw.line((x0,y0,x1,y0),fill=(184,202,209),width=5)
 draw.line((x0+9,y0+9,x0+9,y1-4),fill=(82,119,133),width=3)
 draw.rectangle((x0,538,x1,553),fill=(91,113,124));hd.rectangle((x0,538,x1,553),fill=170);ed.rectangle((x0,538,x1,553),fill=(0,0,0))
 draw.rectangle((x0-11,y1+19,x1+11,y1+35),fill=(158,174,179));hd.rectangle((x0-11,y1+19,x1+11,y1+35),fill=205)
# Stone spandrel panel and architectural seams.
for y in [14,44,925,959,995]:draw.line((0,y,1024,y),fill=(100,120,130),width=3)
fac.save(out/'facade.jpg',quality=94);emit.save(out/'facade-emissive.jpg',quality=93)
h=np.array(height.filter(ImageFilter.GaussianBlur(2))).astype(float)/255;dy,dx=np.gradient(h);normal=np.dstack([-dx*12,-dy*12,np.ones_like(h)]);normal/=np.linalg.norm(normal,axis=2,keepdims=True);Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/'facade-normal.jpg',quality=94)
print('Generated five original material textures in',out)
