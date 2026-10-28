#!/usr/bin/env node
// release-it `before:init` hook. Without GITHUB_TOKEN, release-it falls back
// to a web-based GitHub Release: it opens a prefilled form in the browser and
// reports success, but no release exists until someone submits that form.
// With no release, publish.yml never runs. Fail before anything changes.
// release-it skips hooks in --dry-run, so dry runs don't need a token.
if (!process.env.GITHUB_TOKEN) {
  console.error(
    [
      "GITHUB_TOKEN is not set.",
      "release-it needs it to create the GitHub Release, which triggers publishing.",
      "Run the Release workflow in GitHub Actions, or set GITHUB_TOKEN to a token with repo scope.",
    ].join("\n"),
  );
  process.exit(1);
}
