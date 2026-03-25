# but Fork Release Workflow (GitHub Releases)

This workflow publishes `but` binaries for Linux and macOS to GitHub Releases, and injects an
agent-friendly install/update prompt into release notes.

## Files

- `.github/workflows/release-but.yml`: entry workflow (tag push + manual dispatch)
- `.github/workflows/release-but-reusable.yml`: reusable release implementation
- `scripts/install-github-release.sh`: installer/updater script used by release prompt

## Supported Release Types

- Stable: tags like `v0.21.0`
- Pre-release: tags like `v0.21.0-rc.1` or `v0.21.0-beta.1`

`prerelease` is auto-detected from tag format (contains `-`), and can be overridden in manual run.

## Supported Platforms

- `linux-x86_64`
- `macos-x86_64`
- `macos-aarch64`

## Release Assets

Each release uploads:

- `but-<tag>-linux-x86_64.tar.gz`
- `but-<tag>-macos-x86_64.tar.gz`
- `but-<tag>-macos-aarch64.tar.gz`
- `checksums-<tag>.txt`

## Agent Prompt in Changelog

Release notes include this one-line prompt at the top (values are auto-filled by workflow):

`请在当前机器将 but 安装/更新到 <tag>：执行 \`curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<tag>/scripts/install-github-release.sh | sh -s -- --repo <owner>/<repo> --version <tag>\`，然后运行 \`but --version\` 并回报结果。`

Any user or agent can copy this line and run it to install or update to the exact release version.

## How To Publish

1. Ensure release commit is on the target branch.
2. Create and push a tag:

```bash
git tag v0.21.0
git push origin v0.21.0
```

3. Wait for `Release but (GitHub Releases)` workflow to finish.
4. Open GitHub Release page and verify:
   - assets exist for all three platforms
   - `checksums-<tag>.txt` exists
   - release notes start with the agent prompt line

## Manual Re-run / Backfill

Use Actions -> `Release but (GitHub Releases)` -> `Run workflow` and provide:

- `tag`: existing or new tag (for example `v0.21.0-rc.2`)
- `prerelease_mode`: `auto`, `true`, or `false`
- `target_commitish`: commit/tag/branch when creating a new tag-backed release
