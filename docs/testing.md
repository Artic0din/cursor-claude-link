# Testing and compatibility

## Supported clients

| Version | Commit | Platform |
| --- | --- | --- |
| 3.20.17 | `0c32194e3fb5ffaced9fb36430b860ec301e1fc0` | Windows x64 |
| 3.20.11 | `69d099d6568dc97e110ba8184614faf51c4040b0` | Windows x64 |
| 3.20.7 | `979197d5570b168c034c634b3e21f2bea3ea5be0` | Windows x64 |

The build JSON files record SHA-256 hashes of original JavaScript bundles. Version-specific installers also require unique patch anchors and run Node.js syntax checks before writing application files. Existing GPT installations are accepted only through a matching local installation manifest.

The public source check and unit tests do not require Cursor or Claude sign-in. They cover environment handling, model and context mapping, function-call preparation, usage parsing, picker sections and exact bridge-process matching. CI runs these on Windows with Node.js 22 and 24. Local verification used Node.js 26.7.0; CI results are separate evidence.

## Cursor 3.20.17 update

On September 12, 2026, the desktop and Agents Window model mapping, picker rendering, usage components and dedicated-runtime symbols were updated for this exact build. The new metadata also verifies the original `product.json`. All 28 unit tests, source checks and both native Responses adapter checks passed. The adapter checks cover timeout, sign-in and quota errors, plus a successful function call.

Standalone Claude and combined ChatGPT/Claude installations passed syntax and unique-anchor checks on a separate local copy. Both native workbench routing methods retained SSH workspace execution resources and cancellation signals. Every supported effort value was checked with both 200K and 1M forwarding. Both patches were then installed locally, and all installation, linked-manifest and backup hashes matched. These are automated checks; a new manual IDE, Agents Window and SSH test is still pending.

## Manual and live checks

On September 10, 2026, Sonnet and Fable produced function calls through the bridge and used the returned tool result. Short Sonnet requests succeeded with both 200K and 1M selected. This does not test a full one-million-token workload.

On September 11, 2026, both patches were installed on Cursor 3.20.11. Generated JavaScript passed syntax checks and installation hashes matched. The user confirmed model selection and a file edit after reload. That confirmation did not specify the provider or distinguish IDE from Agents Window coverage.

The automated Claude test on 3.20.11 reported a concurrent OAuth token-refresh error. Usage retrieval was also unavailable during that check. Those tests are not marked as passing. Claude SSH file edits, separate window coverage, approvals and cancellation still need dedicated manual tests.

## Cursor updates

1. Close Cursor and check the newly installed version against the supported table.
2. Run `npm run status`. If it reports old-version state, do not force a restore.
3. Confirm Cursor has replaced the old patched files. Preserve the old backups and move `installed.json` out of the way, for example to `installed.json.before-update`.
4. Run `npm run check`. Proceed only if the new original hashes are recognized. Modified or mixed-version installations need repair through the normal Cursor installer first.
5. Install the supported ChatGPT patch first if used, then install Claude again.

Do not edit the supported version number or hash list to bypass verification. A new build needs separate anchor review and testing.

## Live test

With the local bridge running:

```powershell
npm run test:live
```

This makes real requests and consumes usage. It requires a function call for adding two numbers, supplies the result and verifies the final reply. It does not edit workspace files. It tests the bridge, not the complete Cursor UI.

## Reconnect regression check

On September 11, 2026, the original `response.failed` behavior was reproduced against the installed Cursor 3.20.11 Responses adapters and incomplete-stream guards in both runtime bundles. The corrected bridge passed synthetic timeout, login and quota-error cases, and a successful function-call response. HTTP tests also verify cancellation and request-slot cleanup. These checks do not establish an SSH file-edit result.

To run the installed adapter checks without model requests:

```powershell
npm run check:runtime -- "C:\path\to\Cursor\resources\app"
```

This reads supported installed code and exercises it with synthetic inputs. It does not modify the application or send network requests beyond loopback.

Catalog discovery also passed a live check with a clean CLI exit. After the stream correction, the live tool-round-trip test exposed the OAuth refresh-lock error. A later official `claude auth status --json` call returned `loggedIn: false` and `authMethod: none`; a new local sign-in is required before live inference and SSH validation can finish. No live round-trip success is claimed for this repair.

## Attachment support

On September 11, 2026, the updated Sonnet adapter read the color of a generated PNG and a validation word embedded only in a PDF. Both passed through the running local subscription bridge. The standard function-call and tool-result round trip also passed with the new streaming JSON input format. Unit tests cover byte preservation, history references, multimodal tool results, UTF-8 documents, invalid data, URL handling and CLI result parsing. This supersedes the earlier text-only limitation. These bridge tests do not establish drag-and-drop coverage for every format or a new SSH UI test.

The implementation follows [Claude SDK streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) and [Claude PDF content blocks](https://platform.claude.com/docs/en/build-with-claude/pdf-support).

## Context token accounting

The context correction passed 28 unit tests and the installed Cursor 3.20.11 runtime checks. A synthetic three-step turn with 200,000 cumulative input tokens reports the final 69,000-token prompt instead of the cumulative total. Coverage includes repeated message IDs, subagents, cached tokens, separate result boundaries and output-count fallbacks.

In a live Claude Opus check on September 11, 2026, two visually identical 512 by 512 PNGs of 1,497 and 787,127 bytes both used 1,794 input tokens and 79 output tokens. Both were understood correctly. This checks that image encoding size does not turn into text-token occupancy. The affected existing conversation still needs a new response to refresh its saved UI value.

See [Claude SDK usage scopes](https://code.claude.com/docs/en/agent-sdk/cost-tracking) for the distinction between per-step input usage and cumulative turn usage.


## Local Claude subagent startup

On September 13, 2026, the missing parent Task bubble reported for ChatGPT was also reproduced with a Claude model ID in Cursor 3.20.17's native desktop and Agents Window registration methods. This was a controlled reproduction, not a recorded Claude SSH session failure.

The Claude patch now creates a missing Task bubble through Cursor's existing ToolFormer method when both the request and the loaded parent use Claude subscription models. Existing bubbles, cancellation and the normal registration barrier are preserved. Missing parents or capabilities still fail through the original path.

All 36 Claude unit tests passed. Native registration checks passed for standalone Claude and combined ChatGPT/Claude candidates in both workbenches. Combined installation and uninstall checks verified linked manifests, backups and byte-for-byte restoration of the original build. A completed live subagent task in the SSH Agents Window still needs manual confirmation.

Run the check:subagents npm script with the patched Cursor resources/app path to repeat the native registration check without model requests.


### Empty optional model on the first attempt

The later ChatGPT SSH session contained a separate failure after reload: Task calls supplied an empty model string and failed native validation. The next attempts selected a model successfully and started local subagents. This confirms successful startup after retries, not reliable first-attempt behavior before the additional repair.

For this subscription provider, an empty or whitespace-only requested model is now normalized to an omitted selection before the native resolver runs. Cursor still chooses the inherited, configured or forced model and checks availability. Explicit models and other providers retain native validation. Both runtime resolvers passed a reproduced empty-string failure, inheritance, configured defaults, forced-model handling and blocked-model checks. A new live test of the first attempt after this additional repair is still pending.
