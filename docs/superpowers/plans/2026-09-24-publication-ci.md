# HP publication package and PR CI plan (2026-09-24)

Goal: Retain the current root and `v2/` public URLs and bytes while excluding repository QA and internal files from the GitHub Pages artifact, and run QA on relevant PRs.

Scope: `codex/v3-lower-pages` only. No production HTML/CSS/JS, images, copy, URL, CNAME, robots, sitemap, PR #15, merge, or deploy changes.

1. Inventory the current root and `v2/` public files and local references. Distinguish site owned relative references from external URLs, fragments, `mailto:`, and other schemes. Record existing unresolved references if any.
2. Add contract tests first. Observe failure for missing builder, then for a missing local asset, a leaked development file, altered bytes/noindex, and unsafe links. Use a fixture source tree for deliberate faults.
3. Implement a fixed destination builder under `.pages-artifact/`. Copy exactly the paths in `tools/publication-files.txt`, preserving bytes. Require all 31 public HTML files even when an unlinked source page disappears. Reject new unreviewed HTML/assets, source symlinks, linked output parents, and output paths that could delete the source or an ancestor. Validate exact set, byte equality, forbidden files, and extracted HTML/CSS local references.
4. Change only the Pages artifact input path. Keep its existing `main` push/dispatch trigger and deployment configuration. Before upload, require one `noindex,follow` robots meta on each of the 16 `v2/` HTML files; PR #14 must fail this gate until PR #15 is incorporated. Add a separate Windows Node 22 PR QA workflow for bases `main` and `codex/v3-lower-pages`; install with `npm ci`, Playwright's three browsers, run `qa:all`, then build/verify and browser-test the artifact. No secrets or deploy step in PR QA.
5. Verify red/green contract fixtures, full generated artifact, root and `v2/` HTML URL set, byte hashes, excluded content, and workflow structure. Confirm the staging gate fails on PR #14 and passes with 16 noindex fixture pages while source files remain unchanged. Run available QA and identify environmental limitations without loosening thresholds. Update the relevant README and QA record. Do not commit or push pending independent review.

Official implementation references: GitHub Pages custom workflows and Playwright CI documentation (checked 2026-09-24). The former requires a static upload artifact without links; the latter prescribes `npm ci` then browser installation before tests.
