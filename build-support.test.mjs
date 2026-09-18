import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getBuild, linkedGptManifests, requireSupportedOriginals, sha256} from './build-support.mjs';

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
    assert.match(source,/pending\.some\(x=>x\.path===f\.path\)/,name);
  }
});
