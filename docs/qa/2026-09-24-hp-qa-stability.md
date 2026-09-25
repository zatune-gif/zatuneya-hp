# HP QA stability: 404 active state and mobile section spacing

Date: 2026-09-24. Scope: PR #14 worktree `codex/v3-lower-pages`, starting HEAD `71612aab6caf60e78fbfa877bffb754df078b828`. This changes QA only; no site HTML/CSS/JS, image, or copy changes.

## 404 active-state race

The tested `404.html` primary action is an `<a href="./contact.html">`. The previous test pressed and released at the link center. The release produced a real click and began navigation to `contact.html` while the test called `goto(service-training.html)`. A baseline Chromium run failed 5/10 times; the added regression initially failed with `page.evaluate: Execution context was destroyed, most likely because of a navigation` (exit 1). The test now measures the actual computed `:active` state and its contrast while pressed, moves the pointer away, then releases. It asserts both that the URL remains `404.html` and that the click event did not fire. Reverting the pointer move made this regression fail on the real navigation. No retries or assertions were removed.

Focused verification: the corrected test passed 8/8 independent Chromium runs (exit 0 each). Measured primary active contrast was 6.896:1 and training pricing action contrast was 6.896:1 in the recorded run.

## Mobile geometry gap

The approved mobile comp has shorter copy and omits sections, so the former 375px whole-page height and problems/package absolute-height budgets cannot be used as pass/fail contracts. The replacement gate checked order, image ratios, text/targets, and gutters, but not section padding or internal gaps. This let realistic `@media (361px–400px)` section padding inflation pass even when the 375px total grew from 8,899px to 12,795px (+43.8%).

The gate now checks all eight padded content section IDs, their 44px vertical padding (32px for package), problem grid 12px gap and 20px inset on all four cards, package 20px panel inset/gap and 170px photograph, and service grid 20px gap with cards spanning the 20px-gutter content column. These values come from the approved SP section plan and current CSS. It still does not require the comp and canonical page to have equal total heights.

Focused verification: normal geometry 98/98 checks PASS across 320, 375, 768, and 1280px. The 375px padding-inflation injection failed solely at the intended section-padding contract (exit 1, total 12,795px). A second-card-only 80px padding fault initially escaped with 98/98 PASS, then failed the all-four-cards contract after the gate was corrected. The seven-fault runner rejected all five prior faults (tiny text, gutter removal, image aspect, card columns, hidden section) plus both padding faults at their intended contracts. `qa:all` now invokes this runner after the normal geometry gate.

## Change boundary and optimization

All 59 tracked production files under `v2/` outside tests and screenshot evidence have matching working-tree and `HEAD` Git blob hashes (0 mismatches). Manifest SHA-256 over path, HEAD blob, and working blob: `49d261ce331a5faa0672c7d0ce09c72c9f362f310f5ef6c2ce6dfee1b6a8f970`.

The root `index.html`, `sitemap.xml`, `CNAME`, and Pages workflow have no diff from HEAD. The parent repository's `zatuneya-hp` gitlink has no change. The final integrated QA ran after both independent-review fixes; its tested QA code is the same code selected for this commit.

Optimization check: no debug logs added; `console.info` in QA remains intentional result/diagnostic output. No production inline style, browser alert/confirm/prompt, dead commented code, error-return shape, or secret handling changed. The fault CSS is injected only into local QA browser pages.

## Integrated QA

The final `npm run qa:all` on the complete review-ready file set completed with exit 0. The run reported 581 static checks, 487 lower-page contract checks, 992 lower-page browser checks, 136 header-text checks, 199 SP typography checks, 98 section-geometry checks, seven rejected fault injections, 24 TOP geometry checks, two visual-diff widths, nine cross-browser checks, zero WCAG 2/2.1 A/AA violations across 60 axe scans, and 28 Lighthouse audits. The lowest Lighthouse performance score was 0.98; Accessibility, Best Practices, and SEO were 1.00 in all 28 audits. The 404 active contrast and URL-preservation check passed in the integrated run. Full output is retained in the private visualization log `hp-qa-all-final-2026-09-24.log`.

The run regenerated `v2/qa-screenshots/sticky-cta/1280-mid-scroll.png` and `1440-mid-scroll.png`. Both files were clean before QA. Generated copies from both integrated runs were preserved under the private visualization directory `hp-qa-generated-png/` with matching SHA-256 hashes, then only those two files were restored to their pre-run tracked versions. No other screenshot changes remain.

Not verified here: physical devices, external service communication, deployed GitHub Pages, and PR #15. No push, merge, or publication was performed in this subtask. Search exclusion/publication and CI changes are documented as an unapproved, unimplemented proposal in `docs/superpowers/specs/2026-09-24-publication-ci-design.md`; that document does not implement a deployment change.
