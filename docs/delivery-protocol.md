# Delivery protocol (low admin overhead)

This document defines how work is delivered so you do not have to do conflict triage or branch archaeology.

## Operating mode

- **Single delivery lane:** `main` only unless you explicitly ask for branching.
- **No user conflict resolution:** if conflicts appear, the agent resolves them and re-validates before handoff.
- **No ambiguous PR claims:** the agent must distinguish between local commit metadata and an actual GitHub PR URL.
- **No terminal dependency for you:** acceptance steps must be tappable in GitHub + browser only.

## Agent responsibilities per change

1. Keep edits scoped to the requested outcome (avoid side quests).
2. Verify no conflict markers exist in repository files.
3. Run syntax checks for changed JS modules.
4. Provide one clear acceptance checklist (tap actions only).
5. Provide exact changed files and what to verify in the UI.

## Definition of done for this repo

A change is only considered done when all are true:

- Requested behavior is implemented.
- Checks pass locally.
- A concrete merge/deploy path is stated in one short sequence.
- The handoff does not require you to inspect dozens of diffs to decide conflict chunks.

## If GitHub state and local state diverge

- Treat GitHub `main` as source of truth.
- Re-apply only the requested change set onto current `main`.
- Re-test and hand off one clean update, not multiple alternate branches.
