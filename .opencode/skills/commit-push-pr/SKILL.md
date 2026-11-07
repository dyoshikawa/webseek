---
name: commit-push-pr
description: >-
  Commit current changes, push to remote, and create or update a pull request.
  Use when the user wants to commit and create a PR, push changes and open a
  pull request, or ship their current work as a PR.
---
# Commit, Push, and PR Management

## Step 1: Check Current Branch

Run `git branch --show-current` to get the current branch name.

If the current branch is `main` or `master`:

1. Generate a descriptive branch name based on the staged/unstaged changes
2. Create and switch to the new branch: `git checkout -b <new-branch-name>`

## Step 2: Stage and Commit Changes

1. Run `git status` to check for changes
2. If there are unstaged changes, stage them: `git add .`
3. Analyze the changes and create a meaningful commit message
4. Commit with the message passed through a file, never inside double quotes:

   ```bash
   mktemp
   ```

   Write `<commit-message>` to the path it prints (`<msg_file>`) with your file-writing tool, not through the shell.

   Then run:

   ```bash
   git commit -F '<msg_file>'
   rm -f '<msg_file>'
   ```

## Step 3: Push to Remote

Push the branch to remote with upstream tracking:

```bash
git push -u origin HEAD
```

`HEAD` pushes the current branch under its own name, so the branch name never has to be typed into the command.

## Step 4: Handle Pull Request

Check if a PR already exists for this branch:

```bash
gh pr view --json number,title,body 2>/dev/null
```

### If PR does NOT exist:

Create a new PR:

```bash
mktemp
```

Write `<description>` to the path it prints (`<body_file>`) with your file-writing tool, not through the shell, and `<title>` the same way into a second `mktemp` file (`<title_file>`).

Then run:

```bash
gh pr create --title "$(cat '<title_file>')" --body-file '<body_file>'
rm -f '<body_file>' '<title_file>'
```

Never put drafted text on the command line or in a shell heredoc: it often quotes untrusted issue or PR content, the shell runs backticks and `$(...)` inside double quotes, and a quoted line can end a heredoc early. Create an empty file with `mktemp`, write the text into it with your file-writing tool (not through the shell), and pass the file. Write the title into its own `mktemp` file (`<title_file>`) the same way; `"$(cat '<title_file>')"` is safe because the shell does not re-evaluate what `cat` prints.

The PR description should include:

- Summary of changes
- Test plan (if applicable)

### If PR already exists:

1. Compare the current PR title and description with the actual changes
2. If updates are needed (e.g., scope of changes has expanded), update the PR using GitHub API:

```bash
mktemp
```

Write `<new-description>` to the path it prints (`<body_file>`) with your file-writing tool, not through the shell. Write `<new-title>` the same way into a second `mktemp` file (`<title_file>`).

Then run:

```bash
gh api repos/<owner>/<repo>/pulls/<pr-number> -X PATCH -f title="$(cat '<title_file>')" -F body=@'<body_file>'
rm -f '<body_file>' '<title_file>'
```

Note: Use `gh api` instead of `gh pr edit` to avoid GraphQL deprecation warnings. 3. If no updates are needed, skip this step

## Step 5: Report Result

Output the PR URL and a summary of actions taken.
