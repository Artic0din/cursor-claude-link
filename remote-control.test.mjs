import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchRemoteControlRouting, remoteControlPrelude} from './remote-control.mjs';

const choose = new Function(remoteControlPrelude + '\nreturn __subscriptionRemoteControlEnvironment;')();
const localWorkspace = {id: 'this-mac-workspace'};
const remoteControl = {type: 'new', environment: {usePrivateWorker: true, privateWorkspaceIdentifier: localWorkspace}};
const cloudVm = {type: 'new', environment: {id: 'github.com/example/repo'}};
const thisMac = {type: 'existing', environment: localWorkspace};

function modelConfig(modelId) {
  return {modelConfig: {selectedModels: [{modelId}], modelName: modelId}};
}

test('Remote Control subscription turns reuse the This Mac workspace; cloud VMs stay on the cloud repo', () => {
  assert.deepEqual(choose(remoteControl, modelConfig('claude-subscription/opus')), thisMac);
  assert.deepEqual(choose(remoteControl, modelConfig('chatgpt-codex/test-model')), thisMac);
  assert.equal(choose(remoteControl, modelConfig('grok-4.6')), remoteControl);
  assert.equal(choose(cloudVm, modelConfig('claude-subscription/opus')), cloudVm);
  assert.equal(choose(thisMac, modelConfig('claude-subscription/opus')), thisMac);
  assert.equal(choose(remoteControl, {}), remoteControl);
  const unlabeled = {type: 'new', environment: {usePrivateWorker: true}};
  assert.equal(choose(unlabeled, modelConfig('claude-subscription/opus')), unlabeled);
  assert.deepEqual(
    choose(unlabeled, {...modelConfig('claude-subscription/opus'), privateWorkspaceIdentifier: localWorkspace}),
    thisMac
  );
});

const combinedFixture = `class Combined{constructor(localRepo,cloudRepo){this.localRepo=localRepo;this.cloudRepo=cloudRepo}
resolveEnvironmentRepo(e){switch(e.type){case"existing":return this.localRepo;case"new":return this.cloudRepo;default:throw new Error("Unknown environment type")}}
async createAgent(e,n,i){const r=this.resolveEnvironmentRepo(n);return r.createAgent(e,n,i)}}`;

test('glass createAgent sends Remote Control subscription models through localRepo', async () => {
  const source = patchRemoteControlRouting(combinedFixture, 'glass');
  execFileSync(process.execPath, ['--check', '--input-type=module'], {input: source, stdio: 'pipe'});
  const Combined = new Function(source + '\nreturn Combined;')();
  const calls = [];
  const repo = new Combined(
    {createAgent: (...args) => { calls.push(['local', ...args]); return 'local'; }},
    {createAgent: (...args) => { calls.push(['cloud', ...args]); return 'cloud'; }}
  );
  assert.equal(await repo.createAgent('prompt', remoteControl, modelConfig('claude-subscription/opus')), 'local');
  assert.deepEqual(calls.at(-1)[2], thisMac);
  assert.equal(await repo.createAgent('prompt', remoteControl, modelConfig('chatgpt-codex/test-model')), 'local');
  assert.equal(await repo.createAgent('prompt', remoteControl, modelConfig('grok-4.6')), 'cloud');
  assert.equal(await repo.createAgent('prompt', cloudVm, modelConfig('claude-subscription/opus')), 'cloud');
  assert.equal(await repo.createAgent('prompt', thisMac, modelConfig('claude-subscription/opus')), 'local');
  const unlabeled = {type: 'new', environment: {usePrivateWorker: true}};
  assert.equal(await repo.createAgent('prompt', unlabeled, {...modelConfig('claude-subscription/opus'), privateWorkspaceIdentifier: localWorkspace}), 'local');
});

test('desktop workbenches without the combined repo are unchanged; a missing glass anchor fails closed', () => {
  assert.equal(patchRemoteControlRouting('desktop-workbench', 'desktop'), 'desktop-workbench');
  assert.throws(() => patchRemoteControlRouting('desktop-workbench', 'glass'), /anchor missing/);
  const patched = patchRemoteControlRouting(combinedFixture, 'glass');
  assert.equal(patchRemoteControlRouting(patched, 'glass'), patched);
  assert.throws(() => patchRemoteControlRouting(combinedFixture + combinedFixture, 'glass'), /not unique/);
});
