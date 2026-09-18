import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getBuild, linkedGptManifests, requireSupportedOriginals, restoreInstalledFiles, sha256} from './build-support.mjs';

test('default companion discovery uses the macOS application-support directory', () => {
  const previous=process.env.CURSOR_GPT_LINK_HOME;
  delete process.env.CURSOR_GPT_LINK_HOME;
  try {
    assert.ok(linkedGptManifests().includes(path.join(os.homedir(),'Library','Application Support','cursor-gpt-link','installed.json')));
    process.env.CURSOR_GPT_LINK_HOME='/tmp/custom-gpt-state';
    assert.ok(linkedGptManifests().includes('/tmp/custom-gpt-state/installed.json'));
  } finally {
    if(previous===undefined)delete process.env.CURSOR_GPT_LINK_HOME;
    else process.env.CURSOR_GPT_LINK_HOME=previous;
  }
});

test('historical Windows manifests cannot be mistaken for verified Mac builds', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'claude-build-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const version of ['3.20.7','3.20.11','3.20.21','3.20.23','3.21.1','3.21.9','3.21.12']){
    fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version}));
    assert.throws(()=>getBuild(root),/no verified macOS arm64 metadata/);
  }
});

test('unknown Cursor versions remain unsupported', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'claude-unknown-build-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'9.9.9'}));
  assert.throws(()=>getBuild(root),/Unsupported Cursor version/);
});

test('combined installation cannot pass the preflight that archives stale Claude state', {skip:process.platform!=='darwin'||process.arch!=='arm64'}, t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'claude-combined-test-'));
  const root=path.join(dir,'app'),state=path.join(dir,'gpt');
  const previous=process.env.CURSOR_GPT_LINK_HOME;
  t.after(()=>{if(previous===undefined)delete process.env.CURSOR_GPT_LINK_HOME;else process.env.CURSOR_GPT_LINK_HOME=previous;fs.rmSync(dir,{recursive:true,force:true});});
  process.env.CURSOR_GPT_LINK_HOME=state;
  fs.mkdirSync(root,{recursive:true});fs.mkdirSync(state);
  const build=JSON.parse(fs.readFileSync(new URL('./build-3.20.17.json',import.meta.url),'utf8'));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:build.version}));
  const files=Object.entries(build.files).map(([relative,originalHash])=>{
    const file=path.join(root,relative);
    const contents=relative==='product.json'?JSON.stringify({commit:build.commit}):'combined fixture '+relative;
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);
    return {path:file,originalHash,patchedHash:sha256(contents)};
  });
  const manifestPath=path.join(state,'installed.json');
  fs.writeFileSync(manifestPath,JSON.stringify({files,claudeManifest:path.join(dir,'installed.json')}));
  assert.throws(()=>requireSupportedOriginals(root),/Restore Claude before reinstalling/);
  fs.writeFileSync(manifestPath,JSON.stringify({files}));
  assert.equal(requireSupportedOriginals(root).version,build.version);
});

test('version installers leave installed.json for the macOS restore wrapper', () => {
  const dir=path.dirname(fileURLToPath(import.meta.url));
  for(const name of fs.readdirSync(dir).filter(file=>/^install-3\./.test(file))){
    const source=fs.readFileSync(path.join(dir,name),'utf8');
    assert.equal(source.includes("manifestPath+'.restored-'"),false,name);
    assert.equal(source.includes('unlinkSync(manifestPath)'),false,name);
    assert.match(source,/restoreInstalledFiles\(JSON\.parse\(fs\.readFileSync\(manifestPath/,name);
    assert.match(source,/appMode:requireWritableApp\(root\)/,name);
    assert.match(source,/pending\.some\(x=>x\.path===f\.path\)/,name);
  }
});

function restoreFixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'claude-restore-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const files=['one.js','two.js'].map((name,i)=>{
    const file=path.join(dir,name),backup=path.join(dir,name+'.bak');
    fs.writeFileSync(file,'patched '+i);fs.writeFileSync(backup,'original '+i);
    return {path:file,backup,originalHash:sha256(Buffer.from('original '+i)),patchedHash:sha256(Buffer.from('patched '+i))};
  });
  return {dir,files};
}

test('restore retries after an interrupted copy and skips already-restored targets', t=>{
  const {files}=restoreFixture(t);
  fs.writeFileSync(files[0].path,'original 0');
  restoreInstalledFiles({files,linked:[]});
  assert.equal(fs.readFileSync(files[0].path,'utf8'),'original 0');
  assert.equal(fs.readFileSync(files[1].path,'utf8'),'original 1');
});

test('restore refuses unknown bytes before copying remaining files', t=>{
  const {files}=restoreFixture(t);
  fs.writeFileSync(files[1].path,'tampered');
  assert.throws(()=>restoreInstalledFiles({files,linked:[]}),/Files changed/);
  assert.equal(fs.readFileSync(files[0].path,'utf8'),'patched 0');
});

test('restore writes linked GPT originals and continues if that checkout is gone', t=>{
  const {dir,files}=restoreFixture(t);
  const gpt=path.join(dir,'gpt-installed.json');
  const original=JSON.stringify({files:[{path:files[0].path,patchedHash:files[0].originalHash}]},null,2);
  fs.writeFileSync(gpt,'not-json');
  restoreInstalledFiles({files,linked:[{path:gpt,original}]});
  assert.equal(fs.readFileSync(gpt,'utf8'),original);
  assert.equal(fs.readFileSync(files[0].path,'utf8'),'original 0');
  restoreInstalledFiles({files,linked:[{path:path.join(dir,'missing-gpt','installed.json'),original}]});
});

test('restore rethrows non-ENOENT linked GPT write errors', t=>{
  const {dir,files}=restoreFixture(t);
  const blocked=path.join(dir,'gpt-dir');
  fs.mkdirSync(blocked);
  assert.throws(()=>restoreInstalledFiles({files,linked:[{path:blocked,original:'{}'}]}),{code:'EISDIR'});
  const denied=path.join(dir,'gpt-denied.json');
  fs.writeFileSync(denied,'x');
  fs.chmodSync(denied,0o444);
  try {
    assert.throws(()=>restoreInstalledFiles({files,linked:[{path:denied,original:'{}'}]}),error=>error.code==='EACCES'||error.code==='EPERM');
  } finally {
    fs.chmodSync(denied,0o600);
  }
});
