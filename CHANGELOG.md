# Changelog

All notable changes to this project are documented in this file.
The format follows Keep a Changelog.

## [Unreleased]

### Fixed

- Left `installed.json` in place during version `--restore` so the macOS wrapper can re-sign Cursor, and hash-checked companion GPT manifests only on overlapping paths.
- Kept top-level `context_window` on `/v1/models` next to `capabilities.context_length` for Cursor 3.20.17 clients.
- Enabled installation in Cursor 3.20.17 on macOS Apple Silicon with verified Mac hashes and Apple code signing that preserves hardened runtime and entitlements.
- Kept restoration retryable through signing failures and preserved a companion ChatGPT installation when removing Claude.
- Preserved the active restoration manifest when a combined installation is installed again.
- Checked the installed executable for Apple Silicon support and restored recorded app permissions after standalone removal.
- Corrected companion discovery, Rosetta detection, exact bridge restart matching and private startup diagnostics.
- Routed Cursor tool requests through distinct transport names so Claude does not confuse them with its disabled built-in tools.

### Changed

- Restricted installation to the verified macOS build; retained Windows metadata is explicitly unsupported on Mac.
- Patched the selected app directly, without requiring a full-app backup.
- Synced upstream patch definitions for Cursor 3.20.21, 3.20.23, 3.21.1, 3.21.9 and 3.21.12 (Explore settings, context/MAX, subagent lifecycle, queued follow-ups). Those versions stay rejected on macOS until `scripts/capture-hashes.mjs` records darwin/arm64 hashes.
