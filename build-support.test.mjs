import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getBuild, linkedGptManifests} from './build-support.mjs';

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
  for(const version of ['3.20.7','3.20.11','3.20.21']){
    fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version}));
    assert.throws(()=>getBuild(root),/no verified macOS arm64 metadata/);
  }
});
