import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.mjs'))){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{stdio:'pipe'});
}
for(const version of ['3.20.7','3.20.11','3.20.17','3.20.21','3.20.23','3.21.1','3.21.9','3.21.12']){
  const build=JSON.parse(fs.readFileSync(new URL('build-'+version+'.json',root),'utf8'));
  if(build.version!==version||!Object.values(build.files).every(hash=>/^[a-f0-9]{64}$/.test(hash)))throw new Error('Invalid build metadata');
}
for(const file of fs.readdirSync(root).filter(name=>/^install-3\./.test(name))){
  const source=fs.readFileSync(new URL(file,root),'utf8');
  if(source.includes("manifestPath+'.restored-'")||source.includes('unlinkSync(manifestPath)'))throw new Error(file+' must leave installed.json in place so install.mjs can re-sign after restore');
  if(!source.includes('restoreInstalledFiles(JSON.parse(fs.readFileSync(manifestPath'))throw new Error(file+' must use the shared retry-safe restore helper');
  if(source.includes('Existing GPT manifest')&&!source.includes('pending.some(x=>x.path===f.path)'))throw new Error(file+' must hash-check only overlapping GPT paths');
  const advertisesMax=source.includes('config.advertiseMaxMode=true');
  if(source.includes('patchMaxMode')!==advertisesMax)throw new Error(file+' must advertise MAX picker fields only when patchMaxMode is installed');
  if(!source.includes('advertiseMaxMode:config.advertiseMaxMode'))throw new Error(file+' must serialize pickerModels with the installed MAX flag');
}
console.log('Source syntax and supported build metadata passed.');
