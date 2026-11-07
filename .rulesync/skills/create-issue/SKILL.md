---
name: create-issue
description: >-
  Create a GitHub issue with detailed description, purpose, and appropriate
  labels
targets:
  - "*"
---

# Create GitHub Issue

## Step 1: Gather Information

Receive the issue topic from $ARGUMENTS or the user's description.

If the information is insufficient, ask the user to clarify the following:

- What needs to be done (the task or problem)
- Why it needs to be done (the purpose or motivation)

## Step 2: Research Context

Before writing the issue, investigate the relevant parts of the codebase to understand:

- Which files and modules are affected
- Existing related code patterns
- Potential impact and scope of the change

## Step 3: Draft the Issue

**Important: All issue content (title, body, labels) must be written in English**, regardless of the language used in the conversation with the user.

Create a well-structured issue with the following sections:

```markdown
## Summary

A concise one-liner describing what this issue is about.

## Motivation / Purpose

Why this change is needed. Explain the problem, user impact, or improvement opportunity.

## Details

Detailed description of what needs to be done:

- Specific changes required
- Files or modules likely affected
- Acceptance criteria or expected behavior

## Additional Context

Any relevant links, screenshots, or references (if applicable).
```

## Step 4: Assign Labels

First, get the available labels from the repository:

```bash
gh label list
```

Then choose appropriate labels from the existing repository labels based on the issue content. Also evaluate whether the issue is suitable for newcomers. If the contribution is straightforward (e.g., small scope, well-defined, minimal domain knowledge required), also assign the `good first issue` label if it exists in the repository.

## Step 5: Create the Issue

```bash
mktemp
mktemp
```

Write `<drafted body>` to the first path it prints (`<body_file>`) with your file-writing tool, not through the shell, and `<concise title>` the same way into the second path (`<title_file>`).

Then run:

```bash
gh issue create --title "$(cat '<title_file>')" --body-file '<body_file>' --label '<label1>,<label2>,...'
rm -f '<body_file>' '<title_file>'
```

Never put drafted text on the command line or in a shell heredoc: it often quotes untrusted issue or PR content, the shell runs backticks and `$(...)` inside double quotes, and a quoted line can end a heredoc early. Create an empty file with `mktemp`, write the text into it with your file-writing tool (not through the shell), and pass the file. Write the title into its own `mktemp` file (`<title_file>`) the same way; `"$(cat '<title_file>')"` is safe because the shell does not re-evaluate what `cat` prints.

## Step 6: Report Result

Output the created issue URL and a summary of:

- Issue title
- Assigned labels
- Whether `good first issue` was applied and why (or why not)
