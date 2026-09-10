# Shared Chores

A local-first household responsibility board with simple rotation.

## MVP contract

- Keep a small local list of household members.
- Add recurring chores with an interval, optional due date, notes, and one or more participating members.
- Assign each chore to one current member and rotate deterministically after completion.
- Treat same-day completion as idempotent.
- Accept `chores://add` handoffs from Home Maintenance without taking ownership of the maintenance asset.
- Share the current board as an explicit deep-link snapshot.
- Stage incoming `chores://import` snapshots for review; never overwrite local state until the user explicitly accepts the import.
- Persist the board on-device with AsyncStorage and never overwrite stored data after a failed hydration read.
- No account, feed, points, streaks, rankings, analytics, ads, or cloud dependency.

## Collaboration boundary

This first slice proves interoperable sharing, not real-time synchronization. A shared snapshot is a deliberate transfer of board state. Multi-device conflict resolution and live collaboration belong to a later synchronization layer if real use requires them.

## Local checks

```sh
bun run verify
```
