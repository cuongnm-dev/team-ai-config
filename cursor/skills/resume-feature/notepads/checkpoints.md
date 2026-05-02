# SDLC Checkpoint markers (cache-safe)

Loaded on demand by `resume-feature` Step 7 dispatcher loop after each stage advance.

---

After each stage advance, append a checkpoint marker to `{docs-path}/_checkpoints.md`:
```
## CKP-{NN}  {stage}  {YYYY-MM-DD HH:MM}
verdict: {verdict}
tokens-stage: {N}
tokens-total: {N}
artifacts: [list of new file paths produced this stage]
intel-drift: {true|false}
```

Wave-boundary checkpoints (after `dev-wave-{N}` or `qa-wave-{N}` completes) ALSO snapshot:
- `_state.md` → `_state.md.ckp-{NN}.bak` (rollback target)
- Resolved feature-map.yaml entry hash

reasoning: `_checkpoints.md` is human-readable timeline; `.bak` files give rollback target without git noise. Equivalent to doc pipeline's checkpoint discipline (Strategic Pipeline Spirals 1-4) but per-stage instead of per-spiral.

Rollback path: `/resume-feature {id} --rollback CKP-{NN}` (skill restores `_state.md` from `.bak`, prunes later checkpoint markers).
