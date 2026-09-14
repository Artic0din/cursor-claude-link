const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function bridgeCommandPattern(nodePath, bridgePath) {
  return '^"?' + escapeRegex(nodePath) + '"?\\s+"?' + escapeRegex(bridgePath) + '"?\\s*$';
}

export function buildBridgeLauncher({nodePath, bridgePath}) {
  // Restart only this installation's worker. The pattern is passed as an
  // argument to pkill (no shell), matching cursor-gpt-link.
  const pattern = bridgeCommandPattern(nodePath, bridgePath);
  return `
const {execFile,spawn}=require("node:child_process");
const start=()=>{
  const worker=spawn(${JSON.stringify(nodePath)},[${JSON.stringify(bridgePath)}],{
    detached:true,stdio:"ignore",
    env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}
  });
  worker.on("error",()=>{});worker.unref();
};
if(process.platform==="darwin")execFile("pkill",["-i","-f",${JSON.stringify(pattern)}],()=>start());
else start();
`;
}

export function buildAutostart(options) {
  // A detached launcher owns the entire stop/start sequence. A secondary
  // Cursor process may exit before the previous bridge worker is replaced.
  return `
/* cursor-claude-link autostart */
import("node:child_process").then(({spawn})=>{
  const launcher=spawn(${JSON.stringify(options.nodePath)},["-e",${JSON.stringify(buildBridgeLauncher(options))}],{
    detached:true,stdio:"ignore",
    env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}
  });
  launcher.on("error",()=>{});launcher.unref();
});
`;
}
