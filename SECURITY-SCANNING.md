# AI Skill security scanning

This repository runs `skill-trust` v0.1.0, pinned to commit `331545d5c7ee85ed18234599b1b1451a33457ca4`. The workflow builds that exact source revision and scans every tracked `SKILL.md` directory independently.

## Scope

Scanned targets are discovered from tracked source `skills/**/SKILL.md` and `sources/**/SKILL.md` files. For each target, skill-trust reads the Skill frontmatter and recursively inspects Python, JavaScript, TypeScript, and shell files beneath that Skill. It classifies results as `VERIFIED`, `PARTIAL`, `UNDECLARED`, or `INCONSISTENT` and emits JSON and SARIF.

The current scanner does **not** understand pluginpack manifests, agent Markdown, Cursor rules, standalone scripts outside a Skill, or prose-only reference files. Those files remain in the workflow path filter so changes trigger a fresh baseline, but a clean scan is not evidence that they are safe. Generated output, dependencies, `.git`, images, licenses, changelogs, and general documentation are excluded because they are either duplicates or do not define executable agent behavior. No scan modifies a Skill or plugin.

## Run locally

Requires Node.js 20+:

```sh
git clone https://github.com/Ryan-focus/skill-trust.git /tmp/skill-trust
git -C /tmp/skill-trust checkout --detach 331545d5c7ee85ed18234599b1b1451a33457ca4
npm --prefix /tmp/skill-trust ci --ignore-scripts
npm --prefix /tmp/skill-trust run build
node .github/scripts/run-skill-trust.mjs /tmp/skill-trust/dist/cli.js
```

Reports are written to `skill-trust-results/`. Error findings mean behavior contradicts a declared permission; warnings indicate incomplete declarations; informational findings currently mean the Skill has no `trust` declaration. Review the named rule and source location in JSON or Code Scanning.

## False positives and enforcement

There is no scanner suppression format in v0.1.0. Resolve a valid finding by making the trust declaration accurately describe existing behavior. For a suspected false positive, document the rule, evidence, owner, and expiry in the reviewing issue or pull request; do not weaken or auto-rewrite Skill behavior. A future pinned scanner upgrade or narrowly reviewed orchestration-level suppression can then address it transparently.

The initial workflow is audit-only (`SCAN_ENFORCE=false`). After baseline review, first set it to `true` to block scan errors, inconsistent declarations, or scanner failures. Once warnings have been triaged, the wrapper can additionally fail on `totals.warnings > 0`. Recommended rollout: protect against new errors first, then warnings; do not enforce informational `UNDECLARED` results until trust declarations are deliberately adopted.
