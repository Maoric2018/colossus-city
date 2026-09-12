// Run with the downloaded creator archives in --source=<directory>. Only selected
// base colors ship: resize/compress without changing their artwork or palette.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const output='public/assets/imported/stylized',sha=data=>createHash('sha256').update(data).digest('hex');
if(process.argv.includes('--verify')){
 const manifest=JSON.parse(await readFile(output+'/SOURCES.json','utf8'));
 for(const item of manifest.files){const bytes=await readFile(output+'/'+item.file);if(sha(bytes)!==item.sha256)throw Error('Asset differs: '+item.file);}
 console.log(`${manifest.files.length} stylized source textures verified.`);
}else{
 const source=process.argv.find(a=>a.startsWith('--source='))?.slice(9);if(!source)throw Error('Provide --source=directory containing brick.zip, metal.zip and pack2.zip.');
 const packs={brick:{archive:'brick.zip',author:'JulioVII',source:'https://juliovii.itch.io/ftp-bricks-pavement',license:'CC-BY (creator listing)'},metal:{archive:'metal.zip',author:'JulioVII',source:'https://juliovii.itch.io/ftp-stylized-metal-panels',license:'CC-BY (creator listing)'},paint:{archive:'pack2.zip',author:'rubberduck',source:'https://opengameart.org/content/8-handpainted-style-textures-2',download:'https://opengameart.org/sites/default/files/handpainted-style-textures-2.zip',license:'CC0'}};
 const picks=[['brick','brick','Stylized_Bricks_Red_01'],['paving','brick','Stylized_BricksPavement_02'],['metal','metal','Stylized_MetalPanels_01'],['vent','metal','Stylized_MetalPanels_04'],['concrete','paint','hp_concrete.png'],['marble','paint','hp_marble.png']];
 process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,channel:'chromium'});
 try {await mkdir(output,{recursive:true});const page=await browser.newPage(),files=[];
 for(const [name,pack,entry]of picks){const archivePath=pack==='paint'?entry:`JPEG/${entry}/${entry}_basecolor.jpg`,data=execFileSync('unzip',['-p',path.join(source,packs[pack].archive),archivePath],{maxBuffer:20e6});
  const encoded=await page.evaluate(async({base64,mime})=>{const img=new Image();img.src=`data:${mime};base64,${base64}`;await img.decode();const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,512,512);return c.toDataURL('image/webp',.9).split(',')[1];},{base64:data.toString('base64'),mime:pack==='paint'?'image/png':'image/jpeg'});
  const bytes=Buffer.from(encoded,'base64'),file=name+'.webp';await writeFile(output+'/'+file,bytes);files.push({file,pack,archivePath,sourceSha256:sha(data),sha256:sha(bytes),bytes:bytes.length,width:512,height:512});
 }
 await writeFile(output+'/SOURCES.json',JSON.stringify({description:'Selected downloaded base colors. Only resized to 512px and encoded as WebP; game materials compose the final facades at the device texture tier.',packs,files},null,2)+'\n');console.log(files.map(f=>`${f.file}: ${f.bytes} bytes`).join('\n'));
 }finally{await browser.close();}
}
