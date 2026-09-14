import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export function findClaude() {
  if(process.env.CLAUDE_EXECUTABLE){
    const selected=path.resolve(process.env.CLAUDE_EXECUTABLE);
    if(!fs.existsSync(selected))throw new Error('CLAUDE_EXECUTABLE does not exist.');
    if(/\.exe$/i.test(selected))throw new Error('CLAUDE_EXECUTABLE must point to the macOS claude executable, not claude.exe.');
    return selected;
  }
  // Match the user's terminal before falling back to the native install path.
  try{
    const matches=execFileSync('/usr/bin/which',['-a','claude'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/);
    const executable=matches.find(file=>path.isAbsolute(file)&&fs.existsSync(file)&&!/\.exe$/i.test(file));
    if(executable)return executable;
  }catch{}
  const native=path.join(os.homedir(),'.local/bin','claude');
  if(fs.existsSync(native))return native;
  throw new Error('Claude Code was not found. Install it or set CLAUDE_EXECUTABLE.');
}
