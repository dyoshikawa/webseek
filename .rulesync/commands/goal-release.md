---
targets:
  - "*"
description: >-
  Cut a release end to end: run /draft-release to open the release PR and draft
  GitHub release, wait for CI to turn green, run /merge-pr to merge the release
  PR, then wait for the Publish workflow to publish the npm package and finalize
  the GitHub release. Use when the user wants to draft and merge a release in one
  go, or triggers on "/goal-release".
---

# Goal Release Command

new_version = $ARGUMENTS

This command drives a release all the way to publish. It runs `/draft-release`
to open the release pull request (and create the draft GitHub release), waits
for the PR's CI checks to pass, runs `/merge-pr` to merge it, and finally waits
for the `Publish` workflow to publish the npm package and flip the GitHub
release public.

## 1. Draft the Release

Run the `draft-release` skill (`/draft-release`) with `new_version`.

- If `new_version` is provided (e.g. `v1.2.3` or `1.2.3`), it must match the
  semver shape `^v?\d+\.\d+\.\d+$` — if it does not, stop and report instead of
  passing it on. Pass a valid value through unchanged; `/draft-release`
  normalizes the `v` prefix itself.
- If `new_version` is empty, pass no argument; `/draft-release` determines the
  next version automatically via the `release-dry-run` skill.

When `/draft-release` finishes, it has:

- created a `release/v<version>` branch with the version-bump commit,
- opened a pull request against `main`, and
- created a draft GitHub release `v<version>` with the release notes.

If `/draft-release` failed partway (e.g. the PR exists but the draft release was
not created, or it stopped before opening the PR), stop here and report the
partial state to the user instead of continuing.

## 2. Resolve the Release PR

Use the PR number or URL that `/draft-release`'s `gh pr create` printed in
Step 1 when available. Otherwise, identify the pull request from the current
`release/v<version>` branch:

```bash
gh pr view --json number,title,state,headRefName
```

Confirm that `headRefName` matches the `release/v<version>` branch created in
Step 1. This command must only ever merge that release PR — if the resolved PR
is a different one, stop and report to the user instead of merging.

## 3. Wait for CI

Wait for the release PR's GitHub Actions checks to finish:

```bash
gh pr checks <pr_number> --watch
```

If the watch reports that no checks are registered yet, wait a moment and retry
— checks can take a few seconds to appear right after the PR is opened.

- If every check passes, proceed to Step 4.
- If a check fails, investigate and fix the failure on the release branch (run
  `pnpm cicheck` locally, commit, and push), then wait for the re-run. Never
  proceed to the merge while any check is `fail` or `pending`.
- Fixes must legitimately resolve the failure. Never make a check green by
  skipping or deleting tests, weakening lint or type-check configuration, or
  editing GitHub Actions workflows.
- Set a safety cap of **3** fix attempts. If CI is still red after the cap, stop
  and report the failing checks to the user instead of merging.

If any fix commit beyond `/draft-release`'s own version-bump commit was pushed,
stop before merging and report the extra commits to the user for confirmation.
The release PR must reach the merge step containing only reviewed, expected
content.

## 4. Merge the Release PR

Run the `/merge-pr` command with the release PR number. It re-verifies the PR
state and CI status, merges with `gh pr merge --admin --merge`, posts a
thank-you comment, and cleans up the local branch.

Note: `/goal-pr` tells agents not to auto-merge PRs that touch `package.json` or
release configuration. That restriction does not apply here — merging the
version-bump release PR is this command's explicit purpose, and the user opted
into it by invoking `/goal-release`.

## 5. Wait for the Publish Workflow

Merging the `release/v<version>` PR into `main` triggers the `Publish` workflow
(`.github/workflows/publish.yml`). In a single job it verifies `package.json`
matches the release tag, creates and pushes the `v<version>` tag, runs
`pnpm publish` (npm trusted publishing via OIDC, with provenance), and flips the
draft GitHub release public. No manual "Publish release" click is needed.

1. Wait for the `Publish` run triggered by the merge to complete:

   ```bash
   gh run list --workflow "Publish" --branch "release/v<version>" \
     --limit 1 --json databaseId,status,conclusion,headBranch
   gh run watch <run_id> --exit-status
   ```

   The workflow triggers on every closed PR to `main` (non-release runs are
   job-level skipped but still listed), so filter by the release branch as
   shown. The run can take a few seconds to appear right after the merge — if
   the list is empty, wait and retry. Confirm the watched run belongs to this
   release (its `headBranch` is the `release/v<version>` branch of the PR merged
   in Step 4) and concluded with `success`. If it failed (e.g. an npm publish
   error), stop and report — the release must not be left half-published.

2. Confirm the GitHub release is published (no longer a draft):

   ```bash
   gh release view v<version> --json isDraft --jq .isDraft
   ```

   This should print `false` once the `Publish` workflow's final step has run.
   If it still prints `true` after the workflow succeeded, wait a moment and
   re-check before reporting.

## 6. Final Report

Report to the user:

- The merged release PR number and title.
- The new version and a link to the published GitHub release.
- Confirmation that the npm package was published (the `Publish` run concluded
  with `success` and the release is no longer a draft).
- Any CI fixes that were needed along the way.
