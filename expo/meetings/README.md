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

The app uses a CQRS-style domain boundary:

- `lib/commands.ts` changes meeting state and validates referenced identities/date options/items.
- `lib/queries.ts` derives availability rankings and reminder projections.
- `lib/carpool.ts` owns capacity-constrained assignment and exposes the routing-provider port.
- `lib/hosted.ts` defines versioned hosted persistence plus server-authoritative invite redemption and guest-to-account claiming.
- `lib/hosted-memory.ts` is a deterministic adapter for tests and the static demo only; it is not presented as collaborative persistence.
- UI code consumes domain operations instead of duplicating meeting rules.

## Hosted collaboration contract

Hosted meeting writes use optimistic versions. A stale client must receive a conflict and reload/reapply its command instead of silently overwriting another participant's change.

Guest access is capability-based:

1. The host creates a high-entropy, expiring invite token for one existing guest participant.
2. Only the token digest is stored; the raw invite secret exists only in the invite link returned to the caller.
3. Redeeming an invite is single-use and returns a separate expiring guest-session secret.
4. Only the guest-session digest is stored.
5. If the guest creates an account, the authenticated host binds that account to the existing participant ID. Availability, bring responsibilities, and ride state therefore remain attached without migration or duplication.
6. A session cannot be rebound to a different account, and guest access stops being accepted after the account claim.

`WebCryptoTokenAuthority` provides 256-bit random secrets and SHA-256 digests. A production host must provide durable implementations of `HostedMeetingStore` and `GuestAccessStore` (transactional database, service API, etc.); choosing a hosting/database vendor is intentionally outside the domain and is not hidden inside the Expo client.

The demo still feeds deterministic route-cost fixtures into the same optimizer that a real routing adapter will use. Straight-line distance is deliberately not substituted for road routing.

## Relationship to Event Workboard

`expo/events` remains a private local-first event workboard with explicit snapshot sharing. Meeting Planner is the collaborative scheduler. Any interoperability between them should stay explicit and bounded rather than turning either app into a hidden dependency of the other.

## Next integration slices

1. Real routing adapter for route matrices, privacy-preserving pickup areas, and recalculation when riders/offers change.
2. Notification adapter that derives reminders from confirmed dates, bring responsibilities, and carpool state.
3. Calendar adapter for free/busy input and confirmed-event export without making an external calendar authoritative.
4. Choose and implement a durable deployment adapter for `HostedMeetingStore` / `GuestAccessStore` once the hosting target is selected.

## Local checks

```sh
bun run verify
```
