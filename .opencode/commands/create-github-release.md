---
description: Draft GitHub release notes from commits since the last release
---

You are drafting GitHub release notes for the **Toph** project. Follow the workflow below exactly. Do not skip steps. Do not start writing prose until you have actually gathered the commit data.

The release tag was passed as the only argument: **`$1`**.

## Step 1 — Validate the tag argument

The user invokes this command as `/create-github-release <tag>`. Before doing anything else, validate `$1`:

1. **Argument is required.** If `$1` is empty or missing, stop and ask the user to re-run with a tag (e.g. `/create-github-release v0.4.0`). Do not proceed.
2. **Must start with `v`.** The tag must match `^v\d+\.\d+\.\d+(-[\w.]+)?$` (standard `v`-prefixed semver, with an optional pre-release suffix like `v1.2.0-rc.1`). If it doesn't start with `v` or isn't valid semver, stop and tell the user the expected format. Do not silently "fix" it.
3. **Must match the package version.** Read the root `package.json` (and, if the root doesn't carry the app version, `apps/desktop/package.json`) and confirm that stripping the leading `v` from `$1` yields exactly the `version` field. If they don't match, stop and surface the mismatch — show both values and ask the user to either bump `package.json` or re-run with the correct tag. Do not proceed.
4. **Must not already exist.** Check `git tag --list "$1"` and `gh release view "$1"`. If either finds it, stop — the user almost certainly didn't mean to overwrite an existing release. Surface the conflict.

Only proceed past this step when all four checks pass. From here on, treat `$1` as `<next-tag>` everywhere in this workflow.

## Step 2 — Find the previous release

Determine the previous release using, in order of preference:

1. `gh release view --json tagName,publishedAt,name` for the latest published release.
2. If `gh` is unavailable or there are no releases yet, fall back to `git describe --tags --abbrev=0`.
3. If there are no tags at all, use the first commit (`git rev-list --max-parents=0 HEAD | tail -1`) and tell the user this is the project's first release.

## Step 3 — Collect commits since the previous release

Run:

```sh
git log <previous-ref>..HEAD --no-merges --pretty=format:"%h%x09%an%x09%s"
```

Also gather:

- A unique list of contributors: `git log <previous-ref>..HEAD --no-merges --pretty=format:"%an" | sort -u`
- File-level stats for additional signal: `git log <previous-ref>..HEAD --no-merges --shortstat`
- The numeric commit count and date range.

If the result is empty, stop and tell the user there is nothing to release since `<previous-ref>`.

## Step 4 — Group and interpret the work

Cluster commits into themes based on their subjects (and conventional-commit prefixes if present: `feat`, `fix`, `chore`, `refactor`, `docs`, `perf`, `test`, `build`, `ci`, `style`). Suggested top-level buckets, in order:

1. **New** — user-visible features (`feat:`).
2. **Fixed** — bug fixes (`fix:`).
3. **Improved** — refactors, perf, polish (`refactor:`, `perf:`, `style:` when user-facing).
4. **Under the hood** — chores, build, CI, tests, docs, dependency bumps.

Rules for interpretation:

- Use the codebase map in `AGENTS.md` to attribute commits to the right area (desktop app, UI package, contracts, shared) when the commit subject is ambiguous.
- If a commit subject is cryptic, skim the actual diff with `git show <sha> --stat` (and read the patch if still unclear) before describing it. Do not invent behavior that isn't in the diff.
- Collapse trivial churn (formatting-only commits, dependency bumps, version bumps, lockfile updates) into a single line in "Under the hood." Do not list each one.
- Drop commits that are purely internal noise (e.g. "wip", "fix typo", "address review") if they're already represented by a later commit on the same feature.

## Step 5 — Write the draft in Toph tone

Output the draft as a single Markdown block, ready to paste into GitHub. Use this skeleton — keep it lean, don't pad it. The version in the title is `<next-tag>` with the leading `v` stripped:

```markdown
# Toph <next-tag-without-v> — <short evocative title>

<One-line opener in Toph voice. Witty, nerdy, comedic-villain-but-friendly. One punchline, not three.>

## New
- <feature, in plain language, one line each>

## Fixed
- <bug → behavior now, one line each>

## Improved
- <refactor / perf / polish, one line each>

## Under the hood
- <internals, in a single tight list>

## Contributors
Thanks to <@author1>, <@author2>, … for shipping this one.

**Full changelog:** https://github.com/<owner>/<repo>/compare/<prev-tag>...<next-tag>
```

Tone rules (from the `frontend-design` skill — re-read if you forgot):

- **Useful first.** Each bullet has to tell a real user what changed. The joke is in the opener and section flavor, not in every line item.
- **One punchline per surface.** Resist stacking jokes.
- **Developer humor.** Lean into engineering culture (cache invalidation, flaky tests, Friday deploys, DNS, etc.) rather than generic tech jokes — but never gate meaning behind the joke.
- **Comedic-villain, not scary.** "Plotting…", "Assimilating context…", "I queued this for you." Friendly world-domination energy. No real threats.
- **Speak as "I"** when helpful, sparingly.
- **No emojis** unless the user asks.
- Keep bullets short — aim for one line each. If a bullet runs long, it's probably two bullets.

Use GitHub @-handles for contributors when you can map them confidently from `git log` author names (check `gh api /repos/{owner}/{repo}/commits/<sha>` if a mapping is unclear). If you can't confidently map an author, fall back to their plain name — do **not** guess a handle.

## Step 6 — Present and invite feedback

Print the draft to the chat. Then ask the user:

> Want me to tweak anything — tone, grouping, what's emphasized? Once you're happy, I can push this to GitHub as a **draft** release tagged `<next-tag>`.

(The version itself is locked in by the `$1` argument and was validated in Step 1, so don't invite the user to change it here — if they want a different version, they should re-run the command.)

Do **not** create the GitHub release yet. Wait for the user's feedback or explicit go-ahead.

## Step 7 — Only after the user approves: publish as a GitHub draft

When the user gives the go-ahead, run:

```sh
gh release create <next-tag> \
  --draft \
  --title "<title from the draft>" \
  --notes-file <path-to-temp-notes-file> \
  --target <current-branch-or-main>
```

Write the notes to a temp file (e.g. under `/var/folders/0n/rfz3pwlx6vdb_w2ftnq5ycqc0000gn/T/opencode/`) rather than passing them inline, so newlines and Markdown survive intact. Confirm the resulting URL back to the user.

If the user wants to edit the draft on GitHub afterwards they can use `gh release edit <next-tag>` or the web UI — mention this once, briefly.

## Guardrails

- Never push tags or publish a non-draft release.
- Never `git commit`, `git tag`, or `git push` as part of this command.
- If `gh` is not authenticated, surface that to the user — do not try to work around it.
- If the working tree has uncommitted changes, mention it once at the top of your reply; it doesn't block drafting, but the user should know.
