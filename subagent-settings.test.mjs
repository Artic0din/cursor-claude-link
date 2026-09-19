import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {selectedModelIds,configureTaskProps,selectedParameters,patchSubagentSettingsWorkbench,patchSubagentSettingsRuntime} from './subagent-settings.mjs';
import {CLAUDE_PREFIX} from './subscription-prefix.mjs';
import {verifySubagentSettings} from './scripts/subagent-settings-check.mjs';
import {modelTooltip} from './model-tooltip.mjs';
const parent='claude-subscription/parent',child='claude-subscription/child';
const params=[{id:'reasoning',value:'xhigh'},{id:'context',value:'1000000'},{id:'fast',value:'true'}];
const selection={subagentType:'explore',selection:{case:'model',value:{modelId:child,parameters:params}}};
test('Explore model selection is available locally without changing Default, Inherit or Disabled',()=>{
 const original=['native'];
 assert.deepEqual(selectedModelIds(original,[selection],parent,CLAUDE_PREFIX),['native',child]);
 assert.deepEqual(selectedModelIds(original,[{...selection,selection:{case:'model',value:{modelId:'another-provider/model'}}}],parent,CLAUDE_PREFIX),original);
 for(const mode of ['default','inherit','disabled'])assert.deepEqual(selectedModelIds(original,[{selection:{case:mode}}],parent,CLAUDE_PREFIX),original);
 assert.strictEqual(selectedModelIds(original,[selection],'ordinary',CLAUDE_PREFIX),original);
 assert.deepEqual(original,['native']);
});
test('Explore selection keeps its parameters; inherited and unrelated tasks keep their own parameters',()=>{
 const native={parentRequestedModelName:parent,subagentModels:{modelsBySlug:new Map()},subagentModelOverrides:{explore:{type:'model',modelId:child}}};
 const props=configureTaskProps({modelId:parent,modelParameters:[{id:'reasoning',value:'low'}],subagentModelOverrides:[selection]},native,CLAUDE_PREFIX);
 assert.strictEqual(props.subagentModelOverrides,native.subagentModelOverrides);
 const config={subagent_type:{type:{case:'explore'}},userRequestedModelId:child};
 assert.deepEqual(selectedParameters(props,config,child,undefined,CLAUDE_PREFIX),params);
 assert.notStrictEqual(selectedParameters(props,config,child,undefined,CLAUDE_PREFIX),params);
 assert.deepEqual(props.parentModelParameters,[{id:'reasoning',value:'low'}]);
 assert.equal(selectedParameters(props,config,'explicit-tool-model','fallback',CLAUDE_PREFIX),'fallback');
 assert.equal(selectedParameters(props,{...config,subagent_type:{type:{case:'custom'}}},child,'fallback',CLAUDE_PREFIX),'fallback');
 assert.strictEqual(configureTaskProps({modelId:'ordinary'},native,CLAUDE_PREFIX),native);
 for(const mode of ['inherit','disabled']){
  const source={...native,subagentModelOverrides:{explore:{type:mode}}};
  assert.strictEqual(configureTaskProps({modelId:parent},source,CLAUDE_PREFIX).subagentModelOverrides,source.subagentModelOverrides);
 }
});
test('unknown patch anchors fail before returning a modified bundle',()=>{
 assert.throws(()=>patchSubagentSettingsWorkbench('unrecognized',CLAUDE_PREFIX),/anchor/);
 assert.throws(()=>patchSubagentSettingsRuntime('unrecognized',CLAUDE_PREFIX),/anchor/);
});
test('Claude Explore helpers compose with GPT declarations in workbench and runtime modules',()=>{
 const definition=(fn,name)=>fn.toString().replace('function '+fn.name,'function '+name);
 const catalog='function catalog(i,u){const x=0,a=__subscriptionSelectedModelIds(u.localProviderAgentModelIds??[],u.subagentModelOverrides,u.requestedModel?.modelId??i?.modelId,"chatgpt-codex/"),n=i??this.createDefaultLocalModel(u);return a;}';
 const workbench=patchSubagentSettingsWorkbench(catalog+'\n'+definition(selectedModelIds,'__subscriptionSelectedModelIds'),CLAUDE_PREFIX);
 execFileSync(process.execPath,['--check','--input-type=module'],{input:workbench,stdio:'pipe'});
 const run=new Function(workbench+';return catalog;')();
 for(const prefix of ['chatgpt-codex/','claude-subscription/']){
  const id=prefix+'selected';
  assert.deepEqual(run({modelId:prefix+'parent'},{localProviderAgentModelIds:[],subagentModelOverrides:[{subagentType:'explore',selection:{case:'model',value:{modelId:id}}}]}),[id]);
 }
 const runtime=[
  'function abc(e){return __subscriptionConfigureTaskProps(e,__subscriptionNativeTaskProps(e),"chatgpt-codex/")}',
  'function __subscriptionNativeTaskProps(e){const t=()=>!1,n=lp(e),r=null!=n?n:e.localProvider;return {parentRequestedModelName:e.modelId,subagentModels:{},subagentModelOverrides:{explore:{type:"model",modelId:e.selected}}};}',
  'function lp(e){return e.localProvider;}',
  'function input(f,T){return {modelId:f.modelDetails.modelId,modelParameters:f.parameters,modelInfo:T,localProvider:this.options.localProvider};}',
  'function resolve(a,x,y,z){return{subagentConfig:x,effectiveReadonly:false,resolvedModelId:y,resolvedModelParameters:__subscriptionSelectedParameters(a,x,y,z,"chatgpt-codex/"),subagentIdToResume:undefined};}',
  definition(configureTaskProps,'__subscriptionConfigureTaskProps'),definition(selectedParameters,'__subscriptionSelectedParameters')
 ].join('\n');
 const patched=patchSubagentSettingsRuntime(runtime,CLAUDE_PREFIX);
 execFileSync(process.execPath,['--check','--input-type=module'],{input:patched,stdio:'pipe'});
 const props=new Function(patched+';return abc;')();
 for(const prefix of ['chatgpt-codex/','claude-subscription/']){
  const id=prefix+'selected',parameters=[{id:'reasoning',value:'high'}];
  const result=props({modelId:prefix+'parent',selected:id,subagentModelOverrides:[{subagentType:'explore',selection:{case:'model',value:{modelId:id,parameters}}}]});
  assert.deepEqual(result.subagentModels.__subscriptionSelection,{modelId:id,parameters});
 }
});
test('Claude task-props wrapper keeps a GPT-first native wrapper callable',()=>{
 const native='function abc(e){const t=()=>!1,n=lp(e),r=null!=n?n:e.localProvider;';
 const tail='\nmodelId:f.modelDetails.modelId,modelParameters:f.parameters,modelInfo:T,localProvider:this.options.localProvider\nreturn{subagentConfig:x,effectiveReadonly:false,resolvedModelId:y,resolvedModelParameters:z,subagentIdToResume:';
 const gpt='function abc(e){return __subscriptionConfigureTaskProps(e,__subscriptionNativeTaskProps(e),"chatgpt-codex/")}'+native.replace('function abc(','function __subscriptionNativeTaskProps(')+tail;
 const patched=patchSubagentSettingsRuntime(gpt,CLAUDE_PREFIX);
 assert.ok(patched.includes('function __subscriptionNativeTaskProps(e){return __ClaudeConfigureTaskProps(e,__claudeNativeTaskProps(e),"claude-subscription/")}'));
 assert.equal(patched.split('function __claudeNativeTaskProps(').length,2);
 assert.equal(patched.split('function __subscriptionNativeTaskProps(').length,2);
 assert.ok(patched.includes('function abc(e){return __subscriptionConfigureTaskProps(e,__subscriptionNativeTaskProps(e),"chatgpt-codex/")}'));
});
test('serialized Explore helpers do not close over Node imports',()=>{
 for(const fn of [selectedModelIds,configureTaskProps,selectedParameters]){
  assert.equal(fn.toString().includes('requireSubscriptionPrefix'),false);
 }
 const selected=new Function(selectedModelIds.toString()+';return selectedModelIds')();
 assert.deepEqual(selected(['native'],[selection],parent,CLAUDE_PREFIX),['native',child]);
 const source=',a=e.localProviderAgentModelIds??[],n=i??this.createDefaultLocalModel(u)';
 const patched=patchSubagentSettingsWorkbench(source,CLAUDE_PREFIX);
 assert.equal(patched.includes('requireSubscriptionPrefix'),false);
 const injected=new Function(patched.slice(patched.indexOf('function __ClaudeSelectedModelIds'))+';return __ClaudeSelectedModelIds')();
 assert.deepEqual(injected(['native'],[selection],parent,CLAUDE_PREFIX),['native',child]);
 assert.deepEqual(injected(['native'],[{...selection,selection:{case:'model',value:{modelId:'another-provider/model'}}}],parent,CLAUDE_PREFIX),['native']);
});
test('model tooltip matches Cursor title, context and italic effort layout',()=>{
 assert.equal(modelTooltip('Model','Description',256000,'high').markdownContent,'**Model**  \nDescription\n\n256k context window\n\n*Version: high effort*');
 assert.match(modelTooltip('Model','Description',1000000,'xhigh',true).markdownContent,/1M context window\n\n\*Version: very high effort, fast\*$/);
 assert.equal(modelTooltip('Model','Description',200000).markdownContent.includes('Version:'),false);
 assert.ok(modelTooltip('<Model>','[link](url)',200000,'low').markdownContent.includes('\\<Model\\>'));
});
test('Explore settings check passes the native availableModels modelId contract',()=>{
 const source=[
  'function abc(e){const t=()=>!1,n=lp(e),r=null!=n?n:e.localProvider;const available=(e.availableModels??[]).filter(m=>m.modelId).map(m=>({id:m.modelId}));const g=res("grok-4.5",available);const override=(e.subagentModelOverrides??[]).find(o=>o.subagentType==="explore");const selected=override?.selection?.case==="model"?override.selection.value?.modelId:undefined;const s=res(selected,available);const type=override?.selection?.case==="model"?(s?"model":"inherit"):(override?.selection?.case||"inherit");const x="explore"===norm(t.subagentType);return {localProvider:r,parentRequestedModelName:e.modelId,subagentModels:mod(e,t),subagentModelForcePolicy:pol,subagentModelOverrides:{explore:{type,modelId:s}}};}',
  'function zzz(e){return e instanceof Error}',
  'modelId:f.modelDetails.modelId,modelParameters:f.parameters,modelInfo:T',
  'resolvedModelParameters:__ClaudeSelectedParameters(a,x,y,z,"claude-subscription/"),subagentIdToResume:'
 ].join('\n');
 verifySubagentSettings(source);
});
