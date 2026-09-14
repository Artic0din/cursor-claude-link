import fs from 'node:fs';
import path from 'node:path';
import {cursorRoot} from './build-support.mjs';
const root=cursorRoot();
if(process.platform==='darwin'){
  const {runMacInstaller}=await import('./macos.mjs');
  runMacInstaller(root,process.argv.includes('--restore'));
}else{
const version=process.argv.includes('--restore')?JSON.parse(fs.readFileSync(new URL('./installed.json',import.meta.url),'utf8')).version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
if(!['3.20.7','3.20.11','3.20.17','3.20.21'].includes(version))throw new Error('Unsupported Cursor version: '+version);
await import('./install-'+version+'.mjs');
}
