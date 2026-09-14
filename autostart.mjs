const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function bridgeCommandPattern(nodePath, bridgePath) {
  return '^"?' + escapeRegex(nodePath) + '"?\\s+"?' + escapeRegex(bridgePath) + '"?\\s*$';
}

export function buildBridgeLauncher({nodePath, bridgePath}) {
  const pattern = bridgeCommandPattern(nodePath, bridgePath).replaceAll("'", "''");
  const restart = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '${pattern}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  const encoded = Buffer.from(restart, 'utf16le').toString('base64');
  return `
const {execFile,spawn}=require("node:child_process");
const start=()=>{
  const worker=spawn(${JSON.stringify(nodePath)},[${JSON.stringify(bridgePath)}],{
    detached:true,windowsHide:true,stdio:process.platform==="darwin"?["ignore","ignore",2]:"ignore",
    env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}
  });
  worker.on("error",error=>console.error("Claude bridge startup failed:",error.message));worker.unref();
};
if(process.platform==="win32")execFile("powershell.exe",["-NoProfile","-NonInteractive","-EncodedCommand",${JSON.stringify(encoded)}],{windowsHide:true,timeout:15000},()=>start());
else if(process.platform==="darwin")execFile("/bin/ps",["-axo","pid=,uid=,command="],{timeout:5000},async(error,output)=>{
  if(error){console.error("Could not identify the existing Claude bridge.");return;}
  const expected=${JSON.stringify(nodePath+' '+bridgePath)};
  const pids=output.split("\\n").flatMap(line=>{
    const match=line.match(/^\\s*(\\d+)\\s+(\\d+)\\s+(.+)$/);
    return match&&Number(match[2])===process.getuid()&&match[3]===expected?[Number(match[1])]:[];
  });
  try{
    for(const pid of pids){try{process.kill(pid,"SIGTERM");}catch(error){if(error.code!=="ESRCH")throw error;}}
    const deadline=Date.now()+5000;
    while(pids.some(pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code!=="ESRCH")throw error;return false;}})){
      if(Date.now()>=deadline)throw new Error("The previous Claude bridge did not stop.");
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    start();
  }catch(error){console.error(error.message);}
});
else start();
`;
}

export function buildAutostart(options) {
  // A detached launcher owns the entire stop/start sequence. A secondary
  // Cursor process may exit before the PowerShell process finishes.
  return `
/* cursor-claude-link autostart */
import("node:child_process").then(async({spawn})=>{
  let stderr,fs;
  if(process.platform==="darwin"){
    fs=await import("node:fs");
    const path=await import("node:path");
    const state=path.join(path.dirname(${JSON.stringify(options.bridgePath)}),".state");
    fs.mkdirSync(state,{recursive:true,mode:0o700});
    stderr=fs.openSync(path.join(state,"bridge-startup.log"),"a",0o600);
  }
  try{
  const launcher=spawn(${JSON.stringify(options.nodePath)},["-e",${JSON.stringify(buildBridgeLauncher(options))}],{
    detached:true,windowsHide:true,stdio:stderr===undefined?"ignore":["ignore","ignore",stderr],
    env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}
  });
  launcher.on("error",error=>console.error("Claude bridge launcher failed:",error.message));launcher.unref();
  }finally{if(stderr!==undefined)fs.closeSync(stderr);}
}).catch(error=>console.error("Claude bridge launcher failed:",error.message));
`;
}
