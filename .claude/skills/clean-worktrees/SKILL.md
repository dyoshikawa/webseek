---
name: clean-worktrees
description: Clean git worktrees created by git-worktree-runner
---
1. Run `git gtr list` to list all worktrees.
2. For each worktree branch that is NOT the default branch (e.g. main), run `git gtr rm --force '<branch>'` to remove it. Always put the branch name in single quotes. Branch names can come from other people (for example a worktree for a fork PR), so skip and report any branch whose name contains characters other than letters, digits, `.`, `_`, `-` and `/`, or that does not start with a letter or digit, instead of removing it.
3. Run `git pull --prune` to fetch latest changes and prune deleted remote branches.
