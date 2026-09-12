// Assemble native frame captures with the original score, normalize and verify.
import {writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {root} from './serve.mjs';
const extendedMode=process.argv.includes('--extended'),actionMode=process.argv.includes('--action')||extendedMode,noText=process.argv.includes('--no-text')||actionMode;
const base=path.join(root,'artifacts/cinematic-demo'),out=path.join(base,extendedMode?'extended':actionMode?'action':noText?'no-text':'');
const capture=JSON.parse(await readFile(path.join(out,'capture-report.json'),'utf8'));
const order=capture.shots.map(s=>s.id),duration=capture.shots.at(-1).end,expectedFrames=Math.round(duration*24);
const soundtrack=path.join(actionMode?out:base,'soundtrack.wav');
async function run(command,args){
 return new Promise((resolve,reject)=>{
  const p=spawn(command,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);
  p.on('close',code=>code?reject(Error(stderr)):resolve({stdout,stderr}));
 });
}
// Do not assemble an incomplete shot while its encoder is still running.
for(const shot of capture.shots){const p=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-of','json',path.join(out,`shot-${shot.id}.mp4`)])).stdout);if(Number(p.streams[0].nb_frames)!==Math.round((shot.end-shot.start)*24))throw Error(`Incomplete shot: ${shot.id}`);}
await writeFile(path.join(out,'edit.ffconcat'),'ffconcat version 1.0\n'+order.map(s=>`file 'shot-${s}.mp4'`).join('\n')+'\n');
await run('ffmpeg',['-hide_banner','-y','-f','concat','-safe','0','-i',path.join(out,'edit.ffconcat'),'-c','copy',path.join(out,'picture.mp4')]);
const first=await run('ffmpeg',['-hide_banner','-i',soundtrack,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const jsonFromLog=log=>JSON.parse(log.slice(log.lastIndexOf('{'),log.lastIndexOf('}')+1));
const measured=jsonFromLog(first.stderr);
const normalize=`loudnorm=I=-16:TP=-1.5:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
const final=path.join(out,extendedMode?'COLOSSUS-CITY-Extended-Action-Trailer-1080p.mp4':actionMode?'COLOSSUS-CITY-Action-Trailer-1080p.mp4':noText?'COLOSSUS-CITY-No-Text-1080p.mp4':'COLOSSUS-CITY-Cinematic-Demo-1080p.mp4');
await run('ffmpeg',['-hide_banner','-y','-i',path.join(out,'picture.mp4'),'-i',soundtrack,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',normalize,'-c:a','aac','-b:a','320k','-ar','48000','-t',String(duration),'-movflags','+faststart','-metadata','title=COLOSSUS CITY — City Under Siege','-metadata','comment=Staged in-engine cinematic demo. Original procedural score and sound design.',final]);
const probe=JSON.parse((await run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',final])).stdout);
const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
if(v.width!==1920||v.height!==1080||Number(v.nb_read_frames)!==expectedFrames||!a||Math.abs(Number(probe.format.duration)-duration)>.1)throw Error('Final export specification mismatch');
await run('ffmpeg',['-v','error','-i',final,'-f','null','-']);
const loudness=await run('ffmpeg',['-hide_banner','-i',final,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const audioStats=jsonFromLog(loudness.stderr);
await writeFile(path.join(out,'master-report.json'),JSON.stringify({file:final,width:v.width,height:v.height,fps:v.r_frame_rate,frames:v.nb_read_frames,duration:probe.format.duration,bytes:probe.format.size,video:v.codec_name,audio:a.codec_name,sampleRate:a.sample_rate,audioStats,decode:'PASS'},null,2));
console.log(final);console.log(JSON.stringify({duration:probe.format.duration,frames:v.nb_read_frames,audioStats}));
