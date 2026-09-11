import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export function findClaude() {
  if(process.env.CLAUDE_EXECUTABLE){
    if(!fs.existsSync(process.env.CLAUDE_EXECUTABLE))throw new Error('CLAUDE_EXECUTABLE does not exist.');
    return process.env.CLAUDE_EXECUTABLE;
  }
  // Match the user's terminal before falling back to the native install path.
  if(process.platform==='win32'){
    try{
      const matches=execFileSync('where.exe',['claude.exe'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/);
      const executable=matches.find(file=>path.isAbsolute(file)&&fs.existsSync(file));
      if(executable)return executable;
    }catch{}
  }
  const native=path.join(os.homedir(),'.local/bin',process.platform==='win32'?'claude.exe':'claude');
  if(fs.existsSync(native))return native;
  throw new Error('Claude Code was not found. Install it or set CLAUDE_EXECUTABLE.');
}
