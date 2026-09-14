import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getBuild, linkedGptManifests, verifyFiles} from './build-support.mjs';

test('standalone macOS installation does not link other provider manifests', {skip:process.platform!=='darwin'}, ()=>{
  assert.deepEqual(linkedGptManifests(),[]);
});

test('platform manifests retain exact build and original-file checks', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'claude-build-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const product={version:'3.20.17',commit:'0c32194e3fb5ffaced9fb36430b860ec301e1fc0'};
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(product));
  fs.writeFileSync(path.join(root,'product.json'),JSON.stringify(product));
  const mac=getBuild(root,{platform:'darwin',arch:'arm64'});
  const windows=getBuild(root,{platform:'win32',arch:'x64'});
  assert.equal(mac.platform,'darwin');
  assert.equal(windows.platform,'win32');
  assert.notEqual(mac.files['product.json'],windows.files['product.json']);
  assert.throws(()=>getBuild(root,{platform:'darwin',arch:'x64'}),/Unsupported client platform/);
  assert.throws(()=>verifyFiles(root,{'product.json':mac.files['product.json']}),/Unrecognized or modified Cursor file/);
  fs.writeFileSync(path.join(root,'product.json'),JSON.stringify({...product,commit:'different'}));
  assert.throws(()=>getBuild(root,{platform:'darwin',arch:'arm64'}),/Unsupported Cursor commit/);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'3.20.21'}));
  assert.throws(()=>getBuild(root,{platform:'darwin',arch:'arm64'}),/Unsupported Cursor build for darwin arm64/);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'../other'}));
  assert.throws(()=>getBuild(root,{platform:'darwin',arch:'arm64'}),/Unsupported Cursor version/);
});
