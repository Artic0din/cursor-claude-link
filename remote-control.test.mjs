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

const subscriptionSelections = ['claude-subscription/opus', 'chatgpt-codex/test-model'].flatMap(modelId => [
  modelConfig(modelId),
  {modelConfig: {modelName: modelId, selectedModels: [{modelId: 'grok-4.6'}]}},
  {modelConfig: {modelName: 'grok-4.6', selectedModels: [{modelId: 'grok-4.6'}, {modelId}]}},
  {modelConfig: {modelName: 'grok-4.6', selectedModels: [{modelId}, {modelId: 'grok-4.6'}]}},
  {modelConfig: {modelName: modelId, selectedModels: []}},
  {modelConfig: {modelName: modelId}},
  {modelConfig: {selectedModels: [null, {}, {modelId: 7}, {modelId}]}}
]);

test('Remote Control subscription turns reuse the This Mac workspace; cloud VMs stay on the cloud repo', () => {
  for (const options of subscriptionSelections) {
    assert.deepEqual(choose(remoteControl, options), thisMac);
    assert.equal(choose(cloudVm, options), cloudVm);
    assert.equal(choose(thisMac, options), thisMac);
    for (const usePrivateWorker of [false, 'true']) {
      const environment = {type: 'new', environment: {usePrivateWorker, privateWorkspaceIdentifier: localWorkspace}};
      assert.equal(choose(environment, options), environment);
    }
  }
  assert.equal(choose(remoteControl, modelConfig('grok-4.6')), remoteControl);
  for (const modelId of ['claude-subscription', 'chatgpt-codex', 'other/claude-subscription/opus']) {
    assert.equal(choose(remoteControl, modelConfig(modelId)), remoteControl);
  }
  assert.equal(choose(remoteControl, {modelConfig: {selectedModels: [null, {}, {modelId: 7}]}}), remoteControl);
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
  for (const options of subscriptionSelections) {
    assert.equal(await repo.createAgent('prompt', remoteControl, options), 'local');
    assert.deepEqual(calls.at(-1)[2], thisMac);
    assert.equal(calls.at(-1)[3], options);
  }
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
  const renamedFixture = 'class Other{async createAgent(prompt,env,options){const repo=this.resolveEnvironmentRepo(env);return repo.createAgent(prompt,env,options)}}';
  for (const surfaceName of ['desktop', 'glass']) {
    for (const duplicate of [combinedFixture + combinedFixture, combinedFixture + renamedFixture, renamedFixture + combinedFixture]) {
      assert.throws(() => patchRemoteControlRouting(duplicate, surfaceName), /not unique/);
    }
  }
});
