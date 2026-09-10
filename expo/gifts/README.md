# Gift Tracker

A private local-first Expo app for remembering gifts across relationships.

## First-slice contract

- keep a small local list of people
- record gifts as received, given, or planned
- store title, date, occasion, and notes on-device
- show upcoming planned gifts in deterministic date order
- let a planned gift explicitly reference a gift that was previously received
- warn when that linked gift would be given back to its original giver

## Boundary

This slice intentionally has no account, backend, contacts permission, camera permission, notification permission, shopping feed, or inferred social graph.

The authoritative regift protection is explicit provenance (`sourceGiftId`), not fuzzy text similarity. Similarity may be advisory later but must not silently rewrite gift history.

The legacy AsyncStorage key is intentionally preserved so repository migration does not strand local history. Store/release scaffolding remains owned by `expo-template`.

## Local checks

```sh
bun run verify
```
