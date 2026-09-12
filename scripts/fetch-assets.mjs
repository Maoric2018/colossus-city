// Imported models are committed. Verify them or refresh photographic textures.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/assets/imported/SOURCES.json','utf8'));
if(!process.argv.includes('--verify')){
 for(const entry of manifest.textures){
  const url=new URL(entry.download);if(url.protocol!=='https:'||url.hostname!=='dl.polyhaven.org')throw Error('Unexpected texture download host');
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>8*1024*1024||createHash('md5').update(bytes).digest('hex')!==entry.md5)throw Error(`Texture validation failed: ${entry.file}`);
  await writeFile(entry.file+'.tmp',bytes);await rename(entry.file+'.tmp',entry.file);console.log(`Refreshed ${entry.file}`);
 }
}
for(const entry of manifest.files){const bytes=await readFile(entry.file);if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Asset differs from manifest: ${entry.file}`);}
console.log(`Verified ${manifest.files.length} bundled asset files. Source pack downloads are recorded in public/assets/imported/SOURCES.json.`);
