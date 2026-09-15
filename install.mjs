import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {cursorRoot,getBuild,requireSupportedOriginals,sha256} from './build-support.mjs';
import {requireClosedCursor,requireWritableApp,signingIdentity,verifyMacSignature,signMacApp,setAppMode} from './macos.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=cursorRoot(),build=getBuild(root);
const restore=process.argv.includes('--restore'),manifestPath=path.join(dir,'installed.json'),configPath=path.join(dir,'config.json');
requireClosedCursor();
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
const identity=signingIdentity(config.signingIdentity);
if(restore){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(manifest.version!==build.version||manifest.files.some(file=>!file.path.startsWith(root+path.sep)))throw new Error('The installation belongs to another Cursor app or version. Reinstall official Cursor instead of restoring these files.');
}else{
  requireSupportedOriginals(root);
  verifyMacSignature(root);
  if(fs.existsSync(manifestPath)){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    if(manifest.files.some(file=>!file.path.startsWith(root+path.sep)))throw new Error('Another Cursor installation is recorded in this checkout.');
    fs.renameSync(manifestPath,manifestPath+'.replaced-'+Date.now());
  }
}
requireWritableApp(root);
const backups=path.join(dir,'backups');
fs.mkdirSync(backups,{recursive:true,mode:0o700});
fs.chmodSync(backups,0o700);
execFileSync(process.execPath,[path.join(dir,'install-'+build.version+'.mjs'),...(restore?['--restore']:[])],{cwd:dir,env:{...process.env,CURSOR_APP_ROOT:root},stdio:'pipe',timeout:120000});
if(!restore){
  const saved=JSON.parse(fs.readFileSync(configPath,'utf8'));
  saved.signingIdentity=identity;
  fs.writeFileSync(configPath,JSON.stringify(saved,null,2),{mode:0o600});
}
console.log('Signing Cursor and checking native loading...');
signMacApp(root,identity);
if(restore){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  setAppMode(root,manifest.linked.length?0o700:manifest.appMode);
  fs.renameSync(manifestPath,manifestPath+'.restored-'+Date.now());
}
else{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const file of manifest.files)if(sha256(fs.readFileSync(file.path))!==file.patchedHash)throw new Error('Installed file verification failed: '+file.path);
}
console.log(restore?'Claude patch removed; Cursor signature and native loading verified.':'Claude models installed; Cursor signature and native loading verified.');
