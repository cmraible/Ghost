# Email Analytics

Email Analytics tracks provider events for sent newsletters and maintains cached reporting counts for emails and members.

## Language

**Email recipient**:
A member-specific record of one email send attempt.
_Avoid_: Analytics row, recipient event

**Tracked email recipient**:
An **Email recipient** whose email had open tracking enabled when it was sent.
_Avoid_: Openable recipient, tracked member

**Cached email analytics aggregate**:
A stored count on an email or member that summarizes underlying **Email recipient** rows for reporting.
_Avoid_: Denormalized stat, rollup

**Reconciliation**:
A repair pass that recomputes a **Cached email analytics aggregate** from **Email recipient** rows.
_Avoid_: Aggregation job, refresh

## Relationships

- An **Email recipient** belongs to exactly one member and exactly one email.
- A **Tracked email recipient** contributes to a member's open-rate denominator.
- A **Cached email analytics aggregate** may be incremented from event processing or rebuilt by **Reconciliation**.

## Example dialogue

> **Dev:** "When a provider sends an open event twice, should the member's open count increase twice?"
> **Domain expert:** "No. Only the first event that changes the **Email recipient** from unopened to opened updates the **Cached email analytics aggregate**."

## Flagged ambiguities

- "Aggregation" was used for both incremental counter updates and full recomputation. Resolved: use **Cached email analytics aggregate** for stored counts and **Reconciliation** for full recomputation from source rows.
