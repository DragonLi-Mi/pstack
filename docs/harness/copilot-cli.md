# pstack in GitHub Copilot CLI

This fork's `copilot-cli-compat` branch carries a skill-loading compatibility patch checked on **Copilot CLI 1.0.100, 1.0.102, and 1.0.105**. It preserves the standalone mirror's harness-neutral edits and synchronizes Cursor's `pstack/` at commit `0f77cd5` (pstack 0.15.36), via `backnotprop/pstack` at `25abb38`. Compatibility changes stay on `copilot-cli-compat`, not on the unchanged Cursor subtree branch.

The patch addresses skill loading. It does not implement a new agent runtime or guarantee compatibility with every pstack workflow.

## Why this branch exists

Two separate failure modes were originally reproduced on 1.0.100 using a real Copilot session with only the `skill` tool available:

| Installation and metadata | Skill-tool request | Observed result |
| --- | --- | --- |
| Original plugin, `disable-model-invocation: true` | `pstack:poteto-mode` | `Skill not found` |
| Original plugin, `disable-model-invocation: true` | `poteto-mode` | `Skill not found` |
| Plugin, `disable-model-invocation: false` | `pstack:poteto-mode` | `Skill not found` |
| Plugin, `disable-model-invocation: false` | `poteto-mode` | Success |
| Standalone skills, patched metadata | `poteto-mode` | Success |

A user-invoked plugin slash command can expand successfully and still be followed by a failing, redundant model-tool lookup. Skill discovery, slash-command expansion, and model-tool lookup are different boundaries.

On 1.0.102, `/poteto-help` reproduced that redundant lookup failure even though its content had already loaded. The previous patch covered only `poteto-mode`. An all-skills check against pstack 0.15.30 reproduced the same failure for **55 of 57 skills**, including the new `statechart`; only `poteto-mode` and `setup-pstack` loaded through the skill tool. After the metadata repair, all 57 bare slash commands expand and all 57 redundant skill-tool lookups succeed.

The 0.15.36 sync adds `ketchup-video`, bringing the catalog to 58 skills. On Copilot CLI 1.0.105, the unchanged metadata of that new skill reproduced one loader failure; the same metadata-only repair makes all 58 expand and load. This check ran on Windows, not on a macOS host.

Related upstream reports:
- https://github.com/github/copilot-cli/issues/4438
- https://github.com/github/copilot-cli/issues/4637

## Install without a plugin namespace

Clone this branch into a durable directory:

```sh
git clone --branch copilot-cli-compat https://github.com/DragonLi-Mi/pstack.git
cd pstack
```

Register the complete skills directory. In a POSIX shell:

```sh
copilot skill add "$PWD/skills"
```

In PowerShell:

```powershell
copilot skill add (Join-Path (Get-Location) 'skills')
```

This uses Copilot's built-in directory registration and requires no npm package installation. Keep the clone: Copilot reads the registered directory rather than copying it. Do not register an ephemeral checkout.

If an older pstack plugin is enabled, disable that exact plugin identity first. Inspect `copilot plugin list` to find its marketplace-qualified name. Do not load the plugin and standalone skills simultaneously.

Start a new session and select the bare commands:

```text
/poteto-mode your task
/poteto-help your question
/setup-pstack
```

Do not use `/pstack:poteto-mode` with this standalone registration. An already-running session may retain the previous command catalog; preserve its work and start a fresh session instead of clearing its history.

`copilot skill add <directory>` registers a user-level source. This installation method is globally discoverable; it is not a project-local installation. Use `/skills` or the skill enable/disable commands when adjusting availability. To keep the installation project-scoped, use the host's supported project skill layout instead and verify its discovery separately.

## Metadata change and its tradeoff

Every bundled skill whose frontmatter used `disable-model-invocation: true` receives the same repair:

- Set `disable-model-invocation: false`, so a model-tool lookup is not filtered out.
- Restrict its description to an explicit user request for that skill or routing from an active pstack skill. This keeps composed workflows such as `pstack-teach` routing to `how` and `why` available.
- Leave the workflow body and other metadata unchanged.

The earlier `poteto-mode` patch retains its explicit-user-only description. `setup-pstack` already permits model invocation and keeps its natural-language setup trigger. Principles receive the same loader repair as other manual-only skills; they should not activate independently for ordinary tasks.

**The explicit-user-only behavior is now an instruction, not a runtime-enforced exclusion.** A model may still select the skill incorrectly. This patch does not provide the same hard manual-only gate as the original flag. Review this exception when upgrading Copilot; restore the original flag if the underlying lookup behavior is fixed and verified.

The description does not grant additional file, shell, network, or publishing permissions. Continue using normal Copilot permission controls.

## Models and subagents

The standalone mirror reads `~/.agents/pstack-models.md` outside Cursor. Keep existing role-to-model choices when migrating settings; do not assume a Cursor `alwaysApply` rule will be loaded by Copilot.

Use only models and effort fields actually accepted by the current subagent tool. Cursor-style names with `-xhigh` or `-fast` are not automatically valid Copilot model IDs.

A plain skills-directory installation does not register `agents/*.md` as custom agent types. If `poteto-agent` is unavailable, follow the mirror's Harness fallback: use an available general agent and require it to read the absolute path to `skills/poteto-mode/SKILL.md` in full, including its Principles, before doing the task. This is instruction-level adaptation, not proof that a custom agent type was registered.

## Avoiding duplicate skill names

