import {verifySubagentLifecycle} from './subagent-lifecycle-check.mjs';
import {verifySubagentModels} from './subagent-model-check.mjs';
import {verifySubagentSettings} from './subagent-settings-check.mjs';
import {CURSOR_VERSION, SUBSCRIPTION_PREFIX, workbenchEntry} from '../install-anchors.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {verifySubagentRegistration} from './subagent-registration-check.mjs';
import {verifyAgentHostRouting} from './agent-host-routing-check.mjs';

const root=process.argv[2];
if(!root)throw new Error('Usage: node scripts/check-subagents.mjs <patched Cursor resources/app>');
const features=workbenchEntry(CURSOR_VERSION).features;
for(const surface of ['desktop','glass']){
 const source=fs.readFileSync(path.join(root,'out/vs/workbench/workbench.'+surface+'.main.js'),'utf8');
 const prefixes=source.includes('function __ChatgptTurnStrategy(')?['chatgpt-codex/',SUBSCRIPTION_PREFIX]:[SUBSCRIPTION_PREFIX];
 await verifyAgentHostRouting(source,prefixes);
 await verifySubagentRegistration(source);
 if(features.lifecycle)await verifySubagentLifecycle(source,[SUBSCRIPTION_PREFIX]);
 console.log(surface+': Claude subagent registration passed.');
}

for(const name of ['cursor-agent-exec','cursor-local-agent-runtime']){
 const source=fs.readFileSync(path.join(root,'extensions',name,'dist/main.js'),'utf8');
 if(features.model)await verifySubagentModels(source);
 if(features.settings)verifySubagentSettings(source);
}
