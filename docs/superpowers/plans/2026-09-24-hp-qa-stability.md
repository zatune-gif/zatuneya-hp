# HP QA stability plan (2026-09-24)

Scope: PR #14 worktree `codex/v3-lower-pages` at `71612aa`. Only `v2/tests`, related test fixtures, `package.json` QA scripts, and this task's QA records may change. HTML, CSS, JavaScript used by the site, images, copy, main, publishing, merge, parent gitlink, and PR #15 are outside scope.

1. Record the clean worktree and hashes of tracked display files. Read the review attachment and prior SP geometry decision.
2. Reproduce the 404 `:active` navigation race and the 375px padding inflation escaping the current gate. Identify each root cause before modifying tests.
3. Add a failing regression for the active-state transition, retaining real computed active contrast measurement. Make the smallest test-harness correction, then repeat at least six times.
4. Add comp-grounded mobile section padding/gap/width/height contracts to the existing geometry gate. First prove the injected padding fault fails the new contract; then prove the normal design passes. Preserve and rerun all five prior fault injections.
5. Run focused QA and coordinate full `qa:all` with the parent. Compare display-file hashes/diff with baseline. Review changed tests and run the optimization checklist.
6. Record measured results and unverified scope in this task's QA note. Hand off changes and evidence for independent review. Do not commit or push in this subtask.
