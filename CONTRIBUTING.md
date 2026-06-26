# Contributing

Thanks for your interest in contributing to webseek!

## Development

This project uses [mise](https://mise.jdx.dev/) to manage runtimes and package
managers, and [pnpm](https://pnpm.io/) as the package manager.

```bash
mise install        # install Node.js + pnpm
pnpm install        # install dependencies
pnpm cicheck        # run all checks (style, types, tests, spelling, secrets)
```

Before committing, run `pnpm cicheck` and make sure it passes. A pre-commit hook
runs secretlint automatically — please do not bypass it with `--no-verify`.

## Pull requests

- Keep PRs focused and reasonably small. For external contributors, PRs with more
  than **1000 added lines** may be asked to be split up.
- External contributors are asked to keep at most **2 open PRs** at a time, so
  reviews stay manageable.
- Link the related issue from your PR description.

These limits are enforced automatically by the `PR Policy` workflow and do not
apply to maintainers.
