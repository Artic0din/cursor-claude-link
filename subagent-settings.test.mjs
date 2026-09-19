import test from 'node:test';
import assert from 'node:assert/strict';
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
 assert.deepEqual(selectedModelIds(original,[{...selection,selection:{case:'model',value:{modelId:'another-provider/model'}}}],parent,CLAUDE_PREFIX),['native','another-provider/model']);
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
test('model tooltip matches Cursor title, context and italic effort layout',()=>{
 assert.equal(modelTooltip('Model','Description',256000,'high').markdownContent,'**Model**  \nDescription\n\n256k context window\n\n*Version: high effort*');
 assert.match(modelTooltip('Model','Description',1000000,'xhigh',true).markdownContent,/1M context window\n\n\*Version: very high effort, fast\*$/);
 assert.equal(modelTooltip('Model','Description',200000).markdownContent.includes('Version:'),false);
 assert.ok(modelTooltip('<Model>','[link](url)',200000,'low').markdownContent.includes('\\<Model\\>'));
});
test('Explore settings check treats availableModels entries as id',()=>{
 const source=[
  'function abc(e){const t=()=>!1,n=lp(e),r=null!=n?n:e.localProvider;const g=res("grok-4.5",e.availableModels??[]);const override=(e.subagentModelOverrides??[]).find(o=>o.subagentType==="explore");const selected=override?.selection?.case==="model"?override.selection.value?.modelId:undefined;const s=res(selected,e.availableModels??[]);const type=override?.selection?.case==="model"?(s?"model":"inherit"):(override?.selection?.case||"inherit");const x="explore"===norm(t.subagentType);return {localProvider:r,parentRequestedModelName:e.modelId,subagentModels:mod(e,t),subagentModelForcePolicy:pol,subagentModelOverrides:{explore:{type,modelId:s}}};}',
  'function zzz(e){return e instanceof Error}',
  'modelId:f.modelDetails.modelId,modelParameters:f.parameters,modelInfo:T',
  'resolvedModelParameters:__subscriptionSelectedParameters(a,x,y,z,"claude-subscription/"),subagentIdToResume:'
 ].join('\n');
 verifySubagentSettings(source);
});
