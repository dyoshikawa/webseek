---
name: draft-release
description: "Prepare a new npm release: bump the version, open a release PR, and create a draft GitHub release. Publishing is automated by the Publish workflow once the release PR is merged into main."
targets:
  - "*"
---

# Draft Release

Stage a release for `webseek`. Merging the release PR into `main` automatically
runs `.github/workflows/publish.yml`, which publishes the package to npm and
finalizes the GitHub release — this skill only prepares the release PR and a
draft GitHub release for the maintainer to review and merge.

## Step 1: Sync main

- Ensure you are on the `main` branch; if not, switch to it with `git checkout main`.
- Run `git fetch --tags && git pull` to get the latest commits and tags.

## Step 2: Determine the new version

- Parse `$ARGUMENTS` for a version, stripping any leading `v`, and assign it to `$new_version`
  (e.g. `v1.2.0` → `1.2.0`).
- If `$ARGUMENTS` is empty, run the `release-dry-run` skill and use its recommended version.
- Confirm `$new_version` is greater than both the current `package.json` version and the
  latest git tag.

## Step 3: Create the release branch and bump the version

1. `git checkout -b release/v${new_version}`.
2. `pnpm version ${new_version} --no-git-tag-version`.
   - This updates `package.json` only. `webseek` reads its version from `package.json`
     at runtime (`getVersion()` in `src/cli/index.ts`), so no source code edit is needed.
3. Run `pnpm cicheck`. If it fails, fix the code until it passes.
4. Commit with the message `chore(release): ${new_version}` (in English, following the
   project's commit conventions).
5. `git push -u origin release/v${new_version}`.

## Step 4: Open the release PR

- Create a PR into `main`:
  `gh pr create --base main --head release/v${new_version} --title "chore(release): ${new_version}" --body "<summary>"`.
- Use the change summary from the `release-dry-run` skill (What's Changed, Full Changelog)
  for the PR body.

## Step 5: Create the draft GitHub release

- `gh release create v${new_version} --draft --title "v${new_version}" --generate-notes --target main`.
- This is a **draft**: no git tag is created and nothing is published to npm yet.

## Step 6: Report and hand off

Output the following for the maintainer:

- The release PR URL.
- The draft release URL.
- The remaining manual step:
  1. Review and merge the release PR into `main`.

On merge, the **Publish** workflow runs automatically and, in a single job:
verifies `package.json` matches the release tag, creates and pushes the
`v${new_version}` tag, runs `pnpm publish` (npm trusted publishing via OIDC, with
provenance), and flips the draft GitHub release to published. No manual "Publish
release" click is needed.

**Important:** Do not publish the draft release manually before the PR is merged —
merging the PR handles publishing end to end. The workflow verifies the merged
commit's `package.json` matches the tag, so a mismatched version is safely
rejected rather than shipping the wrong version. If you ever need to publish a
release whose PR was merged before this automation existed, run the **Publish**
workflow via `workflow_dispatch` with the desired tag (e.g. `v${new_version}`).
