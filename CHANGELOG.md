# Changelog

All notable changes to this project are documented in this file.
The format follows Keep a Changelog.

## [Unreleased]

### Fixed

- Serialized Explore and Task-bubble helpers no longer close over Node imports (`requireSubscriptionPrefix`, `CLAUDE_PREFIX`). Patchers still validate the prefix; bubbles emit `CLAUDE_PREFIX` into the workbench bundle.
- `--restore` reads the existing `installed.json` first and no longer requires `getBuild()` to succeed, so a leftover 3.20.17 patch can be uninstalled after this checkout became 3.21.12-only. 3.20.17 is not an install target; new installs still fail closed until darwin/arm64 hashes exist.
- Combined-install GPT overlay is tested without requiring verified 3.21.12 hashes, so CI `test (22)` / `test (24)` can pass while metadata is still Windows.
- Skipped linked GPT restore when that checkout's `installed.json` is gone, even if the parent directory still exists. Do not recreate an archived GPT manifest.
- `check:actions` now asserts the same derived runtime insertions the 3.21 patcher writes, instead of pinning `_` / `e,r,s`.
- Privatized Cursor.app to `0700` on every version installer before writing the bridge key into workbench assets, matching 3.20.17. Rollback restores recorded `appMode`.
- Made version `--restore` retryable after a partial copy by accepting already-restored `originalHash` targets, and restored linked GPT manifests from saved `linked.original` without aborting if that checkout is gone. `install.mjs` still archives `installed.json` after re-sign. Linked GPT writes ignore only `ENOENT`; other filesystem errors still abort. Every version installer records `appMode` from `requireWritableApp`.
- Advertised Cursor MAX-switch metadata only on versions that install `patchMaxMode`; 3.20.17 still exposes the Context dropdown and 200K/1M display split.
- Wired `verifySubagentSettings` into `check:subagents` and failed closed on unknown `lifecycleSymbols` versions.
- Left `installed.json` in place during version `--restore` so the macOS wrapper can re-sign Cursor, and hash-checked companion GPT manifests only on overlapping paths.
- Kept top-level `context_window` on `/v1/models` next to `capabilities.context_length` for Cursor 3.20.17 clients.
- Enabled installation in Cursor 3.20.17 on macOS Apple Silicon with verified Mac hashes and Apple code signing that preserves hardened runtime and entitlements.
- Kept restoration retryable through signing failures and preserved a companion ChatGPT installation when removing Claude.
- Preserved the active restoration manifest when a combined installation is installed again.
- Checked the installed executable for Apple Silicon support and restored recorded app permissions after standalone removal.
- Corrected companion discovery, Rosetta detection, exact bridge restart matching and private startup diagnostics.
- Routed Cursor tool requests through distinct transport names so Claude does not confuse them with its disabled built-in tools.

### Changed

- Target only Cursor 3.21.12. Older builders, installers, feature gates, and `advertiseMaxMode` splits are gone. One install/restore/write pipeline and one symbol-table row. Installation still fails closed until darwin/arm64 hashes are captured.
- Restricted installation to the verified macOS build; retained Windows metadata is explicitly unsupported on Mac.
- Patched the selected app directly, without requiring a full-app backup.
- Synced upstream patch definitions for Cursor 3.20.21, 3.20.23, 3.21.1, 3.21.9 and 3.21.12 (Explore settings, context/MAX, subagent lifecycle, queued follow-ups). Those versions stay rejected on macOS until `scripts/capture-hashes.mjs` records darwin/arm64 hashes.
