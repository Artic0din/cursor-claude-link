import assert from 'node:assert/strict';
import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const base='http://127.0.0.1:'+config.port;
const headers={Authorization:'Bearer '+config.key,'Content-Type':'application/json'};
assert.equal((await fetch(base+'/picker-models')).status,401);
const account=await (await fetch(base+'/account',{headers})).json();
assert.equal(account.authMethod,'claude.ai');
console.log('Authentication: Claude subscription ('+account.subscriptionType+')');
async function infer(body){
  const res=await fetch(base+'/v1/responses',{method:'POST',headers,body:JSON.stringify({model:'claude-subscription/'+(process.env.CLAUDE_TEST_MODEL||'sonnet'),...body}),signal:AbortSignal.timeout(180000)});
  assert.equal(res.status,200);
  const events=(await res.text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
  const failed=events.find(e=>e.type==='response.failed');assert.equal(failed,undefined,failed?.response?.error?.message);
  const done=events.find(e=>e.type==='response.completed');assert.ok(done);return done.response.output;
}
const tools=[{type:'function',name:'add',description:'Add two integers',parameters:{type:'object',properties:{a:{type:'integer'},b:{type:'integer'}},required:['a','b'],additionalProperties:false}}];
const prompt={role:'user',content:'Use add for 19 plus 23. After receiving the tool result, answer with only the result.'};
const first=await infer({input:[prompt],tools,tool_choice:{type:'function',name:'add'},reasoning:{effort:'low'}});
const call=first.find(i=>i.type==='function_call');assert.ok(call);const args=JSON.parse(call.arguments);assert.equal(args.a+args.b,42);
const second=await infer({input:[prompt,...first,{type:'function_call_output',call_id:call.call_id,output:'42'}],tools,reasoning:{effort:'low'}});
assert.match(second.filter(i=>i.type==='message').flatMap(i=>i.content).map(i=>i.text).join(''),/42/);
console.log('Live Claude subscription tool call and result round trip: passed');
