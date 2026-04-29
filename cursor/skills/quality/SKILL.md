---
name: quality
description: Review code hoặc sinh test tự động. 2 chế độ: review (xem PR/diff để góp ý chất lượng, bảo mật, hiệu năng) và gen-tests (sinh test unit + integration cho code mới hoặc code đã có nhưng thiếu test).
---

# Quality

Replaces: review-pr, gen-tests.
Modes: `review` | `gen-tests`.
User-facing output: Vietnamese.

## Mode detection

| Signal | Mode |
|---|---|
| PR URL, diff, "review this", "is this safe" | review |
| "generate tests", "add tests", "test coverage" | gen-tests |

---

## Mode: review

Ad-hoc code review outside formal pipeline.

Input: PR URL, branch name, file paths, or staged diff

Steps:
1. Get diff: `gh pr diff` or `git diff`
2. Task(reviewer) → checklist:
   - Readability, naming, structure
   - Security (injection, auth bypass, data exposure)
   - Performance (N+1, unbounded queries, memory leaks)
   - Test coverage (new code has tests?)
   - Backward compatibility (breaking changes?)
3. Classify findings: must-fix / should-fix / nit

Output:
```
## Review: {description}
Verdict: {Approved | Changes requested | Blocked}

### Must-fix
- [{file}:{line}] {finding}

### Should-fix
- [{file}:{line}] {finding}
```

## Mode: gen-tests

QA identifies scenarios, dev writes test code following repo conventions.

Input: module path, function name, or feature area

Steps:
1. Scan existing test patterns (framework, naming, directory structure, helpers)
2. Task(qa) → test scenarios: happy path, edge cases, error cases, boundary values
3. Task(dev) → write test files matching repo conventions
4. Run tests → report results

Output: test files in `{project-path}/src/` (or matching test directory)

---

## What's next

| Outcome | Next |
|---|---|
| Review approved | Merge PR |
| Changes requested | Fix → re-run `/quality review` |
| Tests passing | `/quality review` for the test PR |
| Tests failing | Fix implementation, re-run |
