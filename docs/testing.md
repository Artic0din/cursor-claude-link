# Testing and compatibility

## Verified macOS build

This fork targets Cursor 3.21.12 only. The 3.21.12 metadata is still the upstream Windows bundle and is rejected on macOS until `scripts/capture-hashes.mjs` records darwin/arm64 hashes from an original Mac app.
The exact Cursor commit is `05ddb9e824590e2c1db6bd2548dd71bf67ac9d20`.
The minimum supported OS is macOS 26.
A matching version label alone is insufficient to establish compatibility.

## Current checks

All 78 local tests passed (7 darwin-only checks skipped on this Linux runner), covering bridge error handling, external tool naming, attachments, token accounting, subagent registration, Explore settings, conversation actions, exact POSIX process matching and startup after the launching host exits.
Repeating a combined installation is rejected before its active restoration manifest can be archived; the regression also permits a GPT-only installation.
The repeated-install check also passed against the real combined app, leaving both manifests and all six app resources unchanged.

Both links installed directly in `/Applications/Cursor.app`, GPT first and Claude second, with an existing Apple signing identity.
Strict signature verification, Electron native loading and both installation manifests passed after combined installation.
Both bridge workers started automatically with Cursor and appeared in the native model picker.
Cloud agents are unsupported: use a local workspace and the This Mac environment.

A native Claude file-edit request reproduced a collision between Cursor tool names and disabled Claude Code built-ins.
After assigning distinct transport names, replaying that captured request returned the expected Cursor `Write` call.
The live subscription check passed a function-call/result round trip and automatic selection of an external `Write` tool.
That check requests a write without executing it; the final post-fix Cursor file edit and readback remains pending because desktop automation could not unlock the Mac.

Signing fixtures verify preservation of hardened runtime and entitlements after patching and resource restoration.
The fixture uses a disposable executable and an injected test signer; production requires an available Apple identity and refuses ad-hoc signing.
The checks also reject a correctly signed Intel-only executable and verify permission preservation during preflight and signed restoration.
New manifests save the original app mode; standalone removal restores it, while removing Claude over GPT keeps the app private.
Legacy manifests without an original mode retain current permissions; official reinstallation recovers the vendor defaults.
No full-app backup is required; six resource backups and recovery manifests are retained.

Combined removal was tested on the real app: GPT refused removal before Claude, Claude restoration preserved GPT, and final GPT restoration recovered all six original resource hashes.
Both restoration steps passed strict signature verification and native loading.

## Repeatable checks

```bash
npm test
npm run check:source
npm run status
npm run check:runtime -- "/Applications/Cursor.app/Contents/Resources/app"
npm run check:subagents -- "/Applications/Cursor.app/Contents/Resources/app"
npm run check:actions -- "/Applications/Cursor.app/Contents/Resources/app"
npm run check:ui -- "/Applications/Cursor.app/Contents/Resources/app"
```

Unit and source checks do not require account sign-in or model requests.
Runtime checks inspect the supported installed bundles and exercise synthetic responses and registration paths.
CI runs unit tests on macOS 26 with Node.js 22, 24 and 26; those runners do not contain a real Cursor installation.

With the bridge running, `npm run test:live` checks a function call, returned tool result and automatic external tool selection.
`npm run test:attachments` checks image and PDF content.
These optional commands consume subscription usage and do not prove complete Cursor UI coverage.

## Cursor updates and recovery

1. Close Cursor and restore Claude before restoring GPT.
2. Restore validates every resource backup before writing and re-signs the app before reporting success.
3. Retry an interrupted restore while its manifest remains present; unknown file changes stop restoration.
4. Reinstall official Cursor to recover its vendor signature or a failed signing operation.
5. Install GPT followed by Claude on the recognized build; stale manifests are archived only after original files or a valid companion installation are verified.

Never restore old resources over a newer build or edit hashes to bypass compatibility checks.
A new Mac build needs original-file capture with `scripts/capture-hashes.mjs`, anchor review and separate validation.
The six resource backups do not contain the original vendor code signature.

## Historical upstream results and remaining coverage

Earlier September 10–14 notes were inherited from the Windows implementation.
They described bridge tool calls, image/PDF input, token accounting and synthetic desktop, Agents Window and SSH routing.
They do not establish macOS installer, GUI, authentication renewal or SSH coverage.
The preceding test history remains in Git.

Fresh macOS SSH file edits, live subagents, cancellation, fresh sign-in/renewal and large-context workloads remain unverified.
Fast and Ultracode are not implemented.

### Explore model settings

The workbench now includes the explicitly selected Explore model in the local runtime catalog when that ID starts with `claude-subscription/`. Foreign Explore IDs stay out of this provider's catalog so the runtime does not send them through the Claude bridge. Previously a same-prefix selection missing from `localProviderAgentModelIds` silently became Inherit. The patch also carries the selected model parameters into the client subagent request and preserves parent parameters for inherited models. Default, Inherit and Disabled continue through Cursor's native resolver.

Unit tests reproduce the missing-catalog fallback. This fork keeps the 3.21.12 workbench and runtime patches and still rejects unverified Windows hashes on macOS. Tooltip tests cover every effort and context variant using the native Markdown layout. A live SSH Explore run with a different selected model still needs manual confirmation.

### Context and MAX mode

Context selection and Cursor's legacy MAX switch now choose the actual runtime window while preserving effort. Models advertise `capabilities.context_length` so Cursor can cap its prompt session, usage display and compaction budget. See [Context and MAX mode](model-modes.md). Unit tests cover variant scoring; native solver checks need an installed Cursor app.
