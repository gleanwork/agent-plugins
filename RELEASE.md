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
- This repo currently allows merge commits, squash merges, _and_ rebase
  merges on PRs, so watch how a PR lands:
  - **Regular merge** — every individual commit is preserved, and
    conventional-changelog reads them straight from `git log`. The merge
    commit itself doesn't need a type prefix.
  - **Squash merge** — the PR collapses into one commit, using the squash
    commit message (GitHub defaults this to the PR title). That message is
    now the _only_ thing conventional-changelog sees for the whole PR, so the
    PR title itself must be a valid Conventional Commit message.
## Release

Run the **Release** workflow
([`.github/workflows/release.yml`](./.github/workflows/release.yml)) from the
Actions tab, on `main`:

1. Run it with **Dry run** checked (the default). The log shows the next
   version and the changelog.
2. If that looks right, run it again with **Dry run** unchecked.

Leave **Version increment** on `auto` unless you need to override the
version that the commits imply.

From the command line:

```sh
gh workflow run release.yml --repo gleanwork/agent-plugins --ref main
gh workflow run release.yml --repo gleanwork/agent-plugins --ref main -f dry-run=false
```

The workflow runs `release-it` as the `pluginpack-sync` GitHub App. The app
is the only actor the `main` ruleset lets push without a pull request, and a
release the app creates triggers the publish workflow. A release created with
the workflow's own `GITHUB_TOKEN` would not.

`release-it` will:

  1. Determine the next version from commits since the last tag (`feat` →
     minor, `fix` → patch, a `BREAKING CHANGE` footer → major).
  2. Bump both the root `package.json` and
     `shared/glean/mcp/package.json` to the same version. Regenerate
     `CHANGELOG.md`. Its `before:git:beforeRelease` hook then runs
     `npm run build`, after the changelog plugin has written the new entry and
     before release-it stages the release commit. The build syncs that
     changelog into `shared/glean` and `shared/glean-dev-docs`, rebuilds the
     generated plugin output, and checks that every shipped changelog matches
     the root, so the synced changelogs are staged with the rest of the
     release. A later hook such as `before:git:release` runs after staging, and
     the synced changelogs would be left out of the commit.
  3. Commit as `chore: release v${version}`, tag `v${version}`, and push both
     to `main`.
  4. Create a GitHub Release from that tag.

  Nothing here is published to the npm registry — `npm.publish: false` in
  [`.release-it.json`](./.release-it.json).

### Releasing from your machine

Use the workflow. A local `npm run release` works only if you can push to
`main` without a pull request, and it needs `GITHUB_TOKEN` set to a token
with `repo` scope. Without the token, `release-it` would open a release form
in your browser and report success while no release exists, so the
`before:init` hook stops the release instead.

Run it from an up-to-date `main` with a clean working tree:

```sh
git checkout main
git pull
npm ci
GITHUB_TOKEN="$(gh auth token)" npm run release
```

## What happens next (automatic)

Publishing the GitHub Release triggers
[`.github/workflows/publish.yml`](./.github/workflows/publish.yml), which:

1. Rebuilds and validates all 3 targets (`claude`, `cursor`, `codex`).
2. Opens — or force-updates — one PR per target in that target's output
   repo (`gleanwork/claude-plugins`, `gleanwork/cursor-plugins`,
   `gleanwork/codex-plugins`), on a machine-owned `pluginpack/sync-<target>`
   branch labeled `pluginpack-sync`.
3. Squash-merges each sync PR. Users get the release once these merge.

The merge step needs `pluginpack-sync` to be allowed to bypass pull request
reviews in each output repo. If a merge fails, the job says which PR to
merge by hand.

The sync PRs are regenerated and force-pushed on every sync — **don't push
to them by hand or hand-edit their content**.

To get a fix on `main` to users, cut a release. Sync mode runs only on a
release tag, so it never publishes unreleased code. To re-run a release's
sync, for example after a failed job, dispatch the workflow on that tag:

```sh
gh workflow run publish.yml --repo gleanwork/agent-plugins --ref v3.6.0 -f mode=sync
```

Check mode runs on any ref and only reports whether the output repos are
stale:

```sh
gh workflow run publish.yml --repo gleanwork/agent-plugins -f mode=check
```
