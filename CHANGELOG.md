# Changelog

All notable changes to this project are documented in this file.
The format follows Keep a Changelog.

## [Unreleased]

### Fixed

- Enabled installation in Cursor 3.20.17 on macOS Apple Silicon with verified Mac hashes and Apple code signing that preserves hardened runtime and entitlements.
- Kept restoration retryable through signing failures and preserved a companion ChatGPT installation when removing Claude.
- Preserved the active restoration manifest when a combined installation is installed again.
- Corrected companion discovery, Rosetta detection, exact bridge restart matching and private startup diagnostics.
- Routed Cursor tool requests through distinct transport names so Claude does not confuse them with its disabled built-in tools.

### Changed

- Restricted installation to the verified macOS build; retained Windows metadata is explicitly unsupported on Mac.
- Patched the selected app directly, without requiring a full-app backup.