Standalone skills share a name catalog with installed plugin skills. On Copilot CLI 1.0.104, Matt Pocock's plugin registered `tdd` and `teach` before pstack, so Copilot skipped pstack's versions and printed duplicate-name warnings. That is source precedence, not an installation failure; reloading the same names cannot resolve it.

This branch uses `/pstack-tdd` and `/pstack-teach`, with matching skill directories and updated pstack routing and examples. Other plugins retain `/tdd` and `/teach`. Both implementations stay available without disabling a plugin, changing its priority, or hiding the warnings. These are plain unique names, not the unsupported `pstack:` plugin namespace.

Existing installations should fast-forward to this branch and reload skills or start a fresh CLI session. Do not retain copies in the old `skills/tdd/` and `skills/teach/` directories alongside the renamed skills.

## Validation performed

The local repair was checked at these boundaries:

1. Real skill-tool calls reproduced the original failures and the metadata-only improvement shown above.
2. After standalone registration, a real `skill("poteto-mode")` call succeeded without a failed prefixed call.
3. An isolated SDK session listed `poteto-mode` as a slash command and expanded it to an `agent-prompt` containing the complete mode and Harness section.
4. A regression assertion compared the workflow body with its pre-patch backup and confirmed it was unchanged.

The live loader probe exposed only the skill tool, disabled hooks and unrelated plugins in its isolated repository, and requested no coding, setup, or delegation. These were **ad-hoc loader checks, not a full coding-workflow test suite**. No raw conversation traces, local account paths, or credentials are included in this repository.

### Repeatable all-skills and collision check

Run the checked-in regression script with the `index.js` from the SDK bundled with the installed CLI version and the path to the matching Copilot executable:

```text
node scripts/check-copilot-skills.mjs <path-to-copilot-sdk/index.js> <path-to-copilot>
```

For the standard Windows 1.0.105 package location, in PowerShell:

```powershell
node .\scripts\check-copilot-skills.mjs "$env:LOCALAPPDATA\copilot\pkg\win32-x64\1.0.105\copilot-sdk\index.js" (Get-Command copilot).Source
```

The script creates a temporary SDK configuration, discovers every bundled skill, expands each bare slash command, and executes the real `skill` tool after that expansion. It checks the complete slash-expansion body and the tool's success, returned skill identity, and workflow heading. Tool-returned content remains subject to normal CLI redaction, including credential examples in `make-bot-ui`; the check does not disable or bypass redaction. It exposes only the skill tool, rejects permission requests, loads no repository configuration or file hooks, sends no inference prompts, and removes its temporary state. It does not register skills globally or change the user's plugins, authentication, or approval settings.

The check also registers fixture skills named `tdd` and `teach` in a second source. It verifies those implementations still load from their own files while all 58 pstack skills expand and load from pstack. Before the collision repair, the real loader resolved a pstack request to the competing `tdd` workflow and the assertion failed. This covers source collisions without depending on which plugins happen to be installed.

Before the repair, this check reported 57 slash expansions and 55 loader failures. After the repair, it reported 57 slash expansions and zero loader failures. Workflow bodies were also compared with the post-sync baseline, normalizing Git checkout line endings. These are loader regressions, not proof that every workflow, model selection, or external tool works.

For a manual check after installation:

```text
Use the poteto-mode skill explicitly. Load it once, then stop. Do not run setup,
change files, delegate work, or execute the workflow. Report the actual tool result.
```

Verify the real tool result rather than only the model's prose. Separately check `/poteto-mode` in the session command menu. A successful loader check does not establish coding correctness.

### Statechart and platform scope

The 0.15.36 statechart implementation replaces the old `.mjs` commands with TypeScript. Its core parser and pipeline tests run with Node's TypeScript support on Windows and POSIX hosts. From the repository root, in PowerShell:

```powershell
node --test .\skills\statechart\scripts\test\chart.test.ts .\skills\statechart\scripts\test\messages.test.ts .\skills\statechart\scripts\test\pipeline.test.ts
```

The same tests on macOS or another POSIX host:

```sh
node --test skills/statechart/scripts/test/chart.test.ts skills/statechart/scripts/test/messages.test.ts skills/statechart/scripts/test/pipeline.test.ts
```

These 67 core tests passed on Windows. The corpus fixtures use LF on every platform; converting them to CRLF changes TLC message parsing and breaks the regression expectations.

All 61 PR-watcher and plan-checker tests also passed on Windows. Their fake `gh` command runs through the current runtime rather than a shell script or a hard-coded PATH separator, so the fixture works with the same test runner on Windows and POSIX. The declared TypeScript check could not run because dependency downloads were unavailable.

The upstream shell launcher and executable modes remain unchanged for macOS/POSIX. The statechart CLI uses `/bin/sh` and POSIX process-group signals; this branch does not claim native Windows end-to-end CLI support. Run the full upstream suite with `npm test` from `skills/statechart/scripts` in a compatible POSIX environment after installing its declared dependencies and external prerequisites. Loader checks and core tests do not establish that the full CLI or renderer works, and this synchronization was not executed on a macOS host.

## Known limitations

- Other enabled packs can still collide with unprefixed pstack names beyond the repaired `tdd` and `teach` cases; inspect discovery warnings and resolve the intended source. Do not silently disable unrelated packs.
- Copilot-specific transcript paths and every pstack delegation path have not been validated by this patch.
- Current sessions can retain stale catalogs. Avoid restarting while delegates have in-flight work.
- Keep this compatibility commit separate from upstream synchronization. Review conflicts rather than blindly overwriting local changes with the upstream files.
- Do not infer that the patch fixes future or different Copilot versions without rerunning the loader checks.
