import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {CURSOR_VERSION} from '../install-anchors.mjs';

const root=new URL('../',import.meta.url);
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.mjs'))){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{stdio:'pipe'});
}
const builds=fs.readdirSync(root).filter(name=>/^build-3\./.test(name));
if(builds.length!==1||builds[0]!=='build-'+CURSOR_VERSION+'.json')throw new Error('Only build-'+CURSOR_VERSION+'.json may remain');
const build=JSON.parse(fs.readFileSync(new URL(builds[0],root),'utf8'));
if(build.version!==CURSOR_VERSION||!Object.values(build.files).every(hash=>/^[a-f0-9]{64}$/.test(hash)))throw new Error('Invalid build metadata');
const installers=fs.readdirSync(root).filter(name=>/^install-3\./.test(name));
if(installers.length!==1||installers[0]!=='install-'+CURSOR_VERSION+'.mjs')throw new Error('Only install-'+CURSOR_VERSION+'.mjs may remain');
const shim=fs.readFileSync(new URL(installers[0],root),'utf8');
if(!shim.includes('await installVersion(CURSOR_VERSION)'))throw new Error(installers[0]+' must dispatch the shared pipeline');
const pipeline=fs.readFileSync(new URL('install-workbench.mjs',root),'utf8');
if(pipeline.includes("manifestPath+'.restored-'")||pipeline.includes('unlinkSync(manifestPath)'))throw new Error('install-workbench.mjs must leave installed.json in place so install.mjs can re-sign after restore');
if(!pipeline.includes('restoreInstalledFiles(JSON.parse(fs.readFileSync(manifestPath'))throw new Error('install-workbench.mjs must use the shared retry-safe restore helper');
if(!pipeline.includes('appMode: requireWritableApp(root)')&&!pipeline.includes('appMode:requireWritableApp(root)'))throw new Error('install-workbench.mjs must record original Cursor.app permissions');
if(!pipeline.includes('setAppMode(root, 0o700)')&&!pipeline.includes('setAppMode(root,0o700)'))throw new Error('install-workbench.mjs must privatize Cursor.app before writing the bridge key');
if(!pipeline.includes('pending.some(x => x.path === f.path)')&&!pipeline.includes('pending.some(x=>x.path===f.path)'))throw new Error('install-workbench.mjs must hash-check only overlapping GPT paths');
if(pipeline.includes('advertiseMaxMode'))throw new Error('MAX advertising is not a persisted version gate');
if(!pipeline.includes('patchRuntimeReasoning(source, prefix)'))throw new Error('install-workbench.mjs must use the shared runtime reasoning patcher');
const wrapper=fs.readFileSync(new URL('install.mjs',root),'utf8');
if(wrapper.includes('getBuild('))throw new Error('install.mjs must not call getBuild; restore reads the existing manifest and install goes through requireSupportedOriginals');
if(!wrapper.includes('readExistingManifest(root,manifestPath)')&&!wrapper.includes('readExistingManifest(root, manifestPath)'))throw new Error('install.mjs must read the existing manifest before restoring');
if(!wrapper.includes('restoreInstalledFiles(manifest)'))throw new Error('install.mjs must restore leftover installs from the existing manifest');
const bubbles=fs.readFileSync(new URL('subagent-bubbles.mjs',root),'utf8');
if(!bubbles.includes('var CLAUDE_PREFIX=')||!bubbles.includes('JSON.stringify(CLAUDE_PREFIX)'))throw new Error('patchSubagentBubbles must emit CLAUDE_PREFIX into the workbench bundle');
console.log('Source syntax and supported build metadata passed.');
