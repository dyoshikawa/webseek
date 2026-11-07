---
name: merge-pr
description: Merge a pull request using gh pr merge --admin
targets:
  - "*"
---

# Merge Pull Request

Merge a pull request using `gh pr merge --admin`.

## Input

```
$ARGUMENTS
```

## Step 1: Determine the Target PR

Parse `$ARGUMENTS` to identify the PR to merge:

### Case A: PR number or URL is provided

- Extract the PR number from the argument
- Examples: `123`, `#123`, `https://github.com/owner/repo/pull/123`

### Case B: No argument provided

- Get the PR associated with the current branch:
  ```bash
  gh pr view --json number,title,state
  ```

### Case C: Unable to determine the PR

If the PR cannot be determined (e.g., no PR exists for the current branch, or the argument is ambiguous), **ask the user** to specify which PR to merge.

## Step 2: Verify the PR

Before merging, confirm the PR details:

```bash
gh pr view <pr_number> --json number,title,state,mergeable,author,baseRefName,headRefName,isCrossRepository
```

Check:

1. The PR state is `OPEN`
2. Display the PR title and number to the user for confirmation

If the PR is not open or not mergeable, inform the user and stop.

## Step 3: Check GitHub Actions Workflow Status

Verify that all CI checks have passed before merging:

```bash
gh pr checks <pr_number>
```

Check:

1. All workflow checks show `pass` status
2. No checks are `pending` or `fail`

If any checks have failed or are still running, inform the user and ask whether to:

- Wait for pending checks to complete
- Investigate failed checks before merging
- Proceed with merge anyway (using `--admin` will bypass required checks)

## Step 4: Merge the PR

Execute the merge command:

```bash
gh pr merge <pr_number> --admin --merge
```

**Important**: Only merge ONE PR at a time. If multiple PRs are somehow specified, ask the user which single PR to merge.

## Step 5: Comment on the PR

After the merge succeeds, leave a thank-you comment mentioning the PR author:

```bash
gh pr comment <pr_number> --body "@<author_login> Thank you!"
```

Use the `author.login` value obtained in Step 2 for the mention.

## Step 6: Report Result

After merging:

1. Confirm the PR was successfully merged
2. Display the merged PR number and title

## Step 7: Clean Up Local Branch

If the local branch exists, please clean up the local branch. For a PR from this repository (`isCrossRepository` is false), execute:

```bash
branch="$(gh pr view <pr_number> --json headRefName --jq .headRefName)"
git checkout main && git pull --prune
git branch -d -- "$branch"
```

For a fork PR (`isCrossRepository` is true), do not delete `"$branch"`: the fork's head branch name may match an unrelated local branch of yours. Delete only `pr-<pr_number>` (the local name the `git-worktree-runner` skill uses for fork PRs) with `git branch -d -- 'pr-<pr_number>'`, after removing its worktree with `git gtr rm 'pr-<pr_number>'` if one still exists. For a PR from this repository, do the same for `pr-<pr_number>` too if it exists. Skip a branch that does not exist. If the PR was squash- or rebase-merged, `git branch -d` reports the branch as not fully merged; then confirm the PR is merged and ask the user before using `-D`.

The head branch name is chosen by the PR author (for a fork PR, anyone). Never type it into the command yourself: read it into a variable as above and always use it as `"$branch"`, so the shell never interprets characters in it.
