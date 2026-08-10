# Release Process

Releases are automated with [release-it](https://github.com/release-it/release-it/)
and [`@release-it/conventional-changelog`](https://github.com/release-it/conventional-changelog).

This is **not** the standard `create-rwjblue-release-it-setup` setup, even
though it's scaffolded from it — there are no changelog-relevant PR labels
here, and no `lerna-changelog`. The changelog is generated straight from
[Conventional Commit](https://www.conventionalcommits.org/) messages in the
git log (see [`.release-it.json`](./.release-it.json)). `release-it` also
never publishes an npm package — `npm.publish` is `false`. Its only job is to
bump the version, write `CHANGELOG.md`, tag, and cut a GitHub Release; that
release is what triggers the actual plugin distribution (below).

## Preparation

- Every commit that should be user-visible in the changelog needs a
  Conventional Commit type prefix: `feat:`, `fix:`, or `docs:` (see the
  README's [Commit conventions](./README.md#commit-conventions) for how
  `feat`/`fix` vs `docs` map to skill changes vs repo-only docs). Everything
  else (`chore:`, `refactor:`, `ci:`, `build:`, `test:`, ...) is fine to merge
  but is intentionally left out of `CHANGELOG.md`.
- This repo currently allows merge commits, squash merges, *and* rebase
  merges on PRs, so watch how a PR lands:
  - **Regular merge** — every individual commit is preserved, and
    conventional-changelog reads them straight from `git log`. The merge
    commit itself doesn't need a type prefix.
  - **Squash merge** — the PR collapses into one commit, using the squash
    commit message (GitHub defaults this to the PR title). That message is
    now the *only* thing conventional-changelog sees for the whole PR, so the
    PR title itself must be a valid Conventional Commit message.
- Make sure you're releasing from an up-to-date `main` with a clean working
  tree and dependencies installed:

  ```sh
  git checkout main
  git pull
  npm install
  ```

## Release

- `release-it`'s GitHub plugin needs a token with `repo` scope to create the
  GitHub Release (this is the event the plugin sync below listens for):

  ```sh
  export GITHUB_TOKEN=ghp_...
  ```

- Run the release:

  ```sh
  npm run release
  ```

  `release-it` will:

  1. Determine the next version from commits since the last tag (`feat` →
     minor, `fix` → patch, a `BREAKING CHANGE` footer → major).
  2. Regenerate `CHANGELOG.md`. Its `after:bump` hook then runs `npm run
     build`, which syncs that changelog into `shared/glean` and
     `shared/glean-dev-docs`, then rebuilds the
     generated plugin output — all of which is included in the release
     commit.
  3. Commit as `chore: release v${version}`, tag `v${version}`, and push both
     to `main`.
  4. Create a GitHub Release from that tag.

  Nothing here is published to the npm registry — `npm.publish: false` in
  [`.release-it.json`](./.release-it.json).

## What happens next (automatic)

Publishing the GitHub Release triggers
[`.github/workflows/publish.yml`](./.github/workflows/publish.yml), which:

1. Rebuilds and validates all 3 targets (`claude`, `cursor`, `codex`).
2. Opens — or force-updates — one PR per target in that target's output
   repo (`gleanwork/claude-plugins`, `gleanwork/cursor-plugins`,
   `gleanwork/codex-plugins`), on a machine-owned `pluginpack/sync-<target>`
   branch labeled `pluginpack-sync`.

Those PRs are regenerated and force-pushed on every sync — **don't push to
them by hand or hand-edit their content**. Review and merge each one in its
own repo once it looks right.

If you need those PRs to pick up a fix made on `main` *without* cutting a new
release, dispatch the workflow directly instead of running `release-it`
again:

```sh
gh workflow run publish.yml --repo gleanwork/agent-plugins -f mode=sync
```

Use `-f mode=check` instead to only report staleness without opening or
updating anything.
