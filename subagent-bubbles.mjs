import {CLAUDE_PREFIX} from './subscription-prefix.mjs';

// A local subagent can start before its Task bubble exists in the Agents
// Window. Materialize that bubble through ToolFormer so the parent-linking
// barrier can observe it. Never signal a fake bubble.
export function ensureClaudeTaskBubble(service, request, parent, taskType, Params, capabilityType) {
  if (!parent || typeof request.modelId !== 'string' || !request.modelId.startsWith(CLAUDE_PREFIX)) return;
  request.abortSignal?.throwIfAborted();
  const model = parent.data?.modelConfig;
  const ids = [model?.modelName, ...(model?.selectedModels ?? []).map(entry => entry.modelId)];
  if (!ids.some(id => typeof id === 'string' && id.startsWith(CLAUDE_PREFIX))) return;
  service.loadComposerCapabilities?.(parent);
  const toolFormer = service.getComposerCapability(parent, capabilityType);
  if (!toolFormer || toolFormer.getBubbleIdByToolCallId(request.toolCallId) !== undefined) return;
  const name = request.subagentType || 'general-purpose';
  toolFormer.getOrCreateBubbleId({
    toolCallId:request.toolCallId, toolIndex:0, modelCallId:'', toolCallType:taskType, name:'task_v2',
    params:{case:'taskV2Params', value:new Params({description:name, prompt:request.prompt ?? '',
      subagentType:name, name, model:request.modelId, mode:request.mode})}
  });
}

const bubbleSymbols = {
  '3.21.12': {desktop:{trim:'$K', task:'Je.TASK_V2', params:'PBe', former:'es.TOOL_FORMER'},
              glass:  {trim:'voe',task:'St.TASK_V2', params:'_7e', former:'to.TOOL_FORMER'}},
};

export function patchSubagentBubbles(source, surface, version) {
  if (version == null) throw new Error('Subagent bubble version is required');
  const desktop = surface === 'desktop';
  if (!desktop && surface !== 'glass') throw new Error('Unknown workbench surface');
  const request = desktop ? 'e' : 't', parent = desktop ? 't' : 'e';
  const symbols = bubbleSymbols[version]?.[surface];
  if (!symbols) throw new Error('Unsupported subagent bubble version');
  const trim = symbols.trim;
  const anchor = 'async _waitForParentTaskBubbleIfPossible('+request+'){const '+parent+'='+trim+'('+request+'.parentConversationId),n='+trim+'('+request+'.toolCallId);if(!'+parent+'||!n)return;const i=this._composerDataService.getHandleIfLoaded('+parent+');';
  if (source.split(anchor).length !== 2) throw new Error('Subagent bubble anchor is not unique: '+surface);
  const call = '__ensureClaudeTaskBubble(this._composerDataService,'+request+',i,'+symbols.task+','+symbols.params+','+symbols.former+');';
  return 'var CLAUDE_PREFIX='+JSON.stringify(CLAUDE_PREFIX)+';\n'+
    ensureClaudeTaskBubble.toString().replace('function ensureClaudeTaskBubble','function __ensureClaudeTaskBubble')+'\n'+source.replace(anchor,anchor+call);
}
