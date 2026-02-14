# Conflict handling policy

This project uses a **prevent-first** policy.

## Principle

You should not be asked to resolve conflict chunks manually for routine updates.

## What the agent must do

- Minimize overlap by editing only required files.
- Reconcile conflicts before handoff.
- Re-test after reconciliation.
- Deliver a concise summary of final effective changes.

## Escalation rule

If a conflict changes product behavior materially, the agent should present exactly two concrete options (A/B) in plain language and implement the option you select.
