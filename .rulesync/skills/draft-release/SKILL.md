---
name: draft-release
description: "Prepare a new npm release: bump the version, open a release PR, and create a draft GitHub release. Publishing is automated by the Publish workflow once the draft release is published."
targets:
  - "*"
---

# Draft Release

Stage a release for `webseek`. The actual `npm publish` is performed
automatically by `.github/workflows/publish.yml` when the draft GitHub release
is published — this skill only prepares everything for the maintainer to review.

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
- The remaining manual steps:
  1. Review and merge the release PR into `main`.
  2. Open the draft release on GitHub and click **Publish release**.
  3. The **Publish** workflow then runs `pnpm publish` automatically (it verifies the tag
     matches `package.json` and publishes with provenance).

**Important:** Do not publish the draft release before the PR is merged. The Publish
workflow checks out the tagged commit and fails if its `package.json` version does not match
the tag, so publishing early is safely rejected rather than shipping a wrong version.
