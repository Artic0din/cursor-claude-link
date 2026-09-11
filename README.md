# cursor-claude-link

An experimental patch that adds your Claude Code models to Cursor and uses your existing Claude subscription sign-in. Cursor keeps its agent harness, tools and approval controls. No extension is installed.

Companion project: [cursor-gpt-link](https://github.com/vertexitde/cursor-gpt-link).

## Status

| Item | Current status |
| --- | --- |
| Client platform | Windows x64 |
| Latest tested Cursor | 3.20.11, September 11, 2026 |
| Cursor commit | `69d099d6568dc97e110ba8184614faf51c4040b0` |
| Previous supported Cursor | 3.20.7, commit `979197d5570b168c034c634b3e21f2bea3ea5be0` |
| Node.js used locally | 26.7.0 |
| Claude Code used locally | 2.1.263, signed in with Claude Max |
| Model selection and file edits | Confirmed manually after updating Cursor to 3.20.11 |
| Bridge tool calls | Sonnet and Fable round trips verified before the Cursor update |
| Context and effort | Forwarding checked in both runtime bundles; short requests tested with 200K and 1M |
| IDE and Agents Window | Both bundles patched and syntax checked; separate manual coverage is not recorded |
| Remote SSH | Local inference routing implemented; dedicated Claude SSH testing is still pending |
| Subscription usage | Settings card implemented; retrieval can be unavailable |
| Fast and Ultracode | Not implemented |

The automated Claude inference check after the 3.20.11 update encountered an OAuth refresh-lock error. A separate manual test confirmed model selection and a file edit, but did not specify which provider was selected. See [testing notes](docs/testing.md) for the exact coverage.

Only the listed builds are supported. The installer checks version, commit, original JavaScript hashes and patch anchors. A matching local ChatGPT installation manifest can identify already patched files. Unknown changes stop installation.

## What it adds

Models appear with a small Claude logo in a **Claude Subscription** section. ChatGPT subscription models and native Cursor models keep their own sections.

The model list comes from the installed Claude Code client. In the tested account it included Opus 5, Fable 5.1, Sonnet 5 and Haiku 4.5. The patch does not grant model access. Different Claude Code installations or accounts can return different catalogs.

Each model appears once. The redundant Default entry is folded into the model it resolves to. **Context** offers 200K and 1M where supported, independently of **Effort**. Standard mode holds Claude Code to 200K; extended mode enables the larger window. Haiku keeps its standard window. This is why the menu does not copy Cursor's native 300K label.

Effort levels come from model metadata: Low, Medium, High, Very high and Max where available. English descriptions explain what each model is suited to. Text added by this patch is English; existing Cursor controls retain Cursor's localization.

**Plan & Usage** contains a **Claude Subscription** card with the reported plan, usage percentages and reset times. It refreshes every minute while open. The bridge uses Claude Code's `/usage` command, with no model prompt, to retrieve these values. Errors appear as unavailable status rather than invented percentages.

## Requirements

- Windows x64 and a supported Cursor build.
- Node.js 22 or newer on PATH. Local testing used 26.7.0.
- The native Claude Code executable and a Claude subscription sign-in with access to the requested models.
- Permission to modify the Cursor installation.

There are no npm dependencies. API-key-only authentication is not supported. Claude Code manages sign-in and token renewal; this project does not read credential files or import browser cookies.

## Install

```powershell
git clone https://github.com/vertexitde/cursor-claude-link.git
cd cursor-claude-link
npm run check
claude auth login --claudeai
npm run doctor
```

Skip the login command if Claude Code is already signed into the correct account. Complete browser sign-in yourself. `doctor` reports selected status and model fields, without printing credentials or account identifiers.

Close Cursor, then install:

```powershell
npm run install:patch
```

Start Cursor again and select a Claude model. The bridge starts with Cursor on `127.0.0.1:43188`. To start it manually, use `npm start`. If you applied the patch while Cursor was open, run **Developer: Reload Window** and start the bridge if needed.

The installer prefers `claude.exe` on PATH, matching the terminal, then tries the native install location. For custom locations, set these before the first installation:

```powershell
$env:CURSOR_APP_ROOT = 'D:\Apps\Cursor\resources\app'
$env:CLAUDE_EXECUTABLE = 'D:\Tools\claude.exe'
npm run check
npm run install:patch
```

`CURSOR_APP_ROOT` points to `resources/app`, not the folder containing `Cursor.exe`. Keep the same value for later status and restore commands. The chosen Claude executable is saved in local `config.json`.

Configuration, installation manifests and backups live in this clone and are ignored by Git. Keep the clone and Node.js at their installation paths while the patch is installed. Unlike cursor-gpt-link, this release does not copy its runtime into a separate state directory. To move the project, restore first and install again from the new location.

## Using it with ChatGPT

Install [cursor-gpt-link](https://github.com/vertexitde/cursor-gpt-link) first, then this patch. Both patch the same Cursor bundles. The Claude installer preserves the existing ChatGPT changes and updates its installation hashes.

For removal or upgrades, restore Claude first, then restore ChatGPT if needed. Removing Claude returns Cursor to the state immediately before the Claude installation, which can include ChatGPT. Do not remove the underlying ChatGPT patch first and assume the Claude manifest still matches.

Custom public ChatGPT state directories are recognized through `CURSOR_GPT_LINK_HOME`. Set it to the same value used by that installation. Each project still requires support for the selected Cursor build.

## Check, update or remove

```powershell
npm run status
npm run uninstall
```

These correspond to `node patcher.mjs status` and `node patcher.mjs restore`. Status verifies installed-file and backup hashes. Restore refuses to overwrite changed files. Backups remain available.

For a normal project update, close Cursor, restore the patch, run `git pull`, then install again. An already running bridge can remain after restore until stopped or Windows is restarted. Do not share its local key or configuration.

Cursor updates can replace the patched files. **Do not restore old backups over a newer Cursor build.** Check the supported version table and follow [the update notes](docs/testing.md#cursor-updates). There is no force option.

## Remote SSH

Inference runs on the local PC through Cursor's dedicated local runtime. Cursor's existing workspace path handles tools on the SSH host. The remote machine should not need Claude Code, copied credentials or a forwarded bridge port.

This routing is implemented in both workbenches. Claude-specific end-to-end SSH validation is still pending; the successful SSH tests in cursor-gpt-link do not establish Claude coverage.

## How it works

The patch changes both workbench bundles, both agent runtime bundles, main-process startup and the workbench checksum in `product.json`. Only model IDs beginning with `claude-subscription/` use this bridge.

The local bridge accepts bearer-authenticated Responses requests and invokes unmodified Claude Code in print mode. Claude returns structured text and requested function calls. Cursor executes the tools with its existing permissions and sends their results back on the next request.

Claude's built-in tools, hooks, MCP servers and project settings are disabled for these requests. The bridge sends Cursor's instructions, conversation and tool schemas to Claude instead. It does not run a second file-editing agent behind Cursor.

This is a structured-output adapter, not native Anthropic Messages transport. Text is returned once Claude finishes each turn, rather than token by token. Requests include the complete conversation and do not persist Claude Code sessions. The bridge allows two concurrent inference requests and a three-minute timeout per request.

Prompts and tool data go to Anthropic through Claude Code. The bridge does not add request logging. Account credentials stay with Claude Code; only a generated local bridge key is inserted into Cursor. Programs running as your local user can read that key. Never publish configuration, manifests, patched bundles or backups.

## Subscription usage and limitations

The bridge requires `claude.ai` subscription authentication and removes API-key and alternative-provider environment overrides from its child process. There is no API-key fallback.

Anthropic's [Agent SDK support notice](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), checked in September 2026, says the announced June 15 billing change is paused. Actual billing depends on provider policy, plan, model and enabled extra usage. A successful subscription sign-in does not prove that every model request is included at no extra charge.

In particular, [Fable can use usage credits on some plans](https://code.claude.com/docs/en/model-config#fable-and-usage-credits), and non-interactive Claude Code does not show the interactive billing-consent prompt. Check your account's usage settings before using it.

- Fast mode, voice and image generation are not implemented.
- Ultracode is not an effort level above Max. It combines xhigh reasoning with Claude Code's dynamic workflow orchestration. That orchestration is not implemented in this Cursor adapter, so no misleading Ultracode option is shown. See [Claude's model configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level).
- Initial model entries are embedded during installation. A failed catalog refresh can leave stale entries visible; the provider still decides whether a request is accepted.
- Claude Code authentication, catalog and usage behavior can change separately from Cursor. A refresh-lock error can require retrying later or signing in again through Claude Code.
- Cloud agents, macOS and Linux clients are unsupported. Separate manual coverage of both Cursor windows and SSH is still needed.

## Reconnecting or failed requests

Claude CLI errors now use the error event understood by Cursor's Responses adapter. Earlier bridge versions sent `response.failed`, which Cursor 3.20.11 ignored and treated as an interrupted stream. This could hide login, usage-limit or timeout errors behind repeated reconnect attempts. The correction reports the original error; it does not resolve an expired login, exhausted usage or a broken SSH connection.

Model discovery now closes the Claude CLI input stream and waits for a clean exit before returning the catalog, so it no longer kills a successful discovery process during cleanup. If Claude reports a missing sign-in, run `claude auth login --claudeai` locally, then retry the request.

The local `.state/bridge-status.json` file records up to 40 request lifecycle entries with model, timestamp, duration and outcome. It contains no prompts, tool arguments, credentials or error text. The file is ignored by Git.

## Attachments

Images (PNG, JPEG, GIF and WebP) and PDFs are sent to Claude Code as native content blocks through streaming JSON input. UTF-8 text attachments, including Markdown, CSV and JSON, are sent as text documents. Attachments retain their position in the conversation and can also be included in tool results. The bridge does not place base64 file data in the text prompt or read local paths from attachment URLs.

Both workbenches advertise image support. Cursor decides how files are attached or extracted before a request reaches the bridge. Other binary formats, audio, video and provider-specific file IDs are not supported by this Claude adapter. Attach file contents, an HTTP(S) URL, or extracted text. The bridge accepts requests up to 64 MiB including JSON and base64 overhead; Claude's own file, page and context limits still apply.

Run `npm run test:attachments` against the running bridge for a real image and PDF content check. It consumes subscription usage.

## Development

```powershell
npm test
npm run check:source
```

Unit tests use synthetic data and do not make model requests. The optional `npm run test:live` requires the running bridge and consumes subscription usage. It checks a tool call and its result. Set `CLAUDE_TEST_MODEL` to a catalog value to select a different model.

No Cursor binaries, full bundled source, model caches or account files are distributed. When reporting a problem, include the Cursor version and commit, operating system, Node.js and Claude Code versions, and a redacted error. See [SECURITY.md](SECURITY.md) for sensitive reports.

## Legal Disclaimer & Terms of Service Notice

- **Educational & PoC Only:** This project is an independent open-source proof-of-concept for educational purposes.
- **No Affiliation:** This project is not affiliated with, maintained, sponsored, or endorsed by Anysphere (Cursor) or Anthropic.
- **Use at Your Own Risk:** Modifying software binaries or patching client environments may violate the Terms of Service of Cursor and/or Anthropic.
- **Account Safety:** The maintainers are not responsible for suspended accounts, lost access, or any damages caused by using this patch.

## License

The patcher and bridge source are provided under the [MIT license](LICENSE). The Claude icon has a separate license and attribution in [third-party notices](THIRD_PARTY_NOTICES.md).
