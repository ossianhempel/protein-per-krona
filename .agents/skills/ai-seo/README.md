# ai-seo (vendored)

Upstream: https://github.com/coreyhaines31/marketingskills/tree/main/skills/ai-seo
Pinned rev: 5b2c0007766c6a1cf1d53fd8fc73e979e0821022
Copied: 2026-09-22

This copy is vendored as-is from upstream. Upstream `SKILL.md` names sibling
skills (`programmatic-seo`, `schema`, `cro`, `ad-creative`, `analytics`,
`customer-research`) that are **not** installed in this repo — treat those as
pointers to upstream, not local files.

## Refresh

Run from the repo root, then update the pinned rev above:

```sh
tmp=$(mktemp -d)
gh api repos/coreyhaines31/marketingskills/tarball/main | tar -xz -C "$tmp" --strip-components=1
cp -R "$tmp/skills/ai-seo/." .agents/skills/ai-seo/
cp -R "$tmp/skills/ai-seo/." .claude/skills/ai-seo/
trash "$tmp"
```

Diff before overwriting if you have local edits. There is no automated updater
for these project-local copies; `ossian-stack`'s `check:upstream` covers only
skills vendored into that plugin.
