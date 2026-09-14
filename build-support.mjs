import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

export function macOSProductVersion() {
  if(process.platform!=='darwin')return null;
  try{
    return execFileSync('sw_vers',['-productVersion'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  }catch{
    return null;
  }
}

export function assertSupportedClient() {
  // Match cursor-gpt-link: macOS 26+ on Apple Silicon only.
  if(process.platform!=='darwin'||process.arch!=='arm64'){
    throw new Error('Only macOS 26+ (Apple Silicon) clients are supported.');
  }
  const version=macOSProductVersion();
  if(!version)throw new Error('Unable to determine macOS version. Only macOS 26+ (Apple Silicon) is supported.');
  const major=Number(version.split('.')[0]);
  if(!Number.isFinite(major)||major<26){
    throw new Error('Only macOS 26+ (Apple Silicon) clients are supported. Detected macOS '+version+'.');
  }
}

export function cursorRoot() {
  if(process.env.CURSOR_APP_ROOT)return path.resolve(process.env.CURSOR_APP_ROOT);
  const roots=[
    '/Applications/Cursor.app/Contents/Resources/app',
    path.join(os.homedir(),'Applications/Cursor.app/Contents/Resources/app'),
  ];
  const root=roots.find(p=>fs.existsSync(path.join(p,'product.json')));
  if(!root)throw new Error('Cursor was not found. Set CURSOR_APP_ROOT to its Resources/app directory.');
  return root;
}
export function linkedGptManifests() {
  return [...new Set([path.join(os.homedir(),'cursor-chatgpt-bridge/installed.json'),
    path.join(process.env.CURSOR_GPT_LINK_HOME||path.join(os.homedir(),'cursor-gpt-link'),'installed.json')])];
}
export function getBuild(root) {
  assertSupportedClient();
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  if(!['3.20.7','3.20.11','3.20.17','3.20.21'].includes(version))throw new Error('Unsupported Cursor version: '+version);
  const build=JSON.parse(fs.readFileSync(new URL('./build-'+version+'.json',import.meta.url),'utf8'));
  if(build.platform&&build.platform!=='darwin')throw new Error('Unsupported Cursor platform metadata.');
  if(build.arch&&build.arch!=='arm64')throw new Error('Unsupported Cursor architecture metadata.');
  if(JSON.parse(fs.readFileSync(path.join(root,'product.json'),'utf8')).commit!==build.commit)throw new Error('Unsupported Cursor commit.');
  return build;
}
export function verifyFiles(root,files) {
  for(const [relative,expected] of Object.entries(files)){
    if(sha256(fs.readFileSync(path.join(root,relative)))!==expected)throw new Error('Unrecognized or modified Cursor file: '+relative);
  }
}
export function requireSupportedOriginals(root) {
  const build=getBuild(root),expected={...build.files};
  for(const manifestPath of linkedGptManifests().filter(p=>fs.existsSync(p))){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    const matching=manifest.files.filter(f=>path.resolve(f.path).toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep));
    if(!matching.length)continue;
    // A known local GPT installation may wrap the supported original bundles.
    for(const entry of matching){
      const relative=path.relative(root,entry.path).split(path.sep).join('/');
      if(!(relative in expected))continue;
      if(sha256(fs.readFileSync(entry.path))!==entry.patchedHash)throw new Error('GPT manifest differs from Cursor. Restore or repair that installation first.');
      expected[relative]=entry.patchedHash;
    }
  }
  verifyFiles(root,expected);
  return build;
}
