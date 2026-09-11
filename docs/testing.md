# Testing and compatibility

## Supported clients

| Version | Commit | Platform |
| --- | --- | --- |
| 3.20.11 | `69d099d6568dc97e110ba8184614faf51c4040b0` | Windows x64 |
| 3.20.7 | `979197d5570b168c034c634b3e21f2bea3ea5be0` | Windows x64 |

The build JSON files record SHA-256 hashes of original JavaScript bundles. Version-specific installers also require unique patch anchors and run Node.js syntax checks before writing application files. Existing GPT installations are accepted only through a matching local installation manifest.

The public source check and unit tests do not require Cursor or Claude sign-in. They cover environment handling, model and context mapping, function-call preparation, usage parsing, picker sections and exact bridge-process matching. CI runs these on Windows with Node.js 22 and 24. Local verification used Node.js 26.7.0; CI results are separate evidence.

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
