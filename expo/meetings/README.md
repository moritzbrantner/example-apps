# Meeting Planner

Collaborative meeting coordination for reusable groups and standalone meetings.

## Product contract

- People can join through an invite as guests; creating an account is optional.
- A guest can later claim an account without changing their participant identity, availability, responsibilities, or ride state.
- Meetings can belong to a reusable group or stand alone.
- Organizers propose multiple dates. Participants answer `available`, `if-needed`, or `unavailable`; unanswered remains distinct.
- Availability ranking is a domain query with an explicit, replaceable policy rather than UI arithmetic.
- Bring items have explicit assignees and state so reminders can be derived from current responsibilities.
- Drivers offer seats and participants request rides.
- Carpool matching maximizes seated passengers and then minimizes route detour while respecting capacity and a configurable detour limit.
- Actual road travel costs come from a `RoutingProvider`; the meeting domain owns matching policy, not routing semantics.

## Architecture

The app starts with a CQRS-style domain boundary:

- `lib/commands.ts` changes meeting state and validates referenced identities/date options/items.
- `lib/queries.ts` derives availability rankings and reminder projections.
- `lib/carpool.ts` owns capacity-constrained assignment and exposes the routing-provider port.
- UI code consumes those operations instead of duplicating meeting rules.

This slice deliberately does not pretend that straight-line distance is road routing. The demo feeds deterministic route-cost fixtures into the same optimizer that a real routing adapter will use.

## Relationship to Event Workboard

`expo/events` remains a private local-first event workboard with explicit snapshot sharing. Meeting Planner is the collaborative scheduler. Any interoperability between them should stay explicit and bounded rather than turning either app into a hidden dependency of the other.

## Next integration slices

1. Hosted meeting persistence and invite tokens with guest-first access and optional account claiming.
2. Real routing adapter for route matrices, privacy-preserving pickup areas, and recalculation when riders/offers change.
3. Notification adapter that derives reminders from confirmed dates, bring responsibilities, and carpool state.
4. Calendar adapter for free/busy input and confirmed-event export without making an external calendar authoritative.

## Local checks

```sh
bun run verify
```
