---
name: principle-make-operations-idempotent
description: "Use only when the user explicitly requests this skill or an active pstack skill routes here. Apply when designing commands, lifecycle steps, or processing loops that run amid crashes, restarts, and retries. Converge to the same end state regardless of partial prior runs."
disable-model-invocation: false
---

# Make Operations Idempotent

Design every state-changing operation to converge to the correct state however many times it runs and wherever the previous run stopped.

Derive each step from the state that exists, not from what the previous run meant to do. Read the current state, compare it to the goal, and apply only the difference.

Anything a run leaves behind (a lock, a temporary file, a half-written record, a claimed job) must be recognizable as stale by the next run, by evidence that holds wherever the previous run could have stopped. Write to a temporary path and rename it into place.

The test: what happens if this runs twice? What if the previous run crashed at every possible point? If the answer depends on what was left behind, add a reconciliation step.
