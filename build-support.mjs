import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertSupportedMac} from './macos.mjs';
import {CURSOR_VERSION} from './install-anchors.mjs';

export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

// Version `--restore` helpers leave installed.json in place so install.mjs can
// re-sign Cursor and then archive the manifest.
export function restoreInstalledFiles(manifest) {
  for (const file of manifest.files) {
    const current=sha256(fs.readFileSync(file.path));
    if ((current!==file.patchedHash&&current!==file.originalHash)||sha256(fs.readFileSync(file.backup))!==file.originalHash)
      throw new Error('Files changed. Restore stopped: '+file.path);
  }
  for (const file of manifest.files)
    if (sha256(fs.readFileSync(file.path))===file.patchedHash) fs.copyFileSync(file.backup,file.path);
  for (const linked of manifest.linked??[]) {
    try {
      if (typeof linked?.path!=='string'||typeof linked?.original!=='string') continue;
      if (!fs.existsSync(linked.path)) continue;
      fs.writeFileSync(linked.path,linked.original);
    } catch (error) {
      if (error?.code!=='ENOENT') throw error;
    }
  }
}

export function macOSProductVersion() {
  if(process.platform!=='darwin')return null;
  try{
    return execFileSync('sw_vers',['-productVersion'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  }catch{
    return null;
  }
}

export function assertSupportedClient(build) {
  assertSupportedMac(build);
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
    path.join(process.env.CURSOR_GPT_LINK_HOME||path.join(os.homedir(),'Library','Application Support','cursor-gpt-link'),'installed.json')])];
}
export function getBuild(root) {
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  if(version!==CURSOR_VERSION)throw new Error('Unsupported Cursor version: '+version);
  const build=JSON.parse(fs.readFileSync(new URL('./build-'+version+'.json',import.meta.url),'utf8'));
  if(build.platform!=='darwin'||build.arch!=='arm64')throw new Error('Cursor '+version+' has no verified macOS arm64 metadata. Capture hashes from an original Mac app.');
  assertSupportedClient(build);
  if(JSON.parse(fs.readFileSync(path.join(root,'product.json'),'utf8')).commit!==build.commit)throw new Error('Unsupported Cursor commit.');
  return build;
}
export function verifyFiles(root,files) {
  for(const [relative,expected] of Object.entries(files)){
    if(sha256(fs.readFileSync(path.join(root,relative)))!==expected)throw new Error('Unrecognized or modified Cursor file: '+relative);
  }
}
export function overlayLinkedGptOriginals(root, build) {
  const expected={...build.files};
  for(const manifestPath of linkedGptManifests().filter(p=>fs.existsSync(p))){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    const matching=manifest.files.filter(f=>path.resolve(f.path).startsWith(path.resolve(root)+path.sep));
    if(!matching.length)continue;
    if(manifest.claudeManifest)throw new Error('Claude is already installed over GPT. Restore Claude before reinstalling.');
    // A known local GPT installation may wrap the supported original bundles.
    for(const entry of matching){
      const relative=path.relative(root,entry.path).split(path.sep).join('/');
      if(!(relative in expected))continue;
      if(entry.originalHash!==build.files[relative])throw new Error('GPT was installed over an unrecognized original Cursor build.');
      if(sha256(fs.readFileSync(entry.path))!==entry.patchedHash)throw new Error('GPT manifest differs from Cursor. Restore or repair that installation first.');
      expected[relative]=entry.patchedHash;
    }
  }
  return expected;
}

export function requireSupportedOriginals(root) {
  const build=getBuild(root);
  verifyFiles(root,overlayLinkedGptOriginals(root,build));
  return build;
}

// Restore reads the recorded manifest and the app's package.json version. It
// must not call getBuild(): leftover 3.20.17 installs have to uninstall after
// this checkout moved to a newer supported build. 3.20.17 is not an install
// target.
export function readExistingManifest(root, manifestPath) {
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  if(manifest.version!==version||manifest.files.some(file=>typeof file.path!=='string'||!file.path.startsWith(root+path.sep)))
    throw new Error('The installation belongs to another Cursor app or version. Reinstall official Cursor instead of restoring these files.');
  return manifest;
}
