# Event Workboard

A local-first organizational board for real-world gatherings.

## MVP contract

- Create and switch between multiple events with date, location, and notes.
- Track invitees and explicit RSVP state: invited, confirmed, or declined.
- Record what should be brought, how much, and who is responsible for bringing it.
- Link a bring item to Household Inventory without copying inventory ownership.
- Track event work in explicit `general`, `setup`, and `cleanup` categories and assign work to a person or leave it unassigned.
- Mark brought items and work complete while retaining the event plan.
- Share one event as a bounded snapshot and stage imported snapshots for explicit acceptance before adding a copied event locally.
- Persist the event collection on-device with AsyncStorage.
- No account, social feed, analytics, ads, guest tracking, or cloud dependency.

## Boundary

Event Workboard owns event-specific invitations, bring commitments, and event work. Household Inventory remains authoritative for linked physical items. Shared snapshots are deliberate copies, not live collaboration or hidden synchronization.

## Local checks

```sh
bun run verify
```
