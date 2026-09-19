import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchLocalBridgeMode} from './patch-runtime.mjs';

const surface={run:'async run(e,t,n,i,r,s,o,a,c,l,u){const h=a6d(u,',local:'zc'};
function constructorFixture(options,legacy,combined) {
 return `class ${legacy}{constructor(client){this.agentClientService=client}executeTurn(e){return this.agentClientService.run(e.ctx,e.conversationState,e.action,e.modelDetails,e.interactionListener,e.resourceAccessor,e.blobStore,e.conversationActionManager,e.checkpointHandler,e.mcpTools,e.runOptions)}}
function en(fn){return {dispose:fn}}
class Compat{constructor(${options},client,experimentService={checkFeatureGate:()=>false}){this.agentClientService=client,this.experimentService=experimentService,this._executionStrategy=${options}?.executionStrategy??new ${legacy}(this.agentClientService),this._register(en(()=>this._executionStrategy.dispose?.()))}
_register(cleanup){this.cleanup=cleanup}
runAgentLoop(turn){return this._executionStrategy.executeTurn(turn)}
resume(turn){return this._executionStrategy.executeTurn(turn)}
summarize(turn){return this._executionStrategy.executeTurn(turn)}}
class Client{async run(e,t,n,i,r,s,o,a,c,l,u){${combined?'const __chatgptLocal=__isChatgptBridgeModel(u?.requestedModel?.modelId??i?.modelId);':''}const h=a6d(u,{localMode:zc.localMode});if(zc.localMode){return h}return h}}`;
}

for(const [options,legacy] of [['e','W6d'],['t','sdm']]){
 test(`${legacy}: independent Agent Host rejects only subscription turns before any dispatch`,async()=>{
  const Compat=new Function(patchLocalBridgeMode(constructorFixture(options,legacy,false),surface)+';return Compat;')();
  for(const [moveExec,localLoop] of [[true,false],[false,true],[true,true]]){
   const hostCalls=[],localCalls=[],gates=[];
   const hostResult=Promise.resolve('host'),localResult=Promise.resolve('local');
   const host={executeTurn(turn){hostCalls.push(turn);return hostResult}};
   const client={run(...args){localCalls.push(args);return localResult}};
   const experimentService={checkFeatureGate(gate,gateOptions){assert.equal(gateOptions.disableExposureLog,true);gates.push(gate);return gate==='cursor_agent_host_move_exec'?moveExec:localLoop}};
   const compat=new Compat({executionStrategy:host},client,experimentService);
   for(const method of ['runAgentLoop','resume','summarize']){
    for(const turn of [{modelDetails:{modelId:'claude-subscription/haiku'}},{modelDetails:{modelId:'ordinary'},runOptions:{requestedModel:{modelId:'claude-subscription/haiku'}}}]){
     await assert.rejects(compat[method](turn),/Subscription models are temporarily unsupported/);
     assert.equal(hostCalls.length,0);assert.equal(localCalls.length,0);
    }
   }
   gates.length=0;
   for(const requested of ['ordinary','default','chatgpt-codex/test',undefined]){
    const turn={modelDetails:{modelId:requested===undefined?undefined:'claude-subscription/haiku'},runOptions:{requestedModel:requested===undefined?undefined:{modelId:requested}}};
    assert.equal(compat.runAgentLoop(turn),hostResult);assert.equal(hostCalls.at(-1),turn);
   }
   assert.deepEqual(gates,[],'Other models do not evaluate the subscription compatibility guard');
   for(const initialOptions of [undefined,{},{executionStrategy:null}]){
    const native=new Compat(initialOptions,client,experimentService);
    assert.equal(native.runAgentLoop({modelDetails:{modelId:'claude-subscription/haiku'}}),localResult);
   }
   assert.deepEqual(gates,[],'Native fallback does not evaluate independent host gates');
  }
 });
}

for(const [options,legacy] of [['e','W6d'],['t','sdm']])for(const combined of [false,true]){
 test(`${legacy}: all AgentCompat turn entrypoints route Claude locally with an injected host (${combined?'combined':'standalone'})`,()=>{
  const patched=patchLocalBridgeMode(constructorFixture(options,legacy,combined),surface);
  execFileSync(process.execPath,['--check','--input-type=module'],{input:patched,stdio:'pipe'});
  const Compat=new Function(patched+';return Compat;')();
  const hostResult=Promise.resolve('host'),localResult=Promise.resolve('local');
  const hostCalls=[],localCalls=[];
  class Host {
   #disposed=false;
   executeTurn(turn){assert.equal(this.#disposed,false);hostCalls.push(turn);return hostResult}
   dispose(){this.#disposed=true}
   get disposed(){return this.#disposed}
  }
  const host=new Host(),client={run(...args){localCalls.push(args);return localResult}};
  const compat=new Compat({executionStrategy:host},client);
  for(const method of ['runAgentLoop','resume','summarize'])for(const [requested,fallback,local] of [
   ['claude-subscription/haiku','ordinary',true],
   [undefined,'claude-subscription/haiku',true],
   ['ordinary','claude-subscription/haiku',false],
   ['default','claude-subscription/haiku',false],
   [undefined,undefined,false],
   ['chatgpt-codex/test',undefined,false]
  ]){
   const turn={ctx:{signal:AbortSignal.abort()},conversationState:{},action:{},modelDetails:{modelId:fallback},interactionListener:{},resourceAccessor:{},blobStore:{},conversationActionManager:{},checkpointHandler:{},mcpTools:[],runOptions:{requestedModel:requested===undefined?undefined:{modelId:requested}}};
   assert.equal(compat[method](turn),local?localResult:hostResult);
   if(local)[turn.ctx,turn.conversationState,turn.action,turn.modelDetails,turn.interactionListener,turn.resourceAccessor,turn.blobStore,turn.conversationActionManager,turn.checkpointHandler,turn.mcpTools,turn.runOptions].forEach((arg,index)=>assert.equal(localCalls.at(-1)[index],arg));
   else assert.equal(hostCalls.at(-1),turn);
  }
  compat.cleanup.dispose();assert.equal(host.disposed,true);
  const native=new Compat(undefined,client),turn={runOptions:{requestedModel:{modelId:'ordinary'}}};
  assert.equal(native.runAgentLoop(turn),localResult);
 });
}
