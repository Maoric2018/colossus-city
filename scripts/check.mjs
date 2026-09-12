import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const files=[];
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.cache','.tools','artifacts'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())await visit(p);else if(/\.(js|mjs)$/.test(p))files.push(p);}}
await visit('.');let failures=0;
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){console.error(file,result.stderr);failures++;}
 const text=await readFile(file,'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){try{await access(path.resolve(path.dirname(file),m[1]));}catch{console.error('Missing local import',file,m[1]);failures++;}}
}
console.log(`${files.length} JavaScript modules checked; ${failures} errors.`);process.exitCode=failures?1:0;
