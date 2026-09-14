import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha256} from './build-support.mjs';
import {prepareMacCopy,signMacApp,verifyMacSignature} from './macos.mjs';

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'claude-signing-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const app=path.join(dir,'Cursor.app'),root=path.join(app,'Contents/Resources/app');
  const executable=path.join(app,'Contents/MacOS/Cursor');
  fs.mkdirSync(root,{recursive:true});
  fs.mkdirSync(path.dirname(executable),{recursive:true});
  fs.copyFileSync('/usr/bin/true',executable);
  fs.writeFileSync(path.join(app,'Contents/Info.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cursor</string><key>CFBundleIdentifier</key><string>test.claude.signing</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>');
  const file=path.join(root,'fixture.txt'),backup=path.join(dir,'fixture.original');
  fs.writeFileSync(file,'original');
  execFileSync('/usr/bin/codesign',['--force','--sign','-',app],{stdio:'pipe'});
  const originalBinary=fs.readFileSync(executable),seal=path.join(app,'Contents/_CodeSignature/CodeResources'),originalSeal=fs.readFileSync(seal);
  fs.copyFileSync(file,backup);
  fs.writeFileSync(file,'patched');
  const manifestFile=path.join(dir,'installed.json');
  fs.writeFileSync(manifestFile,JSON.stringify({version:'fixture',linked:[],files:[{path:file,backup,originalHash:sha256('original'),patchedHash:sha256('patched')}]}));
  return {dir,root,executable,seal,file,manifestFile,originalBinary,originalSeal};
}

test('macOS signing preserves enough original bytes to restore the original signature', {skip:process.platform!=='darwin'}, t=>{
  const f=fixture(t);
  assert.throws(()=>verifyMacSignature(f.root));
  signMacApp(f.root,f.manifestFile,app=>execFileSync('/usr/bin/codesign',['--force','--sign','-',app],{stdio:'pipe'}));
  verifyMacSignature(f.root);
  const manifest=JSON.parse(fs.readFileSync(f.manifestFile,'utf8'));
  assert.equal(manifest.macos.root,f.root);
  assert.equal(manifest.files.length,3);
  for(const file of manifest.files){
    assert.equal(sha256(fs.readFileSync(file.path)),file.patchedHash);
    assert.equal(sha256(fs.readFileSync(file.backup)),file.originalHash);
    fs.copyFileSync(file.backup,file.path);
  }
  verifyMacSignature(f.root);
  assert.deepEqual(fs.readFileSync(f.executable),f.originalBinary);
  assert.deepEqual(fs.readFileSync(f.seal),f.originalSeal);
  assert.equal(fs.readFileSync(f.file,'utf8'),'original');
});

test('a signing failure rolls back both app resources and signature files', {skip:process.platform!=='darwin'}, t=>{
  const f=fixture(t);
  assert.throws(()=>signMacApp(f.root,f.manifestFile,()=>{
    fs.writeFileSync(f.executable,'interrupted signing');
    fs.writeFileSync(f.seal,'interrupted sealing');
    throw new Error('signing failed');
  }),/signing failed/);
  assert.equal(fs.existsSync(f.manifestFile),false);
  assert.deepEqual(fs.readFileSync(f.executable),f.originalBinary);
  assert.deepEqual(fs.readFileSync(f.seal),f.originalSeal);
  assert.equal(fs.readFileSync(f.file,'utf8'),'original');
  verifyMacSignature(f.root);
});

test('app copies preserve signatures and never overwrite an existing destination', {skip:process.platform!=='darwin'}, t=>{
  const f=fixture(t),target=path.join(f.dir,'private/Copy.app');
  fs.writeFileSync(f.file,'original');
  const root=prepareMacCopy(f.root,target);
  verifyMacSignature(root);
  verifyMacSignature(f.root);
  assert.equal(fs.statSync(target).mode&0o777,0o700);
  assert.throws(()=>prepareMacCopy(f.root,target),/already exists/);
  fs.writeFileSync(f.file,'tampered');
  const rejected=path.join(f.dir,'private/Rejected.app');
  assert.throws(()=>prepareMacCopy(f.root,rejected));
  assert.equal(fs.existsSync(rejected),false);
  assert.deepEqual(fs.readdirSync(path.dirname(target)),['Copy.app']);
});
