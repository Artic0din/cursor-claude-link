import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getBuild,requireSupportedOriginals,sha256} from './build-support.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const manifestFile=path.join(dir,'installed.json');
const appRoot=app=>path.join(app,'Contents/Resources/app');
const appBundle=root=>{
  const app=path.resolve(root,'../../..');
  if(appRoot(app)!==path.resolve(root)||!app.endsWith('.app'))throw new Error('Expected a macOS app Contents/Resources/app directory.');
  return app;
};
const command=(executable,args)=>execFileSync(executable,args,{stdio:'pipe',timeout:120000});

export function verifyMacSignature(root) {
  command('/usr/bin/codesign',['--verify','--deep','--strict',appBundle(root)]);
}

function signingFiles(app) {
  const magic=new Set(['feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca']);
  const result=[];
  for(const relative of fs.readdirSync(app,{recursive:true})){
    const file=path.join(app,relative);
    if(!fs.lstatSync(file).isFile())continue;
    const fd=fs.openSync(file,'r'),header=Buffer.alloc(4);
    try{fs.readSync(fd,header,0,4,0);}finally{fs.closeSync(fd);}
    const executable=magic.has(header.toString('hex'));
    if(executable||path.basename(file)==='CodeResources')result.push({path:file,executable});
  }
  return result;
}

export function signMacApp(root,file,sign) {
  const app=appBundle(root),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  const backupDir=path.dirname(manifest.files[0].backup);
  try{
    const signatures=signingFiles(app);
    for(const [index,entry] of signatures.entries()){
      const backup=path.join(backupDir,'macos-'+index+'.original');
      fs.copyFileSync(entry.path,backup,fs.constants.COPYFILE_FICLONE);
      const originalHash=sha256(fs.readFileSync(entry.path));
      manifest.files.push({path:entry.path,backup,originalHash,patchedHash:originalHash});
    }
    manifest.macos={root,signing:true};
    fs.writeFileSync(file,JSON.stringify(manifest,null,2),{mode:0o600});
    sign(app,signatures.filter(entry=>entry.executable).map(entry=>entry.path));
    verifyMacSignature(root);
    for(const entry of manifest.files)entry.patchedHash=sha256(fs.readFileSync(entry.path));
    manifest.macos.signing=false;
    fs.writeFileSync(file,JSON.stringify(manifest,null,2));
  }catch(error){
    for(const entry of manifest.files){
      if(sha256(fs.readFileSync(entry.backup))!==entry.originalHash)throw new Error('Signing failed and a backup changed: '+entry.backup,{cause:error});
    }
    for(const entry of manifest.files)fs.copyFileSync(entry.backup,entry.path);
    for(const entry of manifest.linked)fs.writeFileSync(entry.path,entry.original);
    fs.renameSync(file,file+'.rolled-back-'+Date.now());
    throw error;
  }
}

function requireClosed(app) {
  const processes=command('/bin/ps',['-axo','command=']).toString().split('\n');
  if(processes.some(line=>line.startsWith(app+'/Contents/MacOS/')||line.startsWith(app+'/Contents/Frameworks/')))
    throw new Error('Close the copied Cursor app before installing or restoring: '+app);
}

function requirePrivateCopy(app) {
  const real=fs.realpathSync(app),home=fs.realpathSync(os.homedir());
  if(!real.startsWith(home+path.sep)||real===path.join(home,'Applications/Cursor.app')||fs.statSync(real).uid!==process.getuid())
    throw new Error('macOS installation requires a separate app copy owned by you inside your home directory. Omit CURSOR_APP_ROOT to create one.');
  requireClosed(real);
  fs.chmodSync(real,0o700);
}

export function prepareMacCopy(root,target=path.join(os.homedir(),'Applications/Cursor Claude.app')) {
  if(appBundle(root)===target)return root;
  if(fs.existsSync(target))throw new Error('The copied app already exists: '+target);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const staging=fs.mkdtempSync(path.join(path.dirname(target),'.cursor-claude-'));
  try{
    const copy=path.join(staging,'Cursor.app');
    command('/usr/bin/ditto',[appBundle(root),copy]);
    fs.chmodSync(copy,0o700);
    verifyMacSignature(appRoot(copy));
    fs.renameSync(copy,target);
  }finally{fs.rmSync(staging,{recursive:true,force:true});}
  return appRoot(target);
}

export function runMacInstaller(root,restore=false) {
  if(restore){
    const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    if(manifest.macos?.root!==root||manifest.macos.signing)throw new Error('macOS installation state does not match this app, or signing was interrupted. Preserve the backups.');
    getBuild(root);
    requirePrivateCopy(appBundle(root));
    verifyMacSignature(root);
    command(process.execPath,[path.join(dir,'install-'+manifest.version+'.mjs'),'--restore']);
    verifyMacSignature(root);
    console.log('Claude patch removed; original macOS signatures and files restored.');
    return;
  }
  if(fs.existsSync(manifestFile))throw new Error('Claude patch already installed. Restore before reinstalling.');
  const identity=process.env.CURSOR_MACOS_SIGN_IDENTITY;
  if(!/^[a-f0-9]{40}$/i.test(identity||''))throw new Error('Set CURSOR_MACOS_SIGN_IDENTITY to the SHA-1 of an Apple signing identity. Ad-hoc signing cannot preserve Cursor library validation.');
  const build=requireSupportedOriginals(root);
  verifyMacSignature(root);
  if(!process.env.CURSOR_APP_ROOT)root=prepareMacCopy(root);
  requirePrivateCopy(appBundle(root));
  const backups=path.join(dir,'backups');
  fs.mkdirSync(backups,{recursive:true,mode:0o700});
  fs.chmodSync(backups,0o700);
  execFileSync(process.execPath,[path.join(dir,'install-'+build.version+'.mjs')],{
    cwd:dir,env:{...process.env,CURSOR_APP_ROOT:root},stdio:'pipe',timeout:120000
  });
  signMacApp(root,manifestFile,(app,executables)=>{
    const args=['--force','--sign',identity,'--preserve-metadata=entitlements,flags,runtime','--timestamp=none'];
    // Native modules under Resources also load inside hardened Electron hosts.
    for(const executable of executables)command('/usr/bin/codesign',[...args,executable]);
    command('/usr/bin/codesign',[...args,'--deep',app]);
    execFileSync(path.join(app,'Contents/MacOS/Cursor'),['-e','process.exit(0)'],{
      env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:'pipe',timeout:30000
    });
  });
  console.log('Claude subscription models installed in '+appBundle(root)+'. Original signatures are backed up.');
}
