# Syncing this mirror

This repo mirrors [`cursor/plugins/pstack`](https://github.com/cursor/plugins/tree/main/pstack) and adds its own edits: the top of `README.md` and harness-neutral rewrites in some skills.

Three branches keep those edits safe:

- `upstream` holds Cursor's files exactly, with no local edits.
- `main` is `upstream` plus this mirror's edits.
- `copilot-cli-compat` keeps the mirror's edits and adds the Copilot skill-loader workaround. Merge `upstream` into it separately; never copy its compatibility metadata back onto `upstream`.

Never copy Cursor's files onto `main` directly. That erases the edits.

## Steps

1. Copy Cursor's latest `pstack/` folder onto the `upstream` branch:

   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/cursor/plugins.git /tmp/cursor-plugins
   git -C /tmp/cursor-plugins sparse-checkout set pstack
   git switch upstream
   rsync -a --delete --exclude .git --exclude MIRROR.md /tmp/cursor-plugins/pstack/ ./
   git add -A
   git commit -m "upstream: cursor/plugins/pstack @ $(git -C /tmp/cursor-plugins rev-parse --short HEAD)"
   ```

2. Merge it into `main`. Git applies only what changed upstream and keeps the mirror's edits:

   ```bash
   git switch main
   git merge upstream
   ```

   A conflict means Cursor changed a line this mirror also changed. Keep Cursor's new meaning and reapply the harness-neutral wording.

   Also keep the community fixes listed under "What this mirror changes" in `README.md`, unless Cursor has shipped the same fix. Then take Cursor's version and drop the fix from that list.

3. Refresh the bundled Comment Sicko prompt, then check that no new Cursor-only instructions arrived:

   ```bash
   cp agents/comment-sicko.md skills/no-comments/references/comment-sicko.md
   git diff upstream@{1} upstream -- skills | grep -nE '\.cursor/|agent-transcripts|cursor-team-kit|create-skill|Task'
   ```

   Rewrite any new hits the same way as the existing edits. The Harness section in `skills/poteto-mode/SKILL.md` lists the mappings.

4. Push both branches:

   ```bash
   git push origin main upstream
   ```

## Copilot compatibility branch

For this fork, the source mirror is `backnotprop/pstack`. Configure its Git URL as the `upstream` remote, fetch it, and merge `upstream/main` to import both Cursor updates and the mirror's fixes. `origin/upstream` is this fork's snapshot branch; fetching it alone does not establish that the source mirror is current.

```bash
git fetch upstream main upstream
git merge upstream/main
```

Whether merging `upstream/main` or updating the Cursor snapshot locally, keep the existing mirror edits on `copilot-cli-compat`. Apply the metadata workaround described in [the Copilot guide](docs/harness/copilot-cli.md) to any new manual-only skills. Keep their workflow bodies unchanged and leave `setup-pstack`'s automatic trigger intact.

This branch names pstack's `tdd` and `teach` skills `pstack-tdd` and `pstack-teach` so other packs can retain the short names. Keep the matching directory names and pstack routing, examples, and links synchronized. Preserve these renames during an upstream merge; do not restore duplicate short-name copies.

Run `scripts/check-copilot-skills.mjs` with the SDK bundled with the Copilot version being checked. It discovers every bundled skill, so a newly added skill with the incompatible flag fails the check. Keep the upstream synchronization and compatibility changes in separate commits, then push `upstream` and `copilot-cli-compat`.

Preserve the macOS/POSIX launchers and executable modes. Keep shared scripts platform-neutral and retain the LF rule for statechart's recorded fixtures, whose parsers and expected output depend on exact line endings.
