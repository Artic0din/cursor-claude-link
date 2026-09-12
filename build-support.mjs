import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export function cursorRoot() {
  if(process.env.CURSOR_APP_ROOT)return path.resolve(process.env.CURSOR_APP_ROOT);
  const roots=[process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Programs/cursor/resources/app'),
    process.env.ProgramFiles&&path.join(process.env.ProgramFiles,'Cursor/resources/app')].filter(Boolean);
  const root=roots.find(p=>fs.existsSync(path.join(p,'product.json')));
  if(!root)throw new Error('Cursor was not found. Set CURSOR_APP_ROOT to its resources/app directory.');
  return root;
}
export function linkedGptManifests() {
  return [...new Set([path.join(os.homedir(),'cursor-chatgpt-bridge/installed.json'),
    path.join(process.env.CURSOR_GPT_LINK_HOME||path.join(process.env.LOCALAPPDATA||os.homedir(),'cursor-gpt-link'),'installed.json')])];
}
export function getBuild(root) {
  if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Only Windows x64 clients are supported.');
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  if(!['3.20.7','3.20.11','3.20.17'].includes(version))throw new Error('Unsupported Cursor version: '+version);
  const build=JSON.parse(fs.readFileSync(new URL('./build-'+version+'.json',import.meta.url),'utf8'));
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
