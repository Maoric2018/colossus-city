// Local USB development route documented by Meta; no APK or deployment needed.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const bundled=path.resolve('.tools/platform-tools',process.platform==='win32'?'adb.exe':'adb');
const adb=process.env.ADB_PATH||(existsSync(bundled)?bundled:'adb');
function run(args){const r=spawnSync(adb,args,{encoding:'utf8',timeout:15000});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr.trim()||'ADB command failed');return r.stdout.trim();}
try{
 const listing=run(['devices']);
 const devices=listing.split('\n').slice(1).map(s=>s.trim().split(/\s+/)).filter(a=>a.length>=2);
 if(!devices.length)throw Error('No headset detected. Connect Quest 2 using a USB data cable, enable Developer Mode in Meta Horizon, then allow USB debugging inside the headset.');
 if(devices.some(d=>d[1]==='unauthorized'))throw Error('USB debugging needs approval inside the headset. Put it on, allow this computer, then run this command again.');
 const quests=devices.filter(d=>d[1]==='device').map(([serial])=>({serial,model:run(['-s',serial,'shell','getprop','ro.product.model'])})).filter(d=>/quest|oculus/i.test(d.model));
 const device=process.env.ANDROID_SERIAL?quests.find(d=>d.serial===process.env.ANDROID_SERIAL):quests.length===1?quests[0]:null;
 if(!device)throw Error('No single Quest selected. Connect one Quest, or set ANDROID_SERIAL to the intended connected headset.');
 console.log(`Connected: ${device.model}`);
 if(process.argv.includes('--check'))process.exit(0);
 const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
 if(!await fetch(`http://localhost:${port}/healthz`,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok).catch(()=>false))throw Error('Start the game with npm start in a separate terminal, then run npm run quest:usb again.');
 run(['-s',device.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
 console.log(`USB route ready. In Meta Quest Browser, open http://localhost:${port}, choose Colossus, create/join a room, then Enter VR.\nKeep the USB cable and game server connected. On this Mac, open http://localhost:${port} as a Raider and join the same room.\nRemove the USB route afterward with: ${adb} -s ${device.serial} reverse --remove tcp:${port}`);
}catch(e){console.error(e.code==='ENOENT'?'Android Platform Tools are missing. Install them from https://developer.android.com/tools/releases/platform-tools or set ADB_PATH.':e.message);process.exitCode=1;}
