"""Inspect decoded movie frames at four points per shot, not just renderer stills."""
import io,json,subprocess,sys,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

out=Path(__file__).resolve().parents[1]/'artifacts/cinematic-demo'
if '--extended' in sys.argv: out=out/'extended'
elif '--action' in sys.argv: out=out/'action'
elif '--no-text' in sys.argv: out=out/'no-text'
report=json.loads((out/'capture-report.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
for block in range(math.ceil(len(report['shots'])/5)):
    shots=report['shots'][block*5:block*5+5]
    sheet=Image.new('RGB',(4*480,len(shots)*300),(8,14,19));draw=ImageDraw.Draw(sheet)
    for row,shot in enumerate(shots):
        for col,progress in enumerate([.08,.32,.65,.93]):
            local=(shot['end']-shot['start'])*progress
            data=subprocess.check_output(['ffmpeg','-v','error','-ss',str(local),'-i',str(out/f"shot-{shot['id']}.mp4"),'-frames:v','1','-vf','scale=480:270','-f','image2pipe','-vcodec','png','-'])
            image=Image.open(io.BytesIO(data)).convert('RGB');sheet.paste(image,(col*480,row*300+27))
            draw.text((col*480+8,row*300+6),f"{shot['id'].upper()} / {shot['start']+local:05.2f}s",font=font,fill=(199,237,165))
    sheet.save(out/f'film-review-{block+1}.jpg',quality=95)
print(f"Saved {len(report['shots'])*4} decoded-frame checks across {len(report['shots'])} shots.")
